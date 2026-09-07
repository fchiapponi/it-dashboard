# TASIS // Sys.Monitor

Dashboard di monitoraggio per il team: stampanti di rete (toner, carta), telecamere di sorveglianza e calendario condiviso — in un'unica interfaccia in stile terminale/hacker, dark, con dati aggiornati in tempo (quasi) reale.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS 4
- **Prisma 6** + SQLite (facilmente sostituibile con Postgres in produzione)
- **net-snmp** per interrogare le stampanti via Printer-MIB (RFC 3805)
- **onvif** per scoprire/interrogare le telecamere IP (ONVIF)
- **googleapis** per l'integrazione OAuth con Google Calendar
- **node-cron** per il polling periodico in background (`src/instrumentation.ts`)
- **recharts** per lo storico dei livelli toner/carta

## Avvio rapido

```bash
npm install
npx prisma migrate dev   # crea prisma/dev.db (già fatto in questo repo)
npm run dev
```

Apri http://localhost:3000 (o la porta indicata in console).

## Configurazione (`.env`)

Copia `.env.example` in `.env` se non esiste già e imposta:

- `DATABASE_URL` — di default un file SQLite locale (`prisma/dev.db`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — credenziali OAuth create su [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (abilita "Google Calendar API", tipo credenziale "Web application", redirect URI `http://localhost:3000/api/calendar/google/callback` in sviluppo)
- `CREDENTIALS_ENCRYPTION_KEY` — chiave usata per cifrare le community SNMP e le password telecamere salvate nel database (già generata automaticamente in questo repo)
- `PRINTER_POLL_INTERVAL_MS` / `CAMERA_POLL_INTERVAL_MS` — frequenza di polling in background

## ⚠️ Nota architetturale importante

Stampanti di rete e telecamere IP quasi sempre **non sono raggiungibili da internet** (giustamente, per sicurezza) — vivono sulla LAN dell'ufficio. Perché il polling SNMP/ONVIF funzioni davvero, il server che esegue questa app deve trovarsi sulla stessa rete dei dispositivi, oppure raggiungerli tramite VPN/tunnel. In pratica:

- **Va benissimo** far girare l'app su una macchina/NAS/mini-PC in ufficio, oppure su una VM raggiungibile via VPN aziendale.
- **Non funziona** deployare l'app su un hosting cloud pubblico (Vercel, ecc.) sperando che raggiunga stampanti/telecamere dietro il router di casa/ufficio, a meno di configurare un tunnel (es. Tailscale, WireGuard, Cloudflare Tunnel) verso quella rete.

Il calendario Google, invece, essendo un servizio cloud, funziona ovunque l'app sia ospitata.

## Come aggiungere dispositivi

Vai in **Impostazioni** dalla sidebar:

1. **Stampanti** — nome, IP, community SNMP (default `public`), versione SNMP (v1/v2c). Al salvataggio parte subito un primo poll dei livelli toner/carta.
2. **Telecamere** — scegli il protocollo:
   - `ONVIF` — l'app scopre da sola lo snapshot URI del dispositivo (funziona con la maggior parte delle telecamere IP moderne).
   - `MJPEG / snapshot HTTP` — se conosci già l'URL di uno snapshot JPEG statico.
   - `RTSP` — solo verifica di raggiungibilità (online/offline); la vera anteprima video richiede un client RTSP esterno o un proxy da aggiungere in futuro.
3. **Google Calendar** — pulsante "collega" che avvia il flusso OAuth (richiede le credenziali in `.env`).

## Struttura del progetto

```
src/
  app/                pagine (App Router) e API route
  components/          componenti UI (layout, stampanti, telecamere, impostazioni)
  lib/                 logica di dominio: snmp, onvif, google calendar, cifratura, prisma
  instrumentation.ts   avvio dei job di polling in background
prisma/schema.prisma   modello dati (Printer, Camera, CalendarIntegration, storico letture)
```
