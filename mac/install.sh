#!/bin/zsh
# Run ONCE on the Mac driving the TV to make the dashboard autonomous:
# starts at login, restarts itself if it crashes, and auto-pulls +
# rebuilds + restarts whenever origin/main gets new commits (checked every
# 5 minutes). Safe to re-run any time (e.g. after moving the repo).
set -e
cd "$(dirname "$0")/.."
REPO_DIR="$PWD"
AGENTS_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$AGENTS_DIR"

chmod +x mac/run-server.sh mac/update-and-restart.sh

for name in dashboard updater; do
  case "$name" in
    dashboard) label="com.tasis.dashboard" ;;
    updater) label="com.tasis.dashboard-updater" ;;
  esac
  dest="$AGENTS_DIR/${label}.plist"
  sed "s#__REPO_DIR__#${REPO_DIR}#g" "mac/${name}.plist.template" > "$dest"
  echo "Wrote $dest"
done

for label in com.tasis.dashboard com.tasis.dashboard-updater; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS_DIR/${label}.plist"
  launchctl enable "gui/$(id -u)/$label"
done

echo
echo "Done. The dashboard now:"
echo "  - starts automatically at login"
echo "  - restarts itself if it crashes"
echo "  - checks origin/main every 5 min and self-updates (pull, build, restart) when there's something new"
echo
echo "Logs: $REPO_DIR/dashboard.log and $REPO_DIR/updater.log"
echo "To remove: launchctl bootout gui/\$(id -u)/com.tasis.dashboard gui/\$(id -u)/com.tasis.dashboard-updater"
