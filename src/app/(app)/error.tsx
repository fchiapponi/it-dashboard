"use client";

import { useI18n } from "@/i18n/client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6">
      <h2 className="font-semibold">{t("Something went wrong")}</h2>
      <p className="mt-2 text-sm text-dim">{error.message}</p>
      <button className="btn mt-4" onClick={reset}>
        {t("Try again")}
      </button>
    </div>
  );
}
