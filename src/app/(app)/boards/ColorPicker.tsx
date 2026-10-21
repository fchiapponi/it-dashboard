import { getI18n } from "@/i18n/server";

/** Row of color swatches backed by radio inputs, so it works inside plain server-action forms. */
export async function ColorPicker({
  name,
  colors,
  defaultValue,
  allowNone,
}: {
  name: string;
  colors: string[];
  defaultValue?: string | null;
  allowNone?: boolean;
}) {
  const { t } = await getI18n();
  const swatch =
    "grid size-7 cursor-pointer place-items-center rounded-md ring-offset-2 ring-offset-panel has-checked:ring-2 has-checked:ring-fg";
  return (
    <div className="flex flex-wrap gap-2">
      {allowNone && (
        <label className={`${swatch} border border-dashed border-line text-xs text-dim`} title={t("No color")}>
          <input type="radio" name={name} value="" defaultChecked={!defaultValue} className="sr-only" />—
        </label>
      )}
      {colors.map((c) => (
        <label key={c} className={swatch} style={{ background: c }} title={c}>
          <input type="radio" name={name} value={c} defaultChecked={c === defaultValue} className="sr-only" />
        </label>
      ))}
    </div>
  );
}
