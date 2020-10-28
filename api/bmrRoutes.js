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

// Global variables
const dbColl_Servers = "servers";

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
  let image_name = req.body.selectedBmrIsoOption;
  let block_name = req.body.selectedFactoryBlockOption;
  let hypervisor_name = req.body.selectedHypervisorOption;

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
        bmrIsoProcess.insertVmCdOnNodes(ip_arr, image_path)
          .then((response) => {
            console.log(response.message);
            // If ISO mount successful, make lcLog comments with BMR info on each iDRAC
            if (response.success) {
              let lcLogs = [];

              // Define calls to lcLog comment script for each server
              for (const ipAddress of ip_arr) {
                // Wrap script calls in Promises and store them in 'lcLogs' array
                lcLogs.push(
                  new Promise((resolve, reject) => {
                    const myShellScript = exec(
                      `sh bmr-parm.sh ${ipAddress} ${block_name} ${hypervisor_name} ${share_name} ${bmr_username} ${bmr_password}`
                    );
                    myShellScript.stdout.on("data", (data) => {
                      // console.log(data);
                      resolve({
                        success: true,
                        message: `Created lcLog comment for server ${ipAddress} with seq id ${data}`,
                      });
                    });
                    myShellScript.stderr.on("data", (data) => {
                      // console.error(data);
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
                  ip_arr.forEach(idrac_ip => {
                    bmrIsoProcess.setNextOneTimeBootVirtualMediaDevice(idrac_ip)
                      .then(response => {
                        console.log(`setNextOneTimeBootVirtualMediaDevice result for ${idrac_ip} is: ${response.message}`);
                        if (response.success) {
                          setBootCounter++;
                          // If all selected nodes are set to boot proceed to the next step of rebooting them
                          if (setBootCounter == ip_arr.length) {
                            if (ip_arr.length == 1)
                              console.log(`---"${idrac_ip}" has been successfuly set to boot from the inserted VM-CD.---`); //debugging
                            else
                              console.log(`---"${idrac_ip}" have been successfuly set to boot from the inserted VM-CD.---`); //debugging
                            
                            // Now, reboot all the nodes
                            bmrIsoProcess.rebootSelectedNodes(ip_arr)
                              .then((response) => {
                                console.log(response.message);

                                if (response.success) {
                                  res
                                    .status(200)
                                    .json({ success: true, message: response.message });
                                } else {
                                  res
                                    .status(500)
                                    .json({ success: false, message: response.message });
                                };
                              })
                              .catch(error => {
                                console.log(`CATCH in rebootSelectedNodes: ${error.message}`);
                                res
                                  .status(500)
                                  .json({ success: false, message: response.message });
                              });
                          };                                                  
                        } else {
                          // console.log(`Failure in setNextOneTimeBootVirtualMediaDevice on ${idrac_ip}: ${response.message}`);
                          res
                            .status(500)
                            .json({ success: false, message: response.message });
                        };
                      })
                      .catch(error => {
                        console.log(`CATCH in setNextOneTimeBootVirtualMediaDevice on ${idrac_ip}: ${error.message}`);
                        res
                          .status(500)
                          .json({ success: false, message: response.message });
                      });
                  });            
                })
                .catch(error => {
                  console.log(`CATCH in PromiseAll lcLogs: ${error.message}`);
                  res
                    .status(500)
                    .json({ success: false, message: error.message });
                })
            } else {
              console.log(`Failure in insertVmCdOnNodes: ${response.message}`);
              res
                .status(500)
                .json({ success: false, message: response.message });
            }
          })
          .catch(error => {
            console.log(`CATCH in bmrRoutes on insertVmCdOnNodes: ${error.message}`);
            res
              .status(500)
              .json({ success: false, message: error.message });
          })
      } else {
        console.log(`Missing one or more BMR values.`);
        res
          .status(500)
          .json({ success: false, message: `FAIL: Missing one or more BMR values.` });
      }
});

module.exports = router;
