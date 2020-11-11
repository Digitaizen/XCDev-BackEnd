// Imports
const express = require("express");
const router = express.Router();
const mongoUtil = require("../mongoUtil");
const fs = require("fs");
const { readdirSync, statSync } = require("fs");
const bmrValues = "bmr_payload_values.txt";
const bmrIsoProcess = require("../boot_to_BMR");
const { exec, execFile } = require("child_process");
const Shell = require("node-powershell");
const { search } = require("./serverRoutes");

// Global variables
const dbColl_Servers = "servers";

// Write new data to a specific entry based on service tag
function writeToCollection(
  dbObject,
  collectionName,
  searchKey,
  searchValue,
  dataObject
) {
  let searchObject = {};
  searchObject[searchKey] = searchValue;

  return new Promise((resolve, reject) => {
    dbObject.collection(collectionName).findOne(searchObject, (err, res) => {
      if (err) {
        console.log(err);
      }
      // If an entry matches the search query, update the entry
      if (res !== null) {
        dbObject.collection(collectionName).updateOne(
          searchObject,
          {
            $set: dataObject,
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
        // If no entry matches the search query, add a new entry
      } else {
        if (!err) {
          // Add search key and value to data being inserted
          dataObject[searchKey] = searchValue;

          dbObject
            .collection(collectionName)
            .insertOne(dataObject, { checkKeys: false }, (err, res) => {
              if (err) {
                reject({
                  success: false,
                  message: "Error on inserting record: " + err,
                });
              } else {
                resolve({ success: true, message: "Inserted new record." });
              }
            });
        }
      }
    });
  });
}

// Read text file, remove spaces and empty lines, and return an array of text lines
function readLDfile(fName) {
  let linesArr = fs
    .readFileSync(fName)
    .toString()
    .replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "")
    .split("\n");
  return linesArr;
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

// Fetch servers checked out by a specified user
router.get("/getUserServers/:name", (req, res) => {
  let _db = mongoUtil.getDb();

  _db
    .collection(dbColl_Servers)
    .find({ status: req.params.name })
    .toArray(function (err, servers) {
      if (err) {
        res.status(500).json({ success: false, message: err });
      } else {
        // If firmware version is older than 4.00.00.00, exclude server from results
        let resultArray = servers.filter(
          (server) =>
            server.firmwareVersion !== undefined &&
            parseInt(server.firmwareVersion.split(".").join("")) >= 4000000
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

// Fetch names of all the folders listed for Factory Block on the XC Night Flyer Share
// app.get("/getIsoFiles", (req, res) => {
// let source = "";
router.get("/getFactoryBlock", (req, res) => {
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
});

// Fetch names of all the folders listed for Hypervisor on the XC Night Flyer Share
router.get("/getHypervisors", (req, res) => {
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

// Fetch names of .iso files from given directory path
router.get("/getBmrIso", (req, res) => {
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

  console.log("SOURCE IS: " + source);
  let optionsIsoFile = getIsoFiles(source);

  res.status(200).json({
    success: true,
    message: "ISO file paths successfully fetched",
    results: optionsIsoFile,
  });
});

// Getting data from Front-END and passing it to the BMR Process Scripts
router.post("/bmrFactoryImaging", (req, res) => {
  console.log(req.body);

  // Define bmr payload values for mounting network image
  let ip_arr = req.body.selectedRowData.map((server) => {
    return server.ip;
  });
  let server_object_arr = req.body.selectedRowData.map((server) => {
    return { ip: server.ip, serviceTag: server.serviceTag };
  });
  let image_name = req.body.selectedBmrIsoOption;
  let block_name = req.body.selectedFactoryBlockOption;
  let hypervisor_name = req.body.selectedHypervisorOption;

  let _db = mongoUtil.getDb();

  // Get BMR info from a text file
  [share_name, bmr_username, bmr_password, share_path] = readLDfile(bmrValues);

  let image_path = `${share_path}${image_name}`;
  console.log("Here is the image path:", image_path);

  // Mount BMR ISO
  // AZAT SCRIPTS START
  if (
    ip_arr !== "" &&
    share_name !== "" &&
    image_name !== "" &&
    bmr_username !== "" &&
    bmr_password !== "" &&
    share_path !== ""
  ) {
    bmrIsoProcess
      .insertVmCdOnNodes(ip_arr, image_path)
      .then((response) => {
        console.log(response.message);
        // If ISO mount successful, make lcLog comments with BMR info on each iDRAC
        if (response.success) {
          let mountUpdates = [];

          // Update BMR status in servers collection
          server_object_arr.forEach((server) => {
            mountUpdates.push(
              new Promise((resolve, reject) => {
                writeToCollection(
                  _db,
                  dbColl_Servers,
                  "serviceTag",
                  server.serviceTag,
                  {
                    bmrStatus: `ISO mount successful for server ${server.ip}`,
                  }
                )
                  .then((response) => {
                    if (response.success) {
                      resolve({
                        success: true,
                        message: `ISO mount successful for server ${server.ip}`,
                      });
                    } else {
                      reject({
                        success: false,
                        message: `BMR Status failed to update for ${server.ip}`,
                      });
                    }
                  })
                  .catch((error) => {
                    console.log(
                      `CATCH on mount update writeToCollection: ${error.statusText}`
                    );
                  });
              })
            );
          });

          // Execute each BMR status update query
          Promise.all(mountUpdates)
            .then((responses) => {
              console.log(responses);

              let lcLogs = [];

              // Define calls to lcLog comment script for each server
              for (const server of server_object_arr) {
                // Wrap script calls in Promises and store them in 'lcLogs' array
                lcLogs.push(
                  new Promise((resolve, reject) => {
                    const myShellScript = exec(
                      `sh bmr-parm.sh ${server.ip} ${block_name} ${hypervisor_name} ${share_name} ${bmr_username} ${bmr_password}`
                    );
                    myShellScript.stdout.on("data", (data) => {
                      // Update BMR status in servers collection
                      writeToCollection(
                        _db,
                        dbColl_Servers,
                        "serviceTag",
                        server.serviceTag,
                        {
                          bmrStatus: `Created lcLog comment for server ${server.ip} with seq id ${data}`,
                        }
                      )
                        .then((response) => {
                          if (response.success) {
                            resolve({
                              success: true,
                              message: `Created lcLog comment for server ${server.ip} with seq id ${data}`,
                            });
                          } else {
                            reject({
                              success: false,
                              message: `BMR Status failed to update for ${server.ip}`,
                            });
                          }
                        })
                        .catch((error) => {
                          console.log(
                            `CATCH on lclog writeToCollection: ${error.statusText}`
                          );
                        });
                    });
                    myShellScript.stderr.on("data", (data) => {
                      reject({
                        success: false,
                        message: data,
                      });
                    });
                  })
                );
              }

              // Execute each lcLog script call
              Promise.all(lcLogs)
                .then((responses) => {
                  console.log(responses);

                  // After lcLog comments finish, loop through all selected nodes and set them to boot once from the VM-CD.
                  let setBootCounter = 0;
                  server_object_arr.forEach((server) => {
                    bmrIsoProcess
                      .setNextOneTimeBootVirtualMediaDevice(server.ip)
                      .then((response) => {
                        console.log(
                          `setNextOneTimeBootVirtualMediaDevice result for ${server.ip} is: ${response.message}`
                        );
                        if (response.success) {
                          // Update BMR status in servers collection
                          writeToCollection(
                            _db,
                            dbColl_Servers,
                            "serviceTag",
                            server.serviceTag,
                            {
                              bmrStatus: `Set next boot VM for server ${server.ip}`,
                            }
                          )
                            .then((response) => {
                              if (response.success) {
                                setBootCounter++;
                                // If all selected nodes are set to boot proceed to the next step of rebooting them
                                if (setBootCounter == ip_arr.length) {
                                  if (ip_arr.length == 1)
                                    console.log(
                                      `---"${server.ip}" has been successfuly set to boot from the inserted VM-CD.---`
                                    );
                                  //debugging
                                  else
                                    console.log(
                                      `---"${ip_arr}" have been successfuly set to boot from the inserted VM-CD.---`
                                    ); //debugging

                                  // Now, reboot all the nodes
                                  bmrIsoProcess
                                    .rebootSelectedNodes(ip_arr)
                                    .then((response) => {
                                      console.log(response.message);

                                      if (response.success) {
                                        res.status(200).json({
                                          success: true,
                                          message: response.message,
                                        });
                                      } else {
                                        res.status(500).json({
                                          success: false,
                                          message: response.message,
                                        });
                                      }
                                    })
                                    .catch((error) => {
                                      console.log(
                                        `CATCH in rebootSelectedNodes: ${error.message}`
                                      );
                                      res.status(500).json({
                                        success: false,
                                        message: response.message,
                                      });
                                    });
                                }
                              } else {
                                console.log(
                                  `BMR Status failed to update for ${server.ip}`
                                );
                                res.status(500).json({
                                  success: false,
                                  message: response.message,
                                });
                              }
                            })
                            .catch((error) => {
                              console.log(
                                `CATCH on set boot VM writeToCollection: ${error.statusText}`
                              );
                              res.status(500).json({
                                success: false,
                                message: error.statusText,
                              });
                            });
                        } else {
                          res.status(500).json({
                            success: false,
                            message: response.message,
                          });
                        }
                      })
                      .catch((error) => {
                        console.log(
                          `CATCH in setNextOneTimeBootVirtualMediaDevice on ${server.ip}: ${error.message}`
                        );
                        res
                          .status(500)
                          .json({ success: false, message: response.message });
                      });
                  });
                })
                .catch((error) => {
                  console.log(`CATCH in PromiseAll lcLogs: ${error.message}`);
                  res
                    .status(500)
                    .json({ success: false, message: error.message });
                });
            })
            .catch((error) => {
              console.log(
                `CATCH in PromiseAll mount updates: ${error.message}`
              );
              res.status(500).json({ success: false, message: error.message });
            });
        } else {
          console.log(`Failure in insertVmCdOnNodes: ${response.message}`);
          res.status(500).json({ success: false, message: response.message });
        }
      })
      .catch((error) => {
        console.log(
          `CATCH in bmrRoutes on insertVmCdOnNodes: ${error.message}`
        );
        res.status(500).json({ success: false, message: error.message });
      });
  } else {
    console.log(`Missing one or more BMR values.`);
    res.status(500).json({
      success: false,
      message: `FAIL: Missing one or more BMR values.`,
    });
  }
});

module.exports = router;
