"use strict";

console.log("Server side code running");

// Loading the required modules for node
const fetch = require("node-fetch");
const base64 = require("base-64");
const https = require("https");
const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const app = express();

// Defining the directory where express will serve the website
app.use(express.static("public"));

// Local monogodb database session
const url = "mongodb://localhost:27017";
let db;

// Establish mongoclient and start the server on port 8080
MongoClient.connect(url, { useUnifiedTopology: true }, function(err, client) {
  console.log("Connected successfully to server");
  db = client.db("nodeExpressMongo");

  app.listen(8080, (req, res) => {
    console.log("listening on 8080");
  });
});

// Default reply for home page
// app.get("/", (req, res) => {
//   res.sendFile(__dirname + "/index.html");
// });

// Make public API call to jsonPlaceholder for users and save the response data in database

//   db.collection("users").deleteMany({});
// });

// List of hard-coded iDRAC IPs for testing
let idracIps = ["100.80.146.100", "100.80.146.97"];

// Iterate through iDRAC IPs
idracIps.forEach(function(item, index) {
  let emptyObject = {};
  // Define the inputs for a fetch call
  let idracUrl = "https://" + item + "/redfish/v1";
  let anotherUrl = "https://" + item + "/redfish/v1/Systems/System.Embedded.1";

  let key1 = "v1";
  let key2 = "System";

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

  // Make fetch call
  fetch(idracUrl, options, {
    method: "GET"
  })
    .then(function(response) {
      if (response.ok) {
        return response.json();
      } else {
        return Promise.reject(response);
      }
    })
    .then(function(v1Data) {
      emptyObject[key1] = v1Data;

      return fetch(anotherUrl, options, {
        method: "GET"
      });
    })
    .then(function(response) {
      if (response.ok) {
        return response.json();
      } else {
        return Promise.reject(response);
      }
    })
    .then(function(systemData) {
      emptyObject[key2] = systemData;

      return db.collection("servers").findOne({ ip: item }, (err, results) => {
        if (err) {
          return console.log(err);
        }
        // Update old collection entry if a match is found
        if (results !== null) {
          db.collection("servers").updateOne(
            { ip: item },
            { $set: { ip: item, data: emptyObject } },
            (err, res) => {
              if (err) {
                return console.log(err);
              }
              console.log("Server updated in db");
            }
          );
          // Add new collection entry if no match is found
        } else {
          db.collection("servers").insertOne(
            { ip: item, data: emptyObject },
            (err, res) => {
              if (err) {
                return console.log(err);
              }
              console.log("Server added to db");
            }
          );
        }
        // console.log("v1 object: ", emptyObject.v1);
        // console.log("System object: ", emptyObject.System);
      });
    })
    .catch(function(error) {
      console.warn(error);
    });
});
