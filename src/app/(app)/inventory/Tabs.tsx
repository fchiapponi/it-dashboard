import { FilterTabs } from "@/components/ui";

export function InventoryTabs({ active, lowStock }: { active: "assets" | "supplies"; lowStock?: number }) {
  return (
    <FilterTabs
      active={active}
      items={[
        { key: "assets", label: "Assets", href: "/inventory" },
        { key: "supplies", label: lowStock ? `Supplies · ${lowStock} low` : "Supplies", href: "/inventory/supplies" },
      ]}
    />
  );
}
