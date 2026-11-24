$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$dockerHome = Join-Path $repo ".tools\DockerDesktop"
$dockerDesktop = Join-Path $dockerHome "Docker Desktop.exe"
$docker = Join-Path $dockerHome "resources\bin\docker.exe"
$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$temp = Join-Path $repo ".data\temp"
New-Item -ItemType Directory -Force -Path $temp, (Join-Path $repo ".data\logs") | Out-Null
$env:TEMP = $temp
$env:TMP = $temp

if (-not (Test-Path -LiteralPath $docker)) { throw "Docker is not installed. Run processing\finish-docker-admin.ps1 as Administrator." }
if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
}

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  & $docker info *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw "Docker did not become ready within two minutes." }

& $docker compose -f (Join-Path $PSScriptRoot "docker-compose.yml") up -d
if ($LASTEXITCODE -ne 0) { throw "MySQL/Redis containers failed to start." }

$workerLog = Join-Path $repo ".data\logs\resume-worker.log"
Start-Process -FilePath $python -ArgumentList (Join-Path $PSScriptRoot "run_worker.py") -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput $workerLog -RedirectStandardError (Join-Path $repo ".data\logs\resume-worker-error.log")
Write-Host "MySQL, Redis, schema initialization, and the resume worker are running."

