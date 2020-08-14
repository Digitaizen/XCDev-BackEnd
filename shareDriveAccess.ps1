# Article Link for credentials creation help
# https://pscustomobject.github.io/powershell/howto/Store-Credentials-in-PowerShell-Script/


# Define variables
$networkDrive = $null

# Define clear text string for username and password
[string]$userName = 'idm\nutanix_admin'
[string]$userPassword = 'raid4us!'

# Convert to SecureString
[securestring]$secStringPassword = ConvertTo-SecureString $userPassword -AsPlainText -Force

# Create credential object
[pscredential]$credObject = New-Object System.Management.Automation.PSCredential ($userName, $secStringPassword)

# Mapping the shared drive
New-SmbMapping -LocalPath 'X:' -RemotePath "\\10.211.4.215\dropbox\dl\WIMs\XC" -UserName $userName -Password $userPassword

(Get-ChildItem -Directory X:\).name 
# if ($networkDrive) {
#     Remove-SmbMapping -LocalPath "S:"
# }
# else {

#     New-PSDrive -Name "S" -Root "\\10.211.4.215\dropbox\dl\WIMs\XC" -Persist -PSProvider FileSystem -Credential $credObject
# }

# $networkDrive