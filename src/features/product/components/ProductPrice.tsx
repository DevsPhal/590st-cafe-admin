"use client";

import { useI18n } from "@/contexts/I18nContext";
import { discountAmountLabel, productPriceLabel } from "@/lib/utils";
import type { ProductResponse } from "@/store/api/types";

/** The list's price: what customers pay now and, while a discount runs, the old price and how much is off. */
export function ProductPrice({
  product,
}: {
  product: Pick<ProductResponse, "variants" | "discountActive" | "discountType" | "discountValue">;
}) {
  const { t } = useI18n();
  const now = productPriceLabel(product.variants);
  const off = discountAmountLabel(product);
  if (!off) return <>{now}</>;
  const before = productPriceLabel(product.variants, "price");
  return (
    <span className="product_price">
      <strong>{now}</strong>
      {before !== now ? <s>{before}</s> : null}
      <span className="discount_badge">{t("products.discount_off", "{value} off", { value: off })}</span>
    </span>
  );
}
