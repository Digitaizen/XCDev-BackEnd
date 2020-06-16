// Backend logic that connects to database and provides
// the API for the frontend

"use strict";

// Pull-in required modules ///////////////////////////////////////////////////
const MongoClient = require("mongodb").MongoClient;
const base64 = require("base-64");
const https = require("https");
const fetch = require("node-fetch");
const fs = require("fs");
const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const keys = require("./config/keys");
const Validator = require("validator");
const isEmpty = require("is-empty");
const async = require("async");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const cors = require("cors");

// Declare the globals ////////////////////////////////////////////////////////
const dbUrl = "mongodb://localhost:27017";
const dbName = "dev";
const dbColl_Servers = "servers";
const dbColl_Users = "users";
const dbColl_Counters = "counters";
const portNum = 8080;
const ipFile = "./active_iDRAC_ips.txt";
const iDracLogin = "root";
const iDracPassword = "calvin";
const corsOptions = {
  origin: ["http://100.80.149.19", "http://100.80.150.91"]
};

// Define functions here //////////////////////////////////////////////////////
// Grab iDRAC IPs from a text file
function readIpFile(fName) {
  let idracIps = fs
    .readFileSync(fName)
    .toString()
    .replace(/\r/g, "")
    .split("\n");
  return idracIps;
}

/**
 * Increases counter variable by 1
 *
 * @return {Number} counter value used as _id in latest servers collection entry
 */
function getNextSequence(db, name, callback) {
  db.collection(dbColl_Counters).findAndModify(
    { _id: name },
    null,
    { $inc: { seq: 1 } },
    function(err, result) {
      if (err) callback(err, result);
      callback(err, result.value.seq);
    }
  );
}

/**
 * Performs fetch call to "url", allows "n" retries before returning error
 * @return {Response} response containing data from the url
 */
const fetch_retry = (url, options, n) =>
  fetch(url, options, {
    method: "GET"
  }).catch(error => {
    if (n === 1) throw error;
    return fetch_retry(url, options, n - 1);
  });

/**
 * Updates MongoDB collection with data from iDRAC Redfish API
 * @param {array} idracIps array containing IP addresses of active iDRACs
 */
async function getRedfishData(idracIps, db) {
  // Initialize count of servers being added/updated to db
  let serverCount = 0;

  // Iterate through iDRAC IPs
  idracIps.forEach(item => {
    // Declare object that will store the iDRAC's data
    let redfishDataObject = {};

    // Define the URLs to be fetched from
    let v1Url = "https://" + item + "/redfish/v1";
    let systemUrl = "https://" + item + "/redfish/v1/Systems/System.Embedded.1";

    // Construct options to be used in fetch call
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    let options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${base64.encode(
          `${iDracLogin}:${iDracPassword}`
        )}`
      },
      agent: agent
    };

    // Make fetch call on v1 URL
    fetch_retry(v1Url, options, 3)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          return Promise.reject(response);
        }
      })
      .then(v1Data => {
        // Store data from v1 URL in iDRAC data object
        redfishDataObject["v1"] = v1Data;

        // Make fetch call on systems URL
        return fetch_retry(systemUrl, options, 3);
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          return Promise.reject(response);
        }
      })
      .then(systemData => {
        // Store data from systems URL in iDRAC data object
        redfishDataObject["System"] = systemData;
        let systemGeneration = redfishDataObject.System.hasOwnProperty("Oem")
          ? redfishDataObject.System.Oem.Dell.DellSystem.SystemGeneration
          : "";

        // Add or update collection entry with iDRAC data object
        return db
          .collection(dbColl_Servers)
          .findOne({ ip: item }, (err, results) => {
            if (err) {
              return console.log(err);
            }
            // If an entry with the same iDRAC IP is found, update the entry
            if (results !== null) {
              db.collection(dbColl_Servers).updateOne(
                { ip: item },
                {
                  $set: {
                    ip: item,
                    serviceTag: redfishDataObject.System.SKU,
                    model: redfishDataObject.System.Model,
                    hostname: redfishDataObject.System.HostName,
                    generation: systemGeneration
                  }
                },
                err => {
                  if (err) {
                    return console.log(err);
                  }
                  serverCount++;
                  console.log(
                    `Server # ${serverCount} @ ${item} updated in db`
                  );
                }
              );
              // If no entry with the same iDRAC IP is found, add a new entry
            } else {
              getNextSequence(db, "serverId", function(err, result) {
                if (!err) {
                  db.collection(dbColl_Servers).insertOne(
                    {
                      _id: result,
                      ip: item,
                      serviceTag: redfishDataObject.System.SKU,
                      model: redfishDataObject.System.Model,
                      hostname: redfishDataObject.System.HostName,
                      generation: systemGeneration,
                      status: "available",
                      timestamp: "",
                      comments: ""
                    },
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
            }
          });
      })
      .catch(error => {
        console.warn(error);
      });
  });
}

/**
 * Retrieves all data from MongoDB collection & returns it as an array
 * @return {array} array of JSON objects, each representing a single iDRAC's data
 */
function getMongoData(db) {
  let result = db
    .collection(dbColl_Servers)
    .find()
    .toArray();
  return result;
}

/**
 * Determines if username and password fields contain valid/non-empty input
 *
 * @param {JSON} data JSON object containing login info submitted by user
 */
function validateLoginInput(data) {
  let errors = {};

  // Convert empty fields to an empty string so we can use validator functions
  data.username = !isEmpty(data.username) ? data.username : "";
  data.password = !isEmpty(data.password) ? data.password : "";

  // Username checks
  if (Validator.isEmpty(data.username)) {
    errors.message = "Username field is required";
  }

  // Password checks
  if (Validator.isEmpty(data.password)) {
    errors.message = "Password field is required";
  }

  return {
    errors,
    isValid: isEmpty(errors)
  };
}

/**
 * Determines if registration fields contain valid/non-empty input
 *
 * @param {JSON} data JSON object containing registration info submitted by user
 */
function validateRegisterInput(data) {
  let errors = {};

  // Convert empty fields to an empty string so we can use validator functions
  data.name = !isEmpty(data.name) ? data.name : "";
  data.email = !isEmpty(data.email) ? data.email : "";
  data.username = !isEmpty(data.username) ? data.username : "";
  data.password = !isEmpty(data.password) ? data.password : "";

  // Name checks
  if (Validator.isEmpty(data.name)) {
    errors.message = "Name field is required";
  }

  // Email checks
  if (Validator.isEmpty(data.email)) {
    errors.message = "Email field is required";
  } else if (!Validator.isEmail(data.email)) {
    errors.message = "Email is invalid";
  }

  // Username checks
  if (Validator.isEmpty(data.username)) {
    errors.message = "Username field is required";
  }

  // Password checks
  if (Validator.isEmpty(data.password)) {
    errors.message = "Password field is required";
  }

  if (!Validator.isLength(data.password, { min: 6, max: 30 })) {
    errors.message = "Password must be at least 6 characters";
  }

  return {
    errors,
    isValid: isEmpty(errors)
  };
}

// Launch the server //////////////////////////////////////////////////////////
console.log("Launching the backend server..");

// Instantiate
const app = express();
app.use(cors(corsOptions));

// Connect to the database, start the server, query iDRACs via RedFish, and populate db
MongoClient.connect(dbUrl, { useUnifiedTopology: true, poolSize: 10 }).then(
  client => {
    const _db = client.db(dbName);
    console.log(`Connected to ${dbName}`);

    // Defining the directory where express will serve the website
    app.use(express.static("public"));

    // Start the server
    app.listen(portNum, () => {
      console.log(`Server started on port ${portNum}`);
    });

    // Default reply for home page
    app.get("/", (req, res) => {
      res.sendFile(__dirname + "/index.html");
    });

    // Define opts for strategy
    const opts = {};
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.secretOrKey = keys.secretOrKey;

    // Define strategy for passport instance
    passport.use(
      new JwtStrategy(opts, (jwt_payload, done) => {
        _db
          .collection(dbColl_Users)
          .findOne({ _id: jwt_payload.id })
          .then(user => {
            if (user) {
              return done(null, user);
            }
            return done(null, false);
          })
          .catch(err => console.log(err));
      })
    );

    // Initialize passport instance
    app.use(passport.initialize());

    // Allow parsing of res.body
    app.use(
      bodyParser.urlencoded({
        extended: true
      })
    );

    app.use(bodyParser.json());

    // Accept valid login credentials and return a JSON web token
    app.post("/login", (req, res) => {
      // Form validation
      const { errors, isValid } = validateLoginInput(req.body);

      // Check validation
      if (!isValid) {
        return res.status(400).json(errors);
      }

      // If user exists and password is correct, return a success token
      _db
        .collection(dbColl_Users)
        .findOne({
          username: {
            $regex: new RegExp("^" + req.body.username.toLowerCase() + "$", "i")
          }
        })
        .then(user => {
          // Check if user exists
          if (!user) {
            return res.status(404).json({ message: "Username not found" });
          }

          // Check password

          if (req.body.password == user.password) {
            // User matched
            // Create JWT Payload
            const payload = {
              id: user.id,
              name: user.name
            };

            // Sign token
            jwt.sign(
              payload,
              keys.secretOrKey,
              {
                expiresIn: 31556926 // 1 year in seconds
              },
              (err, token) => {
                res.json({
                  success: true,
                  token: "Bearer " + token,
                  userInfo: user
                });
              }
            );
          } else {
            return res.status(400).json({ message: "Password incorrect" });
          }
        });
    });

    // Add new user credentials to users collection and return credentials as JSON
    app.post("/register", async (req, res) => {
      // Form validation
      const { errors, isValid } = validateRegisterInput(req.body);

      // Check validation
      if (!isValid) {
        return res.status(400).json(errors);
      }

      try {
        // Check if email is already in use; if not, create new user record in collection
        _db
          .collection(dbColl_Users)
          .findOne({
            email: {
              $regex: new RegExp("^" + req.body.email.toLowerCase() + "$", "i")
            }
          })
          .then(user => {
            if (user) {
              return res.status(400).json({ message: "Email already exists" });
            } else {
              _db
                .collection(dbColl_Users)
                .insertOne(
                  {
                    name: req.body.name,
                    email: req.body.email,
                    username: req.body.username,
                    password: req.body.password
                  },
                  { checkKeys: false }
                )
                .then(user => res.json(user.ops[0]))
                .catch(err => console.log(err));
              console.log("You're registered! Now login");
            }
          });
      } catch {
        console.log("There was an error while registering");
      }
    });

    // Make call to iDRAC Redfish API and save the response data in MongoDB collection
    app.post("/postServers", (req, res) => {
      res.connection.setTimeout(0);

      let idracIps = readIpFile(ipFile);
      console.log(idracIps);
      return getRedfishData(idracIps, _db);
    });

    // Get collection data from MongoDB and return relevant data
    app.get("/getServers", (req, res) => {
      getMongoData(_db).then(results => {
        res.send(results);
      });
    });

    // Get status value of server that has specified id
    app.get("/status/:id", (req, res) => {
      _db
        .collection(dbColl_Servers)
        .findOne({ _id: parseInt(req.params.id) }, (err, results) => {
          if (err) {
            res.status(500).send(err);
          } else {
            res.json(results);
          }
        });
    });

    app.patch("/patchStatus/:id", (req, res) => {
      _db.collection(dbColl_Servers).updateOne(
        { _id: parseInt(req.params.id) },
        {
          $set: {
            status: req.body.status,
            timestamp: req.body.timestamp
          }
        },
        (err, results) => {
          if (err) {
            res.status(500).send(err);
          } else {
            res.status(200).send(results);
          }
        }
      );
    });

    // Patch comments value of server that has specified id
    app.patch("/patchComments/:id", (req, res) => {
      _db.collection(dbColl_Servers).updateOne(
        { _id: parseInt(req.params.id) },
        {
          $set: {
            comments: req.body.comments
          }
        },
        (err, results) => {
          if (err) {
            res.status(500).send(err);
          } else {
            res.status(200).send(results);
          }
        }
      );
    });

    // Reset password of user with specified password-reset token
    app.post("/reset", async (req, res) => {
      _db
        .collection(dbColl_Users)
        .findOne({ username: req.body.username })
        .then(user => {
          // Check if user exists
          if (!user) {
            return res.status(404).json({ message: "Username not found" });
          }

          // Check if password is long enough
          if (!Validator.isLength(req.body.password, { min: 6, max: 30 })) {
            return res
              .status(404)
              .json({ message: "Password must be at least 6 characters" });
          }

          // Check if passwords match
          if (!Validator.equals(req.body.password, req.body.password2)) {
            return res.status(404).json({ message: "Passwords must match" });
          }

          // Update user record with new password
          _db.collection(dbColl_Users).updateOne(
            { username: req.body.username },
            {
              $set: {
                password: req.body.password
              }
            },
            function(err, results) {
              if (err) {
                res.status(500).send(err);
              } else {
                res.status(200).send(results);
              }
            }
          );
        });
    });
  }
);