# TASIS One

One web app for TASIS staff to:

- **Tickets**: report problems to **IT**, **Facilities** or **Kitchen & Dining** (more departments can be added from Admin). Each ticket has a category, location, priority, assignee, a reply thread and internal notes that only agents can see.
- **Inventory**:
  - **Assets** with serial numbers. Each one has a QR label; scanning it opens the asset page with a *Report a problem* button.
  - **Consumables**, with stock movements and low-stock warnings. Agents can book consumables used on a ticket directly from that ticket.
- **Visitors**: staff pre-register the people they expect. Reception checks visitors in and out with a badge number, prints visitor badges and always has an "on site now" list.
- **Deliveries**: reception logs incoming parcels and marks them as collected. Recipients see what's waiting for them on their dashboard.
- **Events**: staff create events and say what IT, Facilities and Kitchen & Dining need to do. Each need becomes a ticket for that department, linked back to the event. The app warns when two events are booked in the same place at the same time.

Same stack and hosting model as the Control Room dashboard: Next.js 16, Prisma 6 + SQLite and Tailwind 4, running on the school Mac.

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

Or double-click **`Start Helpdesk.command`** on the Mac, which does all of the above.

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

**Important:** Google accepts only `http://localhost` or **HTTPS on a real domain name** as a redirect URI. A LAN address like `http://172.25.x.x:3060` is rejected. To make the app usable from other machines, put it behind a hostname such as `helpdesk.tasis.ch`, served over HTTPS. Two ways to do that:
- a reverse proxy such as Caddy on the Mac, with internal DNS pointing the hostname at the Mac;
- a Cloudflare Tunnel.

## Day-to-day

- **New staff become agents:** they sign in once (or an admin adds them under *Admin → People*), then an admin ticks their departments.
- **Labels:** in *Inventory*, tick the assets you want and press *Print labels for selected*. The sheet fits 3 labels per row on A4.
- **Locations** are a starting list of buildings. Edit them in *Admin → Locations*, and add rooms as needed.

## Not built yet

- Email notifications for new tickets, replies, and parcels that have arrived. Planned: through Gmail or SMTP.
- File attachments (photos) on tickets.
- A reception kiosk mode where visitors sign themselves in on a tablet.
