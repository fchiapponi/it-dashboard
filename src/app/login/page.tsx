import Image from "next/image";
import { emailSignIn } from "./actions";
import { emailSignInEnabled, googleSignInEnabled } from "@/lib/auth";
import { safeReturnTo } from "@/lib/format";

const ERRORS: Record<string, string> = {
  domain: "Please sign in with your school account.",
  state: "The sign-in link expired. Please try again.",
  cancelled: "Sign-in was cancelled.",
  google: "Google sign-in failed. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : null);
  const error = typeof params.error === "string" ? ERRORS[params.error] : null;
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  const google = googleSignInEnabled();

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Image src="/tasis-crest.png" alt="TASIS One" width={235} height={175} priority className="h-20 w-auto" />
        </div>
        <p className="mb-6 text-sm text-dim">
          Report problems to IT, Facilities and Kitchen & Dining, register visitors, track deliveries and request event support.
        </p>
        {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
        {google && (
          <>
            <a href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`} className="btn btn-primary w-full py-2.5">
              Sign in with Google
            </a>
            {domain && <p className="mt-3 text-center text-xs text-dim">Use your @{domain} account</p>}
          </>
        )}

        {emailSignInEnabled() && (
          <form action={emailSignIn} className={google ? "mt-8 space-y-2 border-t border-dashed border-line pt-6" : "space-y-2"}>
            {google && <p className="text-xs font-medium text-dim">Development sign-in (not available in production)</p>}
            <input type="hidden" name="returnTo" value={returnTo} />
            <input name="email" type="email" required placeholder={domain ? `name@${domain}` : "email"} className="input" />
            <input name="name" placeholder="name (optional)" className="input" />
            <button className={google ? "btn w-full" : "btn btn-primary w-full py-2.5"}>Sign in</button>
          </form>
        )}
      </div>
    </main>
  );
}
