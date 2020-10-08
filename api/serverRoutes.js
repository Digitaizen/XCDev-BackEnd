// Imports
const express = require("express");
const router = express.Router();
const mongoUtil = require("../mongoUtil");
const base64 = require("base-64");
const https = require("https");
const fetch = require("node-fetch");
const fs = require("fs");
const ip_scan = require("../iDRAC_IP_Scan");
const mongoose = require("mongoose");

// Global variables
const dbColl_Servers = "servers";
const lab_ip_range = "100.80.144.0-100.80.144.25";
const file_idracs = "IPrangeScan-iDRACs.txt";
const file_others = "IPrangeScan-Others.txt";
const iDracLogin = "root";
const iDracPassword = "calvin";

/**
 * Retrieves all data from MongoDB collection & returns it as an array
 * @return {array} array of JSON objects, each representing a single iDRAC's data
 */
function getMongoData(db) {
  let result = db.collection(dbColl_Servers).find().toArray();
  return result;
}

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

function readLDfile(fName) {
  let linesArr = fs
    .readFileSync(fName)
    .toString()
    .replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "")
    .split("\n");
  return linesArr;
}

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

      let options = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${base64.encode(
            `${iDracLogin}:${iDracPassword}`
          )}`,
        },
        agent: agent,
      };

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
            ? `${
                redfishDataObject.Location.Attributes[
                  "CurrentNIC.1.DNSRacName"
                ].split("-")[1]
              }-${
                redfishDataObject.Location.Attributes[
                  "CurrentNIC.1.DNSRacName"
                ].split("-")[2]
              }-${
                redfishDataObject.Location.Attributes[
                  "CurrentNIC.1.DNSRacName"
                ].split("-")[3]
              }`
            : "--";

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
            );
        })
        .catch((error) => {
          console.warn(error);
        });
    });
  } catch (error) {
    console.warn("ERROR in getRedfishData: ", error);
  }
}

// Make call to iDRAC Redfish API and save the response data in MongoDB collection
router.post("/postServers", (req, res) => {
  res.connection.setTimeout(0);

  let idracIps = readLDfile(file_idracs);
  console.log(idracIps);

  let _db = mongoUtil.getDb();

  return getRedfishData(idracIps, _db);
});

// Get collection data from MongoDB and return relevant data
router.get("/getServers", (req, res) => {
  let _db = mongoUtil.getDb();

  getMongoData(_db).then((results) => {
    res.send(results);
  });
});

router.post("/findServers", (req, res) => {
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
        console.log(`findIdracsInIpRange else response: ${response.results}`);
        // throw new Error();
      }
    })
    .catch((error) => {
      console.log(`Caught error in findIdracsInIpRange: ${error.results}`);
      res.json({ status: false, message: error.message });
    });
});

// Get status value of server that has specified id
router.get("/status/:id", (req, res) => {
  let _db = mongoUtil.getDb();

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
                message: "Document with specified _id successfully retrieved",
              },
              results
            )
          );
        }
      }
    );
});

// Patch status value of server that has specified id
router.patch("/patchStatus/:id", (req, res) => {
  let _db = mongoUtil.getDb();

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
});

// Patch comments value of server that has specified id
router.patch("/patchComments/:id", (req, res) => {
  let _db = mongoUtil.getDb();

  _db.collection(dbColl_Servers).updateOne(
    { _id: mongoose.Types.ObjectId(req.params.id) },
    {
      $set: {
        comments: req.body.comments,
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
              { success: true, message: "Comment successfully patched" },
              results
            )
          );
      }
    }
  );
});

module.exports = router;
