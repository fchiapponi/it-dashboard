import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { requireUser } from "@/lib/auth";
import "./monitor.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TASIS // Sys.Monitor",
  description: "Control-room screen for printers, access points and the IT Trello board",
};

// The TV dashboard: full screen, without the app's navigation. Signing in once
// on the TV's browser keeps it signed in for the session's 30 days.
export default async function MonitorLayout({ children }: LayoutProps<"/monitor">) {
  await requireUser();
  return <div className={`monitor ${jetbrainsMono.variable}`}>{children}</div>;
}
