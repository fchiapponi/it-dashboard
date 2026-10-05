@echo off
rem Double-click ONCE on the Windows server to make the dashboard
rem autonomous (see install.ps1). Asks for administrator rights, which
rem creating the scheduled tasks needs.

net session >nul 2>&1 || (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
