// Background jobs, started once by instrumentation.ts on the Node.js server:
// re-reads the network printers (status, toner levels, page counts), checks
// the cameras and servers for /monitor, re-reads the kitchen's meal-count
// sheet, and polls the ticket@ mailbox when Gmail is configured (see
// "Tickets by email" in the README).
import { pollAllCameras } from "@/lib/camera-service";
import { syncDevicesFromConfig } from "@/lib/device-sync";
import { diningRefreshMs, getDiningData } from "@/lib/dining";
import { pollTicketMailbox } from "@/lib/emailTickets";
import { refreshPrinters } from "@/lib/printers";
import { pollAllServers } from "@/lib/server-service";

// The onvif library can throw asynchronously from inside its own HTTP
// response handlers (outside any try/catch we control) when a camera returns
// an unexpected response; without this, that kills the whole app instead of
// just failing that one camera's check.
process.on("uncaughtException", (err) => console.error("[server] uncaught exception (ignored, process kept alive)", err));
process.on("unhandledRejection", (err) => console.error("[server] unhandled rejection (ignored, process kept alive)", err));

const minutes = Math.max(1, Number(process.env.PRINTER_REFRESH_MINUTES) || 2);
const refresh = () =>
  refreshPrinters()
    .then(({ total, failed }) => total && failed.length && console.log(`[printers] no answer from ${failed.length}/${total}: ${failed.join(", ")}`))
    .catch((e) => console.error("[printers]", e));
setInterval(refresh, minutes * 60 * 1000);
void refresh();

await syncDevicesFromConfig().catch((e) => console.error("[devices] sync from config failed", e));
const every = (ms: unknown) => Math.max(60_000, Number(ms) || 60_000);
const pollCameras = () => pollAllCameras().catch((e) => console.error("[cameras]", e));
const pollServers = () => pollAllServers().catch((e) => console.error("[servers]", e));
setInterval(pollCameras, every(process.env.CAMERA_POLL_INTERVAL_MS));
setInterval(pollServers, every(process.env.SERVER_POLL_INTERVAL_MS));
void pollCameras();
void pollServers();

if (process.env.DINING_SHEET_ID) {
  const read = () =>
    getDiningData(true)
      .then((d) => console.log(`[dining] ${d.error ? `read failed: ${d.error}` : `read ${d.days.length} days`}`))
      .catch((e) => console.error("[dining]", e));
  setInterval(read, diningRefreshMs());
  void read();
}

if (process.env.TICKET_MAILBOX && process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
  const seconds = Math.max(15, Number(process.env.EMAIL_POLL_SECONDS) || 60);
  setInterval(pollTicketMailbox, seconds * 1000);
  void pollTicketMailbox();
  console.log(`[email-tickets] watching ${process.env.TICKET_MAILBOX} every ${seconds}s`);
}
