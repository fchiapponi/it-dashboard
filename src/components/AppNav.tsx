import { redirect } from "next/navigation";
import { Nav, type NavItem } from "@/components/Nav";
import { isAgentOf, isReception, signInRequired, signOut, type CurrentUser } from "@/lib/auth";
import { getDepartment } from "@/lib/department";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { leaveDepartment } from "@/app/(app)/actions";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/login");
}

// The app's sidebar, shared by the app layout and the monitor.
export async function AppNav({ user }: { user: CurrentUser }) {
  const { t } = await getI18n();
  const [myDeliveries, department] = await Promise.all([
    prisma.delivery.count({ where: { recipientId: user.id, status: "received" } }),
    getDepartment(),
  ]);
  // Tickets and inventory are the picked department's; inventory only for people who work for it.
  const agent = !!department && isAgentOf(user, department.id);

  const items: NavItem[] = [
    { href: "/", label: t("Dashboard"), icon: "dashboard" },
    ...(department ? [{ href: "/tickets", label: t("Tickets"), icon: "tickets" } as NavItem] : []),
    { href: "/boards", label: t("Boards"), icon: "boards" },
    ...(agent ? [{ href: "/inventory", label: t("Inventory"), icon: "inventory" } as NavItem] : []),
    { href: "/visitors", label: t("Visitors"), icon: "visitors" },
    { href: "/deliveries", label: t("Deliveries"), icon: "deliveries", badge: isReception(user) ? undefined : myDeliveries },
    { href: "/dining", label: t("Dining"), icon: "dining" },
    { href: "/hours", label: t("Hours"), icon: "hours" },
    // The full-screen control-room view for the TV (printers, Wi-Fi, IT Trello board), for IT only
    ...(agent && department?.slug === "it" ? [{ href: "/monitor", label: t("Monitor"), icon: "monitor" } as NavItem] : []),
  ];
  if (user.isAdmin) items.push({ href: "/admin", label: t("Admin"), icon: "admin" });

  return (
    <Nav
      items={items}
      user={{ name: user.name, email: user.email }}
      department={department ? { name: department.name, color: department.color } : undefined}
      leaveDepartment={leaveDepartment}
      signOut={signInRequired() ? signOutAction : undefined}
    />
  );
}
