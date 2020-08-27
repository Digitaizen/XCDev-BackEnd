console.log("Client side code running");

// Grab each button via selector //////////////////////////////////////////////
const fetchButton = document.querySelector(".buttonFetch");
const readButton = document.querySelector(".buttonRead");
const scanButton = document.querySelector(".btnRunIPScan");
const hwInventoryButton = document.querySelector(".buttonHwInventory");

// Function to display result of a query in the browser window
function displayResult(result) {
  let node = document.createElement("li");
  let textNode = document.createTextNode(result, node);
  node.appendChild(textNode);
  document.getElementById("serverList").appendChild(node);
}

hwInventoryButton.addEventListener("click", () => {
  fetch("/hardwareInventoryToDb", {
    method: "POST",
  })
    .then((response) => response.json())
    .then((response) => {
      if (response.success) {
        console.log(response.message);
      } else {
        resultMsg =
          "Hardware inventory request failed. Details: " + response.message;
        throw new Error(resultMsg);
      }
    });
});

// Set logic for each of the buttons //////////////////////////////////////////
scanButton.addEventListener("click", () => {
  console.log("Scan button clicked, calling API..");
  let resultMsg = "";
  // Notify user about wait-time in the browser window
  displayResult(
    "Scan initiated. Please, wait as it can take approximately 3+ minutes to complete, unless there's a failure."
  );

  fetch("/findServers", {
    method: "POST",
  })
    .then((response) => response.json())
    .then((response) => {
      console.log("Back from API call, response.status is:", response.status);
      if (response.status) {
        console.log("Now updating the database..");
        // Now, feed the new IP file to the backend by triggering the fetch button
        fetchButton.click();
        resultMsg = response.message;
        // Output results of the request to the browser window
        displayResult(resultMsg);
        return;
      } else {
        resultMsg = "Scan request failed. Details: " + response.message;
        throw new Error(resultMsg);
      }
    })
    .catch((error) => {
      console.log(error);
      // Output results of the request to the browser window
      displayResult(error);
    });
});

// Set logic for each of the buttons //////////////////////////////////////////
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
