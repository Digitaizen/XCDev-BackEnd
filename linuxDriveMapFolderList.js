const readdirp = require("readdirp");

const myShellScript = exec("sh mapSharedDrive.sh ./");
myShellScript.stdout.on("data", (data) => {
  console.log("success:" + data);
  //   optionsIsoFiles.push(data);
  // do whatever you want here with data
});
myShellScript.stderr.on("data", (data) => {
  console.error(data);
});

let path = "/mnt/nightFlyter";
// Define settings for readdirp
// var settings = {
//   // Only search for files with '.iso' extension
//   fileFilter: "*.iso",
// };

// Declare array to hold .iso filenames
var isoFilePaths = [];

// Declare success and message variables for response
let successValue = null;
let messageValue = null;

//   Iterate recursively through given path
//   readdirp(req.body.path, settings)
readdirp(path, settings)
  .on("data", function (entry) {
    // Push .iso filename to array
    isoFilePaths.push(entry);
  })
  .on("warn", function (warn) {
    // Set success to false and message to warning
    console.log("Warning: ", warn);
    successValue = false;
    messageValue = warn;
  })
  .on("error", function (err) {
    // Set success to false and message to error
    console.log("Error: ", err);
    successValue = false;
    messageValue = err;
  })
  .on("end", function (err) {
    // If success is false, send warning/error response
    if (successValue == false) {
      res.status(500).json({
        success: false,
        message: messageValue,
      });
      // Else, send response with array of .iso filenames
    } else {
      var optionsIsoFile = isoFilePaths.map((isoFilepath) => {
        return {
          value: isoFilepath.basename,
          label: isoFilepath.basename,
        };
      });
    }
  });
