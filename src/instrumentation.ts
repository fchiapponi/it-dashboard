export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const globalForPoller = globalThis as unknown as { __tasisPollerStarted?: boolean };
  if (globalForPoller.__tasisPollerStarted) return;
  globalForPoller.__tasisPollerStarted = true;

  // The onvif library can throw asynchronously from inside its own HTTP
  // response handlers (outside any try/catch we control) when a camera
  // returns an unexpected response — without this, that crashes/kills the
  // whole dashboard instead of just failing that one camera's poll.
  process.on("uncaughtException", (err) => {
    console.error("[poller] uncaught exception (ignored, process kept alive)", err);
  });
  process.on("unhandledRejection", (err) => {
    console.error("[poller] unhandled rejection (ignored, process kept alive)", err);
  });

  const cron = await import("node-cron");
  const { pollAllPrinters } = await import("@/lib/printer-service");
  const { pollAllCameras } = await import("@/lib/camera-service");
  const { syncDevicesFromConfig } = await import("@/lib/device-sync");

  await syncDevicesFromConfig().catch((err) => console.error("[poller] device sync error", err));

  const printerIntervalMin = Math.max(1, Math.round(Number(process.env.PRINTER_POLL_INTERVAL_MS ?? 300000) / 60000));
  const cameraIntervalMin = Math.max(1, Math.round(Number(process.env.CAMERA_POLL_INTERVAL_MS ?? 60000) / 60000));

  cron.schedule(`*/${printerIntervalMin} * * * *`, () => {
    pollAllPrinters().catch((err) => console.error("[poller] printer poll error", err));
  });

  cron.schedule(`*/${cameraIntervalMin} * * * *`, () => {
    pollAllCameras().catch((err) => console.error("[poller] camera poll error", err));
  });

  // Warm-up run shortly after startup.
  setTimeout(() => {
    pollAllPrinters().catch((err) => console.error("[poller] initial printer poll error", err));
    pollAllCameras().catch((err) => console.error("[poller] initial camera poll error", err));
  }, 5000);

  console.log(
    `[poller] started — printers every ${printerIntervalMin}min, cameras every ${cameraIntervalMin}min`,
  );
}
