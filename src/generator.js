const jsf = require("json-schema-faker");
const fs = require('fs');
const jp = require('jsonpath');
const { countReset } = require("console");

class Generator {
  dateFormat = require('dateformat');
  fake = require('faker');
  jp = require('jsonpath');
  outputFile = "./output/genData.json"
  rsourceBlueprints
  generationInstruction
  generatationInstructions = []
  idPrefix = "generated-id-"
  idPaths
  curGenResources = []

  idCounters = {
    Patient: 1,
    Encounter: 1,
    Condition: 1,
    Procedure: 1,
    Observation: 1,
    ServiceRequest: 1,
    DiagnosticReport: 1,
    Speciment: 1,
    MedicationStatement: 1
  }

  unset(){
    return "";
  }

  genNumber(params) {
    return parseFloat(this.fake.finance.amount(params['min'], params['max'], params['precision']))
  }

  genEnum(params) {
    var len = params['options'].length
    var index = this.fake.datatype.number({"max": len - 1})
    return params['options'][index]
  }

  genDate(params) {
    var start = new Date(params['start'])
    var end = new Date(params['end'])
    var format = params['format']
    var randDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    
    if(format != undefined){
      return this.dateFormat(randDate, format)
    } else {
      return this.dateFormat(randDate, "yyyy-mm-dd'T'hh:MM:ss+02:00")
    }
  }

  valueFromEntry(params){
    return params['replaceValue']
  }

  valueFromRessource(params){
    var val = jp.value(this.curGenResources, params['resourcePath'])
    return val
  }

  dateDistanceFromRessource(params){
    var dateVal = jp.value(this.curGenResources, params['resourcePath'])
    var resDate = new Date(dateVal)
    var distPlus = params['distancePlus']
    var distMinus = params['distanceMinus']
  
    var start = new Date()
    start.setTime(resDate.getTime())
    start.setDate(start.getDate() - distMinus)
    var end = new Date()
    end.setTime(resDate.getTime())
    end.setDate(end.getDate() + distPlus)

    var randDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

    return this.dateFormat(randDate, "yyyy-mm-dd'T'hh:MM:ss+02:00")
  }

  initGenerator() {
    let rsourceBlueprintsData = fs.readFileSync('./src/config/resource-blueprints.json')
    let rsourceBlueprints = JSON.parse(rsourceBlueprintsData)
    this.rsourceBlueprints = rsourceBlueprints

    this.idPaths = JSON.parse(fs.readFileSync('./src/config/idpath-config.json'))

    var files = fs.readdirSync('./input/');

    files.forEach(file => {
      console.log(file)
      let generationInstructionData = fs.readFileSync('./input/' + file)
      let generationInstruction = JSON.parse(generationInstructionData)
      this.generatationInstructions.push(generationInstruction)     
    });

    this.sortGenDescBundle()

  }

  sortGenDescBundle(){

    this.generatationInstructions.forEach(element => {

      let tmpGenDesc = []
      var patient = element['Bundle'].filter(obj => {
        return obj['blueprint'] === 'Patient'
      })
  
      var encounter = element['Bundle'].filter(obj => {
        return obj['blueprint'] === 'Encounter'
      })
  
      var rest = element['Bundle'].filter(obj => {
        return (obj['blueprint'] !== 'Patient' && obj['blueprint'] !== 'Encounter')
      })
  
      tmpGenDesc = tmpGenDesc.concat(patient)
      tmpGenDesc = tmpGenDesc.concat(encounter)
      tmpGenDesc = tmpGenDesc.concat(rest)
      element['Bundle'] = tmpGenDesc
      
    });

    


  }

  generateForDesc(curGenerationDesc) {

    var replacements = []

    for (var key in curGenerationDesc) {
      var valueGenDesc = curGenerationDesc[key]
      var replaceVal = null
      var unset = false
      

      if (valueGenDesc['function'] != undefined) {

        if(valueGenDesc['function'] == 'valueFromEntry'){
          var entryValue = replacements.filter(replacement => {
            return replacement['replacePath'] === valueGenDesc['params']['path']
          })[0];
          valueGenDesc['params']['replaceValue'] = entryValue.replaceValue
        }

        if(valueGenDesc['function'] == 'unset'){
          unset = true
        }


        replaceVal = this[valueGenDesc['function']](valueGenDesc['params'])
      } else {
        replaceVal = valueGenDesc
      }

      replacements.push({ "replacePath": key, "replaceValue": replaceVal, "unset": unset })

    }

    return replacements
  }

  createEntryFromResource(resource) {

    var fullUrl = resource['resourceType'] + "/" + resource['id']

    //resource object needs to be deepcopied to avoid changing data later

    var entry = {
      fullUrl: fullUrl,
      resource: resource,
      request: {
        method: "PUT",
        url: fullUrl
      }
    };

    return entry
  }

  setIdsForResource(resource) {

    var resourceType = resource['resourceType']
    this.idCounters[resourceType] = this.idCounters[resourceType] + 1

    this.idPaths[resourceType].forEach(idPath => {
      let idPrefix = idPath['counterName'].toLowerCase().substring(0,3) + "-"
      var generatedId = idPrefix + this.idPrefix + String(this.idCounters[idPath['counterName']])

      if (idPath['refPrefix']!= undefined){
        generatedId = idPath['refPrefix'] + generatedId
      }

      jp.value(resource, idPath['path'], generatedId)
    });
  }


  generateOne(genInst) {

    this.curGenResources = [];

    genInst['Bundle'].forEach(item => {
      //TODO: double check if object is new and resourceBlueprint not overwritten
      var curResource = JSON.parse(JSON.stringify(this.rsourceBlueprints[item['blueprint']]))
      var replacements = this.generateForDesc(item['genDesc'])
      this.setIdsForResource(curResource)

      replacements.forEach(replacement => {

        if(replacement['unset'] == true){
          jp.value(curResource, replacement['replacePath'], undefined)
        } else {
          jp.value(curResource, replacement['replacePath'], replacement['replaceValue'])
        }
      });

      this.curGenResources.push(this.createEntryFromResource(curResource))

    });

    var bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: this.curGenResources
    }

    return bundle
  }


  generate() {

    var n_gen_inst = this.generatationInstructions.length
    var n_gen_inst_processed = 0

    this.generatationInstructions.forEach(genInst => {

      console.log("processed " + n_gen_inst_processed + " generation instructions out of " + n_gen_inst)
      this.idCounters = genInst['idOffsets']
      var nToGenerate = genInst['numberToGenerate']

      let outputFile = './output/' + genInst['name'] + '.ndjson'

      var fileStream = fs.createWriteStream(outputFile, {
        flags: 'a+'
      })

      console.log("Begin generating patients")

      for (var i = 0; i < nToGenerate; i++) {

        var toWrite = JSON.stringify(this.generateOne(genInst)) + "\n"
        fileStream.write(toWrite, function (err) {
          if (err) throw err;
        });
        
        if( (i+1) % 1000 == 0){
          console.log("Generated " , i + 1, " out of " , nToGenerate)
        }

        if(!((i+1) % 1000 == 0) && i == nToGenerate -1){
          console.log("Generated " , i + 1, " out of " , nToGenerate)
        }
      }

      n_gen_inst_processed = n_gen_inst_processed + 1
    });

  }

}

var generator = new Generator();
generator.initGenerator()
generator.generate()
