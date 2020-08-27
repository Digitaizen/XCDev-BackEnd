#
# GetSystemHWInventoryREDFISH. Python script using Redfish API to get system hardware inventory
# Modification: dumps extracted data to a JSON file instead of the text one; adds/removes certain
# data points
#
# _author_ = Texas Roemer <Texas_Roemer@Dell.com>
# _modified_ = Azat Salikhov <Azat_Salikhov@Dellteam.com>
# _version_ = 7.1
#
# Copyright (c) 2020, Dell, Inc.
#
# This software is licensed to you under the GNU General Public License,
# version 2 (GPLv2). There is NO WARRANTY for this software, express or
# implied, including the implied warranties of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. You should have received a copy of GPLv2
# along with this software; if not, see
# http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt.
#


import requests, json, sys, re, time, warnings, argparse, os

from datetime import datetime

warnings.filterwarnings("ignore")

parser = argparse.ArgumentParser(
    description="Python script using Redfish API to get system hardware inventory(output will be printed to the screen and also copied to a text file). This includes information for storage controllers, memory, network devices, general system details, power supplies, hard drives, fans, backplanes, processors"
)
parser.add_argument("-ip", help="iDRAC IP address", required=True)
parser.add_argument("-u", help="iDRAC username", required=True)
parser.add_argument("-p", help="iDRAC password", required=True)
parser.add_argument(
    "script_examples",
    action="store_true",
    help="GetSystemHWInventoryREDFISH.py -ip 192.168.0.120 -u root -p calvin -m y, this example will get only memory information. GetSystemHWInventoryREDFISH.py -ip 192.168.0.120 -u root -p calvin -c y -m y, this example will get only processor and memory information. GetSystemHWInventoryREDFISH.py -ip 192.168.0.120 -u root -p calvin -a y, this example will get all system information: general system information, processor, memory, fans, power supplies, hard drives, storage controllers, network devices",
)
parser.add_argument(
    "-s", help='Get system information only, pass in "y"', required=False
)
parser.add_argument(
    "-m", help='Get memory information only, pass in "y"', required=False
)
parser.add_argument(
    "-c", help='Get processor information only, pass in "y"', required=False
)
parser.add_argument("-f", help='Get fan information only, pass in "y"', required=False)
parser.add_argument(
    "-ps", help='Get power supply information only, pass in "y"', required=False
)
parser.add_argument(
    "-S", help='Get storage information only, pass in "y"', required=False
)
parser.add_argument(
    "-n", help='Get network device information only, pass in "y"', required=False
)
parser.add_argument(
    "-a",
    help='Get all system information / device information, pass in "y"',
    required=False,
)


args = vars(parser.parse_args())

idrac_ip = args["ip"]
idrac_username = args["u"]
idrac_password = args["p"]

idrac_inventory = {
    "System Information": {},
    "Memory Information": {},
    "CPU Information": {},
    "Storage Controller Information": {},
    "Storage Disks Information": {},
    "Network Device Information": {},
    "Power Supply Information": {},
    "Backplane Information": {},
}

try:
    os.remove("hw_inventory.json")
except:
    pass


# f = open("hw_inventory.txt", "a")
# d = datetime.now()
# current_date_time = "- Data collection timestamp: %s-%s-%s  %s:%s:%s\n" % (
#     d.month,
#     d.day,
#     d.year,
#     d.hour,
#     d.minute,
#     d.second,
# )
# f.writelines(current_date_time)
# f.close()


def check_supported_idrac_version():
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print(
            "\n- WARNING, iDRAC version installed does not support this feature using Redfish API"
        )
        sys.exit()
    else:
        pass


def get_system_information():
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print("\n- FAIL, get command failed, error is: %s" % data)
        sys.exit()
    else:
        # message = "\n---- System Information ----"
        # print(message)
        # Grab the whole returned json data and dump it into a json file
        # with open("hw_inventory.json", "w") as write_file:
        #     json.dump(data, write_file, indent=2)

        for i in data.items():
            if (
                # i[0] == "@odata.id"
                # or i[0] == "@odata.context"
                "@odata" in i[0]
                or i[0] == "Links"
                or i[0] == "Actions"
                # or i[0] == "@odata.type"
                or i[0] == "Description"
                or i[0] == "EthernetInterfaces"
                or i[0] == "Storage"
                or i[0] == "Processors"
                or i[0] == "Memory"
                or i[0] == "SecureBoot"
                or i[0] == "NetworkInterfaces"
                or i[0] == "Bios"
                or i[0] == "SimpleStorage"
                or i[0] == "PCIeDevices"
                or i[0] == "PCIeFunctions"
            ):
                pass
            elif i[0] == "Oem":
                for ii in i[1]["Dell"]["DellSystem"].items():
                    if (
                        "@odata"
                        in ii[0]
                        # ii[0] == "@odata.context"
                        # or ii[0] == "@odata.type"
                        # or ii[0] == "@odata.id"
                    ):
                        pass
                    else:
                        idrac_inventory["System Information"][ii[0]] = ii[1]

            elif i[0] == "Boot":
                try:
                    idrac_inventory["System Information"]["BiosBootMode"] = [i[1]][
                        "BootSourceOverrideMode"
                    ]
                except:
                    pass
            else:
                idrac_inventory["System Information"][i[0]] = i[1]


def get_memory_information():
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1/Memory" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print("\n- FAIL, get command failed, error is: %s" % data)
        sys.exit()
    # else:
    #     message = "\n---- Memory Information ----"
    #     print(message)
    for i in data["Members"]:
        dimm = i["@odata.id"].split("/")[-1]
        try:
            dimm_slot = re.search("DIMM.+", dimm).group()
        except:
            print("\n- FAIL, unable to get dimm slot info")
            sys.exit()
        response = requests.get(
            "https://%s%s" % (idrac_ip, i["@odata.id"]),
            verify=False,
            auth=(idrac_username, idrac_password),
        )
        sub_data = response.json()
        if response.status_code != 200:
            print("\n- FAIL, get command failed, error is: %s" % sub_data)
            sys.exit()
        else:
            # message = "\n- Memory details for %s -\n" % dimm_slot
            # print(message)
            for ii in sub_data.items():
                if (
                    "@odata" in ii[0]
                    # ii[0] == "@odata.id"
                    # or ii[0] == "@odata.context"
                    or ii[0] == "Assembly"
                    or ii[0] == "Metrics"
                    or ii[0] == "Links"
                ):
                    pass
                elif ii[0] == "Oem":
                    for iii in ii[1]["Dell"]["DellMemory"].items():
                        # if iii[0] == "@odata.context" or iii[0] == "@odata.type":
                        if "@odata" in iii[0]:
                            pass
                        else:
                            idrac_inventory["Memory Information"][iii[0]] = iii[1]
                else:
                    idrac_inventory["Memory Information"][ii[0]] = ii[1]


def get_cpu_information():
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1/Processors" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print("\n- FAIL, get command failed, error is: %s" % data)
        sys.exit()

    for i in data["Members"]:
        cpu = i["@odata.id"].split("/")[-1]
        response = requests.get(
            "https://%s%s" % (idrac_ip, i["@odata.id"]),
            verify=False,
            auth=(idrac_username, idrac_password),
        )
        sub_data = response.json()
        if response.status_code != 200:
            print("\n- FAIL, get command failed, error is: %s" % sub_data)
            sys.exit()
        else:
            for ii in sub_data.items():
                if (
                    "@odata" in ii[0]
                    # ii[0] == "@odata.id"
                    # or ii[0] == "@odata.context"
                    or ii[0] == "Metrics"
                    or ii[0] == "Links"
                    or ii[0] == "Description"
                    or ii[0] == "Assembly"
                    # or ii[0] == "@odata.type"
                ):
                    pass
                elif ii[0] == "Oem":
                    for iii in ii[1]["Dell"]["DellProcessor"].items():
                        if "@odata" in iii[0]:
                            # if iii[0] == "@odata.context" or iii[0] == "@odata.type":
                            pass
                        else:
                            idrac_inventory["CPU Information"][iii[0]] = iii[1]
                else:
                    idrac_inventory["CPU Information"][ii[0]] = ii[1]


def get_fan_information():
    f = open("hw_inventory.txt", "a")
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print("\n- FAIL, get command failed, error is: %s" % data)
        sys.exit()
    else:
        message = "\n---- Fan Information ----\n"
        f.writelines(message)
        f.writelines("\n")
        print(message)
    fan_list = []
    if data["Links"]["CooledBy"] == []:
        print("\n- WARNING, no fans detected for system")
    else:
        for i in data["Links"]["CooledBy"]:
            for ii in i.items():
                fan_list.append(ii[1])
        fan_list_final = []
        for i in fan_list:
            response = requests.get(
                "https://%s%s" % (idrac_ip, i),
                verify=False,
                auth=(idrac_username, idrac_password),
            )
            if response.status_code != 200:
                print("\n- FAIL, get command failed, error is: %s" % data)
            else:
                data_get = response.json()
                try:
                    message = "\n- Details for %s -\n" % data_get["FanName"]
                    f.writelines(message)
                    print(message)
                    message = "\n"
                    f.writelines(message)
                except:
                    pass
                if "Fans" not in data_get.keys():
                    for ii in data_get.items():
                        message = "%s: %s" % (ii[0], ii[1])
                        f.writelines(message)
                        print(message)
                        message = "\n"
                        f.writelines(message)
                    message = "\n"
                    f.writelines(message)
                    print(message)
                else:
                    count = 0
                    while True:
                        if count == len(fan_list):
                            return
                        for i in data_get["Fans"]:
                            message = "\n- Details for %s -\n" % i["FanName"]
                            count += 1
                            f.writelines(message)
                            print(message)
                            message = "\n"
                            f.writelines(message)
                            for ii in i.items():
                                message = "%s: %s" % (ii[0], ii[1])
                                f.writelines(message)
                                print(message)
                                message = "\n"
                                f.writelines(message)
    f.close()


def get_ps_information():
    f = open("hw_inventory.txt", "a")
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print("\n- FAIL, get command failed, error is: %s" % data)
        sys.exit()
    # else:
    #     message = "\n---- Power Supply Information ----\n"
    #     print(message)
    if data["Links"]["PoweredBy"] == []:
        print("- WARNING, no power supplies detected for system")

    else:
        for i in data["Links"]["PoweredBy"]:
            for ii in i.items():
                response = requests.get(
                    "https://%s%s" % (idrac_ip, ii[1]),
                    verify=False,
                    auth=(idrac_username, idrac_password),
                )
                if response.status_code != 200:
                    print("\n- FAIL, get command failed, error is: %s" % data)
                    sys.exit()
                else:
                    data_get = response.json()
                    if "PowerSupplies" not in data_get.keys():
                        # message = "\n- Details for %s -\n" % data_get["Name"]
                        # print(message)
                        for i in data_get.items():
                            if i[0] == "Oem":
                                try:
                                    for ii in i[1]["Dell"]["DellPowerSupply"].items():
                                        idrac_inventory["Power Supply Information"][
                                            ii[0]
                                        ] = ii[1]
                                except:
                                    print(
                                        "- FAIL, unable to find Dell PowerSupply OEM information"
                                    )
                                    sys.exit()
                            else:
                                idrac_inventory["Power Supply Information"][i[0]] = i[1]
                    else:
                        if len(data["Links"]["PoweredBy"]) == 1:
                            # message = (
                            #     "\n- Details for %s -\n"
                            #     % data_get["PowerSupplies"][0]["Name"]
                            # )
                            # print(message)
                            for i in data_get.items():
                                if i[0] == "PowerSupplies":
                                    for ii in i[1]:
                                        for iii in ii.items():
                                            if iii[0] == "Oem":
                                                try:
                                                    for iiii in iii[1]["Dell"][
                                                        "DellPowerSupply"
                                                    ].items():
                                                        idrac_inventory[
                                                            "Power Supply Information"
                                                        ][iiii[0]] = iiii[1]
                                                except:
                                                    print(
                                                        "- FAIL, unable to find Dell PowerSupply OEM information"
                                                    )
                                                    sys.exit()
                                            else:
                                                idrac_inventory[
                                                    "Power Supply Information"
                                                ][iii[0]] = iii[1]
                                elif i[0] == "Voltages":
                                    pass
                                elif i[0] == "PowerControl":
                                    for ii in i[1]:
                                        for iii in ii.items():
                                            idrac_inventory["Power Supply Information"][
                                                iii[0]
                                            ] = iii[1]
                                else:
                                    idrac_inventory["Power Supply Information"][
                                        i[0]
                                    ] = i[1]
                        else:
                            for i in data_get.items():
                                if i[0] == "PowerSupplies":
                                    psu_ids = i[1]
                            count = 0
                            while True:
                                if len(psu_ids) == count:
                                    return
                                else:
                                    for i in psu_ids:
                                        # message = "\n- Details for %s -\n" % i["Name"]
                                        # print(message)
                                        for ii in i.items():
                                            if ii[0] == "Oem":
                                                try:
                                                    for iii in ii[1]["Dell"][
                                                        "DellPowerSupply"
                                                    ].items():
                                                        idrac_inventory[
                                                            "Power Supply Information"
                                                        ][iii[0]] = iii[1]
                                                except:
                                                    print(
                                                        "- FAIL, unable to find Dell PowerSupply OEM information"
                                                    )
                                                    sys.exit()
                                            else:
                                                idrac_inventory[
                                                    "Power Supply Information"
                                                ][ii[0]] = ii[1]
                                        count += 1


def get_storage_controller_information():
    # message = "\n---- Controller Information ----"
    # print(message)
    global controller_list
    controller_list = []
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1/Storage" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    for i in data["Members"]:
        for ii in i.items():
            controller_list.append(ii[1])
    for i in controller_list:
        response = requests.get(
            "https://%s%s" % (idrac_ip, i),
            verify=False,
            auth=(idrac_username, idrac_password),
        )
        data = response.json()
        # message = "\n - Detailed controller information for %s -\n" % i.split("/")[-1]
        # print(message)
        for i in data.items():
            if i[0] == "Status":
                pass
            elif "@" in i[0] or "odata" in i[0]:
                pass
            elif i[0] == "StorageControllers":
                for ii in i[1]:
                    for iii in ii.items():
                        if iii[0] == "Status":
                            for iiii in iii[1].items():
                                idrac_inventory["Storage Controller Information"][
                                    iiii[0]
                                ] = iiii[1]
                        else:
                            idrac_inventory["Storage Controller Information"][
                                iii[0]
                            ] = [iii[1]]
            elif i[0] == "Oem":
                try:
                    for ii in i[1]["Dell"]["DellController"].items():
                        idrac_inventory["Storage Controller Information"][ii[0]] = ii[1]
                except:
                    for ii in i[1]["Dell"].items():
                        idrac_inventory["Storage Controller Information"][ii[0]] = ii[1]
            else:
                idrac_inventory["Storage Controller Information"][i[0]] = i[1]
    else:
        pass


def get_storage_disks_information():
    # message = "\n---- Disk Information ----"
    # print(message)
    for i in controller_list:
        response = requests.get(
            "https://%s/redfish/v1/Systems/System.Embedded.1/Storage/%s"
            % (idrac_ip, i.split("/")[-1]),
            verify=False,
            auth=(idrac_username, idrac_password),
        )
        data = response.json()
        if response.status_code == 200 or response.status_code == 202:
            pass
        else:
            print("- FAIL, GET command failed, detailed error information: %s" % data)
            sys.exit()
        if data["Drives"] == []:
            message = "\n- WARNING, no drives detected for %s" % i.split("/")[-1]
            print(message)
        else:
            for i in data["Drives"]:
                for ii in i.items():
                    response = requests.get(
                        "https://%s%s" % (idrac_ip, ii[1]),
                        verify=False,
                        auth=(idrac_username, idrac_password),
                    )
                    data = response.json()
                    # message = (
                    #     "\n - Detailed drive information for %s -\n"
                    #     % ii[1].split("/")[-1]
                    # )
                    # print(message)
                    for ii in data.items():
                        if ii[0] == "Oem":
                            for iii in ii[1]["Dell"]["DellPhysicalDisk"].items():
                                idrac_inventory["Storage Disks Information"][
                                    iii[0]
                                ] = iii[1]
                        elif ii[0] == "Status":
                            for iii in ii[1].items():
                                idrac_inventory["Storage Disks Information"][
                                    iii[0]
                                ] = iii[1]
                        else:
                            idrac_inventory["Storage Disks Information"][ii[0]] = ii[1]


def get_backplane_information():
    response = requests.get(
        "https://%s/redfish/v1/Chassis" % (idrac_ip),
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print("\n- FAIL, get command failed, error is: %s" % data)
        sys.exit()
    # message = "\n---- Backplane Information ----"
    # print(message)
    backplane_URI_list = []
    for i in data["Members"]:
        backplane = i["@odata.id"]
        if "Enclosure" in backplane:
            backplane_URI_list.append(backplane)
    if backplane_URI_list == []:
        message = "- WARNING, no backplane information detected for system\n"
        print(message)
        sys.exit()
    for i in backplane_URI_list:
        response = requests.get(
            "https://%s%s" % (idrac_ip, i),
            verify=False,
            auth=(idrac_username, idrac_password),
        )
        data = response.json()
        # message = "\n- Detailed backplane information for %s -\n" % i.split("/")[-1]
        # print(message)
        for iii in data.items():
            if (
                iii[0] == "@odata.id"
                or iii[0] == "@odata.context"
                or iii[0] == "Metrics"
                or iii[0] == "Links"
                or iii[0] == "@Redfish.Settings"
                or iii[0] == "@odata.type"
                or iii[0] == "RelatedItem"
                or iii[0] == "Actions"
                or iii[0] == "PCIeDevices"
            ):
                pass
            elif iii[0] == "Oem":
                try:
                    idrac_inventory["Backplane Information"]["Oem"] = {}
                    idrac_inventory["Backplane Information"]["Oem"]["Dell"] = {}
                    idrac_inventory["Backplane Information"]["Oem"]["Dell"][
                        "DellEnclosure"
                    ] = {}
                    for iiii in iii[1]["Dell"]["DellEnclosure"].items():
                        if (
                            iiii[0] == "@odata.context"
                            or iiii[0] == "@odata.type"
                            or iiii[0] == "@odata.id"
                        ):
                            pass
                        else:
                            idrac_inventory["Backplane Information"]["Oem"]["Dell"][
                                "DellEnclosure"
                            ][iiii[0]] = iiii[1]
                except:
                    pass
            else:
                idrac_inventory["Backplane Information"][iii[0]] = iii[1]


def get_network_information():
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1/NetworkInterfaces" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    if response.status_code != 200:
        print("\n- FAIL, get command failed, error is: %s" % data)
        sys.exit()
    # message = "\n---- Network Device Information ----"
    # print(message)
    network_URI_list = []
    for i in data["Members"]:
        network = i["@odata.id"]
        network_URI_list.append(network)
    if network_URI_list == []:
        message = "\n- WARNING, no network information detected for system\n"
        print(message)
    for i in network_URI_list:
        # message = "\n- Network device details for %s -\n" % i.split("/")[-1]
        # print(message)
        i = i.replace("Interfaces", "Adapters")
        response = requests.get(
            "https://%s%s" % (idrac_ip, i),
            verify=False,
            auth=(idrac_username, idrac_password),
        )
        data = response.json()
        if response.status_code != 200:
            print("\n- FAIL, get command failed, error is: %s" % data)
            sys.exit()
        for ii in data.items():
            if ii[0] == "NetworkPorts":
                network_port_urls = []
                url_port = ii[1]["@odata.id"]
                response = requests.get(
                    "https://%s%s" % (idrac_ip, url_port),
                    verify=False,
                    auth=(idrac_username, idrac_password),
                )
                data = response.json()
                if response.status_code != 200:
                    print("\n- FAIL, get command failed, error is: %s" % data)
                    sys.exit()
                else:
                    port_uri_list = []
                    for i in data["Members"]:
                        port_uri_list.append(i["@odata.id"])
            if (
                ii[0] == "@odata.id"
                or ii[0] == "@odata.context"
                or ii[0] == "Metrics"
                or ii[0] == "Links"
                or ii[0] == "@odata.type"
                or ii[0] == "NetworkDeviceFunctions"
                or ii[0] == "NetworkPorts"
                or ii[0] == "Assembly"
            ):
                pass
            elif ii[0] == "Controllers":
                idrac_inventory["Network Device Information"][
                    "Controller Capabilities"
                ] = ii[1][0]["ControllerCapabilities"]
                idrac_inventory["Network Device Information"][
                    "FirmwarePackageVersion"
                ] = ii[1][0]["FirmwarePackageVersion"]
            else:
                idrac_inventory["Network Device Information"][ii[0]] = ii[1]

        for z in port_uri_list:
            response = requests.get(
                "https://%s%s" % (idrac_ip, z),
                verify=False,
                auth=(idrac_username, idrac_password),
            )
            data = response.json()
            if response.status_code != 200:
                print("\n- FAIL, get command failed, error is: %s" % data)
                sys.exit()
            else:
                # message = "\n- Network port details for %s -\n" % z.split("/")[-1]
                # print(message)
                for ii in data.items():
                    if (
                        ii[0] == "@odata.id"
                        or ii[0] == "@odata.context"
                        or ii[0] == "Metrics"
                        or ii[0] == "Links"
                        or ii[0] == "@odata.type"
                    ):
                        pass
                    elif ii[0] == "Oem":
                        try:
                            for iii in ii[1]["Dell"]["DellSwitchConnection"].items():
                                if (
                                    iii[0] == "@odata.context"
                                    or iii[0] == "@odata.type"
                                ):
                                    pass
                                else:
                                    idrac_inventory["Network Device Information"][
                                        iii[0]
                                    ] = iii[1]
                        except:
                            pass
                    else:
                        idrac_inventory["Network Device Information"][ii[0]] = ii[1]


if __name__ == "__main__":
    check_supported_idrac_version()
    if args["s"]:
        get_system_information()
    if args["m"]:
        get_memory_information()
    if args["c"]:
        get_cpu_information()
    if args["f"]:
        get_fan_information()
    if args["ps"]:
        get_ps_information()
    if args["S"]:
        get_storage_controller_information()
        get_storage_disks_information()
        get_backplane_information()
    if args["n"]:
        get_network_information()
    if args["a"]:
        get_system_information()
        get_memory_information()
        get_cpu_information()
        # get_fan_information()
        get_ps_information()
        get_storage_controller_information()
        get_storage_disks_information()
        get_backplane_information()
        get_network_information()

    with open("hw_inventory.json", "w") as write_file:
        json.dump(idrac_inventory, write_file, indent=2)
    print(
        '\n- WARNING, output also captured in "%s\hw_inventory.json" file' % os.getcwd()
    )

