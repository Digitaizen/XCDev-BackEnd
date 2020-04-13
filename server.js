"use strict";

console.log("Server side code running");

// Loading the required modules for node
const fetch = require("node-fetch");
const base64 = require("base-64");
const https = require("https");
const express = require("express");
const app = express();

// Defining the directory where express will serve the website
app.use(express.static("public"));

// Local monogodb database session
let db;

async function dbConnection() {
  const MongoClient = require("mongodb").MongoClient;
  const url = "mongodb://localhost:27017";

  // Establish mongoclient and start the server on port 8080
  const mongoConnect = await MongoClient.connect(
    url,
    { useUnifiedTopology: true }
    // function(err, client) {
    //   console.log("Connected successfully to server");
    //   db = client.db("nodeExpressMongo");
    //   app.listen(8080, (req, res) => {
    //     console.log("listening on 8080");
    //   });
    // }
  );

  db = mongoConnect.db("nodeExpressMongo");
  // const result = await db
  //   .collection("servers")
  //   .find()
  //   .toArray();
  // return result;
}

// console.log("line 34", db);

// Default reply for home page
// app.get("/", (req, res) => {
//   res.sendFile(__dirname + "/index.html");
// });

// Make public API call to jsonPlaceholder for users and save the response data in database

//   db.collection("users").deleteMany({});
// });

// List of hard-coded iDRAC IPs for testing

function testFunction() {
  // Local monogodb database session
  // const url = "mongodb://localhost:27017";
  // let db;

  // // Establish mongoclient and start the server on port 8080
  // MongoClient.connect(url, { useUnifiedTopology: true }, function(err, client) {
  //   console.log("Connected successfully to server");
  //   db = client.db("nodeExpressMongo");

  //   app.listen(8080, (req, res) => {
  //     console.log("listening on 8080");
  //   });
  // });

  let idracIps = ["100.80.146.94", "100.80.146.97", "100.80.146.100"];

  // Iterate through iDRAC IPs
  idracIps.forEach(function(item, index) {
    let redfishDataObject = {};
    // Define the inputs for a fetch call
    let v1Url = "https://" + item + "/redfish/v1";
    let systemUrl = "https://" + item + "/redfish/v1/Systems/System.Embedded.1";

    let v1Key = "v1";
    let systemKey = "System";

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
    fetch(v1Url, options, {
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
        redfishDataObject[v1Key] = v1Data;

        return fetch(systemUrl, options, {
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
        redfishDataObject[systemKey] = systemData;
        redfishDataObject = JSON.stringify(redfishDataObject);

        return db
          .collection("servers")
          .findOne({ ip: item }, (err, results) => {
            if (err) {
              return console.log(err);
            }
            // Update old collection entry if a match is found
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
              // Add new collection entry if no match is found
            } else {
              db.collection("servers").insertOne(
                { ip: item, data: redfishDataObject },
                (err, res) => {
                  if (err) {
                    return console.log(err);
                  }
                  console.log("Server added to db");
                }
              );
            }
            // console.log("v1 object: ", redfishDataObject.v1);
            // console.log("System object: ", redfishDataObject.System);
          });
      })
      .catch(function(error) {
        console.warn(error);
      });
  });
}

async function getAllData() {
  const res = await dbConnection();

  let result = await db
    .collection("servers")
    .find()
    .toArray();

  let reformattedResult = result.map(obj => {
    obj.data = JSON.parse(obj.data);
    return obj;
  });

  return reformattedResult;

  // return res;

  // console.log(db);
  // Local monogodb database session
  // const url = "mongodb://localhost:27017";
  // let db;

  // // Establish mongoclient and start the server on port 8080
  // MongoClient.connect(url, { useUnifiedTopology: true }, function(err, client) {
  //   console.log("Connected successfully to server");
  //   db = client.db("nodeExpressMongo");

  //   app.listen(8080, (req, res) => {
  //     console.log("listening on 8080");
  //   });
  // });

  // return db
  //   .collection("servers")
  //   .find()
  //   .toArray(function(err, result) {
  //     if (err) throw err;
  //     return result;
  //   });
}

testFunction();
// setTimeout(function() {
//   console.log(getAllData());
// }, 10000);
getAllData().then(function(results) {
  console.log(results);
});
// console.log(results);
