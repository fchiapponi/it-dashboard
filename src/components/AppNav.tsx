import { redirect } from "next/navigation";
import { Nav, type NavItem, type NavSection } from "@/components/Nav";
import { signInRequired, signOut, type CurrentUser } from "@/lib/auth";
import { myDepartments } from "@/lib/department";
import { getI18n } from "@/i18n/server";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/login");
}

// The app's sidebar, shared by the app layout and the monitor: the dashboard and
// personal board, then one section per department the user follows (all of them
// for admins) with its tickets, inventory, board and its own pages.
export async function AppNav({ user }: { user: CurrentUser }) {
  const { t } = await getI18n();
  const departments = await myDepartments();

  // Pages that belong to one department.
  const own: Record<string, NavItem[]> = {
    it: [
      { href: "/hours", label: t("Hours"), icon: "hours" },
      // The full-screen control-room view for the TV (printers, Wi-Fi)
      { href: "/monitor", label: t("Monitor"), icon: "monitor" },
    ],
    kitchen: [{ href: "/dining", label: t("Dining"), icon: "dining" }],
    reception: [
      { href: "/visitors", label: t("Visitors"), icon: "visitors" },
      { href: "/deliveries", label: t("Deliveries"), icon: "deliveries" },
    ],
  };
  const sections: NavSection[] = departments.map((d) => ({
    name: d.name,
    color: d.color,
    items: [
      ...(d.takesTickets ? [{ href: `/tickets?dept=${d.slug}`, label: t("Tickets"), icon: "tickets" } as NavItem] : []),
      { href: `/inventory?dept=${d.slug}`, label: t("Inventory"), icon: "inventory" },
      { href: `/boards/${d.slug}`, label: t("Board"), icon: "boards" },
      ...(own[d.slug] ?? []),
    ],
  }));

  return (
    <Nav
      items={[
        { href: "/", label: t("Dashboard"), icon: "dashboard" },
        { href: "/boards", label: t("My board"), icon: "boards" },
      ]}
      sections={sections}
      footer={user.isAdmin ? [{ href: "/admin", label: t("Admin"), icon: "admin" }] : []}
      user={{ name: user.name, email: user.email }}
      signOut={signInRequired() ? signOutAction : undefined}
    />
  );
}
