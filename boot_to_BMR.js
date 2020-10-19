// Module to mount BMR image and boot into it

// Pull-in required libraries >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const { exec } = require("child_process"); // use it to launch external scripts
const https = require("https");
const base64 = require("base-64");
const fetch = require("node-fetch");
const { resolve } = require("path");
const { response } = require("express");
const { reject } = require("async");

// Declare variables >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const idrac_username = "root";
const idrac_password = "calvin";
let concrete_job_uri = "";

// Define functions >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

function checkRedfishSupport(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("checkRedfishSupport function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService`;

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
            .then((response) => {
                if (response.ok) {
                    resolve({
                        success: true,
                        message: `Supported`
                    });
                } else {
                    reject({
                        success: false,
                        message: `NOT supported`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in checkRedfishSupport failed on ${node_ip}: ${error}`
                });
            });
    });
}

function checkAttachStatus(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("checkAttachStatus function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.GetAttachStatus`;

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
            .then((response) => response.json())
            .then((data) => {
                resolve({
                    success: true,
                    message: data["ISOAttachStatus"]
                });
            })
            .catch((error) => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in checkAttachStatus failed on ${node_ip}: ${error}`
                });
            });
    });
}

function connectNetworkIsoImage(
    node_ip,
    share_ip,
    share_type,
    share_name,
    image_name,
    user_name,
    user_pass
) {
    return new Promise((resolve, reject) => {
        console.log("connectNetworkIsoImage function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.ConnectNetworkISOImage`;

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
        console.log(
            `\n- WARNING, arguments and values used to connect network ISO image for ${node_ip}:`
        );
        console.log(payload);

        // Make fetch call on the URL
        fetch(url, options)
            .then((response) => {
                if (response.ok) {
                    resolve({
                        success: true,
                        message: `PASS`
                    });
                } else {
                    reject({
                        success: false,
                        message: `FAIL: status code is ${response.status} and error message is ${response.statusText}`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in connectNetworkISOImage failed on ${node_ip}: ${error}`
                });
            });
    });
}

function disconnectNetworkIsoImage(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("disconnectNetworkIsoImage function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.DisconnectNetworkISOImage`;

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
            .then((response) => {
                if (response.ok) {
                    resolve({
                        success: true,
                        message: `PASS`
                    });
                } else {
                    reject({
                        success: false,
                        message: `FAIL: status code is ${response.status} and error message is ${response.statusText}`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in disconnectNetworkISOImage failed on ${node_ip}: ${error}`
                });
            });
    });
}

function rebootSystem(node_ip, reboot_type) {
    return new Promise((resolve, reject) => {
        console.log("rebootSystem function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Systems/System.Embedded.1/Actions/ComputerSystem.Reset`;

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
            body: JSON.stringify({ ResetType: reboot_type }),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            .then((response) => {
                if (response.ok) {
                    resolve({
                        success: true,
                        message: `PASS`
                    });
                } else {
                    reject({
                        success: false,
                        message: `FAIL: status code is ${response.status} and error message is ${response.statusText}`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in rebootSystem failed on ${node_ip}: ${error}`
                });
            });
    });
}

// WIP..
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
function bootToNetworkIso(
    node_ip,
    share_type,
    share_name,
    image_name,
    user_name,
    user_pass,
    workgroup
) {
    return new Promise((resolve, reject) => {
        console.log("bootToNetworkIso function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.BootToNetworkISO`;

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
            Workgroup: workgroup,
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
        console.log(
            `\n- WARNING, arguments and values used to ${method} on network share`
        );
        console.log(payload);

        // Make fetch call on the URL
        fetch(url, options)
            .then((response) => {
                if (response.status === 202) {
                    (response) =>
                        response.json().then((data) => {
                            concrete_job_uri = data.headers["Location"];
                            resolve({
                                success: true,
                                message: "booting"
                            });
                        });
                } else {
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in bootToNetworkISO failed on ${node_ip}: ${error}`
                });
            });
    });
}

function detachNetworkIso(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("detachNetworkIso function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Dell/Systems/System.Embedded.1/DellOSDeploymentService/Actions/DellOSDeploymentService.DetachISOImage`;

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
            .then((response) => {
                if (response.ok) {
                    resolve({
                        success: true,
                        message: `PASS`
                    });
                } else {
                    reject({
                        success: false,
                        message: `FAIL: status code is ${response.status} and error message is ${response.statusText}`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in detachNetworkISO failed on ${node_ip}: ${error}`
                });
            });
    });
}

function insertVirtualMediaCD(node_ip, img_path) {
    return new Promise((resolve, reject) => {
        console.log("insertVirtualMediaCD function called for ", node_ip); //debugging

        // Build URL string to fetch to the query; for CD in this case
        let url = `https://${node_ip}/redfish/v1/Managers/iDRAC.Embedded.1/VirtualMedia/CD/Actions/VirtualMedia.InsertMedia`;

        let payload = {};
        if (img_path.includes("cifs"))
            payload = { Image: img_path };
        else
            payload = {
                Image: img_path,
                Inserted: true,
                WriteProtected: true,
            };

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
            body: JSON.stringify(payload),
            agent: agent
        };

        // Make fetch call on the URL
        fetch(url, options)
            .then((response) => {
                if (response.status != 204) {
                    reject({
                        success: false,
                        message: `FAIL: error ${response.status} on insert and its message is ${response.statusText}`
                    });
                } else {
                    resolve({
                        success: true,
                        message: `PASS`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in insertVirtualMediaCD failed on ${node_ip}: ${error}`
                });
            });
    });
}

function ejectVirtualMediaCD(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("ejectVirtualMediaCD function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Managers/iDRAC.Embedded.1/VirtualMedia/CD/Actions/VirtualMedia.EjectMedia`;

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
            .then((response) => {
                if (response.status != 204) {
                    reject({
                        success: false,
                        message: `FAIL: error ${response.status} on eject and its message is ${response.statusText}`
                    });
                } else {
                    resolve({
                        success: true,
                        message: `PASS`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in ejectVirtualMediaCD failed on ${node_ip}: ${error}`
                });
            });
    });
}

function checkVirtualMediaCdStatus(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("checkVirtualMediaCdStatus function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Managers/iDRAC.Embedded.1/VirtualMedia/CD`;

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
            .then((response) => response.json())
            .then((data) => {
                resolve({
                    success: true, //data["Inserted"],
                    message: `${data["Inserted"]}`
                });
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in checkVirtualMediaCDStatus failed on ${node_ip}: ${error}`
                });
            });
    });
}

function setNextOneTimeBootVirtualMediaDevice(idrac_ip) {
    return new Promise((resolve, reject) => {
        console.log("setNextOneTimeBootVirtualMediaDevice function called for ", idrac_ip);

        // Build URL string to fetch to the query
        let url = `https://${idrac_ip}/redfish/v1/Managers/iDRAC.Embedded.1/Actions/Oem/EID_674_Manager.ImportSystemConfiguration`;

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let payload = { "ShareParameters": { "Target": "ALL" }, "ImportBuffer": "<SystemConfiguration><Component FQDD=\"iDRAC.Embedded.1\"><Attribute Name=\"ServerBoot.1#BootOnce\">Enabled</Attribute><Attribute Name=\"ServerBoot.1#FirstBootDevice\">VCD-DVD</Attribute></Component></SystemConfiguration>" };

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

        // Make fetch call on the URL
        fetch(url, options)
            // .then(response => console.log(response))
            .then((response) => {
                if (response.status != 202) {
                    reject({
                        success: false,
                        message: `FAIL: error ${response.status} on set next boot VM and its message is ${response.statusText}`
                    });
                } else {
                    resolve({
                        success: true,
                        message: `PASS`
                    });
                }
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in setNextOneTimeBootVirtualMediaDevice failed on ${node_ip}: ${error}`
                });
            });
    })
}

function deleteJobQueue(node_ip, arg) {
    return new Promise((resolve, reject) => {
        console.log("deleteJobQueue function called for ", idrac_ip);

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Dell/Managers/iDRAC.Embedded.1/DellJobService/Actions/DellJobService.DeleteJobQueue`;

        // Construct options to be used in fetch call
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        let payload;
        if (arg.includes("JID_"))
            payload = { "JobID": arg };
        else if (arg === "CLEARALL")
            payload = { "JobID": "JID_CLEARALL" };
        else if (arg === "CLEARALL_FORCE")
            payload = { "JobID": "JID_CLEARALL_FORCE" };

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

        // Make fetch call on the URL
        fetch(url, options)
            // .then(response => console.log(response)) //debugging
            .then((response) => {
                if (response.status != 200)
                    (response) => response.json()
                        .then((data) => {
                            reject({
                                success: false,
                                message: `- FAIL, deleteJobQueue action failed, status code is ${response.statusText}. \n- POST command failure is: ${data}`
                            });
                        });
                else {
                    // let msg = "";
                    if (arg.includes("JID_"))
                        console.log(`- PASS: DeleteJobQueue action passed to clear job ID ${arg}, status code 200 returned`);
                    else if (arg === "CLEARALL") {
                        console.log(`- PASS: DeleteJobQueue action passed to clear the job queue, status code 200 returned`);
                        resolve({
                            success: true,
                            message: `PASS`
                        });
                    } else if (arg === "CLEARALL_FORCE") {
                        console.log(`- PASS: DeleteJobQueue action passed to clear the job queue and restart Lifecycle Controller services, status code 200 returned`);
                        sleep(10000);
                        console.log("- WARNING, Lifecycle Controller services restarted. Script will loop checking the status of Lifecycle Controller until Ready state");
                        sleep(60000);
                        while (true) {
                            url = `https://${node_ip}/redfish/v1/Dell/Managers/iDRAC.Embedded.1/DellLCService/Actions/DellLCService.GetRemoteServicesAPIStatus`;

                            // Construct options to be used in fetch call
                            const agent = new https.Agent({
                                rejectUnauthorized: false
                            });
                            payload = {};
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
                            // Make fetch call on the URL
                            fetch(url, options)
                                .then(response => response.json().then(data => ({ status: response.status, data: data })))
                                // .then(resObj => console.log(resObj)) //debugging
                                .then((resObj) => {
                                    if (resObj.status != 200) {
                                        reject({
                                            success: false,
                                            message: `-FAIL, POST command failed, status code is  ${resObj.status}, \n
                                            -POST command failure results: ${resObj.data}`
                                        });
                                    } else {
                                        let lc_status = resObj.data["LCStatus"];
                                        let server_status = resObj.data["Status"];
                                        if (lc_status === "Ready" && server_status === "Ready") {
                                            console.log("- PASS, Lifecycle Controller services are in ready state");
                                            resolve({
                                                success: true,
                                                message: `PASS`
                                            });
                                        } else {
                                            console.log("- WARNING, Lifecycle Controller services not in ready state, polling again");
                                            sleep(20000);
                                        };
                                    };
                                })
                                .catch(error => {
                                    reject({
                                        success: false,
                                        message: `FAIL: Fetch on GetRemoteServicesAPIStatus failed on ${node_ip}: ${error}`
                                    });
                                });
                        };
                    };
                    // resolve({
                    //     success: true,
                    //     message: msg
                    // });
                };
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in deleteJobQueue failed on ${node_ip}: ${error}`
                });
            });
    });
}

// Call this function with an array of IPs and image props to mount ISO image from a share. If any of the
// functions fail, it will as well.
function mountNetworkImageOnNodes(idrac_ips, share_ip, share_type, share_name, image_name, user_name, user_pass) {
    return new Promise((resolve, reject) => {
        console.log("mountNetworkImageOnNodes function called for ", idrac_ips);   //debugging
        let mountedCounter = 0;

        idrac_ips.forEach(idrac_ip => {
            checkRedfishSupport(idrac_ip)
                .then(response => {
                    console.log(`checkRedfishSupport result for ${idrac_ip} is: ${response.message}`);
                    if (response.success) {
                        checkAttachStatus(idrac_ip)
                            .then(response => {
                                console.log(`checkAttachStatus result for ${idrac_ip} is: ${response.message}`);
                                if (response.message === "Attached") {
                                    disconnectNetworkIsoImage(idrac_ip)
                                        .then(response => {
                                            console.log(`disconnectNetworkIsoImage result for ${idrac_ip} is: ${response.message}`);
                                            if (response.success) {
                                                connectNetworkIsoImage(idrac_ip, share_ip, share_type, share_name, image_name, user_name, user_pass)
                                                    .then(response => {
                                                        console.log(`connectNetworkIsoImage result for ${idrac_ip} is: ${response.message}`);
                                                        if (response.success) {
                                                            mountedCounter++;
                                                            if (mountedCounter == idrac_ips.length) {
                                                                if (idrac_ips.length == 1)
                                                                    resolve({
                                                                        success: true,
                                                                        message: `---"${image_name}" has been successfuly mounted on the selected node.---`
                                                                    });
                                                                else
                                                                    resolve({
                                                                        success: true,
                                                                        message: `---"${image_name}" has been successfuly mounted on all selected nodes.---`
                                                                    });
                                                            }
                                                        } else {
                                                            reject({
                                                                success: false,
                                                                message: response.message
                                                            });
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.log(`CATCH in mountNetworkImageOnNodes: ${error.message}`);
                                                        reject({
                                                            success: false,
                                                            message: `CATCH in mountNetworkImageOnNodes: ${error.message}`
                                                        });
                                                    })
                                            } else {
                                                reject({
                                                    success: false,
                                                    message: response.message
                                                });
                                            }
                                        })
                                        .catch(error => {
                                            console.log(`CATCH in mountNetworkImageOnNodes: ${error.message}`);
                                            reject({
                                                success: false,
                                                message: `CATCH in mountNetworkImageOnNodes: ${error.message}`
                                            });
                                        })
                                }
                                else {
                                    connectNetworkIsoImage(idrac_ip, share_ip, share_type, share_name, image_name, user_name, user_pass)
                                        .then(response => {
                                            console.log(`connectNetworkIsoImage result: ${response.message}`);
                                            if (response.success) {
                                                mountedCounter++;
                                                if (mountedCounter == idrac_ips.length) {
                                                    if (idrac_ips.length == 1)
                                                        resolve({
                                                            success: true,
                                                            message: `---"${image_name}" has been successfuly mounted on the selected node.---`
                                                        });
                                                    else
                                                        resolve({
                                                            success: true,
                                                            message: `---"${image_name}" has been successfuly mounted on all selected nodes.---`
                                                        });
                                                }
                                            } else {
                                                reject({
                                                    success: false,
                                                    message: response.message
                                                });
                                            }
                                        })
                                        .catch(error => {
                                            console.log(`CATCH in mountNetworkImageOnNodes: ${error.message}`);
                                            reject({
                                                success: false,
                                                message: `CATCH in mountNetworkImageOnNodes: ${error.message}`
                                            });
                                        })
                                }
                            })
                            .catch(error => {
                                console.log(`CATCH in mountNetworkImageOnNodes: ${error.message}`);
                                reject({
                                    success: false,
                                    message: `CATCH in mountNetworkImageOnNodes: ${error.message}`
                                });
                            })

                    } else {
                        reject({
                            success: false,
                            message: `iDRAC version installed on ${idrac_ip} does not support OEM boot via Redfish`
                        });
                    }
                })
                .catch(error => {
                    console.log(`CATCH in mountNetworkImageOnNodes: ${error.message}`);
                    reject({
                        success: false,
                        message: `CATCH in mountNetworkImageOnNodes: ${error.message}`
                    });
                });
        });
    });
}

function checkCurrentPowerState(node_ip) {
    return new Promise((resolve, reject) => {
        console.log("checkCurrentPowerState function called for ", node_ip); //debugging

        // Build URL string to fetch to the query
        let url = `https://${node_ip}/redfish/v1/Systems/System.Embedded.1`;

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
            .then((response) => response.json())
            .then((data) => {
                resolve({
                    success: true,
                    message: data["PowerState"]
                });
            })
            .catch(error => {
                reject({
                    success: false,
                    message: `FAIL: Fetch in checkCurrentPowerState failed on ${node_ip}: ${error}`
                });
            });
    })
}

// Call it with an array of iDRAC IPs you want to reboot. Stops and returns failure flag if any of them fails to reboot.
function rebootSelectedNodes(idrac_ips) {
    return new Promise((resolve, reject) => {
        console.log("rebootSelectedNodes function called for ", idrac_ips); //debugging
        let rebootCounter = 0;
        let rebootType = "";

        idrac_ips.forEach((idrac_ip) => {
            checkCurrentPowerState(idrac_ip)
                .then(response => {
                    if (response.success) {
                        console.log(`checkCurrentPowerState result for ${idrac_ip} is: ${response.message}`);
                        if (response.message == "On")
                            rebootType = "ForceRestart";
                        else
                            rebootType = "PushPowerButton";
                        console.log(`rebootType for ${idrac_ip} set to: ${rebootType}`);
                        rebootSystem(idrac_ip, rebootType)
                            .then((response) => {
                                console.log(`rebootSystem result for ${idrac_ip} is: ${response.message}`);
                                if (response.success) {
                                    rebootCounter++;
                                    if (rebootCounter == idrac_ips.length) {
                                        if (idrac_ips.length == 1)
                                            resolve({
                                                success: true,
                                                message: `---Selected node has been successfuly rebooted.---`
                                            });
                                        else
                                            resolve({
                                                success: true,
                                                message: `---All selected nodes have been successfuly rebooted.---`
                                            });
                                    }
                                } else reject({
                                    success: false,
                                    message: response.message
                                });
                            })
                            .catch((error) => {
                                console.log(`CATCH in rebootSelectedNodes: ${error.message}`);
                                reject({
                                    success: false,
                                    message: `CATCH in rebootSelectedNodes: ${error.message}`
                                });
                            })
                    }
                    else {
                        console.log(`Could not get Power State from ${idrac_ip}, error: ${response.message}`);
                        reject({
                            success: false,
                            message: `Could not get Power State from ${idrac_ip}, error: ${response.message}`
                        });
                    }
                })
                .catch(error => {
                    console.log(`CATCH in rebootSelectedNodes: ${error.message}`);
                    reject({
                        success: false,
                        message: `CATCH in rebootSelectedNodes: ${error.message}`
                    });
                });
        });
    });
}

// Call this function with an array of IPs and image path to mount Virtual Media ISO image from a share. If any of the
// functions fail, it will as well.
function insertVirtualMediaOnNodes(idrac_ips, image_path) {
    return new Promise((resolve, reject) => {
        console.log("insertVirtualMediaOnNodes function called for ", idrac_ips);   //debugging
        let insertedCounter = 0;

        try {
            idrac_ips.forEach(idrac_ip => {
                // checkRedfishSupport(idrac_ip)
                //     .then(response => {
                //         console.log(`checkRedfishSupport result for ${idrac_ip} is: ${response.message}`);
                // if (response.success) {
                checkVirtualMediaCdStatus(idrac_ip)
                    .then(response => {
                        console.log(`checkVirtualMediaCdStatus result for ${idrac_ip} is inserted: ${response.message}`);
                        if (response.message === "true") {
                            ejectVirtualMediaCD(idrac_ip)
                                .then(response => {
                                    console.log(`ejectVirtualMediaCD result for ${idrac_ip} is: ${response.message}`);
                                    if (response.success) {
                                        insertVirtualMediaCD(idrac_ip, image_path)
                                            .then(response => {
                                                console.log(`insertVirtualMediaCD result for ${idrac_ip} is: ${response.message}`);
                                                if (response.success) {
                                                    // deleteJobQueue(idrac_ip, "CLEARALL")
                                                    //     .then(response => {
                                                    //         console.log(`deleteJobQueue result for ${idrac_ip} is: ${response.message}`);
                                                    //         if (response.success) {
                                                    setNextOneTimeBootVirtualMediaDevice(idrac_ip)
                                                        .then(response => {
                                                            console.log(`setNextOneTimeBootVirtualMediaDevice result for ${idrac_ip} is: ${response.message}`);
                                                            if (!response.success) {
                                                                reject({
                                                                    success: false,
                                                                    message: response.message
                                                                });
                                                            } else {
                                                                insertedCounter++;
                                                                if (insertedCounter == idrac_ips.length) {
                                                                    if (idrac_ips.length == 1)
                                                                        resolve({
                                                                            success: true,
                                                                            message: `---"${image_path}" has been successfuly inserted on the selected node and set to boot from it.---`
                                                                        });
                                                                    else
                                                                        resolve({
                                                                            success: true,
                                                                            message: `---"${image_path}" has been successfuly inserted on all selected nodes and set to boot from it.---`
                                                                        });
                                                                }
                                                            }
                                                        }) 
                                                        .catch(error => {
                                                            console.log(`CATCH in setNextOneTimeBootVirtualMediaDevice: ${error.message}`);
                                                            reject({
                                                                success: false,
                                                                message: `CATCH in setNextOneTimeBootVirtualMediaDevice: ${error.message}`
                                                            });
                                                        });
                                                    //     }
                                                    // })
                                                    // .catch(error => {
                                                    //     console.log(`CATCH in deleteJobQueue: ${error.message}`);
                                                    //     reject({
                                                    //         success: false,
                                                    //         message: `CATCH in deleteJobQueue: ${error.message}`
                                                    //     });
                                                    // });
                                                } else {
                                                    reject({
                                                        success: false,
                                                        message: response.message
                                                    });
                                                }
                                            }) 
                                            .catch(error => {
                                                console.log(`CATCH in insertVirtualMediaCD: ${error.message}`);
                                                reject({
                                                    success: false,
                                                    message: `CATCH in insertVirtualMediaCD: ${error.message}`
                                                });
                                            })
                                    } else {
                                        reject({
                                            success: false,
                                            message: response.message
                                        });
                                    }
                                })
                                .catch(error => {
                                    console.log(`CATCH in ejectVirtualMediaCD: ${error.message}`);
                                    reject({
                                        success: false,
                                        message: `CATCH in ejectVirtualMediaCD: ${error.message}`
                                    });
                                })
                        } else {
                            insertVirtualMediaCD(idrac_ip, image_path)
                                .then(response => {
                                    console.log(`insertVirtualMediaCD result for ${idrac_ip} is: ${response.message}`);
                                    if (response.success) {
                                        // deleteJobQueue(idrac_ip, "CLEARALL")
                                        //     .then(response => {
                                        //         console.log(`deleteJobQueue result for ${idrac_ip} is: ${response.message}`);
                                        //         if (response.success) {
                                        setNextOneTimeBootVirtualMediaDevice(idrac_ip)
                                            .then(response => {
                                                console.log(`setNextOneTimeBootVirtualMediaDevice result for ${idrac_ip} is: ${response.message}`);
                                                if (!response.success) {
                                                    reject({
                                                        success: false,
                                                        message: response.message
                                                    });
                                                } else {
                                                    insertedCounter++;
                                                    if (insertedCounter == idrac_ips.length) {
                                                        if (idrac_ips.length == 1)
                                                            resolve({
                                                                success: true,
                                                                message: `---"${image_path}" has been successfuly inserted on the selected node and set to boot from it.---`
                                                            });
                                                        else
                                                            resolve({
                                                                success: true,
                                                                message: `---"${image_path}" has been successfuly inserted on all selected nodes and set to boot from it.---`
                                                            });
                                                    }
                                                }
                                            })
                                            .catch(error => {
                                                console.log(`CATCH in setNextOneTimeBootVirtualMediaDevice: ${error.message}`);
                                                reject({
                                                    success: false,
                                                    message: `CATCH in setNextOneTimeBootVirtualMediaDevice: ${error.message}`
                                                });
                                            });
                                        //     }
                                        // })
                                        // .catch(error => {
                                        //     console.log(`CATCH in deleteJobQueue: ${error.message}`);
                                        //     reject({
                                        //         success: false,
                                        //         message: `CATCH in deleteJobQueue: ${error.message}`
                                        //     });
                                        // });
                                    } else {
                                        reject({
                                            success: false,
                                            message: response.message
                                        });
                                    }
                                })
                                .catch(error => {
                                    console.log(`CATCH in insertVirtualMediaOnNodes: ${error.message}`);
                                    reject({
                                        success: false,
                                        message: `CATCH in insertVirtualMediaOnNodes: ${error.message}`
                                    });
                                })
                                .catch(error => {
                                    console.log(`CATCH in insertVirtualMediaCD: ${error.message}`);
                                    reject({
                                        success: false,
                                        message: `CATCH in insertVirtualMediaCD: ${error.message}`
                                    });
                                })
                        }
                    })
                    .catch(error => {
                        console.log(`CATCH in checkVirtualMediaCdStatus: ${error.message}`);
                        reject({
                            success: false,
                            message: `CATCH in checkVirtualMediaCdStatus: ${error.message}`
                        });
                    })

                // } else {
                //     reject({
                //         success: false,
                //         message: `iDRAC version installed on ${idrac_ip} does not support this functionality via Redfish`
                //     });
                // }
                // })
                // .catch(error => {
                //     console.log(`CATCH in insertVirtualMediaCD: ${error.message}`);
                //     reject({
                //         success: false,
                //         message: `CATCH in insertVirtualMediaCD: ${error.message}`
                //     });
                // });
            });
        } catch (error) {
            console.log(`CATCH in insertVirtualMediaOnNodes: ${error.message}`);
            reject({
                success: false,
                message: `CATCH in insertVirtualMediaOnNodes: ${error.message}`
            });
        }
    });
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
// let idrac_ip = "100.80.144.128";
// let img_path = "cifs://SVC_ Auto_Image:MustChange2!@10.211.4.215/dropbox/dl/WIMs/XC/RASR_BMR_4.0_Test_Only_For_XC_Automation.iso";

// // Example of calling mountNetworkImageOnNodes then rebootSelectedNodes functions from server.js
// mountNetworkImageOnNodes(ip_arr, share_ip, share_type, share_name, image_name, user_name, user_pass)
//     .then(response => {
//         if (response.success) {
//             // Logic in case of success
//             console.log(response.message);
//             // Reboot systems
//             rebootSelectedNodes(ip_arr)
//                 .then(response => {
//                     if (response.success)
//                         // Logic in case of success
//                         console.log(response.message);
//                     else
//                         // Logic in case of failure
//                         console.log(response.message);
//                 })
//         }
//         else
//             // Logic in case of failure
//             console.log(response.message);
//     });


// checkCurrentPowerState("100.80.144.128")
//     .then(response => console.log(response.message))
//     .catch(error => console.log(error.message));

// ip_arr.forEach(idrac_ip => {
//     checkRedfishSupport(idrac_ip)
//         .then(response => {
//             console.log(`checkRedfishSupport result: ${response.message}`);
//             if (response.success === true) {
//                 checkVirtualMediaCdStatus(idrac_ip)
//                     .then(response => {
//                         console.log("checkVirtualMediaCdStatus response message: " + response.message);
//                         if (response.message === true) {
//                             response => response.json();
//                             console.log(`Virtual Media on ${idrac_ip} is inserted`); // and here the contents: ${response.data}`);
//                             ejectVirtualMediaCD(idrac_ip)
//                                 .then(response => {
//                                     console.log("ejectVirtualMediaCD response: " + response.message);
//                                     if (response.success === false) {
//                                         console.log(`FAIL: ejectVirtualMediaCD failed on ${idrac_ip}`);
//                                     }
//                                 })
//                         }
//                         else {
//                             console.log(`Virtual Media on ${idrac_ip} is ejected`);
//                         }

//                         insertVirtualMediaCD(idrac_ip, img_path)
//                             .then(response => {
//                                 if (response.success === true) {
//                                     insertedCounter++;
//                                     if (insertedCounter === ip_arr.length) {
//                                         rebootSelectedNodes(ip_arr)
//                                             .then(response => {
//                                                 if (response.success === true) {
//                                                     console.log("All nodes rebooted!");
//                                                 } else {
//                                                     console.log("There were issues rebooting nodes: " + response.message);
//                                                 }
//                                             })
//                                             .catch(error => {
//                                                 console.log(`FAIL: rebootSelectedNodes for ${ip_arr} failed: ${error.message}`);
//                                             })
//                                     }
//                                 }
//                             })
//                             .catch(error => {
//                                 console.log(`FAIL: insertVirtualMediaCD for ${idrac_ip} failed: ${error.message}`);
//                             })
//                     })
//                     .catch(error => {
//                         console.log(`FAIL: checkVirtualMediaCdStatus for ${idrac_ip} failed: ${error.message}`);
//                     })
//                 // .then(
//                 //     checkAttachStatus(idrac_ip)
//                 //         .then(response => {
//                 //             console.log(`checkAttachStatus result for ${idrac_ip}: ${response.message}`);
//                 //             if (response.message === "Attached") {
//                 //                 // disconnectNetworkIsoImage(idrac_ip)
//                 //                 //     .then(response => {
//                 //                 //         console.log(`disconnectNetworkIsoImage result: ${response.message}`);
//                 //                 //     })

//                 //                 rebootSystem(idrac_ip)
//                 //                     .then(response => {
//                 //                         console.log(`rebootSystem result: ${response.message}`);
//                 //                     })
//                 //             }
//                 //             else {
//                 //                 connectNetworkIsoImage(idrac_ip, share_ip, share_type, share_name, image_name, user_name, user_pass)
//                 //                     .then(response => {
//                 //                         console.log(`connectNetworkIsoImage result: ${response.message}`);
//                 //                     })
//                 //             }
//                 //         })
//                 //         .catch(error => {
//                 //             console.log(`FAIL: checkAttachStatus for ${idrac_ip} failed: ${error.message}`);
//                 //         })
//                 // )
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


// insertVirtualMediaCD(idrac_ip, img_path)
//     .then(response => console.log(`insertVirtualMediaCD result: ${response.message}`))
//     .catch(error => {
//         console.log(`FAIL: insertVirtualMediaCD result: ${error.message}`);
//     })

// deleteJobQueue(idrac_ip, "CLEARALL")
//     .then(response => console.log(`deleteJobQueue for ${idrac_ip} result: ${response.message}`))
//     .catch(error => {
//         console.log(`FAIL: deleteJobQueue result: ${error.message}`);
//     });

// insertVirtualMediaOnNodes(ip_arr, img_path)
//     .then(response => {
//         console.log(`insertVirtualMediaOnNodes for ${idrac_ip} result: ${response.message}`);
//         rebootSelectedNodes(ip_arr)
//             .then(response => console.log(`rebootSelectedNodes for ${idrac_ip} result: ${response.message}`))
//             .catch(error => {
//                 console.log(`FAIL: rebootSelectedNodes result: ${error.message}`);
//             });
//     })
//     .catch(error => {
//         console.log(`FAIL: insertVirtualMediaOnNodes result: ${error.message}`);
//     });

module.exports = { insertVirtualMediaOnNodes, rebootSelectedNodes };
