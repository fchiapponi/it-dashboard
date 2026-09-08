# TASIS Control Room Dashboard

A single-page, TV-oriented dashboard for TASIS (The American School In Switzerland) IT staff: live status of network printers, IP cameras, and Wi-Fi access points, all on one screen, dark "terminal" theme, glass panels, scales automatically from a laptop browser up to a 4K TV.

No login, no settings UI — everything is either polled directly from the devices or pulled from the Meraki cloud API, and printers/cameras are declared in a single source-of-truth code file.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Prisma 6** + SQLite — stores printer/camera inventory, live status and printer supply-level history
- **net-snmp** — queries printers over the standard Printer-MIB (RFC 3805) for toner/ink/paper levels
- **onvif** — probes IP cameras over ONVIF to confirm they're reachable
- **Cisco Meraki Dashboard API** — pulls live access point status directly from the cloud (no local polling needed)
- **node-cron** — runs the background printer/camera polling loop (`src/instrumentation.ts`)

## Prerequisites

- Node.js 20+ and npm
- Network access to the printer and camera subnets (see **Network requirements** below)
- A Cisco Meraki Dashboard API key, if you want access points (optional — the dashboard works fine without it, that column just stays empty)

## Setup

```bash
git clone git@github.com:fchiapponi/tasis-dashboard.git
cd tasis-dashboard
npm install

cp .env.example .env
# edit .env — see the table below

npx prisma generate
npx prisma migrate deploy   # creates prisma/dev.db and applies the schema

npm run build
npm run start               # production server, defaults to http://localhost:3000
```

For day-to-day development (hot reload) use `npm run dev` instead of `build`+`start`. `PORT=3050 npm run start` picks a specific port if 3000 is already taken by something else on the machine.

## Environment variables (`.env`)

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | SQLite connection string. **Must be `file:./dev.db...`, not `file:./prisma/dev.db...`** — Prisma resolves this path relative to `prisma/schema.prisma`'s own directory, so the extra `prisma/` prefix would create a stray nested `prisma/prisma/dev.db`. The `?connection_limit=1&socket_timeout=20` part serializes SQLite access so polling dozens of devices concurrently doesn't hit "database is locked" errors. |
| `CREDENTIALS_ENCRYPTION_KEY` | Random key used to encrypt SNMP community strings and camera passwords at rest in the database. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and never change it once devices exist (it won't be able to decrypt old rows). |
| `PRINTER_POLL_INTERVAL_MS` | How often the background job re-queries every printer over SNMP (default 300000 = 5 min). |
| `CAMERA_POLL_INTERVAL_MS` | How often it re-probes every camera over ONVIF (default 60000 = 1 min). |
| `MERAKI_API_KEY` | Cisco Meraki Dashboard API key (Dashboard → your profile icon → *My profile* → *API access* → generate). Leave empty to skip access points entirely. |
| `MERAKI_ORG_ID` | The Meraki organization ID that owns the access points. Find it by calling `https://api.meraki.com/api/v1/organizations` with the API key, or from the dashboard URL. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google Calendar OAuth credentials. The calendar integration is currently built but not shown on the dashboard (see **Currently disabled** below) — these only matter if you re-enable it. |

## Adding or removing printers and cameras

There is no settings page. Edit **`src/config/devices.ts`**:

```ts
export const PRINTERS: PrinterConfig[] = [
  { name: "Art Center", ipAddress: "172.25.200.2" },
  { name: "Aurora", ipAddress: "172.25.200.4", snmpCommunity: "public", snmpVersion: 2 },
];

export const CAMERAS: CameraConfig[] = [
  { name: "Front Gate", protocol: "onvif", host: "172.30.1.25" },
];
```

On every startup (`npm run dev` / `npm run start`), `src/lib/device-sync.ts` reconciles the database against this file: printers/cameras whose IP is no longer listed are deleted, new ones are created, and existing ones have their name/settings updated. **Restart the server after editing this file** for changes to take effect. `snmpCommunity` defaults to `"public"` and `snmpVersion` to `2` if omitted.

Access points need no configuration here at all — every wireless device (`productType: "wireless"`) visible to the Meraki API key shows up automatically.

## Network requirements

Printers and cameras live on the school's internal LAN and are (rightly) not reachable from the public internet. **The machine running this app must be on the same network as them**, or reachable to it via VPN/tunnel — hosting it on a public cloud platform (Vercel, etc.) will not work for the printers/cameras column unless you also set up a tunnel (Tailscale, WireGuard, Cloudflare Tunnel...) back into that LAN.

Access points are the exception: since they're fetched from Meraki's cloud API rather than polled directly, that column works from anywhere with internet access.

## Running it permanently

`npm run start` only stays up as long as its terminal/session does. To keep it running across reboots and crashes, use a process manager, e.g. [pm2](https://pmpm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start npm --name tasis-dashboard -- start
pm2 save
pm2 startup   # prints the command to make pm2 itself start on boot
```

On a Mac, a `launchd` LaunchDaemon is the native alternative; on Windows, a real Windows Service (e.g. via `nssm`) or a Task Scheduler task set to "run whether user is logged on or not".

## Project structure

```
src/
  app/
    page.tsx                the entire dashboard (single page, no routing)
    api/                     REST endpoints backing the dashboard
      printers/              CRUD + poll-now + poll-all
      cameras/                CRUD + poll-now + poll-all + snapshot proxy
      access-points/          GET (proxies the Meraki API, 20s cache)
      calendar/               OAuth flow + events (built, not currently shown)
  components/
    layout/                  Clock, Countdowns (17:00 / Friday 17:00 timers)
    ui/                      TerminalPanel, StatTile, StatusBadge, LevelBar
  config/devices.ts          <- single source of truth for printers & cameras
  lib/
    snmp-printer.ts           SNMP walk + Printer-MIB parsing
    onvif-camera.ts           ONVIF probing
    meraki.ts                 Meraki Dashboard API client
    printer-service.ts /
    camera-service.ts         polling orchestration + DB writes
    device-sync.ts             reconciles the DB against config/devices.ts
    crypto.ts                  encrypts SNMP/camera credentials at rest
  instrumentation.ts          starts the cron polling loop on boot
prisma/schema.prisma          Printer, Camera, PrinterSupply, PrinterReading, CalendarIntegration
```

## Currently disabled

- **Calendar**: fully implemented (OAuth, event fetching) but not rendered on the dashboard — removed from the UI to keep the layout focused on printers/cameras/access points. Re-add a panel in `page.tsx` using `useCalendarStatus`/`useCalendarEvents` from `src/lib/hooks.ts` to bring it back.
- **Camera video**: cameras show reachability status only, not a live snapshot/stream — deliberate, to keep the dashboard lightweight and fast at high device counts.

## Known quirks

- Some printer models misreport their ink/toner cartridges under the Printer-MIB "waste" type code instead of "ink"/"toner" — `src/lib/snmp-printer.ts` corrects this by trusting the free-text supply description over the numeric type when they disagree.
- A few printers expose two distinct SNMP rows under the exact same commercial supply name (e.g. two "Black Ink Cartridge" entries); these are automatically suffixed `(1)`, `(2)` so neither reading is silently dropped.
