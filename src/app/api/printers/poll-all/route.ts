import { NextResponse } from "next/server";
import { pollAllPrinters } from "@/lib/printer-service";

export async function POST() {
  const results = await pollAllPrinters();
  return NextResponse.json({ results });
}
