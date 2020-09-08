// Imports
const express = require("express");
const router = express.Router();
const mongoUtil = require("../mongoUtil");
const base64 = require("base-64");
const https = require("https");
const fetch = require("node-fetch");
const fs = require("fs");

// Global variables
const dbColl_Servers = "servers";
const file_idracs = "IPrangeScan-iDRACs.txt";
const iDracLogin = "root";
const iDracPassword = "calvin";

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
        "/redfish/v1/Managers/System.Embedded.1/Attributes?$select=ServerTopology.*";
      let codeNameUrl =
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

          return fetch_retry(codeNameUrl, options, 3);
        })
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            return { error: "No location data available" };
          }
        })
        .then((codeNameData) => {
          // Store data from codename URL in iDRAC data object
          redfishDataObject["codeName"] = codeNameData;

          // If no generation was scanned, set generation variable to ""
          let systemGeneration = redfishDataObject.System.hasOwnProperty("Oem")
            ? redfishDataObject.System.Oem.Dell.DellSystem.SystemGeneration
            : "";

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

module.exports = router;
