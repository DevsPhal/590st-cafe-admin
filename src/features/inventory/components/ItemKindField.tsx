"use client";

import { SelectField } from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";
import type { ItemKind } from "../stock";

export function ItemKindField({ value, onChange }: { value: ItemKind; onChange: (kind: ItemKind) => void }) {
  const { t } = useI18n();
  return (
    <SelectField
      label={t("inventory.filters.item_type", "Item Type")}
      placeholder={t("inventory.filters.all_items", "All items")}
      value={value}
      onChange={(e) => onChange(e.target.value as ItemKind)}
    >
      <option value="MENU">{t("inventory.kind.menu", "Menu items")}</option>
      <option value="INGREDIENT">{t("inventory.kind.ingredients", "Ingredients")}</option>
    </SelectField>
  );
}
