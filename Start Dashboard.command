#!/bin/zsh
# Double-click this file to install (first run only), build, start and open
# the TASIS dashboard. Safe to double-click again any time — if it's already
# running it just reopens the browser tab.

set -e
cd "$(dirname "$0")"

PORT="${PORT:-3050}"
URL="http://localhost:${PORT}"

echo "== TASIS Dashboard launcher =="
echo

# --- 1. Node.js present? ------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  if command -v brew >/dev/null 2>&1; then
    echo "Installing it with Homebrew (this can take a few minutes)..."
    brew install node@20
    export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"
  else
    echo "Please install Node.js from https://nodejs.org (LTS version), then double-click this file again."
    open "https://nodejs.org"
    read "?Press Return to close this window..."
    exit 1
  fi
fi
echo "Node.js: $(node --version)"

# --- 2. Already running? -------------------------------------------------
if curl -sf "$URL" >/dev/null 2>&1; then
  echo "Dashboard is already running — opening it in your browser."
  open "$URL"
  sleep 1
  exit 0
fi

# --- 3. .env present? ------------------------------------------------------
if [ ! -f .env ]; then
  echo
  echo "No .env file found."
  echo "Copy the working .env file into this same folder (ask whoever set this up for it), then double-click this file again."
  cp .env.example .env 2>/dev/null || true
  open -R "$PWD/.env.example"
  read "?Press Return to close this window..."
  exit 1
fi

# --- 4. Dependencies ---------------------------------------------------
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only, this can take a few minutes)..."
  npm install
fi

# --- 5. Database ---------------------------------------------------------
echo "Setting up the database..."
npx prisma generate
npx prisma migrate deploy

# --- 6. Build --------------------------------------------------------------
echo "Building..."
npm run build

# --- 7. Start in the background --------------------------------------------
echo "Starting the dashboard on port ${PORT}..."
PORT="$PORT" nohup npm run start > "$PWD/dashboard.log" 2>&1 &
disown

for _ in $(seq 1 30); do
  if curl -sf "$URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if curl -sf "$URL" >/dev/null 2>&1; then
  echo
  echo "Dashboard is up: $URL"
  open "$URL"
  echo "You can close this window — the dashboard keeps running in the background."
  echo "Logs: $PWD/dashboard.log"
else
  echo
  echo "Something went wrong — check $PWD/dashboard.log for details."
fi

read "?Press Return to close this window..."
