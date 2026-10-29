import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/auth";
import { requireDepartmentPage } from "@/lib/department";
import "./monitor.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TASIS // Sys.Monitor",
  description: "Control-room screen for the school printers",
};

// The TV dashboard: full screen next to the app's collapsed sidebar. Signing in
// once on the TV's browser keeps it signed in for the session's 30 days.
export default async function MonitorLayout({ children }: LayoutProps<"/monitor">) {
  const user = await requireUser();
  // IT's screen: for IT's members (and admins).
  await requireDepartmentPage("it");
  return (
    <div className="md:flex">
      <AppNav user={user} />
      <div className={`monitor min-w-0 flex-1 ${jetbrainsMono.variable}`}>{children}</div>
    </div>
  );
}
