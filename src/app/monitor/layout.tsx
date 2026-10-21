import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/auth";
import "./monitor.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TASIS // Sys.Monitor",
  description: "Control-room screen for printers and the IT Trello board",
};

// The TV dashboard: full screen, with the app's navigation hidden off-screen
// until the mouse reaches the left edge. Signing in once on the TV's browser
// keeps it signed in for the session's 30 days.
export default async function MonitorLayout({ children }: LayoutProps<"/monitor">) {
  const user = await requireUser();
  return (
    <>
      <AppNav user={user} autoHide />
      <div className={`monitor ${jetbrainsMono.variable}`}>{children}</div>
    </>
  );
}
