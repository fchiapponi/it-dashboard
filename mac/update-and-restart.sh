#!/bin/zsh
# Run every 5 minutes by the com.tasis.dashboard-updater LaunchAgent. Pulls
# origin/main, and if there's anything new, rebuilds and restarts the
# com.tasis.dashboard service. A no-op (fast, silent) when already current.
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."

echo "$(date '+%Y-%m-%d %H:%M:%S') checking for updates..."
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') up to date ($LOCAL)"
  exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') updating $LOCAL -> $REMOTE"
git merge --ff-only origin/main
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

echo "$(date '+%Y-%m-%d %H:%M:%S') restarting dashboard service"
launchctl kickstart -k "gui/$(id -u)/com.tasis.dashboard"
echo "$(date '+%Y-%m-%d %H:%M:%S') done"
