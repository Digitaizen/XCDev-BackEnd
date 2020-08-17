umount /mnt/nightFlyter
mount.cifs //10.211.4.215/dropbox/dl/WIMs/XC /mnt/nightFlyter/ -o user=nutanix_admin,pass=raid4us!
umount /mnt/nightFlyter
# cd /mnt/nightFlyter
# ls -d */ | sed 's#/##'