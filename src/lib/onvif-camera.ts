import { Cam } from "onvif";
import net from "net";

export interface CameraProbeResult {
  online: boolean;
  error?: string;
  snapshotUrl?: string;
  streamUri?: string;
  deviceName?: string;
}

const CONNECT_TIMEOUT_MS = 6000;
const SNAPSHOT_TIMEOUT_MS = 4000;

export function probeOnvifCamera(opts: {
  host: string;
  port: number;
  username?: string;
  password?: string;
}): Promise<CameraProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: CameraProbeResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const connectTimer = setTimeout(() => {
      settle({ online: false, error: "ONVIF connection timeout" });
    }, CONNECT_TIMEOUT_MS);

    new Cam(
      {
        hostname: opts.host,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        timeout: CONNECT_TIMEOUT_MS - 1000,
      },
      function onConnect(this: InstanceType<typeof Cam>, err: Error | null) {
        clearTimeout(connectTimer);
        if (settled) return;
        if (err) {
          settle({ online: false, error: err.message });
          return;
        }

        // The device answered ONVIF device-service calls, so it's reachable —
        // that alone makes it "online" even if the snapshot fetch below hangs
        // or fails (some devices never invoke this callback for GetSnapshotUri).
        const deviceName = (this as unknown as { name?: string }).name;
        const snapshotTimer = setTimeout(() => {
          settle({ online: true, error: "Snapshot request timed out", deviceName });
        }, SNAPSHOT_TIMEOUT_MS);

        this.getSnapshotUri((err2: Error | null, snapshot?: { uri: string }) => {
          clearTimeout(snapshotTimer);
          if (settled) return;
          if (err2 || !snapshot) {
            settle({
              online: true,
              error: `Snapshot unavailable: ${err2?.message ?? "empty response"}`,
              deviceName,
            });
            return;
          }
          settle({ online: true, snapshotUrl: snapshot.uri, deviceName });
        });
      },
    );
  });
}

export function probeTcpReachable(host: string, port: number, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}
