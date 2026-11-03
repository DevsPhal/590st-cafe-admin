import { humanise } from "@/lib/utils";

export type EnumGroup =
  | "role" | "user_status" | "status" | "order_status" | "payment_method" | "gender"
  | "audit_action" | "variant" | "unit" | "category_group" | "table_size" | "call_reason" | "contact_topic"
  | "movement_reason" | "waste_reason" | "report_period";

type Translate = (key: string, fallback?: string) => string;

/**
 * A backend enum value such as "OUT_FOR_DELIVERY" in the current language (common.json → enums).
 * Pass `t` from useI18n so the label follows a language switch; a value with no entry yet falls
 * back to the humanised English, as before.
 */
export function enumLabel(t: Translate, group: EnumGroup, value: string | null | undefined): string {
  if (!value) return "";
  return t(`enums.${group}.${value}`, humanise(value));
}
