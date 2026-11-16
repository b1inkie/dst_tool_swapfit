@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found. Install Node.js and reopen this file.
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found. Check your Node.js installation.
    pause
    exit /b 1
)
where cargo >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust cargo was not found. Install Rust and reopen this file.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm ci
    if errorlevel 1 goto :failed
)

echo Starting DST SwapFit...
echo Keep this window open while using the application.
call npm run tauri dev
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo [ERROR] Startup failed. See the output above for details.
pause
exit /b 1
