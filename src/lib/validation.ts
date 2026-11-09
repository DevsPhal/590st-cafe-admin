import { z } from "zod";
import toast from "react-hot-toast";
import { PHONE_INVALID_MESSAGE, PHONE_PATTERN } from "@/lib/phone";
import { translate, type TranslationParams } from "@/contexts/translate";

// Messages are looked up when a form is checked, so they follow the selected language.
export function message(key: string, fallback: string, params?: () => TranslationParams) {
  return { error: () => translate(`validation.${key}`, fallback, params?.()) };
}

/** A field name as it appears inside a message, e.g. "Category name" or "reorder level". */
export function fieldLabel(label: string): string {
  return translate(`validation.fields.${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, label);
}

export const currencySchema = z.enum(["USD", "KHR"], message("select_currency", "Select a currency."));

export function buildCashPaymentSchema(minAmount: number) {
  return z.object({
    currency: currencySchema,
    amountTendered: z.coerce
      .number(message("amount_tendered", "Enter the amount handed over."))
      .positive(message("amount_tendered", "Enter the amount handed over."))
      .min(minAmount, message("amount_too_low", "Amount tendered is less than the total due.")),
  });
}

export type CashPaymentFormValues = z.infer<
  ReturnType<typeof buildCashPaymentSchema>
>;

export const deliveryFeeSchema = z.object({
  fee: z.coerce
    .number(message("delivery_fee", "Enter the delivery fee."))
    .min(0, message("delivery_fee_negative", "Delivery fee cannot be negative.")),
});

export function firstIssueMessage(
  error: z.ZodError,
  fallback = translate("validation.check_form", "Check the form and try again."),
): string {
  return error.issues[0]?.message ?? fallback;
}

// Mirrors the API's ValidationPatterns.STRONG_PASSWORD_REGEX (register, reset, change password, create staff).
export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const STRONG_PASSWORD_HINT =
  "At least 8 characters, including an uppercase letter, a lowercase letter, a number and a symbol.";

export const OTP_PATTERN = /^\d{6}$/;

/** Field path ("name", "items.0.quantity") -> first message for it. "" holds a problem with no field. */
export type FieldErrors = Record<string, string>;

/** Every field's first issue, keyed like the values object, so each can be shown under its input. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Validates values that have no visible form field to show an error under (a single
 * confirmation step, for example): shows the first issue as an error toast and returns null.
 * Forms with fields use useFormErrors().validate instead, which shows each message inline.
 */
export function parseForm<S extends z.ZodType>(schema: S, values: z.input<S>): z.output<S> | null {
  const result = schema.safeParse(values);
  if (!result.success) {
    toast.error(firstIssueMessage(result.error));
    return null;
  }
  return result.data;
}

// ---- Field builders shared by the form schemas -------------------------------------

/** Required text, trimmed. `max` mirrors the API's @Size limit. */
export const requiredText = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, message("required", "{label} is required.", () => ({ label: fieldLabel(label) })))
    .max(max, message("max_length", "{label} must be {max} characters or fewer.", () => ({ label: fieldLabel(label), max })));

/** Optional text, trimmed; blank becomes undefined. */
export const optionalText = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .max(max, message("max_length", "{label} must be {max} characters or fewer.", () => ({ label: fieldLabel(label), max })))
    .transform((value) => value || undefined);

export const fullNameField = z
  .string()
  .trim()
  .min(1, message("full_name_required", "Full name is required."))
  .min(2, message("full_name_short", "Full name must be at least 2 characters."))
  .max(120, message("full_name_long", "Full name must be 120 characters or fewer."));

export const emailField = z
  .string()
  .trim()
  .min(1, message("email_required", "Email is required."))
  .pipe(z.email(message("email_invalid", "Enter a valid email address.")))
  .transform((value) => value.toLowerCase());

export const optionalPhoneField = z
  .string()
  .trim()
  .refine((value) => !value || PHONE_PATTERN.test(value), message("phone_invalid", PHONE_INVALID_MESSAGE))
  .transform((value) => value || undefined);

export const requiredPhoneField = (requiredMessage = message("phone_required", "Phone number is required.")) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(PHONE_PATTERN, message("phone_invalid", PHONE_INVALID_MESSAGE));

export const strongPasswordField = z
  .string()
  .min(1, message("password_required", "Password is required."))
  // The API's PASSWORD_MAX_LENGTH: BCrypt only reads the first 72 bytes.
  .max(72, message("password_too_long", "Password must be 72 characters or fewer."))
  .regex(STRONG_PASSWORD_PATTERN, message("password_hint", STRONG_PASSWORD_HINT));

export const otpField = z
  .string()
  .trim()
  .regex(OTP_PATTERN, message("otp_invalid", "Enter the 6-digit code."));

/** A select that must have a value; `T` keeps the option's union type after parsing. */
export const requiredChoice = <T extends string = string>(error: ReturnType<typeof message>) =>
  z
    .string()
    .min(1, error)
    .transform((value) => value as T);

type NumberRules = {
  /** Inclusive lower bound. */
  min?: number;
  /** Exclusive lower bound (e.g. 0 for "greater than zero"). */
  greaterThan?: number;
  max?: number;
  integer?: boolean;
};

const toNumber = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.replace(/,/g, "").trim();
  return trimmed === "" ? undefined : Number(trimmed);
};

function numberRules(label: string, rules: NumberRules) {
  // "{Label}" starts a sentence, "{label}" sits inside one.
  const labels = () => {
    const name = fieldLabel(label);
    return { label: name, Label: capitalise(name), min: rules.min ?? "", max: rules.max ?? "", greaterThan: rules.greaterThan ?? "" };
  };
  let schema = z.number(message("number_invalid", "Enter a valid {label}.", labels));
  if (rules.integer) schema = schema.int(message("number_whole", "{Label} must be a whole number.", labels));
  if (rules.greaterThan !== undefined)
    schema = schema.gt(rules.greaterThan, message("number_greater_than", "{Label} must be greater than {greaterThan}.", labels));
  if (rules.min !== undefined)
    schema = schema.min(
      rules.min,
      rules.max !== undefined
        ? message("number_between", "{Label} must be between {min} and {max}.", labels)
        : message("number_min", "{Label} must be {min} or more.", labels),
    );
  if (rules.max !== undefined)
    schema = schema.max(
      rules.max,
      rules.min !== undefined
        ? message("number_between", "{Label} must be between {min} and {max}.", labels)
        : message("number_max", "{Label} must be {max} or less.", labels),
    );
  return schema;
}

/** A required number typed into a text input ("1,250.50" is accepted). */
export const numberField = (label: string, rules: NumberRules = {}) =>
  z.preprocess(toNumber, numberRules(label, rules));

/** An optional number typed into a text input; blank becomes undefined. */
export const optionalNumberField = (label: string, rules: NumberRules = {}) =>
  z.preprocess(toNumber, numberRules(label, rules).optional());

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
