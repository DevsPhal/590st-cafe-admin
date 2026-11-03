"use client";

import { memo, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Coffee, Minus, Plus } from "lucide-react";
import type { ProductResponse, ProductVariantResponse } from "@/store/api/types";
import { cn, titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { hasDrinkOptions } from "@/lib/drinkOptions";
import { formatStock, unitsPerSale } from "@/lib/stockUnits";
import { useI18n } from "@/contexts/I18nContext";

// How much of one product is already in the order, in total and per size.
export type CartCounts = { total: number; byVariant: Readonly<Record<string, number>> };

// Shared by every product that isn't in the order, so those cards skip re-rendering when the cart changes.
export const EMPTY_CART_COUNTS: CartCounts = { total: 0, byVariant: {} };

const money = (value: number) => `$${value.toFixed(2)}`;

function ProductImage({ src }: { src: string | null }) {
  // A broken image link falls back to the placeholder instead of an empty box.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = src && src !== failedSrc ? src : null;
  return image ? (
    <Image
      src={image}
      alt=""
      fill
      sizes="(max-width: 520px) 50vw, 240px"
      className="pos_product_img"
      onError={() => setFailedSrc(image)}
    />
  ) : (
    <Coffee aria-hidden className="pos_product_placeholder" strokeWidth={1.5} />
  );
}

export const PosProductCard = memo(function PosProductCard({
  product,
  counts,
  onAdd,
  onCustomize,
  onDecrease,
}: {
  product: ProductResponse;
  counts: CartCounts;
  onAdd: (product: ProductResponse, variant: ProductVariantResponse) => void;
  // Drinks with sugar/ice/milk or extras open the options dialog instead of adding straight away.
  onCustomize: (product: ProductResponse, variant: ProductVariantResponse) => void;
  onDecrease: (product: ProductResponse) => void;
}) {
  const { t } = useI18n();
  const name = titleCase(product.name);
  // Stock and reorder level are both counted in the sell unit (cans), whatever unit it was bought in.
  const stock = Number(product.quantityOnHand);
  const inCart = counts.total;
  const customizable = hasDrinkOptions(product);
  const pick = (variant: ProductVariantResponse) => (customizable ? onCustomize(product, variant) : onAdd(product, variant));

  const activeVariants = product.variants
    .filter((v) => v.status === "ACTIVE")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const onlyVariant = activeVariants.length === 1 ? activeVariants[0] : null;
  // A drink made from a recipe has no stock of its own: how many can be made depends on its ingredients.
  const recipeBased = activeVariants.some((v) => v.recipeBased);
  const canMake = Math.max(0, ...activeVariants.filter((v) => v.recipeBased).map((v) => v.availableQuantity ?? 0));
  // A carton needs a whole carton's worth of cans on hand.
  const notEnoughFor = (variant: ProductVariantResponse) =>
    variant.recipeBased ? (variant.availableQuantity ?? 0) < 1 : unitsPerSale(variant) > stock;
  const outOfStock = activeVariants.length === 0 || activeVariants.every(notEnoughFor);
  const lowStock = !outOfStock && !recipeBased && stock <= Number(product.reorderLevel);
  // A product also sold by the carton shows its stock in cartons too: "50 Can (2 Carton + 2)".
  const sellsMultiUnit = activeVariants.some((v) => unitsPerSale(v) > 1);
  const stockLabel = sellsMultiUnit
    ? formatStock(t, stock, product)
    : `${stock.toLocaleString()} ${enumLabel(t, "unit", product.sellUnit)}`;
  const perUnit = onlyVariant && unitsPerSale(onlyVariant) > 1
    ? enumLabel(t, "variant", onlyVariant.name)
    : enumLabel(t, "unit", product.sellUnit);
  const prices = activeVariants.map((v) => Number(v.finalPrice));
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const priceLabel = prices.length > 1 && lowest !== highest ? `${money(lowest)}–${money(highest)}` : money(prices[0] ?? 0);
  const originalPrice =
    onlyVariant && Number(onlyVariant.price) > Number(onlyVariant.finalPrice) ? Number(onlyVariant.price) : null;
  const discountLabel =
    !product.discountActive || product.discountValue == null
      ? null
      : product.discountType === "PERCENTAGE"
        ? t("pos.product.discount_off", "{amount} off", { amount: `${Number(product.discountValue)}%` })
        : t("pos.product.discount_off", "{amount} off", { amount: money(Number(product.discountValue)) });

  // Tapping the photo is the quick way to ring up one more; the Add/+ button below does the same for keyboards.
  const addFromPhoto = () => {
    if (outOfStock) {
      toast.error(t("pos.toast.out_of_stock", "{name} is out of stock.", { name: product.name }));
      return;
    }
    if (onlyVariant) pick(onlyVariant);
  };

  return (
    <article className={cn("pos_product_card", inCart > 0 && "is_in_cart", outOfStock && "is_out_of_stock")}>
      <div className={cn("pos_product_media", onlyVariant && "is_tappable")} onClick={onlyVariant ? addFromPhoto : undefined}>
        <ProductImage src={product.imageUrl} />
        {discountLabel ? <span className="pos_product_discount">{discountLabel}</span> : null}
        {inCart > 0 ? (
          // Keyed by the count so the badge pops each time the quantity changes.
          <span key={inCart} className="pos_product_in_cart" aria-hidden>
            {inCart}
          </span>
        ) : null}
      </div>

      <div className="pos_product_body">
        <h2 className="pos_product_name" title={name}>
          {name}
        </h2>
        <p className="pos_product_price">
          <strong>{priceLabel}</strong>
          {originalPrice !== null ? <s>{money(originalPrice)}</s> : null}
          <span>{t("pos.product.per_unit", "per {unit}", { unit: perUnit })}</span>
        </p>
        <p className={cn("pos_product_stock", lowStock && "is_low", outOfStock && "is_out")}>
          {outOfStock
            ? t("pos.product.out_of_stock", "Out of stock")
            : recipeBased
              ? t("pos.product.can_make", "Can make {count}", { count: canMake })
              : lowStock
              ? t("pos.product.low_stock_label", "Low stock · {stock}", { stock: stockLabel })
              : t("pos.product.stock_label", "{stock} in stock", { stock: stockLabel })}
        </p>

        <div className="pos_product_action">
          {onlyVariant ? (
            <div
              role="group"
              aria-label={t("pos.product.quantity_of", "Quantity of {name}", { name })}
              className={cn("pos_product_stepper", inCart === 0 && "is_empty")}
            >
              {inCart > 0 && (
                <button type="button" aria-label={t("pos.quantity.decrease", "Decrease quantity")} onClick={() => onDecrease(product)}>
                  <Minus aria-hidden />
                </button>
              )}
              {inCart > 0 && <span aria-live="polite">{inCart}</span>}
              {/* Stays the same element from "Add" to "+", so keyboard focus survives the first tap. */}
              <button
                type="button"
                className="is_add"
                disabled={notEnoughFor(onlyVariant)}
                aria-haspopup={customizable ? "dialog" : undefined}
                aria-label={
                  inCart > 0
                    ? t("pos.quantity.increase", "Increase quantity")
                    : outOfStock
                      ? undefined
                      : t("pos.product.add_to_order", "Add {name} to the order", { name })
                }
                onClick={() => pick(onlyVariant)}
              >
                {inCart === 0 && notEnoughFor(onlyVariant) ? (
                  t("pos.product.out_of_stock", "Out of stock")
                ) : (
                  <>
                    <Plus aria-hidden />
                    {inCart === 0 ? t("pos.product.add", "Add") : null}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="pos_product_variants">
              {activeVariants.map((variant) => {
                const count = counts.byVariant[variant.id] ?? 0;
                const perSale = unitsPerSale(variant);
                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={notEnoughFor(variant)}
                    aria-haspopup={customizable ? "dialog" : undefined}
                    onClick={() => pick(variant)}
                    className={cn("pos_product_variant", count > 0 && "is_selected")}
                    aria-label={t("pos.product.add_variant", "Add {variant} {name}, {price}", {
                      variant: enumLabel(t, "variant", variant.name),
                      name,
                      price: money(Number(variant.finalPrice)),
                    })}
                  >
                    <span>
                      {enumLabel(t, "variant", variant.name)}
                      {perSale > 1 ? ` ×${perSale}` : null}
                    </span>
                    <b>{money(Number(variant.finalPrice))}</b>
                    {count > 0 ? (
                      <span key={count} className="pos_product_variant_count" aria-hidden>
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
});
