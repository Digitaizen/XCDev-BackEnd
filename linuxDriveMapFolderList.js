const { exec } = require("child_process");
const { readdirSync } = require('fs')

const myShellScript = exec("sh mapSharedDrive.sh ./");
myShellScript.stdout.on("data", (data) => {
  console.log("success:" + data);
});
myShellScript.stderr.on("data", (data) => {
  console.error(data);
});

let source = "/mnt/nightFlyter";

const getDirectories = source =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

console.log(getDirectories(source))
