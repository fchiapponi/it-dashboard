import Image from "next/image";
import { redirect } from "next/navigation";
import { devSignIn } from "./actions";
import { signInRequired } from "@/lib/auth";
import { safeReturnTo } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";
import type { Message } from "@/i18n";

const ERRORS: Record<string, Message> = {
  domain: "Please sign in with your school Google account.",
  state: "The sign-in link expired. Please try again.",
  cancelled: "Sign-in was cancelled.",
  google: "Google sign-in failed. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const { t } = await getI18n();
  if (!signInRequired()) redirect("/");
  const returnTo = safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : null);
  const error = typeof params.error === "string" && ERRORS[params.error] ? t(ERRORS[params.error]) : null;
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card relative w-full max-w-sm p-8">
        <LanguageSwitch className="absolute top-4 right-4" />
        <div className="mb-6 flex justify-center">
          <Image src="/tasis-crest.png" alt="TASIS One" width={235} height={175} priority className="h-20 w-auto" />
        </div>
        <p className="mb-6 text-sm text-dim">
          {t("Report problems to IT, Facilities, Electrician and Kitchen & Dining, register visitors, track deliveries and request event support.")}
        </p>
        {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <a href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`} className="btn btn-primary w-full py-2.5">
          {t("Sign in with Google")}
        </a>
        {domain && <p className="mt-3 text-center text-xs text-dim">{t("Use your @{domain} account", { domain })}</p>}

        {process.env.NODE_ENV === "development" && (
          <form action={devSignIn} className="mt-8 space-y-2 border-t border-dashed border-line pt-6">
            <p className="text-xs font-medium text-dim">{t("Development sign-in (not available in production)")}</p>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input name="email" type="email" required placeholder={t("email")} className="input" />
            <input name="name" placeholder={t("name (optional)")} className="input" />
            <button className="btn w-full">{t("Sign in")}</button>
          </form>
        )}
      </div>
    </main>
  );
}
