# SuccessPro Local Services Starter (PowerShell)
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting SuccessPro Local Development Services" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = "D:\successpro-app-vscode"

# 1. Start MySQL
Write-Host "1. Starting MySQL Server on port 3307..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $root; .\.tools\mysql\bin\mysqld.exe --defaults-file=processing\mysql-local.ini --console"
Start-Sleep -Seconds 3

# 2. Start Garnet (Redis with Lua)
Write-Host "2. Starting Garnet Server (Redis) on port 6380 with Lua..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "set DOTNET_ROOT=$root\.tools\dotnet&& set DOTNET_ROOT_X64=$root\.tools\dotnet&& $root\.tools\garnet\garnet-server.exe --port 6380 --bind 127.0.0.1 --lua"
Start-Sleep -Seconds 2

# 3. Start Python Resume Worker
Write-Host "3. Starting Python Resume Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $root; .\processing\.venv\Scripts\python.exe processing\run_worker.py"
Start-Sleep -Seconds 2

# 4. Start Next.js Web Dev Server
Write-Host "4. Starting Next.js Web Server on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $root\apps\web; `$env:NODE_OPTIONS='--max-old-space-size=4096'; .\node_modules\.bin\next.cmd dev --port 3000"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "All 4 services started successfully in separate windows!" -ForegroundColor Green
Write-Host "Open in browser: http://localhost:3000/review" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
