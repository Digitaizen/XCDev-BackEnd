// Imports
const express = require("express");
const router = express.Router();
const mongoUtil = require("../mongoUtil");
const fs = require("fs");
const { readdirSync, statSync } = require("fs");
const bmrValues = "bmr_payload_values.txt";
const bmrIsoProcess = require("../boot_to_BMR");
const { exec, execFile } = require("child_process");

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

// Fetch names of .iso files from given directory path
router.get("/getBmrIso", (req, res) => {
  let source = "/mnt/bmr";

  const getIsoFiles = function (dirPath) {
    let files = readdirSync(dirPath);
    let arrayOfFiles = [];
    files.map((name) => {
      let extension = name.endsWith("iso") && name.includes("BMR3");
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

  // let bmr_payload_values = fs
  //   .readFileSync("bmr_payload_values.txt")
  //   .toString()
  //   .replace(/\r/g, "")
  //   .split("\n");
  // let share_ip = bmr_payload_values[0];
  // let share_name = bmr_payload_values[1];
  // let share_type = bmr_payload_values[2];
  // let bmr_username = bmr_payload_values[3];
  // let bmr_password = bmr_payload_values[4];

  // Get BMR info from a text file
  [share_ip, share_name, share_type, bmr_username, bmr_password] = readLDfile(
    bmrValues
  );

  // Mount BMR ISO
  // AZAT SCRIPTS START
  if (
    ip_arr !== "" &&
    share_ip !== "" &&
    share_name !== "" &&
    share_type !== "" &&
    image_name !== "" &&
    bmr_username !== "" &&
    bmr_password !== ""
  ) {
    bmrIsoProcess
      .mountNetworkImageOnNodes(
        ip_arr,
        share_ip,
        share_type,
        share_name,
        image_name,
        bmr_username,
        bmr_password
      )
      .then((response) => {
        console.log(response.message);
        // If ISO mount successful, make lclog comments with BMR info on each iDRAC
        if (response.success) {
          let lclogs = [];

          // Define calls to lclog comment script for each server
          for (const ipAddress of ip_arr) {
            // Wrap script calls in Promises and store them in 'lclogs' array
            lclogs.push(
              new Promise((resolve, reject) => {
                const myShellScript = exec(
                  `sh bmr-parm.sh ${ipAddress} ${block_name} ${hypervisor_name} ${share_name} ${bmr_username} ${bmr_password}`
                );
                myShellScript.stdout.on("data", (data) => {
                  // console.log(data);
                  resolve({
                    success: true,
                    message: `Created lclog comment for server ${ipAddress} with seq id ${data}`,
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

          // Execute each lclog script call
          Promise.all(lclogs).then((responses) => {
            console.log(responses);

            // After lclog comments finish, reboot each server
            bmrIsoProcess.rebootSelectedNodes(ip_arr).then((response) => {
              console.log(response.message);

              if (response.success) {
                res
                  .status(200)
                  .json({ success: true, message: response.message });
              } else {
                res
                  .status(500)
                  .json({ success: false, message: response.message });
              }
            });
          });
        } else {
          res.status(500).json({ success: false, message: response.message });
        }
      });
  }
});

module.exports = router;
