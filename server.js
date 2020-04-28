"use strict";

console.log("Server side code running");

// Loading the required modules for node
const fetch = require("node-fetch");
const base64 = require("base-64");
const https = require("https");
const express = require("express");
const mongoUtil = require("./mongoUtil");
const fs = require("fs");
const readline = require("readline");
const app = express();

// Global MongoDB database variable
let db;
let serverCount;

// Establish connection to local MongoDB server
mongoUtil.connectToServer(function(err, client) {
  if (err) console.log(err);
  // Assign database access to global variable
  db = mongoUtil.getDb();
});

/**
 * Performs fetch call to "url", allows "n" retries before returning error
 *
 * @return {Response} response containing data from the url
 */
const fetch_retry = (url, options, n) =>
  fetch(url, options, {
    method: "GET"
  }).catch(function(error) {
    if (n === 1) throw error;
    return fetch_retry(url, options, n - 1);
  });

/**
 * Reads from text file containing IP addresses of active iDRACs and stores them in an array
 *
 * @return {array} array containing the IP addresses of active iDRACs
 */
async function readIpTextFile() {
  // Connect stream to text file
  const fileStream = fs.createReadStream(
    "C:/Users/Administrator/Documents/Bitbucket/xcwebappback/active_iDRAC_ips.txt"
  );
  // Declare empty array
  let idracIps = [];

  // Define interface for reading from stream
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Wait for each line in the text file to be read
  for await (const line of rl) {
    idracIps.push(line);
  }

  return idracIps;
}

/**
 * Updates MongoDB collection with data from iDRAC Redfish API
 *
 * @param {array} idracIps array containing IP addresses of active iDRACs
 */
async function getRedfishData(idracIps) {
  // Initialize count of servers being added/updated to db
  serverCount = 0;

  // Iterate through iDRAC IPs
  idracIps.forEach(function(item, index) {
    // Declare object that will store the iDRAC's data
    let redfishDataObject = {};

    // Define the URLs to be fetched from
    let v1Url = "https://" + item + "/redfish/v1";
    let systemUrl = "https://" + item + "/redfish/v1/Systems/System.Embedded.1";

    // Define keys that will reference specific iDRAC data
    let v1Key = "v1";
    let systemKey = "System";

    // Construct options to be used in fetch call
    let login = "root";
    let password = "calvin";
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    let options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${base64.encode(`${login}:${password}`)}`
      },
      agent: agent
    };

    // Make fetch call on v1 URL
    fetch_retry(v1Url, options, 3)
      .then(function(response) {
        if (response.ok) {
          return response.json();
        } else {
          return Promise.reject(response);
        }
      })
      .then(function(v1Data) {
        // Store data from v1 URL in iDRAC data object
        redfishDataObject[v1Key] = v1Data;

        // Make fetch call on systems URL
        return fetch_retry(systemUrl, options, 3);
      })
      .then(function(response) {
        if (response.ok) {
          return response.json();
        } else {
          return Promise.reject(response);
        }
      })
      .then(function(systemData) {
        // Store data from systems URL in iDRAC data object
        redfishDataObject[systemKey] = systemData;

        // Add or update collection entry with iDRAC data object
        return db
          .collection("servers")
          .findOne({ ip: item }, (err, results) => {
            if (err) {
              return console.log(err);
            }
            // If an entry with the same iDRAC IP is found, update the entry
            if (results !== null) {
              db.collection("servers").updateOne(
                { ip: item },
                { $set: { ip: item, data: redfishDataObject } },
                (err, res) => {
                  if (err) {
                    return console.log(err);
                  }
                  serverCount++;
                  console.log("Server updated in db");
                  console.log("Server #", serverCount);
                }
              );
              // If no entry with the same iDRAC IP is found, add a new entry
            } else {
              db.collection("servers").insertOne(
                { ip: item, data: redfishDataObject },
                { checkKeys: false },
                (err, res) => {
                  if (err) {
                    return console.log(err);
                  }
                  serverCount++;
                  console.log("Server added to db");
                  console.log("Server #", serverCount);
                }
              );
            }
          });
      })
      .catch(function(error) {
        console.warn(error);
      });
  });
}

/**
 * Retrieves all data from MongoDB collection & returns it as an array
 *
 * @return {array} array of JSON objects, each representing a single iDRAC's data
 */
async function getMongoData() {
  let result = await db
    .collection("servers")
    .find()
    .toArray();

  return result;
}

// Defining the directory where express will serve the website
app.use(express.static("public"));

// Start the server on port 8080
app.listen(8080, (req, res) => {
  console.log("listening on 8080");
});

// Default reply for home page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Make call to iDRAC Redfish API and save the response data in MongoDB collection
app.post("/postServers", (req, res) => {
  res.connection.setTimeout(0);

  return readIpTextFile().then(function(idracIps) {
    return getRedfishData(idracIps);
  });
});

// Get collection data from MongoDB and return relevant data
app.get("/getServers", (req, res) => {
  getMongoData().then(function(results) {
    // Print array to console
    // console.log(JSON.stringify(results, null, 2));

    // Extract relevant data using map()
    results = results.map(item => {
      return {
        Ip: item.ip,
        ServiceTag: item.data.System.SKU,
        Model: item.data.System.Model,
        HostName: item.data.System.HostName
      };
    });

    // return results;
    res.send(results);
  });
});
