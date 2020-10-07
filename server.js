// Backend logic that connects to database and provides
// the API for the frontend

"use strict";

// Pull-in required modules ///////////////////////////////////////////////////
const fs = require("fs");
const express = require("express");
const passport = require("passport");
const bodyParser = require("body-parser");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const keys = require("./config/keys");
const cors = require("cors");
const morganBody = require("morgan-body");

const serverRouter = require("./api/serverRoutes");
const loginRouter = require("./api/loginRoutes");
const bmrRouter = require("./api/bmrRoutes");
const inventoryRouter = require("./api/inventoryRoutes");
const mongoUtil = require("./mongoUtil");

// Declare the globals ////////////////////////////////////////////////////////
const dbName = "dev";
const dbUrl = "mongodb://localhost:27017";
const dbName = "master";
const dbColl_Servers = "servers";
const dbColl_Users = "users";
const dbColl_Inventory = "componentInventory";
const portNum = 8080;
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://100.80.149.19",
    "http://100.80.150.91",
    "http://100.80.149.97",
  ],
};

// Launch the server ////////////////////////////////////////////////////////////
mongoUtil
  .connectToServer()
  .then((response) => {
    if (response.success) {
      const _db = mongoUtil.getDb();

      // Launch the server //////////////////////////////////////////////////////////
      console.log("Launching the backend server..");

      // Instantiate
      const app = express();
      app.use(cors(corsOptions));
      function getServerInventory(node_ip) {
        return new Promise((resolve, reject) => {
          console.log(`${node_ip} -> getServerInventory function called..`);
          // Execute the Python script to get iDRAC HW inventory
          exec(
            `python get_iDRAC_Inventory.py -ip ${node_ip} -u ${iDracLogin} -p ${iDracPassword} -a y`,
            (err, stdout, stderr) => {
              if (err || stderr) {
                reject({ success: false, message: stderr });
              } else {
                // console.log("Here's the query result: "); //debugging
                // console.log(stdout); //debugging
                resolve({ success: true, message: stdout });
              }
            }
          );
        });
      }

      console.log(`Connected to ${dbName}`);
      function writeToInventoryColl(dbObject, jsonObject) {
        return new Promise((resolve, reject) => {
          dbObject
            .collection(dbColl_Inventory)
            .findOne({ _id: jsonObject.SystemInformation.SKU }, (err, res) => {
              if (err) {
                console.log(err);
              }
              // If an entry with the same service tag is found, update the entry
              if (res !== null) {
                dbObject.collection(dbColl_Inventory).updateOne(
                  { _id: jsonObject.SystemInformation.SKU },
                  {
                    $set: {
                      data: jsonObject,
                    },
                  },
                  (err, res) => {
                    if (err) {
                      reject({
                        success: false,
                        message: "Error on updating record: " + err,
                      });
                    } else {
                      resolve({ success: true, message: "Updated the record." });
                    }
                  }
                );

                // Defining the directory where express will serve the website
                app.use(express.static("public"));
                // If no entry with the same service tag is found, add a new entry
              } else {
                if (!err) {
                  dbObject.collection(dbColl_Inventory).insertOne(
                    {
                      _id: jsonObject.SystemInformation.SKU,
                      data: jsonObject,
                    },
                    { checkKeys: false },
                    (err, res) => {
                      if (err) {
                        reject({
                          success: false,
                          message: "Error on inserting record: " + err,
                        });
                      } else {
                        resolve({ success: true, message: "Inserted new record." });
                      }
                    }
                  );
                }
              }
            });
        });
      }

      // Start the server
      app.listen(portNum, () => {
        console.log(`Server started on port ${portNum}`);
        function getComponentDataArray(dbObject) {
          return new Promise((resolve, reject) => {
            dbObject
              .collection(dbColl_Inventory)
              .find()
              .toArray(function (err, docs) {
                if (err) {
                  reject({
                    success: false,
                    message: "Error in fetching data from component inventory: " + err,
                  });
                } else {
                  resolve({
                    success: true,
                    message: "Successfully fetched data from component inventory",
                    resultArray: docs,
                  });
                }
              });

            // Default reply for home page
            app.get("/", (req, res) => {
              res.sendFile(__dirname + "/index.html");
              /**
               * Performs fetch call to "url", allows "n" retries before returning error
               * @return {Response} response containing data from the url
               */
              const fetch_retry = (url, options, n) =>
                fetch(url, options, {
                  method: "GET",
                }).catch((error) => {
                  if (n === 1) throw error;
                  return fetch_retry(url, options, n - 1);
                });

              /**
               * Updates MongoDB collection with data from iDRAC Redfish API
               * @param {array} idracIps array containing IP addresses of active iDRACs
               */
              async function getRedfishData(idracIps, db) {
                try {
                  // Initialize count of servers being added/updated to db
                  let serverCount = 0;

                  // Iterate through iDRAC IPs
                  idracIps.forEach((item) => {
                    // Declare object that will store the iDRAC's data
                    let redfishDataObject = {};

                    // Define the URLs to be fetched from
                    let v1Url = "https://" + item + "/redfish/v1";
                    let fwUrl = "https://" + item + "/redfish/v1/Managers/iDRAC.Embedded.1";
                    let systemUrl =
                      "https://" + item + "/redfish/v1/Systems/System.Embedded.1";
                    let locationUrl =
                      "https://" +
                      item +
                      "/redfish/v1/Managers/iDRAC.Embedded.1/Attributes?$select=CurrentNIC.*";

                    // Construct options to be used in fetch call
                    const agent = new https.Agent({
                      rejectUnauthorized: false,
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
                          .then((user) => {
                            if (user) {
                              return done(null, user);
                              // Make fetch call on v1 URL
                              fetch_retry(v1Url, options, 3)
                                .then((response) => {
                                  if (response.ok) {
                                    return response.json();
                                  } else {
                                    return Promise.reject(response);
                                  }
                                })
                                .then((v1Data) => {
                                  // Store data from v1 URL in iDRAC data object
                                  redfishDataObject["v1"] = v1Data;

                                  // Make fetch call on firmware URL
                                  return fetch_retry(fwUrl, options, 3);
                                })
                                .then((response) => {
                                  if (response.ok) {
                                    return response.json();
                                  } else {
                                    return Promise.reject(response);
                                  }
                                })
                                .then((fwData) => {
                                  // Store data from fw URL in iDRAC data object
                                  redfishDataObject["fw"] = fwData;

                                  // Make fetch call on systems URL
                                  return fetch_retry(systemUrl, options, 3);
                                })
                                .then((response) => {
                                  if (response.ok) {
                                    return response.json();
                                  } else {
                                    return Promise.reject(response);
                                  }
                                })
                                .then((systemData) => {
                                  // Store data from systems URL in iDRAC data object
                                  redfishDataObject["System"] = systemData;

                                  return fetch_retry(locationUrl, options, 3);
                                })
                                .then((response) => {
                                  if (response.ok) {
                                    return response.json();
                                  } else {
                                    return { error: "No location data available" };
                                  }
                                })
                                .then((locationData) => {
                                  // Store data from codename URL in iDRAC data object
                                  redfishDataObject["Location"] = locationData;

                                  // If no generation was scanned, set generation variable to ""
                                  let systemGeneration = redfishDataObject.System.hasOwnProperty("Oem")
                                    ? redfishDataObject.System.Oem.Dell.DellSystem.SystemGeneration
                                    : "";

                                  // If no location was scanned, set location variable to "--"
                                  let serverLocation = redfishDataObject.Location.hasOwnProperty(
                                    "Attributes"
                                  )
                                    ? `${redfishDataObject.Location.Attributes[
                                      "CurrentNIC.1.DNSRacName"
                                    ].split("-")[1]
                                    }-${redfishDataObject.Location.Attributes[
                                      "CurrentNIC.1.DNSRacName"
                                    ].split("-")[2]
                                    }-${redfishDataObject.Location.Attributes[
                                      "CurrentNIC.1.DNSRacName"
                                    ].split("-")[3]
                                    }`
                                    : "--";

                                  // console.log(serverLocation);

                                  // Add or update collection entry with iDRAC data object
                                  return db
                                    .collection(dbColl_Servers)
                                    .findOne(
                                      { serviceTag: redfishDataObject.System.SKU },
                                      (err, results) => {
                                        if (err) {
                                          return console.log(err);
                                        }
                                        // If an entry with the same service tag is found, update the entry
                                        if (results !== null) {
                                          db.collection(dbColl_Servers).updateOne(
                                            { serviceTag: redfishDataObject.System.SKU },
                                            {
                                              $set: {
                                                ip: item,
                                                serviceTag: redfishDataObject.System.SKU,
                                                firmwareVersion: redfishDataObject.fw.FirmwareVersion,
                                                model: redfishDataObject.System.Model,
                                                hostname: redfishDataObject.System.HostName,
                                                generation: systemGeneration,
                                                location: serverLocation,
                                              },
                                            },
                                            (err) => {
                                              if (err) {
                                                return console.log(err);
                                              }
                                              serverCount++;
                                              console.log(
                                                `Server # ${serverCount} @ ${item} updated in db`
                                              );
                                            }
                                          );
                                          // If no entry with the same service tag is found, add a new entry
                                        } else {
                                          if (!err) {
                                            db.collection(dbColl_Servers).insertOne(
                                              {
                                                ip: item,
                                                serviceTag: redfishDataObject.System.SKU,
                                                firmwareVersion: redfishDataObject.fw.FirmwareVersion,
                                                model: redfishDataObject.System.Model,
                                                hostname: redfishDataObject.System.HostName,
                                                generation: systemGeneration,
                                                location: serverLocation,
                                                status: "available",
                                                timestamp: "",
                                                comments: "",
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
                                        }
                                      }
              return done(null, false);
                                })
                                .catch((err) => console.log(err));
                            })
      );

                    // Initialize passport instance
                    app.use(passport.initialize());

                    // Allow parsing of res.body
                    app.use(
                      bodyParser.urlencoded({
                        extended: true,
                        // Retrieves server(s)' data for specified Service Tags from the database & returns it
                        // as an array of JSON objects
                        function getServersDataByTag(db, stArr) {
                        let result = db
                          .collection(dbColl_Servers)
                          .find({ serviceTag: { $in: stArr } })
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
                            isValid: isEmpty(errors),
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
                            isValid: isEmpty(errors),
                          };
                        }

async function getFactoryBlock() {
                          return new Promise(function (resolve, reject) {
                            let factoryBlock = [];

                            const ps = new Shell({
                              executionPolicy: "Bypass",
                              noProfile: true,
                            });

                            ps.addCommand("./shareDriveAccess.ps1");
                            ps.invoke()
                              .then((output) => {
                                factoryBlock.push(output);
                                console.log(output);
                              })
                              .catch((err) => {
                                console.log(err);
                                ps.dispose();
                              });

                            resolve(factoryBlock);
                          });
                        }

// Launch the server //////////////////////////////////////////////////////////
console.log("Launching the backend server..");

                    // Instantiate
                    const app = express();
                    app.use(cors(corsOptions));

                    // Connect to the database, start the server, query iDRACs via RedFish, and populate db
                    MongoClient.connect(dbUrl, { useUnifiedTopology: true, poolSize: 10 })
                      .then((client) => {
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
                              .then((user) => {
                                if (user) {
                                  return done(null, user);
                                }
                                return done(null, false);
                              })
                              .catch((err) => console.log(err));
                          })
                        );

                        // Initialize passport instance
                        app.use(passport.initialize());

                        // Allow parsing of res.body
                        app.use(
                          bodyParser.urlencoded({
                            extended: true,
                          })
                        );

                        app.use(bodyParser.json());

                        // Log API responses to access.log
                        var accessLogStream = fs.createWriteStream(__dirname + "/access.log", {
                          flags: "a",
                        });
                        morganBody(app, { stream: accessLogStream, noColors: true });

                        // Accept valid login credentials and return a JSON web token
                        app.post("/login", (req, res) => {
                          // Form validation
                          const { errors, isValid } = validateLoginInput(req.body);

                          // Check validation
                          if (!isValid) {
                            return res.status(400).json(Object.assign({ success: false }, errors));
                          }

                          // If user exists and password is correct, return a success token
                          _db
                            .collection(dbColl_Users)
                            .findOne({
                              username: {
                                $regex: new RegExp(
                                  "^" + req.body.username.toLowerCase() + "$",
                                  "i"
                                ),
                              },
                            })
                            .then((user) => {
                              // Check if user exists
                              if (!user) {
                                return res.status(404).json({
                                  success: false,
                                  message: "Username not found",
                                });
                              }

                              // Check password

                              if (req.body.password == user.password) {
                                // User matched
                                // Create JWT Payload
                                const payload = {
                                  id: user.id,
                                  name: user.name,
                                };

                                // Sign token
                                jwt.sign(
                                  payload,
                                  keys.secretOrKey,
                                  {
                                    expiresIn: 31556926, // 1 year in seconds
                                  },
                                  (err, token) => {
                                    res.json({
                                      success: true,
                                      message: "Login is successful",
                                      token: "Bearer " + token,
                                      userInfo: user,
                                    });
                                  }
                                );
                              } else {
                                return res
                                  .status(400)
                                  .json({ success: false, message: "Password incorrect" });
                              }
                            });
                        });

                        // Add new user credentials to users collection and return credentials as JSON
                        app.post("/register", async (req, res) => {
                          // Form validation
                          const { errors, isValid } = validateRegisterInput(req.body);

                          // Check validation
                          if (!isValid) {
                            return res.status(400).json(Object.assign({ success: false }, errors));
                          }

                          try {
                            // Check if email is already in use; if not, create new user record in collection
                            _db
                              .collection(dbColl_Users)
                              .findOne({
                                email: {
                                  $regex: new RegExp("^" + req.body.email.toLowerCase() + "$", "i"),
                                },
                              })
                              .then((user) => {
                                if (user) {
                                  return res
                                    .status(400)
                                    .json({ success: false, message: "Email already exists" });
                                } else {
                                  _db
                                    .collection(dbColl_Users)
                                    .insertOne(
                                      {
                                        name: req.body.name,
                                        email: req.body.email,
                                        username: req.body.username,
                                        password: req.body.password,
                                      },
                                      { checkKeys: false }
                                    )
                                    .then((user) =>
                                      res.json(
                                        Object.assign(
                                          { success: true, message: "Registration is successful" },
                                          user.ops[0]
                                        )
                                      )
                                    )
                                    .catch((err) => console.log(err));
                                  console.log("You're registered! Now login");
                                }
                              });
                          } catch {
                            console.log("There was an error while registering");
                          }
                        });

                        // API endpoint to run bash script that finds live iDRACs on a subnet
                        app.post("/findServers", (req, res) => {
                          console.log("API to scan IPs is called..");
                          // scanSubnet()
                          //   .then((response) => {
                          //     if (response.message === "success") {
                          //       console.log("Scan completed successfully.");
                          //       res.json({
                          //         status: true,
                          //         message: "Scan is complete, file with IPs created.",
                          //       });
                          //       return;
                          //     }
                          //     throw new Error();
                          //   })
                          //   .catch((error) => {
                          //     console.log("Scan failed with error: ", error.message);
                          //     res.json({ status: false, message: error.message });
                          //   });

                          let set_of_ips = fs;
                          ip_scan
                            .findIdracsInIpRange(lab_ip_range)
                            .then((response) => {
                              if (response.success) {
                                set_of_ips.writeFile(
                                  file_idracs,
                                  response.results.idracs.join("\n"),
                                  (err) => {
                                    if (err) {
                                      console.error(`Error writing to file: ${err}`);
                                      return;
                                    }
                                    //file written successfully
                                    console.log(
                                      `Logged: ${response.results.idracs.length} found live iDRACs to "${file_idracs}"`
                                    );
                                  }
                                );
                                set_of_ips.writeFile(
                                  file_others,
                                  response.results.others.join("\n"),
                                  (err) => {
                                    if (err) {
                                      console.error(`Error writing to file: ${err}`);
                                      return;
                                    }
                                    //file written successfully
                                    console.log(
                                      `Logged: ${response.results.others.length} other network devices found to "${file_others}"`
                                    );
                                  }
                                );
                                res.json({
                                  status: true,
                                  message: `Scan is complete: ${response.results.idracs.length} servers were found and logged to "${file_idracs}".`,
                                });
                              } else {
                                console.log(
                                  `findIdracsInIpRange else response: ${response.results}`
                                );
                                // throw new Error();
                              }
                            })
                            .catch((error) => {
                              console.log(`Caught error in findIdracsInIpRange: ${error.results}`);
                              res.json({ status: false, message: error.message });
                            });
                        });

                        // API endpoint that will return server(s)' data for a given array of
                        // Service Tags
                        app.post("/getServersByTag", (req, res) => {
                          console.log("API to get requested servers is called..");
                          // Get array of Service Tags from the request body
                          let theseServiceTags = req.body.ServiceTagArr;
                          console.log(theseServiceTags);

                          // Call function to do the database query for these nodes
                          getServersDataByTag(_db, theseServiceTags)
                            .then((results) => {
                              console.log("Success: data on requested servers sent back.");
                              console.log(results);
                              res.send(results);
                            })
                            .catch((error) => {
                              console.log(
                                `Failure: caught error in getServersDataByTag: ${error.results}`
                              );
                              res.send([]);
                            });
                        });

                        // Make call to iDRAC Redfish API and save the response data in MongoDB collection
                        app.post("/postServers", (req, res) => {
                          res.connection.setTimeout(0);

                          let idracIps = readLDfile(file_idracs);
                          console.log(idracIps);
                          return getRedfishData(idracIps, _db);
                        });

                        // Get collection data from MongoDB and return relevant data
                        app.get("/getServers", (req, res) => {
                          getMongoData(_db).then((results) => {
                            res.send(results);
                          });
                        });

                        // Get status value of server that has specified id
                        app.get("/status/:id", (req, res) => {
                          _db
                            .collection(dbColl_Servers)
                            .findOne(
                              { _id: mongoose.Types.ObjectId(req.params.id) },
                              (err, results) => {
                                if (err) {
                                  res.status(500).json(Object.assign({ success: false }, err));
                                } else {
                                  res.json(
                                    Object.assign(
                                      {
                                        success: true,
                                        message:
                                          "Document with specified _id successfully retrieved",
                                      },
                                      results
                                    )
                                  );
                                }
                              }
                            );
                        });

                        app.patch("/patchStatus/:id", (req, res) => {
                          _db.collection(dbColl_Servers).updateOne(
                            { _id: mongoose.Types.ObjectId(req.params.id) },
                            {
                              $set: {
                                status: req.body.status,
                                timestamp: req.body.timestamp,
                              },
                            },
                            (err, results) => {
                              if (err) {
                                res.status(500).json(Object.assign({ success: false }, err));
                              } else {
                                res
                                  .status(200)
                                  .json(
                                    Object.assign(
                                      { success: true, message: "Status successfully patched" },
                                      results
                                    )
                                  );
                              }
                            }
                          );

                          app.use(bodyParser.json());

                          // Log API responses to access.log
                          var accessLogStream = fs.createWriteStream(__dirname + "/access.log", {
                            flags: "a",
                            // Fetch servers checked out by a specified user
                            app.get("/getUserServers/:name", (req, res) => {
                              _db
                                .collection(dbColl_Servers)
                                .find({ status: req.params.name })
                                .toArray(function (err, servers) {
                                  if (err) {
                                    res.status(500).json({ success: false, message: err });
                                  } else {
                                    // If firmware version is older than 3.21.26.22, exclude server from results
                                    let resultArray = servers.filter(
                                      (server) =>
                                        server.firmwareVersion !== undefined &&
                                        parseInt(server.firmwareVersion.split(".").join("")) >= 3212622
                                    );
                                    // Return array of servers belonging to specified user
                                    res.status(200).json({
                                      success: true,
                                      message: "User servers successfully fetched",
                                      results: resultArray,
                                    });
                                  }
                                });
                            });

                            // Fetch names of all the folders listed for Hypervisor on the XC Night Flyer Share
                            app.get("/getHypervisors", (req, res) => {
                              let source = "/mnt/bmr/FEAR/fip_cfg";

                              const getDirectories = (source) =>
                                readdirSync(source, { withFileTypes: true })
                                  .filter((dirent) => dirent.isDirectory())
                                  .map((dirent) => {
                                    return {
                                      value: dirent.name.match(/\[([^)]+)\]/)[1],
                                      label: dirent.name,
                                    };
                                  });

                              let optionsHypervisor = getDirectories(source);

                              res.status(200).json({
                                success: true,
                                message: "Hypervisors successfully fetched",
                                results: optionsHypervisor,
                              });
                            });

                            // Fetch names of all the folders listed for Factory Block on the XC Night Flyer Share
                            // app.get("/getIsoFiles", (req, res) => {
                            // let source = "";
                            app.get("/getFactoryBlock", (req, res) => {
                              // const myShellScript = exec("sh mapSharedDrive.sh ./");
                              // myShellScript.stdout.on("data", (data) => {
                              //   console.log("success:" + data);
                              // });
                              // myShellScript.stderr.on("data", (data) => {
                              //   console.error(data);
                              // });

                              let source = "/mnt/bmr";

                              const getDirectories = (source) =>
                                readdirSync(source, { withFileTypes: true })
                                  .filter((dirent) => dirent.isDirectory())
                                  .map((dirent) => {
                                    return {
                                      value: dirent.name,
                                      label: dirent.name,
                                    };
                                  });

                              let optionsFactoryBlock = getDirectories(source);

                              res.status(200).json({
                                success: true,
                                message: "Factory Blocks successfully fetched",
                                results: optionsFactoryBlock,
                                // results: optionsFactoryBlock,
                              });
                              morganBody(app, { stream: accessLogStream, noColors: true });

                              // Use API routes
                              app.use(serverRouter);
                              app.use(loginRouter);
                              app.use(bmrRouter);
                              app.use(inventoryRouter);
                              // Fetch names of .iso files from given directory path
                              app.get("/getBmrIso", (req, res) => {
                                let source = "/mnt/bmr";
                                const getIsoFiles = function (dirPath) {
                                  let files = readdirSync(dirPath);
                                  let arrayOfFiles = [];
                                  files.map((name) => {
                                    let extension =
                                      name.endsWith("iso") &&
                                      (name.includes("BMR4") || name.includes("BMR_4"));
                                    if (extension === true) {
                                      arrayOfFiles.push(name);
                                    }
                                  });
                                  return arrayOfFiles.map((fileName) => {
                                    return {
                                      value: fileName,
                                      label: fileName,
                                    };
                                  });
                                };

                                return;
                              }
    throw new Error();
                            })
                              .catch((error) => {
                                console.log("Db connection failed with error: ", error.message);
                              });
