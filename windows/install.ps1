# Run ONCE on the Windows server (via windows\install.bat) to make the
# dashboard autonomous: starts at boot without anyone logging in, restarts
# itself if it crashes, and auto-pulls + rebuilds + restarts whenever
# origin/main gets new commits (checked every 5 minutes). Safe to re-run
# any time (e.g. after moving the folder).

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$repoDir = (Get-Location).Path
$repoUrl = "https://github.com/fchiapponi/it-dashboard.git"

function Fail($message) {
  Write-Host ""
  Write-Host $message -ForegroundColor Red
  exit 1
}

function Run($command) {
  Write-Host "> $command"
  cmd /c $command
  if ($LASTEXITCODE -ne 0) { Fail "'$command' failed - see the messages above." }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "Git is not installed. Install it from https://git-scm.com/download/win and run this again."
}
if (-not (Test-Path .env)) {
  Fail "No .env file found. Copy the working .env file into $repoDir and run this again."
}

# A folder copied by hand becomes a git clone of the repo, so the updater
# can pull. Only tracked files are replaced: .env, the database and
# node_modules are left alone.
if (-not (Test-Path .git)) {
  Write-Host "Linking this folder to $repoUrl ..."
  Run "git init -q"
  Run "git remote add origin $repoUrl"
  Run "git fetch origin main"
  Run "git checkout -f -B main origin/main"
}

# The manual launcher must not compete with the scheduled task for the port.
Get-NetTCPConnection -LocalPort 3050 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
$startupDir = [Environment]::GetFolderPath("Startup")
Get-ChildItem $startupDir -Filter "Start Dashboard*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
  Remove-Item $_.FullName
  Write-Host "Removed old startup shortcut $($_.Name)"
}

# npm ci starts node_modules from scratch: one copied from a Mac lacks the
# Windows command shims (prisma.cmd, next.cmd, ...).
Run "npm ci"
Run "npx prisma generate"
Run "npx prisma migrate deploy"
Run "npm run build"

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$powershell = "powershell.exe"

$serverAction = New-ScheduledTaskAction -Execute $powershell -WorkingDirectory $repoDir `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$repoDir\windows\run-server.ps1`""
$serverSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "TASIS Dashboard" -Force -Principal $principal `
  -Action $serverAction -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $serverSettings | Out-Null

$updaterAction = New-ScheduledTaskAction -Execute $powershell -WorkingDirectory $repoDir `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$repoDir\windows\update-and-restart.ps1`""
$updaterTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$updaterSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "TASIS Dashboard Updater" -Force -Principal $principal `
  -Action $updaterAction -Trigger $updaterTrigger -Settings $updaterSettings | Out-Null

Stop-ScheduledTask -TaskName "TASIS Dashboard" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "TASIS Dashboard"

Write-Host ""
Write-Host "Done. The dashboard now:" -ForegroundColor Green
Write-Host "  - runs on http://localhost:3050, starting at boot even without anyone logged in"
Write-Host "  - restarts itself if it crashes"
Write-Host "  - checks origin/main every 5 min and self-updates (pull, build, restart) when there's something new"
Write-Host ""
Write-Host "Logs: $repoDir\dashboard.log and $repoDir\updater.log"
Write-Host "To remove: Unregister-ScheduledTask 'TASIS Dashboard','TASIS Dashboard Updater' (as administrator)"
