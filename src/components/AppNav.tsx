import { redirect } from "next/navigation";
import { Nav, type NavItem } from "@/components/Nav";
import { isAgent, isReception, signInRequired, signOut, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/login");
}

// The app's sidebar, shared by the app layout and the monitor (where it hides
// off-screen until the mouse reaches the left edge).
export async function AppNav({ user, autoHide }: { user: CurrentUser; autoHide?: boolean }) {
  const myDeliveries = await prisma.delivery.count({ where: { recipientId: user.id, status: "received" } });

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/tickets", label: "Tickets", icon: "tickets" },
    { href: "/boards", label: "Boards", icon: "boards" },
    ...(isAgent(user) ? [{ href: "/inventory", label: "Inventory", icon: "inventory" } as NavItem] : []),
    { href: "/visitors", label: "Visitors", icon: "visitors" },
    { href: "/deliveries", label: "Deliveries", icon: "deliveries", badge: isReception(user) ? undefined : myDeliveries },
    { href: "/dining", label: "Dining", icon: "dining" },
    // The full-screen control-room view for the TV (printers, Wi-Fi, IT Trello board)
    ...(isAgent(user) ? [{ href: "/monitor", label: "Monitor", icon: "monitor" } as NavItem] : []),
  ];
  if (user.isAdmin) items.push({ href: "/admin", label: "Admin", icon: "admin" });

  return (
    <Nav
      items={items}
      user={{ name: user.name, email: user.email }}
      signOut={signInRequired() ? signOutAction : undefined}
      autoHide={autoHide}
    />
  );
}
