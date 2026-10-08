@echo off
rem Double-click this file on the Windows server to update and start TASIS One:
rem it stops the running copy (if any), pulls the latest code from GitHub,
rem installs new dependencies, updates the database, rebuilds and starts it.
rem
rem TASIS One runs in a separate minimized window called "TASIS One server".
rem Closing that window (or logging off) stops it.

setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=3060
set URL=http://localhost:%PORT%

echo == TASIS One launcher ==
echo.

rem --- 1. Node.js and Git present? ------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install Node.js from https://nodejs.org ^(LTS version^), then double-click this file again.
  start "" https://nodejs.org
  goto end
)
for /f "delims=" %%v in ('node --version') do echo Node.js: %%v

where git >nul 2>&1
if errorlevel 1 (
  echo Git is not installed, so updates can't be downloaded.
  echo Please install it from https://git-scm.com/download/win, then double-click this file again.
  start "" https://git-scm.com/download/win
  goto end
)

rem --- 2. .env present? ------------------------------------------------------
if not exist .env (
  echo.
  echo No .env file found.
  echo Copy the working .env file into this same folder ^(ask whoever set this up for it^), then double-click this file again.
  explorer /select,"%CD%\.env.example"
  goto end
)

rem --- 3. Stop the running copy -----------------------------------------------
rem It has to be stopped before updating: Windows locks the files it uses.
curl.exe -sf %URL% >nul 2>&1
if not errorlevel 1 (
  echo TASIS One is running. Stopping it to install updates...
  taskkill /FI "WINDOWTITLE eq TASIS One server*" /T /F >nul 2>&1
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do taskkill /PID %%p /T /F >nul 2>&1
  timeout /t 2 /nobreak >nul
)

rem --- 4. Download updates ------------------------------------------------------
echo Downloading updates from GitHub...
for /f %%h in ('git rev-parse HEAD') do set OLD_HEAD=%%h
git pull --ff-only
if errorlevel 1 (
  echo.
  echo WARNING: couldn't download updates ^(no network, login needed, or files changed on this server^).
  echo Starting the version that is already here.
  echo.
)
for /f %%h in ('git rev-parse HEAD') do set NEW_HEAD=%%h
if "%OLD_HEAD%"=="%NEW_HEAD%" (echo Already up to date.) else (echo Updated to %NEW_HEAD:~0,7%.)

rem --- 5. Dependencies -----------------------------------------------------
rem node_modules copied from a Mac doesn't work here: delete it and run this again.
set NEED_INSTALL=
if not exist node_modules set NEED_INSTALL=1
if not "%OLD_HEAD%"=="%NEW_HEAD%" (
  git diff --quiet %OLD_HEAD% %NEW_HEAD% -- package.json package-lock.json || set NEED_INSTALL=1
)
if defined NEED_INSTALL (
  echo Installing dependencies ^(this can take a few minutes^)...
  call npm install || goto fail
)

rem --- 6. Database -----------------------------------------------------------
echo Updating the database...
call npx prisma generate || goto fail
call npx prisma migrate deploy || goto fail
call npm run db:seed || goto fail

rem --- 7. Build ----------------------------------------------------------------
echo Building...
call npm run build || goto fail

rem --- 8. Start in its own window ---------------------------------------------
echo Starting TASIS One on port %PORT%...
start "TASIS One server" /min cmd /c "npx next start -p %PORT% > "%CD%\helpdesk.log" 2>&1"

for /l %%i in (1,1,30) do (
  curl.exe -sf %URL% >nul 2>&1 && goto up
  timeout /t 1 /nobreak >nul
)
echo.
echo Something went wrong - check %CD%\helpdesk.log for details.
goto end

:up
echo.
echo TASIS One is up: %URL%
start "" %URL%
echo You can close this window. TASIS One keeps running in the minimized "TASIS One server" window.
echo Logs: %CD%\helpdesk.log
goto end

:fail
echo.
echo Setup failed - see the messages above. TASIS One is NOT running.

:end
echo.
pause
