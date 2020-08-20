const { exec } = require("child_process");
// const myShellScript = exec("sh mapSharedDrive.sh ./");
// myShellScript.stdout.on("data", (data) => {
//   console.log(data);
//   // do whatever you want here with data
// });
// myShellScript.stderr.on("data", (data) => {
//   console.error(data);
// });

const myPowerShellScript = exec("shareDriveAccess.ps1 ./");
myPowerShellScript.stdout.on("data", (data) => {
  console.log(data);
  // do whatever you want here with data
});
myPowerShellScript.stderr.on("data", (data) => {
  console.error(data);
});

var os = require("os");
console.log(os.platform()); // 'darwin'
console.log(os.release()); //'10.8.0'
