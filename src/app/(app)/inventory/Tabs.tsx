import { FilterTabs } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function InventoryTabs({ active, lowStock }: { active: "assets" | "supplies"; lowStock?: number }) {
  const { t } = await getI18n();
  return (
    <FilterTabs
      active={active}
      items={[
        { key: "assets", label: t("Assets"), href: "/inventory" },
        { key: "supplies", label: lowStock ? t("Supplies · {n} low", { n: lowStock }) : t("Supplies"), href: "/inventory/supplies" },
      ]}
    />
  );
}
