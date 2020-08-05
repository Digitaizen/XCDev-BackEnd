#!/bin/bash

if [ $# -lt 1 ] || [ $# -gt 2 ] || [[ ! "$1" =~ ^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}/[0-9]{1,2}$ ]] || [ $# -eq 2 -a "$2" != 'open' ] ; then
    echo "
Usage: $0 <subnet> [open]
       Parameters:
         <subnet>  -- Subnet to be scanned specified in this format: <network address>/<mask>
Examples:
       $0 192.168.101.0/24
       $0 10.10.0.0/16
"
    exit 1
fi

function check_idrac_http ()
{
    local IP_ADDR=$1
    local TMP_DIR=$2

    if curl -m 30 -s -k https://$IP_ADDR | grep -q 'start.html' ; then
	echo $IP_ADDR > $TMP_DIR/$IP_ADDR
    else
	# echo "Not iDRAC: $IP_ADDR"
	true
    fi
}

declare NETWORK=$1

declare -r TMP_DIR_PATHNAME=/tmp/tmp.$$.discover_idracs
rm -rf $TMP_DIR_PATHNAME
mkdir $TMP_DIR_PATHNAME || exit 1
declare -r TMP_FILE_PATHNAME1=$TMP_DIR_PATHNAME/nmap_scan_output.txt
declare -r TMP_FILE_PATHNAME2=$TMP_DIR_PATHNAME/idrac_list.txt

nmap --open -n -sS -p T:22,80,443,5900 $NETWORK > $TMP_FILE_PATHNAME1
echo -e `grep -P 'report for|open' $TMP_FILE_PATHNAME1 |sed 's/Nmap/\\\\n/g'` | grep -P 'ssh[^:]+http[^:]+https[^:]+vnc[^:]+' | grep -P -o ' [0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3} ' > $TMP_FILE_PATHNAME2

IDRAC_IP_ADDR_LIST=''
for IP_ADDRESS in $(<$TMP_FILE_PATHNAME2) ; do
    check_idrac_http $IP_ADDRESS $TMP_DIR_PATHNAME &
done
wait
cd $TMP_DIR_PATHNAME
2>/dev/null ls -1 *.*.*.*
cd /tmp
rm -rf $TMP_DIR_PATHNAME
