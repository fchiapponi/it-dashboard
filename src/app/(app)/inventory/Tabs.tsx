import { FilterTabs } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function InventoryTabs({ active, dept, lowStock }: { active: "assets" | "supplies"; dept: string; lowStock?: number }) {
  const { t } = await getI18n();
  return (
    <FilterTabs
      active={active}
      items={[
        { key: "assets", label: t("Assets"), href: `/inventory?dept=${dept}` },
        { key: "supplies", label: lowStock ? t("Supplies · {n} low", { n: lowStock }) : t("Supplies"), href: `/inventory/supplies?dept=${dept}` },
      ]}
    />
  );
}
