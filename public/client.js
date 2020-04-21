console.log("Client side code running");

const fetchButton = document.querySelector(".buttonFetch");
const readButton = document.querySelector(".buttonRead");

fetchButton.addEventListener("click", function(e) {
  console.log("Fetch button clicked");

  fetch("/postServers", {
    method: "POST"
  })
    .then(function(response) {
      if (response.ok) {
        console.log("server data added");
        return;
      }
      throw new Error("Request Failed");
    })
    .catch(function(error) {
      console.log(error);
    });
});

readButton.addEventListener("click", function(e) {
  console.log("Read button clicked");

  fetch("/getServers", {
    method: "GET"
  })
    .then(function(response) {
      if (response.ok) {
        console.log("server data retrieved");
        return response.json();
      }
      throw new Error("Request Failed");
    })
    .then(function(data) {
      document.getElementById("results").innerHTML = `${JSON.stringify(data)}`;
    })
    .catch(function(error) {
      console.log(error);
    });
});
