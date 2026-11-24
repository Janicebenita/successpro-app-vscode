$ErrorActionPreference = "Stop"
$repo = "D:\successpro-app-vscode"
$tools = Join-Path $repo ".tools"
$data = Join-Path $repo ".data"

Write-Host "=== SuccessPro Local Native Environment ===" -ForegroundColor Cyan

# 1. Start Garnet (Redis-compatible server on 6380)
try {
    $tcp6380 = Test-NetConnection -ComputerName 127.0.0.1 -Port 6380 -WarningAction SilentlyContinue
    $garnetRunning = $tcp6380.TcpTestSucceeded
} catch { $garnetRunning = $false }

if (-not $garnetRunning) {
    Write-Host "[1/4] Starting Garnet (Redis replacement on port 6380)..." -ForegroundColor Yellow
    $dotnetDir = Join-Path $tools "dotnet"
    $garnetExe = Join-Path $tools "garnet\garnet-server.exe"
    $garnetData = Join-Path $data "garnet"
    $garnetCmd = "set DOTNET_ROOT=$dotnetDir&& set DOTNET_ROOT_X64=$dotnetDir&& `"$garnetExe`" --port 6380 --bind 127.0.0.1 --lua --checkpointdir `"$garnetData`""
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$garnetCmd`"" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/4] Garnet (port 6380) is already running." -ForegroundColor Green
}

# 2. Start MySQL (port 3307)
try {
    $tcp3307 = Test-NetConnection -ComputerName 127.0.0.1 -Port 3307 -WarningAction SilentlyContinue
    $mysqlRunning = $tcp3307.TcpTestSucceeded
} catch { $mysqlRunning = $false }

if (-not $mysqlRunning) {
    Write-Host "[2/4] Starting MySQL (port 3307)..." -ForegroundColor Yellow
    $mysqlExe = Join-Path $tools "mysql\bin\mysqld.exe"
    $mysqlIni = Join-Path $repo "processing\mysql-local.ini"
    $mysqlCmd = "`"$mysqlExe`" --defaults-file=`"$mysqlIni`""
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$mysqlCmd`"" -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[2/4] MySQL (port 3307) is already running." -ForegroundColor Green
}

# 3. Start Resume Worker
$workerRunning = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*processing*" }
if (-not $workerRunning) {
    Write-Host "[3/4] Starting Python Resume Worker..." -ForegroundColor Yellow
    $pythonExe = Join-Path $repo "processing\.venv\Scripts\python.exe"
    $workerCmd = "`"$pythonExe`" processing/run_worker.py"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$workerCmd`"" -WorkingDirectory $repo -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[3/4] Resume Worker is already running." -ForegroundColor Green
}

# 4. Start Next.js Dev Server (port 3000)
try {
    $tcp3000 = Test-NetConnection -ComputerName 127.0.0.1 -Port 3000 -WarningAction SilentlyContinue
    $nextRunning = $tcp3000.TcpTestSucceeded
} catch { $nextRunning = $false }

if (-not $nextRunning) {
    Write-Host "[4/4] Starting Next.js Web Server (http://localhost:3000)..." -ForegroundColor Yellow
    $nodeExe = "C:\Program Files\nodejs\node.exe"
    $nextCli = (Get-ChildItem -Path "$repo\node_modules\.pnpm" -Filter "next" -Directory -Recurse -Depth 2 | Select-Object -First 1).FullName + "\dist\bin\next"
    $nextCmd = "set NODE_OPTIONS=--max-old-space-size=4096&& `"$nodeExe`" `"$nextCli`" dev -p 3000"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$nextCmd`"" -WorkingDirectory (Join-Path $repo "apps\web") -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[4/4] Next.js (port 3000) is already running." -ForegroundColor Green
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "All local services (MySQL, Garnet, Worker, Next.js) are UP!" -ForegroundColor Green
Write-Host "Open in browser: http://localhost:3000/review" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
