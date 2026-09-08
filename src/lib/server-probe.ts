import net from "net";

// Generic servers don't advertise a single "the" port the way printers/cameras
// do, so reachability is "responds on any commonly-open service port" rather
// than a single well-known check.
const COMMON_PORTS = [22, 80, 443, 3389, 445, 5985, 8080];

function probeTcpPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
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

export async function probeServerReachable(host: string): Promise<boolean> {
  const results = await Promise.all(COMMON_PORTS.map((port) => probeTcpPort(host, port)));
  return results.some(Boolean);
}
