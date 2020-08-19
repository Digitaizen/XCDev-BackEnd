#!/bin/bash
# 
# Usage: bmr-parm BMCIP TgtBlock TgtOS [TgtShare] [TgtShareUser] [TgtSharePswd]
# If less than 3 parms passed then bail out
[ -z "$3" ] && exit 1
# populate parms as passed
BMCIP=$1
TgtBlock=$2
TgtOS=$3
TgtShare=$4
TgtShareUser=$5
TgtSharePswd=$6
# Use default values for XC ADC lab if following not passed
[ -z "$4" ] && TgtShare="//10.211.4.215/dropbox/dl/wims/xc"
[ -z "$5" ] && TgtShareUser="nutanix_admin"
[ -z "$6" ] && TgtSharePswd="raid4us!"


# Get SeqNumber if a xcwebapp worknote entry is already in the lclog
SeqNum=""
SeqNum=`racadm -r "$BMCIP" -u root -p calvin lclog view -c worknotes -k xcwebapp|grep  SeqNumber|tr -d '\r'|cut -d'='  -s -f2 `
# Clear any UserComments in the entry
x0=`racadm -r $BMCIP -u root -p calvin lclog comment edit -q $SeqNum -m " "`

# Create a worknote entry if none found earlier
if [ -z "$SeqNum" ]
then
    x0=`racadm -r "$BMCIP" -u root -p calvin lclog worknote add -m "XCWEBAPP"`
    SeqNum=`racadm -r "$BMCIP" -u root -p calvin lclog view -c worknotes -k xcwebapp|grep SeqNumber|tr -d '\r'|cut -d'=' -s -f2 `
fi

# add a comment in entry SeqNum for BMR parms
x0=`racadm -r $BMCIP -u root -p calvin lclog comment edit -q $SeqNum -m "$TgtShare  $TgtShareUser $TgtSharePswd $TgtBlock $TgtOS"`
# x1=`racadm -r $BMCIP -u root -p calvin lclog view -c worknotes -k xcwebapp|grep UserComment`
x1=`racadm -r "$BMCIP" -u root -p calvin lclog view -q $SeqNum -n 1|grep UserComment|tr -d '\r' `
x2=( $x1 )
x3=${#x2[@]}
# UserComment entries $x3
# TgtOS = ${x2[6]}

if [ $x3 -ne 7 ]
then
    echo "something went wrong"
    exit 1
fi
# power off/on the target system
x0=`racadm -r "$BMCIP" -u root -p calvin serveraction powerdown`
x0=`racadm -r "$BMCIP" -u root -p calvin serveraction powerup`

#return the worknote entry for followup
echo $SeqNum
exit 0

