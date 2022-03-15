var http = require('http');
const fs = require('fs');
const lReader = require('readline');
var path = require('path');
const lineByLine = require('n-readlines');

var myArgs = process.argv.slice(2);

var counter = 0;


callback = function(response) {
  var str = ''
  response.on('data', function (chunk) {
    str += chunk;
  });

  response.on('end', function () {
    counter--;
    console.log(response.statusCode)
    console.log(str)
  });
}


function loadData(){


    var auth = "Basic " + new Buffer(myArgs[3] + ":" + myArgs[4]).toString("base64");

    var header = {
      'Content-Type': 'application/json'
    }

    if(myArgs[3] != undefined){
      header['Authorization'] = auth
    }


    var options = {
        host: myArgs[0],
        port: myArgs[1],
        path: myArgs[2],
        method: 'GET',
        headers: header
      };

    
    var req = http.request(options, callback);
    console.log(req)   
    req.end();
}

loadData()
