import os
import requests


for file in os.listdir("largerFhirBundles"):
    if file.endswith(".ndjson"):
        filepath = os.path.join("./largerFhirBundles", file)

        with open(filepath) as fp:
            Lines = fp.readlines()
            print("loading file:" + filepath)
            for line in Lines:

                headers = {'Content-Type': "application/fhir+json"}

                payload = line
                resp = requests.post("http://localhost:8081/fhir", data=line, headers=headers)
                #print(resp.json())
