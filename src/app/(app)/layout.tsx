import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="md:flex">
      <AppNav user={user} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Dashboards (data-wide) get more room than the usual forms and lists. */}
        <div className="mx-auto max-w-6xl has-[[data-wide]]:max-w-[1680px]">{children}</div>
      </main>
    </div>
  );
}
