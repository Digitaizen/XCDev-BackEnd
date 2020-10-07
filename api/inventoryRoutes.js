// Imports
const express = require("express");
const router = express.Router();
const mongoUtil = require("../mongoUtil");
const fs = require("fs");
const { exec, execFile } = require("child_process");

// Global variables
const file_idracs = "IPrangeScan-iDRACs.txt";
const iDracLogin = "root";
const iDracPassword = "calvin";

// Read text file, remove spaces and empty lines, and return an array of text lines
function readLDfile(fName) {
  let linesArr = fs
    .readFileSync(fName)
    .toString()
    .replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "")
    .split("\n");
  return linesArr;
}

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
          resolve({ success: true, message: stdout });
        }
      }
    );
  });
}

function writeToInventoryColl(dbObject, jsonObject) {
  return new Promise((resolve, reject) => {
    dbObject
      .collection("inventory")
      .findOne({ serviceTag: jsonObject.SystemInformation.SKU }, (err, res) => {
        if (err) {
          console.log(err);
        }
        // If an entry with the same service tag is found, update the entry
        if (res !== null) {
          dbObject.collection("inventory").updateOne(
            { serviceTag: jsonObject.SystemInformation.SKU },
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

          // If no entry with the same service tag is found, add a new entry
        } else {
          if (!err) {
            dbObject.collection("inventory").insertOne(
              {
                serviceTag: jsonObject.SystemInformation.SKU,
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

function getComponentDataArray(dbObject) {
  return new Promise((resolve, reject) => {
    dbObject
      .collection("inventory")
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
  });
}

// **Component Inventory API Endpoint START**
router.post("/hardwareInventoryToDb", (req, res) => {
  let msg = "";
  let countPass = 0;
  let countFail = 0;
  let allQueries = [];
  let queryPass = [];
  let queryFail = [];

  let _db = mongoUtil.getDb();

  //Load the iDRAC IP list from a text file
  let idracIps = readLDfile(file_idracs);

  //Loop through each iDRAC and get its inventory, then save it to db
  idracIps.forEach((node_ip) => {
    allQueries.push(
      getServerInventory(node_ip)
        .then((response) => {
          if (response.success) {
            countPass += 1;
            //Collect IPs of those iDRACs that returned data
            queryPass.push(node_ip);
            msg = `${node_ip} -> Inventory call completed successfully. `;
            //Get the string and parse it into JSON
            let jsonData = JSON.parse(response.message);

            //Call function to write query results to db
            writeToInventoryColl(_db, jsonData)
              .then((response) => {
                if (response.success) {
                  msg += `Write to db was successful.`;
                  console.log(msg);
                } else {
                  msg += `Write to db failed.`;
                  console.log(msg);
                }
              })
              .catch((error) => {
                console.log(
                  `${node_ip} -> CATCH on writeToInventoryColl: ${error.statusText}`
                );
              });
          } else {
            countFail += 1;
            //Collect IPs of those iDRACs that did not return data
            queryFail.push(node_ip);
            msg += `Inventory call on ${node_ip} failed.`;
            console.log(msg);
            throw new Error();
          }
        })
        .catch((error) => {
          //Collect IPs of those iDRACs that failed query
          queryFail.push(node_ip);
          console.log(
            `${node_ip} -> CATCH on getServerInventory: ${error.statusText}`
          );
          // res.json({ success: false, message: error.statusText, results: error.message });
        })
    );
  });
  Promise.all(allQueries)
    .then(() => {
      console.log("All queries have been executed!");
      res.json({
        success: countPass > 0 ? true : false,
        message: `Out of ${idracIps.length} servers queried, ${countPass} passed and ${countFail} failed. `,
        results: { passed: queryPass, failed: queryFail },
      });
    })
    .catch((error) => {
      console.log("Catch in Promise.all: " + error);
    });
});
// **Component Inventory API Endpoint END**

// **Fetch Component Inventory API Endpoint START**
router.get("/getHardwareInventory", (req, res) => {
  let _db = mongoUtil.getDb();
  getComponentDataArray(_db).then((response) => {
    if (response.success) {
      console.log(response.message);
      res.status(200).json({
        success: true,
        message: response.message,
        resultArray: response.resultArray,
      });
    } else {
      res.status(500).json({ success: false, message: response.message });
    }
  });
});
// **Fetch Component Inventory API Endpoint END**

module.exports = router;
