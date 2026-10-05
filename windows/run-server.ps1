# Started at boot by the "TASIS Dashboard" scheduled task. Not meant to be
# run by hand (use Start Dashboard.bat for that). Keeps the server up: if
# it exits (crash, or killed by the updater after a rebuild) it is
# started again a few seconds later.

Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PORT = "3050"

while ($true) {
  Add-Content dashboard.log "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') starting dashboard on port $env:PORT"
  cmd /c "npm run start >> dashboard.log 2>&1"
  Add-Content dashboard.log "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') dashboard exited, restarting in 5s"
  Start-Sleep -Seconds 5
}
