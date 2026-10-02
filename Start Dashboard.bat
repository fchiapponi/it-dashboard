@echo off
rem Windows version of "Start Dashboard.command". Double-click to install
rem (first run only), build and start the TASIS dashboard.
rem To start it automatically at boot: Win+R, shell:startup, and put a
rem shortcut to this file in that folder.

cd /d "%~dp0"
set PORT=3050

where node >nul 2>&1 || (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist .env (
  echo No .env file found. Copy the working .env file into this folder and run this again.
  pause
  exit /b 1
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
