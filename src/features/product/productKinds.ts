import { enumLabel } from "@/lib/enumLabel";
import { unitsPerSale } from "@/lib/stockUnits";
import type { CategoryGroup, ProductVariantResponse, VariantLabel } from "@/store/api/types";

type Translate = (key: string, fallback?: string) => string;

export const isIngredientGroup = (group: CategoryGroup | null | undefined) => group === "INGREDIENT";

export const isIngredient = (product: { categoryGroup: CategoryGroup | null }) => isIngredientGroup(product.categoryGroup);

// Mirrors the API's ProductVariantPolicy.allowedVariants.
export function allowedVariantLabels(group: CategoryGroup | null | undefined): VariantLabel[] {
  switch (group) {
    case "INGREDIENT":
      return [];
    case "FRESH_DRINK":
      return ["MEDIUM", "LARGE"];
    case "BEVERAGE":
      return ["MEDIUM", "LARGE", "PACK", "BOX", "CARTON"];
    default:
      return ["PIECE", "PACK", "BOX", "CARTON"];
  }
}

const PACK_LABELS: readonly VariantLabel[] = ["PACK", "BOX", "CARTON"];

// These sell several sell units in one sale (unitsPerSale); the other labels sell one.
export const isPackLabel = (label: VariantLabel) => PACK_LABELS.includes(label);

// "Carton ×24 Can" for a pack, otherwise just "Medium".
export function variantDisplayName(
  t: Translate,
  variant: Pick<ProductVariantResponse, "name" | "unitsPerSale">,
  sellUnit: string,
): string {
  const label = enumLabel(t, "variant", variant.name);
  const perSale = unitsPerSale(variant);
  return isPackLabel(variant.name) || perSale > 1 ? `${label} ×${perSale} ${enumLabel(t, "unit", sellUnit)}` : label;
}

export const hasRecipe = (product: { variants: Pick<ProductVariantResponse, "recipeBased">[] }) =>
  product.variants.some((variant) => variant.recipeBased);
