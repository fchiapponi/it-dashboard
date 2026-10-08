import { redirect } from "next/navigation";
import { Nav, type NavItem } from "@/components/Nav";
import { isAgent, isReception, requireUser, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  const myDeliveries = await prisma.delivery.count({ where: { recipientId: user.id, status: "received" } });

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/tickets", label: "Tickets", icon: "tickets" },
    { href: "/boards", label: "Boards", icon: "boards" },
    ...(isAgent(user) ? [{ href: "/inventory", label: "Inventory", icon: "inventory" } as NavItem] : []),
    { href: "/visitors", label: "Visitors", icon: "visitors" },
    { href: "/deliveries", label: "Deliveries", icon: "deliveries", badge: isReception(user) ? undefined : myDeliveries },
    { href: "/dining", label: "Dining", icon: "dining" },
  ];
  if (user.isAdmin) items.push({ href: "/admin", label: "Admin", icon: "admin" });

  return (
    <div className="md:flex">
      <Nav items={items} user={{ name: user.name, email: user.email }} signOut={signOutAction} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Dashboards (data-wide) get more room than the usual forms and lists. */}
        <div className="mx-auto max-w-6xl has-[[data-wide]]:max-w-[1680px]">{children}</div>
      </main>
    </div>
  );
}
