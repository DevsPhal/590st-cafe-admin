import { translate } from "@/contexts/translate";
import type {
  IceLevel,
  MilkType,
  ProductExtraResponse,
  ProductResponse,
  SugarLevel,
  VariantLabel,
} from "@/store/api/types";

// The drink choices the customer app offers, with the same order and wording, so the POS matches it.
export const SUGAR_CHOICES: SugarLevel[] = ["NORMAL", "LESS", "EXTRA", "ZERO"];
export const ICE_CHOICES: IceLevel[] = ["NORMAL", "LESS_ICE", "EXTRA_ICE", "NO_ICE"];
export const MILK_CHOICES: MilkType[] = ["NORMAL", "LESS", "EXTRA", "NONE"];

const SUGAR_LABELS: Record<SugarLevel, string> = { ZERO: "No Sugar", LESS: "Less Sugar", NORMAL: "Normal Sugar", EXTRA: "Extra Sugar" };
const ICE_LABELS: Record<IceLevel, string> = { NO_ICE: "No Ice", LESS_ICE: "Less Ice", NORMAL: "Normal Ice", EXTRA_ICE: "Extra Ice" };
const MILK_LABELS: Record<MilkType, string> = { NONE: "No Milk", LESS: "Less Milk", NORMAL: "Normal Milk", EXTRA: "Extra Milk" };
const SIZE_LABELS: Record<VariantLabel, string> = {
  MEDIUM: "Medium", LARGE: "Large", PIECE: "Piece", PACK: "Pack", BOX: "Box", CARTON: "Carton",
};

export const sugarLabel = (level: SugarLevel) => translate(`drink_options.sugar.${level}`, SUGAR_LABELS[level] ?? level);
export const iceLabel = (level: IceLevel) => translate(`drink_options.ice.${level}`, ICE_LABELS[level] ?? level);
export const milkLabel = (type: MilkType) => translate(`drink_options.milk.${type}`, MILK_LABELS[type] ?? type);
export const sizeLabel = (size: VariantLabel) => translate(`drink_options.size.${size}`, SIZE_LABELS[size] ?? size);

export type DrinkCustomization = { ice: boolean; sugar: boolean; milk: boolean };

const HOT_KEYWORD = /\bhot\b/;
const MILK_KEYWORDS = /\b(milk|coffee|latte|cappuccino|mocha|matcha|chocolate|cocoa|smoothie)\b/;
const MILK_DRINK_NAME = /\b(milk|latte|cappuccino|mocha|macchiato|flat white|frappe|frappuccino|matcha|chocolate|cocoa|smoothie)\b/;
const NO_MILK_NAME = /\b(americano|espresso|black|cold brew|ristretto|lungo|soda|juice|lemonade|sparkling|tonic|mojito)\b/;

// Same rules as the customer app's getDrinkCustomization: only fresh drinks take sugar/ice/milk,
// hot drinks skip ice, and milk depends on what the drink is. The API rejects options a product can't take.
export function drinkCustomization(product: Pick<ProductResponse, "categoryGroup" | "name" | "categoryName">): DrinkCustomization {
  if (product.categoryGroup !== "FRESH_DRINK") return { ice: false, sugar: false, milk: false };
  const name = product.name.toLowerCase();
  const text = `${name} ${product.categoryName ?? ""}`.toLowerCase();
  const milk = MILK_DRINK_NAME.test(name) ? true : NO_MILK_NAME.test(name) ? false : MILK_KEYWORDS.test(text);
  return { ice: !HOT_KEYWORD.test(text), sugar: true, milk };
}

export function activeExtras(product: Pick<ProductResponse, "extras">): ProductExtraResponse[] {
  return (product.extras ?? [])
    .filter((extra) => extra.status === "ACTIVE")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

// A product opens the options dialog when the customer app would show choices for it.
export function hasDrinkOptions(product: Pick<ProductResponse, "categoryGroup" | "name" | "categoryName" | "extras">): boolean {
  const flags = drinkCustomization(product);
  return flags.ice || flags.sugar || flags.milk || activeExtras(product).length > 0;
}

type OptionParts = {
  variantName?: VariantLabel | null;
  sugarLevel?: SugarLevel | null;
  iceLevel?: IceLevel | null;
  milkType?: MilkType | null;
  extras?: readonly { name: string }[];
};

// "Large · Less Sugar · No Ice · + Extra Shot" — the same line on the POS, the barista queue and order details.
export function optionSummary({ variantName, sugarLevel, iceLevel, milkType, extras = [] }: OptionParts): string {
  return [
    variantName && variantName !== "PIECE" ? sizeLabel(variantName) : null,
    sugarLevel ? sugarLabel(sugarLevel) : null,
    iceLevel ? iceLabel(iceLevel) : null,
    milkType ? milkLabel(milkType) : null,
    ...extras.map((extra) => `+ ${extra.name}`),
  ]
    .filter(Boolean)
    .join(" · ");
}
