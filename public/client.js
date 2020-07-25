console.log("Client side code running");

// Grab each button via selector //////////////////////////////////////////////
const fetchButton = document.querySelector(".buttonFetch");
const readButton = document.querySelector(".buttonRead");
const scanButton = document.querySelector(".btnRunIPScan");

// Set logic for each of the buttons //////////////////////////////////////////
scanButton.addEventListener("click", () => {
  console.log("Scan button clicked");
  let resultMsg = "";

  fetch("/findServers", {
    method: "POST",
  })
    .then((response) => {
      if (response.ok) {
        console.log("Now updating the database..");
        // Now, feed the new IP file to the backend by triggering the fetch button
        fetchButton.click();
        resultMsg = "Scan complete, database updated."
        return;
      }
      resultMsg = "Scan request failed.";
      throw new Error(resultMsg);
    })
    .then(() => {
      // Output results of the request to the browser window
      let node = document.createElement("li");
      let textNode = document.createTextNode(resultMsg, node);
      node.appendChild(textNode);
      document.getElementById("serverList").appendChild(node);
    })
    .catch((error) => {
      console.log(error);
    });
});

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
