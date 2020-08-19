# Article Link for credentials creation help
# https://pscustomobject.github.io/powershell/howto/Store-Credentials-in-PowerShell-Script/

# Define clear text password
[string]$userPassword = 'raid4us!'

# Crete credential Object
[SecureString]$secureString = $userPassword | ConvertTo-SecureString -AsPlainText -Force 

# Get content of the string
[string]$stringObject = ConvertFrom-SecureString $secureString

# Save Content to file
$stringObject | Set-Content -Path '.\utilities\accessString.txt'