// Runs once when the server starts. The background jobs use Node.js APIs, so
// they live in their own file, loaded only by the Node.js runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
