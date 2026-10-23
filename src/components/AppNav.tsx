import { redirect } from "next/navigation";
import { Nav, type NavItem } from "@/components/Nav";
import { isAgentOf, signInRequired, signOut, type CurrentUser } from "@/lib/auth";
import { getDepartment } from "@/lib/department";
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
  const department = await getDepartment();
  // Tickets and inventory are the picked department's; inventory only for people who work for it.
  const agent = !!department && isAgentOf(user, department.id);
  // Pages that belong to one department.
  const only = (slug: string, ...items: NavItem[]) => (department?.slug === slug ? items : []);

  const items: NavItem[] = [
    { href: "/", label: t("Dashboard"), icon: "dashboard" },
    ...(department?.takesTickets ? [{ href: "/tickets", label: t("Tickets"), icon: "tickets" } as NavItem] : []),
    { href: "/boards", label: t("Boards"), icon: "boards" },
    ...(agent ? [{ href: "/inventory", label: t("Inventory"), icon: "inventory" } as NavItem] : []),
    ...only("reception", { href: "/visitors", label: t("Visitors"), icon: "visitors" }, { href: "/deliveries", label: t("Deliveries"), icon: "deliveries" }),
    ...only("kitchen", { href: "/dining", label: t("Dining"), icon: "dining" }),
    ...only("it", { href: "/hours", label: t("Hours"), icon: "hours" }),
    // The full-screen control-room view for the TV (printers, Wi-Fi, IT Trello board)
    ...(agent ? only("it", { href: "/monitor", label: t("Monitor"), icon: "monitor" }) : []),
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
