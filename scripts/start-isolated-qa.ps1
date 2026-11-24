$root = "D:\successpro-app-vscode"
$env:RESUME_MYSQL_URL = "mysql://successpro:successpro@127.0.0.1:3307/successpro_qa"
$env:RESUME_REDIS_URL = "redis://127.0.0.1:6380/15"
$env:RESUME_LOCAL_STORAGE_ROOT = "D:/successpro-app-vscode/.local/phase4b/resumes"
$env:RESUME_TEMP_ROOT = "D:/successpro-app-vscode/.local/phase4b/resume-temp"
$env:RESUME_AI_PROVIDER = "mock"
$env:DEV_BYPASS_AUTH = "true"
$env:NEXT_PUBLIC_DEV_BYPASS_AUTH = "true"
$env:RESUME_NATIVE_PIPELINE_ENABLED = "true"
$env:NEXT_PUBLIC_RESUME_NATIVE_PIPELINE_ENABLED = "true"
$env:RESUME_NATIVE_LOCAL_USER_ID = "local-developer"
$env:NODE_ENV = "development"
$env:NODE_OPTIONS = "--max-old-space-size=4096"

# Start Python worker
$worker = Start-Process powershell -ArgumentList "-WindowStyle", "Hidden", "-Command", "cd $root; .\processing\.venv\Scripts\python.exe processing\run_worker.py 2>&1 | Tee-Object .local\phase4b\worker.log" -PassThru

# Start Next.js dev server
$web = Start-Process powershell -ArgumentList "-WindowStyle", "Hidden", "-Command", "cd $root\apps\web; .\node_modules\.bin\next.cmd dev --port 3000 2>&1 | Tee-Object ..\..\.local\phase4b\web.log" -PassThru

Write-Host "Started Isolated QA Services! Web Process: $($web.Id), Worker Process: $($worker.Id)"
