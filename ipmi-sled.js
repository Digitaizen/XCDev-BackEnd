// Module to get a server's sled/blade slot position 
// via IPMI call for raw data
const { exec } = require('child_process');

function getSlotPosition(ip) {
    const userName = "root";
    const userPass = "calvin";
    const serverType = new Set([22, 32, 42]);
    const errMsg = "NOT_SUPPORTED";
    let sysType = "";
    let sysSled = "";

    try {
        console.log(`Quering iDRAC @${ip} via IPMI call for system type..`);
        exec(`ipmitool  -I lanplus -H ${ip} -U ${userName} -P ${userPass} raw  0x06 0x59 0x00 0xDD 0x02 0x00`, (err, stdout, stderr) => {
            if (err || stderr) {
                // Debugging, some error occurred
                console.error(err);
                console.log(`1st query, stderr: ${stderr}`);

                return errMsg;
            } else if (stdout) {
                // Debugging, the *entire* stdout (buffered)
                console.log(`1st query, stdout, raw string: ${stdout}`);

                // Parse the raw output and get the 11th byte that indicates the system type
                sysType = parseInt(stdout.split(' ')[11]);

                console.log("System Type num is: ", sysType);

                // Execute further query if the system has mutliple blades		
                if (serverType.has(sysType)) {
                    console.log("Now quering for its blade slot position..");
                    exec(`ipmitool  -I lanplus -H ${ip} -U ${userName} -P ${userPass} raw 0x30 0x12`, (err, stdout, stderr) => {
                        if (err || stderr) {
                            // Debugging, some error occurred
                            console.error(err);
                            console.log(`2nd query, stderr: ${stderr}`);

                            return errMsg;
                        } else {
                            // Debugging, the *entire* stdout (buffered)
                            console.log(`2nd query, stdout, raw string: ${stdout}`);

                            // Get the 10th byte that has the slot position info
                            sysSled = stdout.split(' ')[10];
                            console.log(`Blade Slot num is: ${sysSled}`);

                            return sysSled;
                        }
                    });
                } else {
                    // Debugging 
                    console.log('This system sled info is not supported');

                    return errMsg;
                }
            }
        });
    } catch (err) {
        // Debugging 
        console.log("Error: ", err);

        return "error";
    }
}
