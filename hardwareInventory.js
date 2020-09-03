var axios = require("axios");
const https = require("https");

const username = "root";
const password = "calvin";

const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");

const agent = new https.Agent({
  rejectUnauthorized: false,
});

let config = {
  method: "get",
  url: "https://100.80.144.152/redfish/v1/Systems/System.Embedded.1/Bios",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${token} `,
  },
  httpsAgent: agent,
};

axios(config)
  .then(function (response) {
    // console.log(JSON.stringify(response.data, null, 2));
    console.log(response.data);
  })
  .catch(function (error) {
    console.log(error);
  });
