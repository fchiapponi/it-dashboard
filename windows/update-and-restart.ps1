# Run every 5 minutes by the "TASIS Dashboard Updater" scheduled task.
# Pulls origin/main, and if there's anything new, rebuilds and restarts the
# dashboard. A no-op (fast, silent) when already current.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Log($message) {
  Add-Content updater.log "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
}

# Runs a command through cmd so its output lands in updater.log as plain
# text, and stops the update if it fails. The tasks run as SYSTEM while the
# folder belongs to a user, hence safe.directory.
function Run($command) {
  cmd /c "$command >> updater.log 2>&1"
  if ($LASTEXITCODE -ne 0) { throw "'$command' failed (exit $LASTEXITCODE)" }
}

try {
  Run "git -c safe.directory=* fetch origin main"
  $local = (git -c safe.directory=* rev-parse HEAD).Trim()
  $remote = (git -c safe.directory=* rev-parse origin/main).Trim()
  if ($local -eq $remote) { exit 0 }

  Log "updating $local -> $remote"
  Run "git -c safe.directory=* merge --ff-only origin/main"
  Run "npm install"
  Run "npx prisma generate"
  Run "npx prisma migrate deploy"
  Run "npm run build"

  # run-server.ps1 starts the server again as soon as it exits.
  Log "restarting dashboard"
  Get-NetTCPConnection -LocalPort 3050 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  Log "done"
} catch {
  Log "update failed: $_"
  exit 1
}
