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


import requests
import json
import sys
import re
import time
import warnings
import argparse
import os

from datetime import datetime

warnings.filterwarnings("ignore")

parser = argparse.ArgumentParser(
    description="Python script using Redfish API to get system hardware inventory(output will be printed to the screen and also can be exported to a json file by passing argument). This includes information for storage controllers, memory, network devices, general system details, power supplies, hard drives, fans, backplanes, processors"
)
parser.add_argument("-ip", help="iDRAC IP address", required=True)
parser.add_argument("-u", help="iDRAC username", required=True)
parser.add_argument("-p", help="iDRAC password", required=True)
parser.add_argument(
    "script_examples",
    action="store_true",
    help="GetSystemHWInventoryREDFISH.py -ip 192.168.0.120 -u root -p calvin -m y, this example will get only memory information. GetSystemHWInventoryREDFISH.py -ip 192.168.0.120 -u root -p calvin -c y -m y, this example will get only processor and memory information. GetSystemHWInventoryREDFISH.py -ip 192.168.0.120 -u root -p calvin -a y, this example will get all systemInformation: general systemInformation, processor, memory, fans, power supplies, hard drives, storage controllers, network devices",
)
parser.add_argument(
    "-s", help='Get systemInformation only, pass in "y"', required=False
)
parser.add_argument(
    "-m", help='Get memory information only, pass in "y"', required=False
)
parser.add_argument(
    "-c", help='Get processor information only, pass in "y"', required=False
)
parser.add_argument(
    "-f", help='Get fan information only, pass in "y"', required=False)
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
    help='Get all systemInformation / device information, pass in "y"',
    required=False,
)
parser.add_argument(
    "-d", help='Dump results of a query into a JSON file, pass in "y"', required=False
)
parser.add_argument(
    "-pj",
    help='Output results of a query to console in pretty format, pass in "y"',
    required=False,
)


args = vars(parser.parse_args())

idrac_ip = args["ip"]
idrac_username = args["u"]
idrac_password = args["p"]

file_name = "hw_inventory_%s.json" % idrac_ip

idrac_inventory = {
    "SystemInformation": {},
    "MemoryInformation": {},
    "ProcessorInformation": {},
    "StorageControllerInformation": {},
    "StorageDisksInformation": {},
    "NetworkDeviceInformation": {},
    "PowerSupplyInformation": {},
    "BackplaneInformation": {},
    "FanInformation": {},
}

try:
    os.remove(file_name)
except:
    pass


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
        # message = "\n---- systemInformation ----"
        # print(message)
        for i in data.items():
            if (
                i[0] == "@odata.id"
                or i[0] == "@odata.context"
                # "@odata" in i[0]
                or i[0] == "Links"
                or i[0] == "Actions"
                or i[0] == "@odata.type"
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
                idrac_inventory["SystemInformation"]["Oem"] = {}
                idrac_inventory["SystemInformation"]["Oem"]["Dell"] = {}
                idrac_inventory["SystemInformation"]["Oem"]["Dell"]["DellSystem"] = {
                }
                for ii in i[1]["Dell"]["DellSystem"].items():
                    if (
                        # "@odata"
                        # in ii[0]
                        ii[0] == "@odata.context"
                        or ii[0] == "@odata.type"
                        or ii[0] == "@odata.id"
                    ):
                        pass
                    else:
                        idrac_inventory["SystemInformation"]["Oem"]["Dell"][
                            "DellSystem"
                        ][ii[0]] = ii[1]

            # elif i[0] == "Boot":
            #     try:
            #         idrac_inventory["SystemInformation"]["Boot"] = {}
            #         idrac_inventory["SystemInformation"]["Boot"]["BiosBootMode"] = {}
            #         idrac_inventory["SystemInformation"]["Boot"]["BiosBootMode"] = [
            #             i[1]
            #         ]["BootSourceOverrideMode"]
            #     except:
            #         pass

            else:
                idrac_inventory["SystemInformation"][i[0]] = i[1]


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
            idrac_inventory["MemoryInformation"][dimm_slot] = {}
            # message = "\n- Memory details for %s -\n" % dimm_slot
            # print(message)
            for ii in sub_data.items():
                if (
                    # "@odata" in ii[0]
                    ii[0] == "@odata.id"
                    or ii[0] == "@odata.context"
                    or ii[0] == "Assembly"
                    or ii[0] == "Metrics"
                    or ii[0] == "Links"
                ):
                    pass
                elif ii[0] == "Oem":
                    idrac_inventory["MemoryInformation"][dimm_slot]["Oem"] = {}
                    idrac_inventory["MemoryInformation"][dimm_slot]["Oem"]["Dell"] = {
                    }
                    idrac_inventory["MemoryInformation"][dimm_slot]["Oem"]["Dell"][
                        "DellMemory"
                    ] = {}
                    for iii in ii[1]["Dell"]["DellMemory"].items():
                        if iii[0] == "@odata.context" or iii[0] == "@odata.type":
                            # if "@odata" in iii[0]:
                            pass
                        else:
                            idrac_inventory["MemoryInformation"][dimm_slot]["Oem"][
                                "Dell"
                            ]["DellMemory"][iii[0]] = iii[1]
                else:
                    idrac_inventory["MemoryInformation"][dimm_slot][ii[0]] = ii[1]


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
            idrac_inventory["ProcessorInformation"][cpu] = {}
            for ii in sub_data.items():
                if (
                    # "@odata" in ii[0]
                    ii[0] == "@odata.id"
                    or ii[0] == "@odata.context"
                    or ii[0] == "Metrics"
                    or ii[0] == "Links"
                    or ii[0] == "Description"
                    or ii[0] == "Assembly"
                    or ii[0] == "@odata.type"
                ):
                    pass
                elif ii[0] == "Oem":
                    idrac_inventory["ProcessorInformation"][cpu]["Oem"] = {}
                    idrac_inventory["ProcessorInformation"][cpu]["Oem"]["Dell"] = {
                    }
                    idrac_inventory["ProcessorInformation"][cpu]["Oem"]["Dell"][
                        "DellProcessor"
                    ] = {}
                    for iii in ii[1]["Dell"]["DellProcessor"].items():
                        # if "@odata" in iii[0]:
                        if iii[0] == "@odata.context" or iii[0] == "@odata.type":
                            pass
                        else:
                            idrac_inventory["ProcessorInformation"][cpu]["Oem"]["Dell"][
                                "DellProcessor"
                            ][iii[0]] = iii[1]
                else:
                    idrac_inventory["ProcessorInformation"][cpu][ii[0]] = ii[1]


def get_fan_information():
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
        # message = "\n---- Fan Information ----\n"
        # print(message)
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
                    fan_name = data_get["FanName"].replace(" ", "")
                    idrac_inventory["FanInformation"][fan_name] = {}
                    # message = "\n- Details for %s -\n" % data_get["FanName"]
                    # print(message)
                except:
                    pass
                if "Fans" not in data_get.keys():
                    for ii in data_get.items():
                        idrac_inventory["FanInformation"][fan_name][ii[0]] = ii[1]
                    #     message = "%s: %s" % (ii[0], ii[1])
                    #     print(message)
                    #     message = "\n"
                    # message = "\n"
                    # print(message)
                else:
                    count = 0
                    while True:
                        if count == len(fan_list):
                            return
                        for i in data_get["Fans"]:
                            # message = "\n- Details for %s -\n" % i["FanName"]
                            count += 1
                            # print(message)
                            for ii in i.items():
                                idrac_inventory["FanInformation"][fan_name][ii[0]] = ii[
                                    1
                                ]
                                # message = "%s: %s" % (ii[0], ii[1])
                                # print(message)


def get_ps_information():
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
                        ps_name = data_get["Name"].replace(" ", "")
                        idrac_inventory["PowerSupplyInformation"][ps_name] = {}
                        # message = "\n- Details for %s -\n" % data_get["Name"]
                        # print(message)
                        for i in data_get.items():
                            if i[0] == "Oem":
                                try:
                                    idrac_inventory["PowerSupplyInformation"][ps_name][
                                        "Oem"
                                    ] = {}
                                    idrac_inventory["PowerSupplyInformation"][ps_name][
                                        "Oem"
                                    ]["Dell"] = {}
                                    idrac_inventory["PowerSupplyInformation"][ps_name][
                                        "Oem"
                                    ]["Dell"]["DellPowerSupply"] = {}
                                    for ii in i[1]["Dell"]["DellPowerSupply"].items():
                                        idrac_inventory["PowerSupplyInformation"][
                                            ps_name
                                        ]["Oem"]["Dell"]["DellPowerSupply"][ii[0]] = ii[
                                            1
                                        ]
                                except:
                                    print(
                                        "- FAIL, unable to find Dell PowerSupply OEM information"
                                    )
                                    sys.exit()
                            else:
                                idrac_inventory["PowerSupplyInformation"][ps_name][
                                    i[0]
                                ] = i[1]
                    else:
                        if len(data["Links"]["PoweredBy"]) == 1:
                            ps_name = data_get["PowerSupplies"][0]["Name"].replace(
                                " ", ""
                            )
                            idrac_inventory["PowerSupplyInformation"][ps_name] = {
                            }
                            # message = (
                            #     "\n- Details for %s -\n"
                            #     % data_get["PowerSupplies"][0]["Name"]
                            # )
                            # print(message)
                            for i in data_get.items():
                                if i[0] == "PowerSupplies":
                                    idrac_inventory["PowerSupplyInformation"][ps_name][
                                        "PowerSupplies"
                                    ] = {}
                                    for ii in i[1]:
                                        for iii in ii.items():
                                            if iii[0] == "Oem":
                                                idrac_inventory[
                                                    "PowerSupplyInformation"
                                                ][ps_name]["PowerSupplies"]["Oem"] = {}
                                                idrac_inventory[
                                                    "PowerSupplyInformation"
                                                ][ps_name]["PowerSupplies"]["Oem"][
                                                    "Dell"
                                                ] = {}
                                                idrac_inventory[
                                                    "PowerSupplyInformation"
                                                ][ps_name]["PowerSupplies"]["Oem"][
                                                    "Dell"
                                                ][
                                                    "DellPowerSupply"
                                                ] = {}
                                                try:
                                                    for iiii in iii[1]["Dell"][
                                                        "DellPowerSupply"
                                                    ].items():
                                                        idrac_inventory[
                                                            "PowerSupplyInformation"
                                                        ][ps_name]["PowerSupplies"][
                                                            "Oem"
                                                        ][
                                                            "Dell"
                                                        ][
                                                            "DellPowerSupply"
                                                        ][
                                                            iiii[0]
                                                        ] = iiii[
                                                            1
                                                        ]
                                                except:
                                                    print(
                                                        "- FAIL, unable to find Dell PowerSupply OEM information"
                                                    )
                                                    sys.exit()
                                            else:
                                                idrac_inventory[
                                                    "PowerSupplyInformation"
                                                ][ps_name]["PowerSupplies"][
                                                    iii[0]
                                                ] = iii[
                                                    1
                                                ]
                                elif i[0] == "Voltages":
                                    pass
                                elif i[0] == "PowerControl":
                                    idrac_inventory["PowerSupplyInformation"][ps_name][
                                        "PowerSupplies"
                                    ]["PowerControl"] = {}
                                    for ii in i[1]:
                                        for iii in ii.items():
                                            idrac_inventory["PowerSupplyInformation"][
                                                ps_name
                                            ]["PowerSupplies"]["PowerControl"][
                                                iii[0]
                                            ] = iii[
                                                1
                                            ]
                                else:
                                    idrac_inventory["PowerSupplyInformation"][ps_name][
                                        "PowerSupplies"
                                    ][i[0]] = i[1]
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
                                        ps_name = i["Name"].replace(" ", "")
                                        idrac_inventory["PowerSupplyInformation"][
                                            ps_name
                                        ] = {}
                                        # message = "\n- Details for %s -\n" % i["Name"]
                                        # print(message)
                                        for ii in i.items():
                                            if ii[0] == "Oem":
                                                try:
                                                    idrac_inventory[
                                                        "PowerSupplyInformation"
                                                    ][ps_name]["Oem"] = {}
                                                    idrac_inventory[
                                                        "PowerSupplyInformation"
                                                    ][ps_name]["Oem"]["Dell"] = {}
                                                    idrac_inventory[
                                                        "PowerSupplyInformation"
                                                    ][ps_name]["Oem"]["Dell"][
                                                        "DellPowerSupply"
                                                    ] = {}
                                                    for iii in ii[1]["Dell"][
                                                        "DellPowerSupply"
                                                    ].items():
                                                        idrac_inventory[
                                                            "PowerSupplyInformation"
                                                        ][ps_name]["Oem"]["Dell"][
                                                            "DellPowerSupply"
                                                        ][
                                                            iii[0]
                                                        ] = iii[
                                                            1
                                                        ]
                                                except:
                                                    print(
                                                        "- FAIL, unable to find Dell PowerSupply OEM information"
                                                    )
                                                    sys.exit()
                                            else:
                                                idrac_inventory[
                                                    "PowerSupplyInformation"
                                                ][ps_name][ii[0]] = ii[1]
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
        storage_controller = i.split("/")[-1]
        idrac_inventory["StorageControllerInformation"][storage_controller] = {}
        # message = "\n - Detailed controller information for %s -\n" % i.split("/")[-1]
        # print(message)
        for i in data.items():
            if i[0] == "Status":
                pass
            elif "@" in i[0] or "odata" in i[0]:
                pass
            elif i[0] == "StorageControllers":
                idrac_inventory["StorageControllerInformation"][storage_controller][
                    "StorageControllers"
                ] = {}
                for ii in i[1]:
                    for iii in ii.items():
                        if iii[0] == "Status":
                            for iiii in iii[1].items():
                                idrac_inventory["StorageControllerInformation"][
                                    storage_controller
                                ]["StorageControllers"][iiii[0]] = iiii[1]
                        else:
                            idrac_inventory["StorageControllerInformation"][
                                storage_controller
                            ]["StorageControllers"][iii[0]] = [iii[1]]
            elif i[0] == "Oem":
                try:
                    idrac_inventory["StorageControllerInformation"][storage_controller][
                        "Oem"
                    ] = {}
                    idrac_inventory["StorageControllerInformation"][storage_controller][
                        "Oem"
                    ]["Dell"] = {}
                    idrac_inventory["StorageControllerInformation"][storage_controller][
                        "Oem"
                    ]["Dell"]["DellController"] = {}
                    for ii in i[1]["Dell"]["DellController"].items():
                        idrac_inventory["StorageControllerInformation"][
                            storage_controller
                        ]["Oem"]["Dell"]["DellController"][ii[0]] = ii[1]
                except:
                    for ii in i[1]["Dell"].items():
                        idrac_inventory["StorageControllerInformation"][
                            storage_controller
                        ]["Oem"]["Dell"][ii[0]] = ii[1]
            else:
                idrac_inventory["StorageControllerInformation"][storage_controller][
                    i[0]
                ] = i[1]
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
            message = "\n- WARNING, no drives detected for %s" % i.split(
                "/")[-1]
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
                    storage_drive = ii[1].split("/")[-1]
                    idrac_inventory["StorageDisksInformation"][storage_drive] = {}
                    # message = (
                    #     "\n - Detailed drive information for %s -\n"
                    #     % ii[1].split("/")[-1]
                    # )
                    # print(message)
                    for ii in data.items():
                        if ii[0] == "Oem":
                            idrac_inventory["StorageDisksInformation"][storage_drive][
                                "Oem"
                            ] = {}
                            idrac_inventory["StorageDisksInformation"][storage_drive][
                                "Oem"
                            ]["Dell"] = {}
                            idrac_inventory["StorageDisksInformation"][storage_drive][
                                "Oem"
                            ]["Dell"]["DellPhysicalDisk"] = {}
                            for iii in ii[1]["Dell"]["DellPhysicalDisk"].items():
                                idrac_inventory["StorageDisksInformation"][
                                    storage_drive
                                ]["Oem"]["Dell"]["DellPhysicalDisk"][iii[0]] = iii[1]
                        elif ii[0] == "Status":
                            idrac_inventory["StorageDisksInformation"][storage_drive][
                                "Status"
                            ] = {}
                            for iii in ii[1].items():
                                idrac_inventory["StorageDisksInformation"][
                                    storage_drive
                                ]["Status"][iii[0]] = iii[1]
                        else:
                            idrac_inventory["StorageDisksInformation"][storage_drive][
                                ii[0]
                            ] = ii[1]


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
        backplane_name = i.split("/")[-1]
        idrac_inventory["BackplaneInformation"][backplane_name] = {}
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
                    idrac_inventory["BackplaneInformation"][backplane_name]["Oem"] = {
                    }
                    idrac_inventory["BackplaneInformation"][backplane_name]["Oem"][
                        "Dell"
                    ] = {}
                    idrac_inventory["BackplaneInformation"][backplane_name]["Oem"][
                        "Dell"
                    ]["DellEnclosure"] = {}
                    for iiii in iii[1]["Dell"]["DellEnclosure"].items():
                        if (
                            iiii[0] == "@odata.context"
                            or iiii[0] == "@odata.type"
                            or iiii[0] == "@odata.id"
                        ):
                            pass
                        else:
                            idrac_inventory["BackplaneInformation"][backplane_name][
                                "Oem"
                            ]["Dell"]["DellEnclosure"][iiii[0]] = iiii[1]
                except:
                    pass
            else:
                idrac_inventory["BackplaneInformation"][backplane_name][iii[0]] = iii[1]


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
        net_dev_name = i.split("/")[-1]
        idrac_inventory["NetworkDeviceInformation"][net_dev_name] = {}
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
                idrac_inventory["NetworkDeviceInformation"][
                    "Controller Capabilities"
                ] = ii[1][0]["ControllerCapabilities"]
                idrac_inventory["NetworkDeviceInformation"][
                    "FirmwarePackageVersion"
                ] = ii[1][0]["FirmwarePackageVersion"]
            else:
                idrac_inventory["NetworkDeviceInformation"][ii[0]] = ii[1]

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
                net_dev_port = z.split("/")[-1]
                idrac_inventory["NetworkDeviceInformation"][net_dev_name][
                    net_dev_port
                ] = {}
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
                            idrac_inventory["NetworkDeviceInformation"][net_dev_name][
                                net_dev_port
                            ]["Oem"] = {}
                            idrac_inventory["NetworkDeviceInformation"][net_dev_name][
                                net_dev_port
                            ]["Oem"]["Dell"] = {}
                            idrac_inventory["NetworkDeviceInformation"][net_dev_name][
                                net_dev_port
                            ]["Oem"]["Dell"]["DellSwitchConnection"] = {}
                            for iii in ii[1]["Dell"]["DellSwitchConnection"].items():
                                if (
                                    iii[0] == "@odata.context"
                                    or iii[0] == "@odata.type"
                                ):
                                    pass
                                else:
                                    idrac_inventory["NetworkDeviceInformation"][
                                        net_dev_name
                                    ][net_dev_port]["Oem"]["Dell"][
                                        "DellSwitchConnection"
                                    ][
                                        iii[0]
                                    ] = iii[
                                        1
                                    ]
                        except:
                            pass
                    else:
                        idrac_inventory["NetworkDeviceInformation"][net_dev_name][
                            net_dev_port
                        ][ii[0]] = ii[1]


def save_to_json():
    with open(file_name, "w") as write_file:
        json.dump(idrac_inventory, write_file, indent=2)
    print('\n- WARNING, output captured in "%s\%s" file' %
          (os.getcwd(), file_name))


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
    if args["d"]:
        save_to_json()
    if args["pj"]:
        print(json.dumps(idrac_inventory, indent=2))
    else:
        print(json.dumps(idrac_inventory))  # default
