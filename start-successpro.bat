@echo off
title SuccessPro Launcher
echo ========================================================
echo           Starting SuccessPro (Port 3000)
echo   Interview Copilot (5173 / 8000) will remain untouched!
echo ========================================================

echo [1/4] Starting MySQL on port 3307...
start "SuccessPro - MySQL" "D:\successpro-app-vscode\.tools\mysql\bin\mysqld.exe" --defaults-file="D:\successpro-app-vscode\processing\mysql-local.ini" --console

timeout /t 2 /nobreak >nul

echo [2/4] Starting Garnet Redis on port 6380...
start "SuccessPro - Redis" cmd /c "set DOTNET_ROOT=D:\successpro-app-vscode\.tools\dotnet&& set DOTNET_ROOT_X64=D:\successpro-app-vscode\.tools\dotnet&& D:\successpro-app-vscode\.tools\garnet\garnet-server.exe --port 6380 --bind 127.0.0.1 --lua --memory 128m --page 2m --index 16m"

timeout /t 1 /nobreak >nul

echo [3/4] Starting Python Extraction Worker...
start "SuccessPro - Worker" cmd /c "cd /d D:\successpro-app-vscode && processing\.venv\Scripts\python.exe processing\run_worker.py"

timeout /t 1 /nobreak >nul

echo [4/4] Starting Next.js Web App on port 3000...
start "SuccessPro - Web (Port 3000)" cmd /c "cd /d D:\successpro-app-vscode\apps\web && set NODE_OPTIONS=--max-old-space-size=4096&& node_modules\.bin\next.cmd dev --port 3000"

echo ========================================================
echo All SuccessPro services are running!
echo Open your browser at: http://localhost:3000/review
echo ========================================================
