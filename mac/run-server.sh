#!/bin/zsh
# Started by the com.tasis.dashboard LaunchAgent. Not meant to be run by
# hand (use Start Dashboard.command for that) — launchd doesn't source
# shell rc files, so nvm has to be loaded explicitly here.
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."
exec npm run start
