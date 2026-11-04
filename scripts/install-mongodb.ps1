param([string]$Version = '8.0.34')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($Version -notmatch '^8\.0\.\d+$') { throw 'Use an explicit MongoDB 8.0 patch version.' }
$installRoot = Join-Path $env:LOCALAPPDATA 'SecureAcademicSharing\tools'
$destination = Join-Path $installRoot ('mongodb-' + $Version)
$manifest = Join-Path $installRoot 'mongodb-path.txt'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$existing = Get-ChildItem -LiteralPath $destination -Filter mongod.exe -Recurse | Select-Object -First 1
if ($existing) {
    Set-Content -LiteralPath $manifest -Value $existing.FullName
    Write-Output ('MongoDB already installed: ' + $existing.FullName)
    exit 0
}
$archive = Join-Path $installRoot ('mongodb-' + $Version + '.zip')
$url = 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-' + $Version + '.zip'
Write-Output ('Downloading MongoDB Community ' + $Version + ' from mongodb.org...')
if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive }
$checksum = [string](Invoke-WebRequest -UseBasicParsing -Uri ($url + '.sha256')).Content
$expected = [regex]::Match($checksum, '[a-fA-F0-9]{64}').Value
$actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
if (!$expected -or $actual -ne $expected) { throw 'MongoDB download checksum did not match. The archive was not extracted.' }
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
$binary = Get-ChildItem -LiteralPath $destination -Filter mongod.exe -Recurse | Select-Object -First 1
if (!$binary) { throw 'mongod.exe was not found in the downloaded archive.' }
Set-Content -LiteralPath $manifest -Value $binary.FullName
Write-Output ('Installed: ' + $binary.FullName)
Write-Output 'Next: npm run db:start'
