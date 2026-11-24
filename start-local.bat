@echo off
title SuccessPro Local Services Starter
echo ========================================================
echo Starting SuccessPro Local Development Services
echo ========================================================

echo 1. Starting MySQL Server on port 3307...
start "MySQL (Port 3307)" cmd /k "cd /d D:\successpro-app-vscode && .tools\mysql\bin\mysqld.exe --defaults-file=processing\mysql-local.ini --console"
timeout /t 3 /nobreak > nul

echo 2. Starting Garnet Server (Redis) on port 6380...
start "Garnet Redis (Port 6380)" cmd /k "set DOTNET_ROOT=D:\successpro-app-vscode\.tools\dotnet&& set DOTNET_ROOT_X64=D:\successpro-app-vscode\.tools\dotnet&& D:\successpro-app-vscode\.tools\garnet\garnet-server.exe --port 6380 --bind 127.0.0.1 --lua"
timeout /t 2 /nobreak > nul

echo 3. Starting Python Resume Worker...
start "Python Worker" cmd /k "cd /d D:\successpro-app-vscode && processing\.venv\Scripts\python.exe processing\run_worker.py"
timeout /t 2 /nobreak > nul

echo 4. Starting Next.js Web App on port 3000...
start "Next.js Web (Port 3000)" cmd /k "cd /d D:\successpro-app-vscode\apps\web && set NODE_OPTIONS=--max-old-space-size=4096&& npx next dev --port 3000"

echo.
echo ========================================================
echo All 4 services launched!
echo Open your browser at: http://localhost:3000/review
echo ========================================================
