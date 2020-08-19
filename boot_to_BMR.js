// Module to mount BMR image and boot into it

// Pull-in required libraries >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const { exec } = require('child_process'); // use it to launch external scripts
const https = require("https");
const base64 = require("base-64");
const fetch = require("node-fetch");
const { resolve } = require('path');

// Declare variables >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const idrac_username = "root";
const idrac_password = "calvin";
let concrete_job_uri = "";

// Define functions >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
function checkRedfishSupport(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("checkRedfishSupport function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            agent: agent
        };

        // Make fetch call on the URL to check if it exists
        fetch(url, options)
            .then(response => {
                if (response.ok) {
                    resolve({ success: true, message: `${node_ip}'s OEM Boot to ISO via Redfish is supported` });
                } else {
                    reject({ success: false, message: `${node_ip}'s OEM Boot to ISO via Redfish is NOT supported` });
                }
            });
    });
}

function checkAttachStatus(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("checkAttachStatus function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.GetAttachStatus";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify({}),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            .then(response => response.json())
            .then(data => {
                resolve({ success: true, message: data["ISOAttachStatus"] });
            })
            .catch(err => {
                console.error(err);
                reject({ success: false, message: `FAIL: Check of Attach Status on ${node_ip} failed: ${err}` });
            });
    });
}

function connectNetworkIsoImage(node_ip, share_ip, share_type, share_name, image_name, user_name, user_pass) {
    return new Promise((resolve, reject) => {
        console.log("connectNetworkIsoImage function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.ConnectNetworkISOImage";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        const payload = {
            IPAddress: share_ip,
            ShareName: share_name,
            ShareType: share_type,
            ImageName: image_name,
            UserName: user_name,
            Password: user_pass
        };

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify(payload),
            agent: agent
        };

        // Display the payload
        console.log(`\n- WARNING, arguments and values used to connect network ISO image for ${node_ip}:`);
        console.log(payload);

        // Make fetch call on the URL
        fetch(url, options)
            .then(response => {
                if (response.ok) {
                    resolve({ success: true, message: `PASS: POST command passed to ${node_ip} to connect Network ISO image, status code 200 returned` });
                } else {
                    reject({ success: false, message: `FAIL: POST command failed on ${node_ip} to connect Network ISO image, status code is ${response.status} and error message is ${response.statusText}` });
                }
            });
    });
}

function disconnectNetworkIsoImage(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("disconnectNetworkIsoImage function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.DisconnectNetworkISOImage";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify({}),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            .then(response => {
                if (response.ok) {
                    resolve({ success: true, message: `PASS: POST command passed to ${node_ip} to detach Network ISO image, status code 200 returned` });
                } else {
                    reject({ success: false, message: `FAIL: POST command failed on ${node_ip} to detach Network ISO image, status code is ${response.status} and error message is ${response.statusText}` });
                }
            });
    });
}

function resetSystemForceRestart(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("resetSystemForceRestart function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Systems/System.Embedded.1/Actions/ComputerSystem.Reset";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify({ "ResetType": "ForceRestart" }),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            .then(response => {
                if (response.ok) {
                    resolve({ success: true, message: `PASS: POST command passed to reboot ${node_ip}, status code 200 returned` });
                } else {
                    reject({ success: false, message: `FAIL: POST command failed to reboot ${node_ip}, status code is ${response.status} and error message is ${response.statusText}` });
                }
            });
    })
}

function mountImageViaRacadm(imgPath) {
    try {
        // console.log(`Mounting the image via RACADM`);
        // exec(`racadm remoteimage -c -U ${userName} -P ${userPass} -l '${imgPath}'`, (err, stdout, stderr) => {
        //     if (err || stderr) {
        //         // Debugging, some error occurred
        //         console.error(err);
        //         console.log(`, stderr: ${stderr}`);
        //         errMsg = "Error on image mount.";
        //         return errMsg + stderr;
        //     } else {
        //         exec(`racadm `);
        //         return;
        //     }
        // });

    } catch (err) {
        // Debugging 
        console.log("Error: ", err);

        return "error";
    }
}

// WIP..
function bootToNetworkIso(node_ip, share_type, share_name, image_name, user_name, user_pass, workgroup) {
    return new Promise((resolve, reject) => {
        console.log("bootToNetworkIso function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.BootToNetworkISO";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        const payload = {
            IPAddress: node_ip,
            ShareName: share_name,
            ShareType: share_type,
            ImageName: image_name,
            UserName: user_name,
            Password: user_pass,
            Workgroup: workgroup
        };

        let options = {
            method: "BootToNetworkISO",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify(payload),
            agent: agent
        };

        // Display what is being used
        console.log(`\n- WARNING, arguments and values used to ${method} on network share`);
        console.log(payload);

        // Make fetch call on the URL
        fetch(url, options)
            .then(response => {
                if (response.status === 202) {
                    response => response.json()
                        .then(data => {
                            concrete_job_uri = data.headers["Location"];
                            resolve({ success: true, message: "booting" });
                        })
                }
                else {

                }
            })

            .catch(err => {
                console.error(err);
                reject({ success: false, message: err });
            });


    })
}

function detachNetworkIso(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("detachNetworkIso function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.DetachISOImage";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify({}),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            // .then(response => response.json())
            .then(response => {
                if (response.ok) {
                    resolve({ success: true, message: "PASS: POST command passed to detach ISO image, status code 200 returned" });
                } else {
                    reject({ success: false, message: `FAIL: POST command failed to detach ISO image, status code is ${response.status} and error message is ${response.statusText}` });
                }
            });
    });
}

function insertVirtualMediaCD(node_ip, img_path) {
    return new Promise((resolve, reject) => {
        console.log("insertVirtualMediaCD function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query; for CD in this case
        let url = "https://" + node_ip + "/redfish/v1/Managers/iDRAC.Embedded.1/VirtualMedia/CD/Actions/VirtualMedia.InsertMedia";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify({ "Image": img_path, "Inserted": true, "WriteProtected": true }),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            .then(response => {
                if (response.status != 204) {
                    reject({ success: false, message: `FAIL: POST command failed to insert ${img_path}, error message is ${response.statusText}` });
                } else {
                    resolve({ success: true, message: `PASS: POST command passed to insert ${img_path}, status code 200 returned` });
                }
            });
    });
}

function ejectVirtualMediaCD(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("ejectVirtualMediaCD function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Managers/iDRAC.Embedded.1/VirtualMedia/CD/Actions/VirtualMedia.EjectMedia";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            body: JSON.stringify({}),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            // .then(response => console.log(response))
            .then(response => {
                if (response.status != 204) {
                    reject({ success: false, message: `FAIL: POST command failed to eject Virtual Media, error message is ${response.statusText}` });
                } else {
                    resolve({ success: true, message: "PASS: POST command passed to eject Virtual Media, status code 200 returned" });
                }
            })
            .catch(err => {
                console.error(err);
                reject({ message: err });
            });
    });
}

function checkVirtualMediaCdStatus(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("checkVirtualMediaCdStatus function called for ", node_ip);   //debugging

        // Build URL string to fetch to the query
        let url = "https://" + node_ip + "/redfish/v1/Managers/iDRAC.Embedded.1/VirtualMedia/CD";

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64.encode(
                    `${idrac_username}:${idrac_password}`
                )}`
            },
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            .then(response => response.json())
            .then(data => {
                resolve({ success: data["Inserted"], message: `CD Virtual Media Inserted status for ${node_ip} is: ${data["Inserted"]}` });
            })
            .catch(err => {
                console.error(err);
                reject({ success: false, message: `FAIL: CD Virtual Media Inserted status request for ${node_ip} failed: ${err}` });
            });
    });
}


// WIP. Call this function with an array of IPs and image props to mount ISO image from a share on them. If any of the
// functions fail, it will as well. 
function mountNetworkImageOnNodes(idrac_ips, share_ip, share_type, share_name, image_name, user_name, user_pass) {
    return new Promise((resolve, reject) => {
        let mountedCounter = 0;

        idrac_ips.forEach(idrac_ip => {
            checkRedfishSupport(idrac_ip)
                .then(response => {
                    console.log(`checkRedfishSupport result: ${response.message}`);
                    if (response.success) {
                        checkAttachStatus(idrac_ip)
                            .then(response => {
                                console.log(`checkAttachStatus result: ${response.message}`);
                                if (response.message === "Attached") {
                                    disconnectNetworkIsoImage(idrac_ip)
                                        .then(response => {
                                            console.log(`disconnectNetworkIsoImage result: ${response.message}`);
                                            if (response.success) {
                                                connectNetworkIsoImage(idrac_ip, share_ip, share_type, share_name, image_name, user_name, user_pass)
                                                    .then(response => {
                                                        console.log(`connectNetworkIsoImage result: ${response.message}`);
                                                        if (response.success) {
                                                            mountedCounter++;
                                                            if (mountedCounter == idrac_ips.length) {
                                                                resolve({ success: true, message: response.message })
                                                            }
                                                        } else {
                                                            reject({ success: false, message: response.message });
                                                        }
                                                    })
                                            } else {
                                                reject({ success: false, message: response.message });
                                            }
                                        })
                                }
                                else {
                                    connectNetworkIsoImage(idrac_ip, share_ip, share_type, share_name, image_name, user_name, user_pass)
                                        .then(response => {
                                            console.log(`connectNetworkIsoImage result: ${response.message}`);
                                            if (response.success) {
                                                mountedCounter++;
                                                if (mountedCounter == idrac_ips.length) {
                                                    resolve({ success: true, message: response.message })
                                                }
                                            } else {
                                                reject({ success: false, message: response.message });
                                            }
                                        })
                                }
                            })
                            .catch(error => {
                                console.log(`FAIL: checkAttachStatus for ${idrac_ip} failed: ${error.message}`);
                                reject({ success: false, message: `FAIL: checkAttachStatus for ${idrac_ip} failed: ${error.message}` });
                            })

                    } else {
                        reject({ success: false, message: `iDRAC version installed on ${idrac_ip} does not support OEM boot via Redfish` });
                    }
                })
                .catch(error => {
                    console.log(`FAIL: checkRedfishSupport for ${idrac_ip} failed: ${error.message}`);
                    reject({ success: false, message: `FAIL: checkRedfishSupport for ${idrac_ip} failed: ${error.message}` });
                });
        })
    })
}


// Run main/test module's functions >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Array with two iDRAC IPs, one w/new fw w/support for RF and another without
// // const ip_arr = ["100.80.144.128", "100.80.148.61"]
// const ip_arr = ["100.80.144.128"];
// let share_ip = "10.211.4.215";
// let share_type = "CIFS";
// let share_name = "Nightflyer/_14G/BMR.ISO";
// let image_name = "BMR_DELL_120319.iso";
// let user_name = "nutanix_admin";
// let user_pass = "raid4us!";

// ip_arr.forEach(idrac_ip => {
//     checkRedfishSupport(idrac_ip)
//         .then(response => {
//             console.log(`checkRedfishSupport result: ${response.message}`);
//             if (response.success === true) {
//                 checkVirtualMediaCdStatus(idrac_ip)
//                     .then(response => {
//                         console.log(response.message);
//                         // if (response.success === true) {
//                         //     response => response.json();
//                         //     console.log(`Virtual Media on ${idrac_ip} is inserted`); // and here the contents: ${response.data}`);
//                         // }
//                         // else
//                         //     console.log(`Virtual Media on ${idrac_ip} is ejected`);
//                     })
//                     .catch(error => {
//                         console.log(`FAIL: checkVirtualMediaCdStatus for ${idrac_ip} failed: ${error.message}`);
//                     })
//                     .then(
//                         checkAttachStatus(idrac_ip)
//                             .then(response => {
//                                 console.log(`checkAttachStatus result: ${response.message}`);
//                                 if (response.message === "Attached") {
//                                     // disconnectNetworkIsoImage(idrac_ip)
//                                     //     .then(response => {
//                                     //         console.log(`disconnectNetworkIsoImage result: ${response.message}`);
//                                     //     })

//                                     resetSystemForceRestart(idrac_ip)
//                                         .then(response => {
//                                             console.log(`resetSystemForceRestart result: ${response.message}`);
//                                         })
//                                 }
//                                 else {
//                                     connectNetworkIsoImage(idrac_ip, share_ip, share_type, share_name, image_name, user_name, user_pass)
//                                         .then(response => {
//                                             console.log(`connectNetworkIsoImage result: ${response.message}`);
//                                         })
//                                 }
//                             })
//                             .catch(error => {
//                                 console.log(`FAIL: checkAttachStatus for ${idrac_ip} failed: ${error.message}`);
//                             })
//                     )
//             }
//         })
//         .catch(error => {
//             console.log(`FAIL: checkRedfishSupport for ${idrac_ip} failed: ${error.message}`);
//         });
// });

// detachNetworkIso(idrac_ip)
//     .then(response => console.log(`detachNetworkIso result: ${response.message}`))
//     .catch(error => {
//         console.log(`FAIL: detachNetworkIso result: ${error.message}`);
//     });

// ejectVirtualMediaCD(idrac_ip)
//     .then(response => console.log(`ejectVirtualMediaCD result: ${response.message}`))
//     .catch(error => {
//         console.log(`FAIL: ejectVirtualMediaCD result: ${error.message}`);
//     })

// checkVirtualMediaCdStatus(idrac_ip)
//     .then(response => {
//         // console.log(`checkVirtualMediaCdStatus result: ${response.message}`)
//         if (response.message === true) {
//             response => response.json();
//             console.log(`Virtual Media on ${idrac_ip} is inserted`); 
//         }
//         else
//             console.log(`Virtual Media on ${idrac_ip} is ejected`);
//     })
//     .catch(error => {
//         console.log(`FAIL: checkVirtualMediaCdStatus result: ${error.message}`);
//     });


// insertVirtualMediaCD(idrac_ip, "//10.211.4.215/Nightflyer/_14G/BMR.ISO/BMR_DELL_120319.iso")
//     .then(response => console.log(`insertVirtualMediaCD result: ${response.message}`))
//     .catch(error => {
//         console.log(`FAIL: insertVirtualMediaCD result: ${error.message}`);
//     })