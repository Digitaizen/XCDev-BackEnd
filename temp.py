import requests
import json
import sys
import re
import time
import warnings
import argparse
import os

warnings.filterwarnings("ignore")

parser = argparse.ArgumentParser(
    description="Python script using Redfish API to get system hardware inventory(output will be printed to the screen and also can be exported to a json file by passing argument). This includes information for storage controllers, memory, network devices, general system details, power supplies, hard drives, fans, backplanes, processors"
)
parser.add_argument("-ip", help="iDRAC IP address", required=True)
parser.add_argument("-u", help="iDRAC username", required=True)
parser.add_argument("-p", help="iDRAC password", required=True)
parser.add_argument(
    "-m", help='Get memory information only, pass in "y"', required=False
)
parser.add_argument(
    "-s", help='Get systemInformation only, pass in "y"', required=False
)
parser.add_argument(
    "-c", help='Get processor information only, pass in "y"', required=False
)
parser.add_argument(
    "-n", help='Get network device information only, pass in "y"', required=False
)


args = vars(parser.parse_args())

idrac_ip = args["ip"]
idrac_username = args["u"]
idrac_password = args["p"]


idrac_inventory = {
    "MemoryInformation": {},
    "SystemInformation": {},
    "ProcessorInformation": {},
    "NetworkDeviceInformation": {}
}


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
            else:
                idrac_inventory["SystemInformation"][i[0]] = i[1]


def get_memory_information():
    response = requests.get(
        "https://%s/redfish/v1/Systems/System.Embedded.1/Memory" % idrac_ip,
        verify=False,
        auth=(idrac_username, idrac_password),
    )
    data = response.json()
    # print(data)

    for i in data["Members"]:
        dimm = i["@odata.id"].split("/")[-1]
        # print(dimm)
        dimm_slot = re.search("DIMM.+", dimm).group()
        # print(dimm_slot)
        response = requests.get(
            "https://%s%s" % (idrac_ip, i["@odata.id"]),
            verify=False,
            auth=(idrac_username, idrac_password),
        )
        sub_data = response.json()
        # print(sub_data)
        idrac_inventory["MemoryInformation"][dimm_slot] = {}
        # message = "\n- Memory details for %s -\n" % dimm_slot
        # print(message)
        for ii in sub_data.items():
            # print(ii)
            if (
                "@odata" in ii[0]
                # ii[0] == "@odata.id"
                # or ii[0] == "@odata.context"
                or ii[0] == "Assembly"
                or ii[0] == "Metrics"
                or ii[0] == "Links"
            ):
                pass
            else:
                # idrac_inventory["MemoryInformation"][dimm_slot][ii[0]] = ii[1]
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
                else:
                    idrac_inventory["ProcessorInformation"][cpu][ii[0]] = ii[1]


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
                    else:
                        idrac_inventory["NetworkDeviceInformation"][net_dev_name][
                            net_dev_port
                        ][ii[0]] = ii[1]


if __name__ == "__main__":
    if args["s"]:
        get_system_information()
    if args["m"]:  # NOT WORKING
        get_memory_information()
    if args["c"]:
        get_cpu_information()
    if args["n"]:
        get_network_information()


print(json.dumps(idrac_inventory))
