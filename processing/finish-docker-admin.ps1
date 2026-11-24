#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$installer = Join-Path $repo ".tools\installers\DockerDesktopInstaller.exe"
$dockerHome = Join-Path $repo ".tools\DockerDesktop"
$dockerData = Join-Path $repo ".data\docker-wsl"
$installTemp = Join-Path $repo ".data\windows-install-temp"
New-Item -ItemType Directory -Force -Path $installTemp | Out-Null
$env:TEMP = $installTemp
$env:TMP = $installTemp

if (-not (Test-Path -LiteralPath $installer)) { throw "Docker installer is missing: $installer" }

$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
wsl.exe --status *> $null
$wslReady = $LASTEXITCODE -eq 0
$ErrorActionPreference = $previousErrorPreference

if (-not $wslReady) {
  $ErrorActionPreference = "Continue"
  wsl.exe --install --no-distribution --web-download
  $installExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($installExitCode -ne 0 -and $installExitCode -ne 3010) {
    throw "WSL installation failed with exit code $installExitCode. Run 'wsl.exe --install' manually, then restart Windows."
  }
  Write-Host "WSL was enabled. Restart Windows, then run this script again as Administrator."
  exit 3010
}

$arguments = @(
  "install", "--user", "--quiet", "--accept-license",
  "--installation-dir=$dockerHome",
  "--wsl-default-data-root=$dockerData",
  "--windows-containers-default-data-root=$(Join-Path $repo '.data\docker-windows')"
)
$process = Start-Process -FilePath $installer -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Docker installation failed with exit code $($process.ExitCode)." }
Write-Host "Docker Desktop installed on D:. Run processing\start-processing.ps1 next."

