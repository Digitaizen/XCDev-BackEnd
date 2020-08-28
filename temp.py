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


args = vars(parser.parse_args())

idrac_ip = args["ip"]
idrac_username = args["u"]
idrac_password = args["p"]


idrac_inventory = {
    "MemoryInformation": {}
}


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


if __name__ == "__main__":
    if args["m"]:  # NOT WORKING
        get_memory_information()


print(json.dumps(idrac_inventory["MemoryInformation"]))
