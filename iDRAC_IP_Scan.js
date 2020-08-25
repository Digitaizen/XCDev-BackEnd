// Module with a function to scan a range of IPs to discover live iDRACs
// Example of calling this function: findIdracsInIpRange('100.80.144.0-100.80.148.255') 
// The output: two arrays within an object in the response, one with IPs of live iDRACs 
// found and another one with IPs of other network devices found in the given range.

// Pull-in required libraries ---------------------------------------------------------------------
const https = require("https");
const base64 = require("base-64");
const fetch = require("node-fetch");
const { response } = require("express");
const getIPRange = require("get-ip-range");
const fs = require("fs");
const { retry } = require("async");
const { count } = require("console");
const { performance } = require('perf_hooks');

// Declare global variables -----------------------------------------------------------------------
let set_of_ips = fs;
let file_idracs = "IPrangeScan-iDRACs.txt";
let file_others = "IPrangeScan-Others.txt";

// Define module's functions ----------------------------------------------------------------------
function checkForIdracURL(node_ip) {
  return new Promise((resolve, reject) => {
    // console.log("checkForIdracURL function called for ", node_ip); //debugging

    // Build URL string to fetch to the query
    let url = `https://${node_ip}/restgui/start.html`;

    // Construct options to be used in fetch call
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    let options = {
      method: "GET",
      headers: {},
      agent: agent
    };

    // Make fetch call on the URL to check if it exists
    fetch(url, options)
      .then((response) => {
        if (response.ok) {
          console.log(`PASS - Fetch passed on ${node_ip}: ${response.statusText}`);
          resolve({
            success: true,
            message: `${node_ip}` //is an iDRAC
          });
        } else {
          reject({
            success: false,
            message: `${node_ip}` //is NOT an iDRAC
          });
        }
      })
      .catch(error => {
        console.log(`FAIL - Fetch failed: ${error.message}`);
        reject({
          success: false,
          message: `${node_ip}` //took too long to answer or some other network device
        });
      });
  });
};

// Call this function from the module to find iDRACs in your IP range
function findIdracsInIpRange(ip_range) {
  return new Promise((resolve, reject) => {
    let allQueries = [];
    let live_idracs = [];
    let other_devices = [];

    // Generate an array of IPs from the provided range
    const ipv4Range = getIPRange(ip_range);

    // Loop through the array of IPs and find live iDRACs
    for (node_ip of ipv4Range) {
      // console.log(`Queueing checkForIdracURL in Promise.all array for: ${node_ip}`); //debugging
      allQueries.push(
        checkForIdracURL(node_ip)
          .then(response => {
            if (response.success)
              live_idracs.push(response.message);
            else
              other_devices.push(response.message);
          })
          .catch((error) => {
            other_devices.push(error.message);
          })
        // Debugging
        // .then(() => {
        //   console.log(live_idracs.length + ", " + live_idracs);
        //   console.log(other_devices.length + ", " + other_devices);
        // })
      );
    }

    // Run all queries and wait till all of them finish
    console.log("---Launching all queries...---")
    Promise.all(allQueries)
      .then(() => {
        console.log("---All done!---");
        resolve({ success: true, results: { idracs: live_idracs, others: other_devices } });
      })
      .catch(error => {
        console.log("Catch in Promise.all: " + error);
        reject({ success: false, results: error });
      })
      // Debugging
      .then(() => {
        console.log(`iDRACs found: ${live_idracs.length}, their IPs: ${live_idracs}`);
        console.log(`Other network devices: ${other_devices.length}, their IPs: ${other_devices}`);
      })
  });
}

// Testing.. --------------------------------------------------------------------------------------
let t0 = performance.now(); // Get the first timer value for the function run
findIdracsInIpRange('100.80.144.0-100.80.148.255')
  .then(response => {
    if (response.success) {
      set_of_ips.writeFile(file_idracs, response.results.idracs.join('\n'), err => {
        if (err) {
          console.error(`Error writing to file: ${err}`);
          return;
        }
        //file written successfully
        console.log(`Logged: ${response.results.idracs.length} found live iDRACs to "${file_idracs}"`);
      });
      set_of_ips.writeFile(file_others, response.results.others.join('\n'), err => {
        if (err) {
          console.error(`Error writing to file: ${err}`);
          return;
        }
        //file written successfully
        console.log(`Logged: ${response.results.others.length} other network devices found to "${file_others}"`);
      });
    } else {
      console.log(`findIdracsInIpRange else response: ${response.results}`);
    }
  })
  .catch(error => {
    console.log(`Caught error in findIdracsInIpRange: ${error.results}`);
  })
  .then(() => {
    let t1 = performance.now(); // Get the second timer value at function's end
    console.log("Call to findIdracsInIpRange took " + ((t1 - t0) / 1000) + " seconds."); // Calculate and output the function's run time
  })
  .catch(error => {
    console.log("Error in measuring performance: " + error)
  });

// Expose module's function(s) to the outside
module.exports = { findIdracsInIpRange };
