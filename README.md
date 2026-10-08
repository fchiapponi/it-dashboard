# TASIS One

One web app for TASIS staff to:

- **Tickets**: report problems to **IT**, **Facilities** or **Kitchen & Dining** (more departments can be added from Admin). Each ticket has a category, location, priority, assignee, a reply thread and internal notes that only agents can see.
- **Inventory**:
  - **Assets** with serial numbers. Each one has a QR label; scanning it opens the asset page with a *Report a problem* button.
  - **Consumables**, with stock movements and low-stock warnings. Agents can book consumables used on a ticket directly from that ticket.
- **Visitors**: staff pre-register the people they expect. Reception checks visitors in and out with a badge number, prints visitor badges and always has an "on site now" list.
- **Deliveries**: reception logs incoming parcels and marks them as collected. Recipients see what's waiting for them on their dashboard.
- **Events**: staff create events and say what IT, Facilities and Kitchen & Dining need to do. Each need becomes a ticket for that department, linked back to the event. The app warns when two events are booked in the same place at the same time.
- **Dining**: a dashboard of the meals served each day in De Nobili, Hadsall and Focolare, read from the kitchen's Google Sheet and matched against the school calendar (classes, weekends, holidays, orientation, summer).

Same stack and hosting model as the Control Room dashboard: Next.js 16, Prisma 6 + SQLite and Tailwind 4, running on the school's internal Windows server.

## Who can do what

| Role | How you get it | Can |
|---|---|---|
| Everyone | Sign in with a school Google account | Open and follow their own tickets, pre-register visitors, see their deliveries, create events |
| Agent | Admin ticks one or more departments for you | Work that department's ticket queue, manage its assets and supplies |
| Reception | Member of the **Reception** department | Check visitors in and out, log and hand out deliveries |
| Admin | `ADMIN_EMAILS` in `.env`, or ticked in Admin | Everything, plus people/roles, departments, categories and locations |

## Setup

```bash
npm install
cp .env.example .env          # then fill it in — see below
npx prisma generate
npx prisma migrate deploy     # creates prisma/dev.db
npm run db:seed               # IT / Facilities / Kitchen & Dining / Reception, categories, a few buildings
npm run build
npm run start                 # http://localhost:3060
```

On the Windows server, double-click **`Start Helpdesk.bat`**: it does all of the above and opens the app. On a Mac, use **`Start Helpdesk.command`** instead.

### On the Windows server

- **Install it with `git clone https://github.com/fchiapponi/Tasis-one.git`**, not by copying the folder. The launcher updates the app from GitHub, so it needs Git ([git-scm.com](https://git-scm.com/download/win)). The first `git pull` asks you to sign in to GitHub once; Windows then remembers the login.
- The app is started by hand. It runs in a minimized window called **TASIS One server**. If you close that window or log off, the app stops.
- **To update, double-click `Start Helpdesk.bat`.** It stops the running app, runs `git pull`, installs new dependencies if `package.json` changed, applies new database migrations, rebuilds and starts the app again. If GitHub can't be reached, it says so and restarts the version already on the server.
- Never edit files on the server: `git pull` would refuse to update. Make changes on your own computer and push them to GitHub. `.env`, `prisma/dev.db` and `helpdesk.log` aren't in Git, so updates never touch them.
- Run `npm install` on the server itself. A `node_modules` folder copied from a Mac doesn't work on Windows: delete it and the launcher reinstalls it.
- Keep the folder, and so `prisma/dev.db`, on a local disk of the server, never on a network share. SQLite can corrupt its file on network shares. If possible, exclude the folder from the antivirus' real-time scanning.
- In `.env`, write Windows paths with forward slashes, e.g. `GOOGLE_SERVICE_ACCOUNT_FILE="C:/helpdesk-secrets/service-account.json"`.
- The server needs outbound HTTPS to `*.googleapis.com`, and to `api.anthropic.com` if tickets by email are on. If the school goes out through a proxy, add `HTTPS_PROXY="http://proxy:port"` and `NODE_USE_ENV_PROXY=1` to `.env`.
- Run only one copy of the app at a time. The mailbox check runs inside the app, so two copies would handle each email twice.

To work on the app, run `npm run dev`. In development the login page also shows a **development sign-in** form, so you can sign in as any email without Google. That form is never available in production builds.

## Environment variables

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | SQLite path. Keep it as `file:./dev.db?...`: the path is resolved relative to `prisma/`. |
| `APP_URL` | The URL people open the app at, without a trailing slash. It is used for the Google redirect and for the links inside QR labels, so **set it before printing labels**. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credentials for an OAuth client of type *Web application* in Google Cloud Console. |
| `GOOGLE_WORKSPACE_DOMAIN` | Only accounts from this domain can sign in, e.g. `tasis.ch`. |
| `ADMIN_EMAILS` | Comma-separated emails that become admins when they sign in. |

### Google sign-in

1. In Google Cloud Console, create a project, then go to **APIs & Services → OAuth consent screen**. Choose **Internal**, so that only Workspace users can sign in.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs**, add `<APP_URL>/api/auth/callback`.

**Important:** Google accepts only `http://localhost` or **HTTPS on a real domain name** as a redirect URI. A LAN address like `http://172.25.x.x:3060` is rejected. To make the app usable from other machines, put it behind a hostname such as `helpdesk.tasis.ch`, served over HTTPS.

The app is meant for the **school's internal network only**. Don't publish it to the Internet: no port forwarding, no Cloudflare Tunnel. It still works only on the inside, because:
- **Internal DNS:** `helpdesk.tasis.ch` exists only on the school DNS and points at the Windows server. Google never connects to that address: it only checks that the redirect URI matches, and the browser does the redirect. So the name doesn't have to be reachable from outside.
- **HTTPS:** IIS (with URL Rewrite and ARR) or Caddy on the server forwards `https://helpdesk.tasis.ch` to `http://localhost:3060`. On the Windows firewall, open only port 443 to the school network, and keep 3060 closed.
- **Certificate:** since the site isn't reachable from outside, a normal Let's Encrypt check over HTTP can't work. Use the school's internal certificate authority, if school computers already trust it, or an existing `tasis.ch` certificate, or Let's Encrypt with the DNS check.
- **Outbound access:** the server still has to reach Google, for sign-in and the ticket@ mailbox, and the Claude API. That traffic is outgoing only, and nothing from outside can come in.

Set `APP_URL="https://helpdesk.tasis.ch"` in `.env`. Links in confirmation emails and on QR labels use it, so they open only from the school network.

## Tickets by email

Staff can also open a ticket by writing to **ticket@tasis.ch**:

1. The app checks the mailbox every minute.
2. Claude reads each new email and files it. It writes a short title and picks the department, category, location and priority. The email text is kept unchanged as the ticket description.
3. The sender gets a reply in the same email thread. It shows the ticket number, where the ticket was filed and a link to it.
4. When someone answers in that thread, the answer is added to the ticket as a comment. Quoted history is removed. Only the requester and the department's agents can add comments this way. If the requester answers a *Resolved* or *Waiting* ticket, it moves back to *Open*.

Only addresses from `GOOGLE_WORKSPACE_DOMAIN` can open tickets. Emails from anyone else, out-of-office replies, bounces and mailing lists are ignored and get no reply. If Claude can't be reached, the email still becomes a ticket: it goes to `EMAIL_TICKETS_DEFAULT_DEPARTMENT`, and the ticket history tells agents to check how it was filed. Attachments aren't imported yet; the ticket notes how many there were.

Gmail tags every email it has handled with the label `helpdesk-processed`. You can still read the mailbox normally.

### Setup

1. Create the `ticket@tasis.ch` mailbox, as a user or a group with its own inbox.
2. In Google Cloud Console, in the same project as the sign-in client, enable the **Gmail API**. Then create a **service account** and a JSON key for it. Save the key on the server **outside** this folder, and put its path in `GOOGLE_SERVICE_ACCOUNT_FILE`.
3. In the Google Admin console, go to **Security → Access and data control → API controls → Domain-wide delegation**. Add the service account's client ID with the scope `https://www.googleapis.com/auth/gmail.modify`.
4. Set `TICKET_MAILBOX=ticket@tasis.ch` and `ANTHROPIC_API_KEY` in `.env`, then restart the app. The log should show `[email-tickets] watching ticket@tasis.ch`.

| Variable | Meaning |
|---|---|
| `TICKET_MAILBOX` | The mailbox to watch. Leave it empty to turn the feature off. |
| `TICKET_MAILBOX_NAME` | Sender name on the confirmation emails. |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Path to the service account JSON key. |
| `EMAIL_POLL_SECONDS` | How often to check the mailbox (default 60). |
| `EMAIL_TICKETS_DEFAULT_DEPARTMENT` | Department slug for emails the AI couldn't sort (default `it`). |
| `ANTHROPIC_API_KEY` | Claude API key used to sort emails. |

## Dining dashboard

The **Dining** page reads the kitchen's Google Sheet of daily meal counts: one tab per month, one row per day, with breakfast, lunch and dinner for each dining hall. Words typed in a meal cell instead of a number (BRUNCH, BBQ, ...) and the notes in column K show up as kitchen notes.

1. Share the sheet as **Anyone with the link can view**. The app downloads it without signing in to Google.
2. Put its ID in `DINING_SHEET_ID` (the part of the link between `/d/` and `/edit`) and restart the app.

The app re-reads the sheet every `DINING_REFRESH_HOURS` (default 6), and **Refresh now** on the page re-reads it straight away. Open pages pick up the latest read every 5 minutes. If Google can't be reached, the page says so and keeps showing the last good read.

The school calendar the figures are matched against lives in `src/lib/schoolCalendar.ts`, copied from the academic calendar PDFs on the Parent Portal. It covers January 2026 to June 2027: add the next school year there when it is published.

| Variable | Meaning |
|---|---|
| `DINING_SHEET_ID` | ID of the kitchen's meal-count sheet. Leave it empty to turn the page's data off. |
| `DINING_REFRESH_HOURS` | How often the sheet is re-read in the background (default 6). |

## Day-to-day

- **New staff become agents:** they sign in once (or an admin adds them under *Admin → People*), then an admin ticks their departments.
- **Labels:** in *Inventory*, tick the assets you want and press *Print labels for selected*. The sheet fits 3 labels per row on A4.
- **Locations** are a starting list of buildings. Edit them in *Admin → Locations*, and add rooms as needed.

## Not built yet

- Email notifications when an agent replies in the app, and for parcels that have arrived. The Gmail client used for tickets by email can send these.
- File attachments (photos) on tickets.
- A reception kiosk mode where visitors sign themselves in on a tablet.
