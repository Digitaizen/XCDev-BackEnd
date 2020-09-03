const Shell = require("node-powershell");

async function getFactoryBlock() {
  return new Promise(function (resolve, reject) {
    let factoryBlock = [];

    const ps = new Shell({
      executionPolicy: "Bypass",
      noProfile: true,
    });

    ps.addCommand("./shareDriveAccess.ps1");
    ps.invoke()
      .then((output) => {
        factoryBlock.push(output);
        console.log(JSON.parse(output));
        resolve(factoryBlock);
        ps.dispose();
      })
      .catch((err) => {
        console.log(err);
        ps.dispose();
      });

    // resolve(factoryBlock);
  });
}

// let factoryBlock = [];
// //initialize a shell instance
// const ps = new Shell({
//   executionPolicy: "Bypass",
//   noProfile: true,
// });

// ps.addCommand("./shareDriveAccess.ps1");
// ps.invoke()
//   .then((output) => {
//     factoryBlock.push(output);
//     // console.log(output);
//   })
//   .catch((err) => {
//     console.log(err);
//     ps.dispose();
//   });

async function start() {
  let factoryBlockOutput = await getFactoryBlock();

  console.log(factoryBlockOutput);
}

// console.log(factoryBlock);
start();
