
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
Remove-SmbMapping -LocalPath "X:" -Force
New-SmbMapping -LocalPath 'X:' -RemotePath "\\10.211.4.215\dropbox\dl\WIMs\XC" -UserName $userName -Password $userPassword

# (Get-ChildItem -Directory X:\).name 

$proc = Get-ChildItem X:\ | Sort-Object -Property name -Unique
$hash = @{}
foreach ($p in $proc) {

    $obj = [PSCustomObject]@{name="$p.Name"; value="$p.Name"}
    $hash.add($obj.name, $obj.name)
}
$hash | ConvertTo-Json -Compress

$hash

# $hash = $null

# $hash = @{}

# $proc = Get-ChildItem X:\ | Sort-Object -Property name -Unique

 

# foreach ($p in $proc)

# {

#  $hash.add($p.Name,$p.Name)

# }

# $hash
# $factoryBlockList = Get-ChildItem -Directory -Path X:\ -Name

# $factoryBlockList 
# if ($networkDrive) {
#     Remove-SmbMapping -LocalPath "S:"
# }
# else {

#     New-PSDrive -Name "S" -Root "\\10.211.4.215\dropbox\dl\WIMs\XC" -Persist -PSProvider FileSystem -Credential $credObject
# }

# $networkDrive