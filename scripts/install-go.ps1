$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$goRoot = Join-Path $env:LOCALAPPDATA 'SecureAcademicSharing\tools\go-sdk'
if (!(Test-Path (Join-Path $goRoot 'go\bin\go.exe'))) {
    $release = (Invoke-RestMethod 'https://go.dev/dl/?mode=json') | Where-Object stable | Select-Object -First 1
    $file = $release.files | Where-Object { $_.os -eq 'windows' -and $_.arch -eq 'amd64' -and $_.kind -eq 'archive' } | Select-Object -First 1
    New-Item -ItemType Directory -Force -Path $goRoot | Out-Null
    $archive = Join-Path $goRoot $file.filename
    Invoke-WebRequest -UseBasicParsing -Uri ('https://go.dev/dl/' + $file.filename) -OutFile $archive
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $file.sha256) { throw 'Go download checksum mismatch' }
    Expand-Archive -LiteralPath $archive -DestinationPath $goRoot -Force
}
& (Join-Path $goRoot 'go\bin\go.exe') version
