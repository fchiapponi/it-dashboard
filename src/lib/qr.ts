import "server-only";
import QRCode from "qrcode";

export const assetUrl = (tag: string) => `${process.env.APP_URL ?? ""}/inventory/${encodeURIComponent(tag)}`;

/** Inline SVG markup for a QR code pointing at the asset's page. */
export function assetQrSvg(tag: string) {
  return QRCode.toString(assetUrl(tag), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}
