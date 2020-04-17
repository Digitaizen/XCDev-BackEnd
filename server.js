"use strict";

console.log("Server side code running");

// Loading the required modules for node
const fetch = require("node-fetch");
const base64 = require("base-64");
const https = require("https");
const express = require("express");
// const MongoClient = require("mongodb").MongoClient;
const mongoUtil = require("./mongoUtil");
const app = express();

// Defining the directory where express will serve the website
app.use(express.static("public"));

// Local monogodb database session
// const url = "mongodb://localhost:27017";
let db;

// Establish mongoclient and start the server on port 8080
// MongoClient.connect(url, { useUnifiedTopology: true }, function(err, client) {
//   console.log("Connected successfully to server");
//   db = client.db("nodeExpressMongo");

//   app.listen(8080, (req, res) => {
//     console.log("listening on 8080");
//   });
// });

mongoUtil.connectToServer(function(err, client) {
  if (err) console.log(err);
  db = mongoUtil.getDb();
});

const fetch_retry = (url, options, n) =>
  fetch(url, options, {
    method: "GET"
  }).catch(function(error) {
    if (n === 1) throw error;
    return fetch_retry(url, options, n - 1);
  });

app.listen(8080, (req, res) => {
  console.log("listening on 8080");
});

// async function dbConnection() {
//   const MongoClient = require("mongodb").MongoClient;
//   const url = "mongodb://localhost:27017";

//   // Establish mongoclient and start the server on port 8080
//   const mongoConnect = await MongoClient.connect(url, {
//     useUnifiedTopology: true
//   });

//   // Defines global db variable to be nodeExpressMongo collection
//   db = mongoConnect.db("nodeExpressMongo");
// }

async function getRedfishData() {
  // Wait for connection to MongoDB server to be made
  // const res = await dbConnection();

  // List of hard-coded iDRAC IPs for testing
  let idracIps = ["100.80.146.94", "100.80.146.97", "100.80.146.100"];

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
                  console.log("Server updated in db");
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
                  console.log("Server added to db");
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

async function getMongoData() {
  // Wait for connection to MongoDB server to be made
  // const res = await dbConnection();

  let result = await db
    .collection("servers")
    .find()
    .toArray();

  return result;
}

// Default reply for home page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Make public API call to jsonPlaceholder for users and save the response data in database
app.post("/postServers", (req, res) => {
  return getRedfishData();
});

app.get("/getServers", (req, res) => {
  getMongoData().then(function(results) {
    // Print array to console
    console.log(results);

    // Demonstrate array parsing by printing 1 iDRAC's redfish version
    console.log(
      "Here's 100.80.146.97's redfish version: ",
      results[0].data.v1.RedfishVersion
    );

    return results;
  });
});
