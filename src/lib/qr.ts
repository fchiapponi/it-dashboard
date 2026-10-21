import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * The address phones open from a label: APP_URL, else the one this page was
 * opened at (behind IIS or Caddy, the forwarded host). Without it the QR held
 * a bare path that no phone can open.
 */
async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : "";
}

/** Inline SVG markup for a QR code pointing at the asset's page. */
export async function assetQrSvg(tag: string) {
  return QRCode.toString(`${await appOrigin()}/inventory/${encodeURIComponent(tag)}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}
