@echo off
rem Windows version of "Start Dashboard.command". Double-click to install
rem (first run only), build and start the TASIS dashboard.
rem To run it permanently (start at boot, restart on crash, self-update),
rem double-click windows\install.bat once instead.

cd /d "%~dp0"
set PORT=3050

where node >nul 2>&1 || (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  start https://nodejs.org
  pause
  exit /b 1
)

rem When the scheduled task from windows\install.bat is already running the
rem dashboard, just open it instead of starting a second copy.
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul && (
  start "" http://localhost:%PORT%
  exit /b 0
)

if not exist .env (
  echo No .env file found. Copy the working .env file into this folder and run this again.
  pause
  exit /b 1
)

rem Pull the latest code first when this folder is a git clone; a folder
rem copied by hand just starts with what it has.
if exist .git (
  where git >nul 2>&1 && (
    echo Updating code...
    call git pull --ff-only || echo Could not update, starting with the current code.
    call npm install || goto :error
  )
)

if not exist node_modules call npm install || goto :error
call npx prisma generate || goto :error
call npx prisma migrate deploy || goto :error
call npm run build || goto :error

echo.
echo Dashboard starting on http://localhost:%PORT% - keep this window open.
start "" http://localhost:%PORT%
call npm run start
pause
exit /b 0

:error
echo.
echo Something went wrong - see the messages above.
pause
exit /b 1
