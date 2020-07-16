// Pull-in required modules ///////////////////////////////////////////////////
import { spawn } from 'child_process';

console.log("Client side code running");

// Grab each button via selector //////////////////////////////////////////////
const fetchButton = document.querySelector(".buttonFetch");
const readButton = document.querySelector(".buttonRead");
const scanButton = document.querySelector(".btnRunIPScan");

// Set logic for each of the buttons //////////////////////////////////////////
scanButton.addEventListener("click"), () => {
  console.log("Scan button clicked");

  // Run a bash script to scan subnet for live iDRACs. Linux-only. 
  const process = spawn('bash', ['./find-idracs-on-subnet.sh', '100.80.144.0/21>active_iDRAC_ips.txt']);

  // Output data to console, if directed so
  process.stdout.on('data', data => {
    console.log(data.toString());
  });

  // Now, feed the new IP file to the backend by triggering the fetch button
  fetchButton.click();
};

fetchButton.addEventListener("click", () => {
  console.log("Fetch button clicked");

  fetch("/postServers", {
    method: "POST",
  })
    .then((response) => {
      if (response.ok) {
        console.log("server data added");
        return;
      }
      throw new Error("Request Failed");
    })
    .catch((error) => {
      console.log(error);
    });
});

readButton.addEventListener("click", () => {
  console.log("Read button clicked");

  fetch("/getServers", {
    method: "GET",
  })
    .then((response) => {
      if (response.ok) {
        console.log("server data retrieved");
        return response.json();
      }
      throw new Error("Request Failed");
    })
    .then((data) => {
      data.map((item) => {
        var node = document.createElement("LI");
        var textNode = document.createTextNode(
          String(
            `IP: ${item.ip},\t Service Tag: ${item.serviceTag},\t Model: ${item.model},\t Host Name: ${item.hostname}`
          )
        );
        node.appendChild(textNode);
        document.getElementById("serverList").appendChild(node);
      });
    })
    .catch((error) => {
      console.log(error);
    });
});
