import { z } from "zod";
import { ESTIMATE_MAX_MINUTES } from "@/lib/estimate";
import type { SellUnit, StockUnit, VariantLabel } from "@/store/api/types";
import { translate, type TranslationParams } from "@/contexts/translate";
import {
  emailField,
  fullNameField,
  message,
  numberField,
  optionalNumberField,
  optionalPhoneField,
  optionalText,
  otpField,
  requiredChoice,
  requiredPhoneField,
  requiredText,
  strongPasswordField,
} from "@/lib/validation";

// Every schema mirrors the matching Coffee-Shop-API request DTO so the form catches
// what the server would reject. Messages are full sentences, shown as an error toast
// by `parseForm`.

// ---- Auth -------------------------------------------------------------------------

export const emailLoginSchema = z.object({
  email: emailField,
  password: z.string().min(1, message("password_required", "Password is required.")),
});

export const phoneLoginSchema = z.object({
  phoneNumber: requiredPhoneField(),
});

export const otpSchema = z.object({ otp: otpField });

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    otp: otpField,
    newPassword: strongPasswordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    ...message("passwords_mismatch", "The new passwords do not match."),
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, message("current_password_required", "Enter your current password.")),
    next: strongPasswordField,
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { ...message("passwords_mismatch", "The new passwords do not match."), path: ["confirm"] })
  .refine((v) => v.next !== v.current, {
    ...message("password_unchanged", "The new password must be different from the current one."),
    path: ["next"],
  });

// ---- People -----------------------------------------------------------------------

export const profileSchema = z.object({
  fullName: fullNameField,
  phoneNumber: optionalPhoneField,
});

export const userAccountSchema = profileSchema;

export const staffUpdateSchema = profileSchema;

export const staffCreateSchema = z.object({
  fullName: fullNameField,
  email: emailField,
  password: strongPasswordField,
  phoneNumber: optionalPhoneField,
});

export const staffInviteSchema = z.object({
  fullName: fullNameField,
  phoneNumber: requiredPhoneField(message("phone_required_invite", "Phone number is required to invite via Telegram.")),
});

// Times are Cambodia wall-clock strings (yyyy-MM-ddTHH:mm[:ss]), so plain string comparison orders them.

/** Check-in: starts a shift for someone who is not on shift yet. Mirrors AdminCheckInRequest. */
export function checkInSchema({ now }: { now: string }) {
  return z
    .object({
      baristaId: requiredChoice(message("staff_required", "Choose a staff member.")),
      checkInAt: z.string().min(1, message("check_in_required", "Choose a check-in time.")),
      note: optionalText("Note"),
    })
    .refine((v) => v.checkInAt <= now, { ...message("check_in_future", "Check-in can't be in the future."), path: ["checkInAt"] });
}

/** Check-out: closes the staff member's open shift, which started at `checkInAt`. Mirrors AdminCheckOutRequest. */
export function checkOutSchema({ now, checkInAt }: { now: string; checkInAt: string }) {
  return z
    .object({
      baristaId: requiredChoice(message("on_shift_staff_required", "Choose a staff member who is on shift.")),
      checkOutAt: z.string().min(1, message("check_out_time_required", "Choose a check-out time.")),
      note: optionalText("Note"),
    })
    .refine((v) => v.checkOutAt <= now, { ...message("check_out_future", "Check-out can't be in the future."), path: ["checkOutAt"] })
    .refine((v) => v.checkOutAt > checkInAt, {
      ...message("check_out_before_in", "Check-out must be after check-in."),
      path: ["checkOutAt"],
    });
}

/** Missed attendance (new past shift) and corrections (existing record). Not used for normal check-in or check-out. */
export function attendanceSchema({ now, requireCheckOut }: { now: string; requireCheckOut: boolean }) {
  return z
    .object({
      baristaId: requiredChoice(message("staff_required", "Choose a staff member.")),
      checkInAt: z.string().min(1, message("check_in_required", "Choose a check-in time.")),
      checkOutAt: z.string().transform((value) => value || undefined),
      note: optionalText("Note"),
    })
    .refine((v) => v.checkInAt <= now, { ...message("check_in_future", "Check-in can't be in the future."), path: ["checkInAt"] })
    .refine((v) => !v.checkOutAt || v.checkOutAt <= now, {
      ...message("check_out_future", "Check-out can't be in the future."),
      path: ["checkOutAt"],
    })
    .refine((v) => !v.checkOutAt || v.checkOutAt > v.checkInAt, {
      ...message("check_out_before_in", "Check-out must be after check-in."),
      path: ["checkOutAt"],
    })
    .refine((v) => !requireCheckOut || Boolean(v.checkOutAt), {
      ...message("check_out_required", "A completed shift needs a check-out time."),
      path: ["checkOutAt"],
    });
}

// ---- Catalog ----------------------------------------------------------------------

export const categorySchema = z.object({
  name: requiredText("Category name"),
  description: optionalText("Description"),
});

export const SKU_PATTERN = /^[A-Z0-9]+([-_.][A-Z0-9]+)*$/;
export const SKU_MAX_LENGTH = 64;
export const SKU_FORMAT_HINT = "Letters, digits and single - _ . separators, e.g. FD-COF-IL-001";

// Messages only the product screens use live in products.json rather than the shared validation set.
function productMessage(key: string, fallback: string, params?: () => TranslationParams) {
  return { error: () => translate(`products.validation.${key}`, fallback, params?.()) };
}

/** `isIngredient`: the chosen category is stock-only, so a new product gets no starting variant or price. */
export function productSchema({
  isCreate,
  hasNoCategories,
  isIngredient,
}: {
  isCreate: boolean;
  hasNoCategories: boolean;
  isIngredient: boolean;
}) {
  const needsStartingVariant = isCreate && !isIngredient;
  return z
    .object({
      name: requiredText("Product name"),
      description: optionalText("Description"),
      categoryId: requiredChoice(
        hasNoCategories
          ? message("category_missing", "Create a category first — a product has to belong to one.")
          : message("category_required", "Choose a category."),
      ),
      stockUnit: requiredChoice<StockUnit>(
        productMessage("purchase_unit_required", "Choose the purchase unit (what stock is bought in)."),
      ),
      sellUnit: requiredChoice<SellUnit>(message("sell_unit_required", "Choose a sell unit.")),
      skuMode: z.string(),
      sku: z.string().trim(),
      // Blank = 1: the product is bought in the same unit it is counted in.
      unitsPerStock: optionalNumberField("units per stock", { min: 1, integer: true }).transform((value) => value ?? 1),
      reorderLevel: optionalNumberField("reorder level", { min: 0, integer: true }),
      variantName: z.string().transform((value) => value as VariantLabel | ""),
      variantPrice: z.string(),
    })
    .refine(
      (v) => v.skuMode !== "MANUAL" || !v.sku || (v.sku.length <= SKU_MAX_LENGTH && SKU_PATTERN.test(v.sku)),
      {
        ...message("sku_invalid", "Invalid SKU. {hint}.", () => ({ hint: translate("validation.sku_hint", SKU_FORMAT_HINT) })),
        path: ["sku"],
      },
    )
    .refine((v) => !needsStartingVariant || Boolean(v.variantName), {
      ...message("variant_required", "Choose a variant (e.g. Medium) for the starting price."),
      path: ["variantName"],
    })
    .refine((v) => !needsStartingVariant || startingPrice.safeParse(v.variantPrice).success, {
      ...message("starting_price_invalid", "Enter a valid starting price (0 or more)."),
      path: ["variantPrice"],
    });
}

const startingPrice = numberField("starting price", { min: 0 });

export function discountSchema(type: "PERCENTAGE" | "FIXED") {
  return z
    .object({
      value: numberField("discount", type === "PERCENTAGE" ? { greaterThan: 0, max: 100 } : { greaterThan: 0 }),
      start: z.string(),
      end: z.string(),
    })
    .refine((v) => !v.start || !v.end || v.end > v.start, {
      ...message("end_after_start", "End time must be after start time."),
      path: ["end"],
    });
}

/**
 * `unitsPerSaleFor` names the pack and sell unit when units per sale must be typed: the server only fills it in
 * for a pack named after the product's purchase unit. Blank otherwise means "let the server decide".
 */
export function variantSchema({ unitsPerSaleFor }: { unitsPerSaleFor?: { pack: string; unit: string } } = {}) {
  return z
    .object({
      price: numberField("price", { min: 0 }),
      sortOrder: optionalNumberField("display order", { min: 0, integer: true }),
      unitsPerSale: optionalNumberField("units per sale", { min: 1, integer: true }),
    })
    .refine((v) => !unitsPerSaleFor || v.unitsPerSale !== undefined, {
      ...productMessage("units_per_sale_required", "Enter how many {unit} one {pack} holds.", () => unitsPerSaleFor ?? {}),
      path: ["unitsPerSale"],
    });
}

/** One size's recipe (SetRecipeRequest): whole quantities in each ingredient's sell unit, each ingredient once. */
export function recipeSchema(ingredientName: (id: string) => string) {
  return z
    .object({
      items: z.array(
        z.object({
          ingredientId: requiredChoice(
            productMessage("recipe_ingredient_required", "Choose an ingredient on every row, or remove the empty row."),
          ),
          quantity: numberField("quantity", { min: 1, integer: true }),
        }),
      ),
    })
    .superRefine(({ items }, ctx) => {
      const seen = new Set<string>();
      items.forEach(({ ingredientId }, index) => {
        if (seen.has(ingredientId)) {
          ctx.addIssue({
            code: "custom",
            path: ["items", index, "ingredientId"],
            message: translate(
              "products.validation.recipe_duplicate",
              "{name} is listed more than once. Each ingredient can only appear once in a recipe.",
              { name: ingredientName(ingredientId) },
            ),
          });
        }
        seen.add(ingredientId);
      });
    });
}

export const extraSchema = z.object({
  name: requiredText("Extra name"),
  price: numberField("price", { min: 0 }),
  quantityOnHand: optionalNumberField("quantity on hand", { min: 0 }),
});

export const attachExtraSchema = z.object({
  extraId: requiredChoice(message("extra_required", "Choose an extra to offer.")),
});

export function stockMovementSchema(kind: "STOCK_IN" | "STOCK_CUT") {
  return z.object({
    productId: requiredChoice(message("product_required", "Choose a product first.")),
    quantity: numberField("quantity", { greaterThan: 0 }),
    unitCost: kind === "STOCK_IN" ? numberField("unit cost", { min: 0 }) : z.any().transform(() => undefined),
    note: optionalText("Note", 500),
  });
}

// ---- Shop content -----------------------------------------------------------------

export const isUsableLink = (link: string) => link.startsWith("/") || /^https?:\/\//i.test(link);

export const bannerSchema = z.object({
  title: requiredText("Title"),
  linkUrl: optionalText("Link").refine(
    (link) => !link || isUsableLink(link),
    message("link_invalid", 'Link must be a shop path starting with "/" (e.g. /menu) or a full http(s) URL.'),
  ),
  sortOrder: optionalNumberField("display order", { min: 0, integer: true }).transform((value) => value ?? 0),
});

export const eventSchema = z
  .object({
    title: requiredText("Title"),
    description: optionalText("Description"),
    startAt: z.string().min(1, message("event_start_required", "Choose when the event starts.")),
    endAt: z.string().min(1, message("event_end_required", "Choose when the event ends.")),
    latitude: optionalNumberField("latitude", { min: -90, max: 90 }),
    longitude: optionalNumberField("longitude", { min: -180, max: 180 }),
  })
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    ...message("event_end_after_start", "The end must come after the start."),
    path: ["endAt"],
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    ...message("coordinates_together", "Latitude and longitude must be given together."),
    path: ["longitude"],
  });

export const tableSchema = z.object({
  tableNumber: z
    .string()
    .trim()
    .min(1, message("table_number_required", "Table number is required."))
    .regex(/^[A-Za-z0-9-]{1,20}$/, message("table_number_invalid", "Use 1–20 letters, digits or dashes for the table number.")),
  size: requiredChoice(message("table_size_required", "Choose a table size.")),
  capacity: optionalNumberField("seats", { min: 1, max: 50, integer: true }),
});

// ---- Settings & orders ------------------------------------------------------------

export const exchangeRateSchema = z.object({
  khrPerUsd: numberField("exchange rate", { greaterThan: 0 }),
  marketRate: optionalNumberField("market rate", { greaterThan: 0 }),
});

export const estimateMinutesSchema = z.object({
  minutes: numberField("number of minutes", { min: 1, max: ESTIMATE_MAX_MINUTES, integer: true }),
});
