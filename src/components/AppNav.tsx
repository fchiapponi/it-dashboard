import { redirect } from "next/navigation";
import { Nav, type NavItem } from "@/components/Nav";
import { isAgent, isReception, signInRequired, signOut, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/login");
}

// The app's sidebar, shared by the app layout and the monitor.
export async function AppNav({ user }: { user: CurrentUser }) {
  const { t } = await getI18n();
  const myDeliveries = await prisma.delivery.count({ where: { recipientId: user.id, status: "received" } });

  const items: NavItem[] = [
    { href: "/", label: t("Dashboard"), icon: "dashboard" },
    { href: "/tickets", label: t("Tickets"), icon: "tickets" },
    { href: "/boards", label: t("Boards"), icon: "boards" },
    ...(isAgent(user) ? [{ href: "/inventory", label: t("Inventory"), icon: "inventory" } as NavItem] : []),
    { href: "/visitors", label: t("Visitors"), icon: "visitors" },
    { href: "/deliveries", label: t("Deliveries"), icon: "deliveries", badge: isReception(user) ? undefined : myDeliveries },
    { href: "/dining", label: t("Dining"), icon: "dining" },
    // The full-screen control-room view for the TV (printers, Wi-Fi, IT Trello board)
    ...(isAgent(user) ? [{ href: "/monitor", label: t("Monitor"), icon: "monitor" } as NavItem] : []),
  ];
  if (user.isAdmin) items.push({ href: "/admin", label: t("Admin"), icon: "admin" });

  return (
    <Nav
      items={items}
      user={{ name: user.name, email: user.email }}
      signOut={signInRequired() ? signOutAction : undefined}
    />
  );
}
