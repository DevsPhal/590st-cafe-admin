"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { Loader2, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions, ErrorState, FormSelect, SkeletonBlock, listLoadState } from "@/components/common/AdminKit";
import {
  PosPaymentModal,
  type PosCartItem,
  type PosPaymentMethod,
} from "@/features/pos/components/PosPaymentModal";
import { SaleCompleteModal } from "@/components/common/InvoiceActions";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useCreateBaristaOrderMutation,
  usePayOrderCashMutation as usePayBaristaOrderCashMutation,
  useCancelBaristaOrderMutation,
  useGenerateBakongQrMutation as useGenerateBaristaBakongQrMutation,
  useConfirmBakongPaymentMutation as useConfirmBaristaBakongPaymentMutation,
} from "@/store/api/baristaOrderApi";
import {
  useCreateAdminOrderMutation,
  usePayAdminOrderCashMutation,
  useCancelOrderMutation,
  useGenerateAdminBakongQrMutation,
  useConfirmAdminBakongPaymentMutation,
} from "@/store/api/orderApi";
import { useListCategoriesQuery } from "@/store/api/categoryApi";
import { useListProductsQuery } from "@/store/api/productApi";
import { useGetExchangeRateQuery } from "@/store/api/reportApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { Currency, OrderItemRequest, OrderResponse, ProductResponse, ProductVariantResponse } from "@/store/api/types";
import { cn, humanise, titleCase } from "@/lib/utils";
import { useCatalogAlerts } from "@/hooks/useCatalogAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";

/** How often to ask the API whether the transfer has landed, same cadence as the customer app. */
const BAKONG_POLL_MS = 4000;

/**
 * Point of sale. Checkout is two API calls: creating a PENDING order from the cart, then
 * settling it with the cash tendered. Admin and barista each ring up their own sale against
 * their own endpoint pair (/api/admin/orders vs /api/barista/orders — both support it, per
 * AdminOrderController's own doc comment: "ring up walk-in sales the same as a barista can").
 * Stock is drawn down server-side, so the product grid refetches after each sale.
 *
 * A product carries no price of its own — every price lives on one of its variants (e.g.
 * Medium/Large), so a cart line is a product plus the specific variant chosen, not a size
 * add-on layered on top of a shared base price. Extras (add-ons like Pearl) exist in the API
 * but aren't offered here yet — a product's own attached extras would need a per-line picker,
 * which is future work, not part of this pass.
 */

/** A cart line is a product plus its chosen variant — the same product in two variants is two lines. */
type CartLine = {
  key: string;
  product: ProductResponse;
  variant: ProductVariantResponse;
  quantity: number;
};

/** Deterministic swatch so a product looks the same on every till, with no colour field in the API. */
function accentFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${hash}, 45%, 35%)`;
}

function ProductArtwork({
  accent,
  imageUrl,
  compact = false,
}: {
  accent: string;
  imageUrl?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("pos_product_artwork", compact && "is_compact")}
      style={
        imageUrl
          ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover" }
          : { background: accent }
      }
    />
  );
}

function QuantityControl({
  quantity,
  variant,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  variant: "product" | "cart";
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className={cn("pos_qty_control", variant === "cart" && "is_cart")}>
      <button type="button" aria-label="Decrease quantity" onClick={onDecrement}>
        <Minus />
      </button>
      <span>{quantity}</span>
      <button type="button" aria-label="Increase quantity" onClick={onIncrement}>
        <Plus />
      </button>
    </div>
  );
}

export default function PosView() {
  const { isAdmin, isBarista } = useCurrentRole();

  const [activeCategory, setActiveCategory] = usePersistentState<string>("pos:activeCategory", "All");
  const [search, setSearch] = usePersistentState("pos:search", "");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [cart, setCart] = usePersistentState<CartLine[]>("pos:cart", []);
  const [note, setNote] = usePersistentState("pos:note", "");
  const [pendingOrder, setPendingOrder] = usePersistentState<OrderResponse | null>("pos:pendingOrder", null);
  const confirmingRef = useRef(false);
  // The sale just paid, held so its invoice can be printed while the customer is still at the
  // counter — kept across a refresh so a reload doesn't lose the reprint.
  const [completedSale, setCompletedSale] = usePersistentState<OrderResponse | null>("pos:completedSale", null);

  const [cashCurrency, setCashCurrency] = useState<Currency>("USD");
  // The shop's own rate, kept up to date from Settings — a KHR customer is charged against
  // this, not a client-side guess. Admin-only endpoint (SecurityConfig), so a barista till
  // simply never sees KHR as a cash option rather than firing a request that would 403.
  const { data: exchangeRate } = useGetExchangeRateQuery(undefined, { skip: !isAdmin });

  // Bakong QR state — a walk-in sale scans this on the shop's own screen, so (unlike the
  // customer app's payment page) there's no "open in banking app" deeplink: that would open a
  // banking app on the till, not the customer's phone.
  const [bakongCurrency, setBakongCurrency] = useState<Currency>("USD");
  const [bakongQr, setBakongQr] = useState<{ dataUrl: string; amount: number } | null>(null);
  const [bakongSecondsLeft, setBakongSecondsLeft] = useState<number | null>(null);
  const [bakongFailure, setBakongFailure] = useState<string | null>(null);
  const [isGeneratingBakong, setIsGeneratingBakong] = useState(false);
  const [isCheckingBakong, setIsCheckingBakong] = useState(false);
  // Guards against overlapping calls; the state above is what the UI actually renders from.
  const isGeneratingBakongRef = useRef(false);
  const isCheckingBakongRef = useRef(false);

  const { data: categoryPage, refetch: refetchCategories } = useListCategoriesQuery({ page: 1, size: 100 });
  const productsQuery = useListProductsQuery({
    page: 1,
    size: 200,
    ...(activeCategory !== "All" ? { categoryId: activeCategory } : {}),
  });
  const { data: productPage, refetch } = productsQuery;
  // A catalog refresh mid-sale keeps the grid in place; placeholders only for a new category.
  const products = listLoadState(productsQuery);

  // A price, stock or catalog change made from another tab (or another staff member) reaches
  // the till instantly — a stale price at checkout is a real-money mistake, not a cosmetic one.
  useCatalogAlerts(
    useCallback(() => {
      void refetch();
      void refetchCategories();
    }, [refetch, refetchCategories])
  );

  const [createBaristaOrder, { isLoading: isCreatingBarista }] = useCreateBaristaOrderMutation();
  const [createAdminOrder, { isLoading: isCreatingAdmin }] = useCreateAdminOrderMutation();
  const [payBaristaCash, { isLoading: isPayingBarista }] = usePayBaristaOrderCashMutation();
  const [payAdminCash, { isLoading: isPayingAdmin }] = usePayAdminOrderCashMutation();
  const [cancelBaristaOrder, { isLoading: isCancellingBarista }] = useCancelBaristaOrderMutation();
  const [cancelAdminOrder, { isLoading: isCancellingAdmin }] = useCancelOrderMutation();
  const [generateBaristaBakongQr] = useGenerateBaristaBakongQrMutation();
  const [generateAdminBakongQr] = useGenerateAdminBakongQrMutation();
  const [confirmBaristaBakongPayment] = useConfirmBaristaBakongPaymentMutation();
  const [confirmAdminBakongPayment] = useConfirmAdminBakongPaymentMutation();

  const createOrder = isAdmin ? createAdminOrder : createBaristaOrder;
  const payCash = isAdmin ? payAdminCash : payBaristaCash;
  const cancelOrder = isAdmin ? cancelAdminOrder : cancelBaristaOrder;
  const generateBakongQr = isAdmin ? generateAdminBakongQr : generateBaristaBakongQr;
  const confirmBakongPayment = isAdmin ? confirmAdminBakongPayment : confirmBaristaBakongPayment;
  const isCreating = isAdmin ? isCreatingAdmin : isCreatingBarista;
  const isPaying = isAdmin ? isPayingAdmin : isPayingBarista;
  const isCancelling = isAdmin ? isCancellingAdmin : isCancellingBarista;

  const categories = categoryPage?.content ?? [];

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (productPage?.content ?? []).filter((product) => {
      if (product.status !== "ACTIVE") return false;
      // No active variant means no price, which means it can't be rung up at all.
      if (!product.variants.some((v) => v.status === "ACTIVE")) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term)
      );
    });
  }, [productPage, search]);

  const addToCart = (product: ProductResponse, variant: ProductVariantResponse) => {
    if (pendingOrder || confirmingRef.current) {
      toast.error("Finish or cancel the current payment before changing the order.");
      return;
    }
    const quantity = cart.filter((line) => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0);
    if (quantity + 1 > Number(product.quantityOnHand)) {
      toast.error(`${product.name} does not have enough stock`);
      return;
    }
    const key = `${product.id}:${variant.id}`;

    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { key, product, variant, quantity: 1 }];
    });
  };

  const changeQuantity = (key: string, delta: number) => {
    if (pendingOrder || confirmingRef.current) return;
    const item = cart.find((line) => line.key === key);
    if (item && delta > 0) {
      const quantity = cart.filter((line) => line.product.id === item.product.id).reduce((sum, line) => sum + line.quantity, 0);
      if (quantity + delta > Number(item.product.quantityOnHand)) {
        toast.error(`${item.product.name} does not have enough stock`);
        return;
      }
    }
    setCart((current) =>
      current
        .map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + delta } : line
        )
        .filter((line) => line.quantity > 0)
    );
  };

  const removeLine = (key: string) => {
    if (!pendingOrder && !confirmingRef.current) setCart((current) => current.filter((line) => line.key !== key));
  };

  const resetBakongState = () => {
    setBakongQr(null);
    setBakongSecondsLeft(null);
    setBakongFailure(null);
  };

  const resetCart = () => {
    setPendingOrder(null);
    setCart([]);
    setNote("");
    setPaymentMethod("cash");
    setCashCurrency("USD");
    resetBakongState();
  };
  const clearCart = async () => {
    if (confirmingRef.current || isCancelling) return;
    try {
      if (pendingOrder) await cancelOrder(pendingOrder.id).unwrap();
      resetCart();
    } catch (error) {
      toast.error(apiErrorMessage(error as never, "Could not cancel the pending order. Check its payment status."));
    }
  };

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + Number(line.variant.finalPrice) * line.quantity, 0);

  // Original (pre-discount) value, so the modal can show what the customer saved.
  const grossTotal = cart.reduce((sum, line) => sum + Number(line.variant.price) * line.quantity, 0);
  const discount = Math.max(grossTotal - total, 0);

  const paymentItems: PosCartItem[] = cart.map((line) => ({
    id: line.key,
    name: `${titleCase(line.product.name)} (${humanise(line.variant.name)})`,
    price: Number(line.variant.finalPrice) * line.quantity,
    originalPrice: line.product.discountActive
      ? Number(line.variant.price) * line.quantity
      : undefined,
    quantity: line.quantity,
    accent: accentFor(line.product.id),
  }));

  /** Reuses the already-created order if only the payment leg is being retried (e.g. a failed
   *  cash confirm, or switching from Cash to Bakong on the same sale). */
  const ensureOrder = async (): Promise<OrderResponse> => {
    if (pendingOrder) return pendingOrder;
    const items: OrderItemRequest[] = cart.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      variantId: line.variant.id,
    }));
    const order = await createOrder({ items, note: note.trim() || undefined }).unwrap();
    setPendingOrder(order);
    return order;
  };

  const handleConfirmPayment = async (currency: Currency, amountTendered: number) => {
    if (cart.length === 0 || confirmingRef.current) return;
    confirmingRef.current = true;

    try {
      const order = await ensureOrder();
      const paid = await payCash({
        id: order.id,
        body: { currency, amountTendered },
      }).unwrap();

      // The sale-complete dialog shows the change due and offers the invoice.
      setPaymentOpen(false);
      resetCart();
      setCompletedSale(paid);
    } catch (err) {
      // The order may already exist if only the payment leg failed — the queue will show it
      // as PENDING so it can be settled there rather than silently lost.
      toast.error(apiErrorMessage(err as never, "Could not complete the sale."));
    } finally {
      confirmingRef.current = false;
    }
  };

  /**
   * Generates (or regenerates, after expiry) a Bakong QR for this sale — the same call the
   * customer app makes on its own /payment page, but shown on the shop's own screen for the
   * customer to scan in person. No deeplink here: opening a banking app would open it on the
   * till, not the customer's phone.
   */
  const handleGenerateBakongQr = async () => {
    if (cart.length === 0 || isGeneratingBakongRef.current) return;
    isGeneratingBakongRef.current = true;
    setIsGeneratingBakong(true);
    setBakongFailure(null);
    try {
      const order = await ensureOrder();
      const issued = await generateBakongQr({ id: order.id, currency: bakongCurrency }).unwrap();
      const dataUrl = await QRCode.toDataURL(issued.qrString, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setBakongQr({ dataUrl, amount: Number(issued.amount) });
      setBakongSecondsLeft(Math.max(0, Math.floor(issued.expiresInSeconds)));
    } catch (err) {
      setBakongFailure(apiErrorMessage(err as never, "Could not generate the payment QR."));
    } finally {
      isGeneratingBakongRef.current = false;
      setIsGeneratingBakong(false);
    }
  };

  const handleCheckBakongPayment = async () => {
    if (!pendingOrder || isCheckingBakongRef.current) return;
    isCheckingBakongRef.current = true;
    setIsCheckingBakong(true);
    try {
      const updated = await confirmBakongPayment(pendingOrder.id).unwrap();
      if (updated.paidAt) {
        setPaymentOpen(false);
        resetCart();
        setCompletedSale(updated);
      }
      // No transfer found yet — the API hands back the order untouched rather than failing, so
      // silently doing nothing here is correct; the next auto-poll or manual click tries again.
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not check the payment."));
    } finally {
      isCheckingBakongRef.current = false;
      setIsCheckingBakong(false);
    }
  };

  // Auto-generate the QR the moment the Bakong tab is opened, same as switching currency —
  // the customer shouldn't need a separate "Generate" click on top of picking the tab.
  useEffect(() => {
    if (paymentOpen && paymentMethod === "bakong" && !bakongQr && !isGeneratingBakongRef.current) {
      void handleGenerateBakongQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOpen, paymentMethod, bakongCurrency]);

  // Countdown to the QR's real expiry, reported as a duration so no timezone reconciliation
  // is needed.
  useEffect(() => {
    if (paymentMethod !== "bakong" || bakongSecondsLeft === null || bakongSecondsLeft <= 0) return;
    const timer = setTimeout(() => setBakongSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [paymentMethod, bakongSecondsLeft]);

  // Polls for the transfer while a live QR is on screen — the customer scans on this same
  // screen, so there's no "returning from a banking app" focus event to hook into instead.
  useEffect(() => {
    if (paymentMethod !== "bakong" || !bakongQr || (bakongSecondsLeft ?? 0) <= 0) return;
    const interval = setInterval(() => { void handleCheckBakongPayment(); }, BAKONG_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, bakongQr, bakongSecondsLeft !== null && bakongSecondsLeft > 0]);

  return (
    <PageShell contentClassName="is_pos_page">
      <PageHeader
        title="POS"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Point of Sale" }]}
        rightSlot={<AdminTopActions />}
      />
      {pendingOrder && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p>Order #{pendingOrder.id.slice(0, 8)} is awaiting payment. Retry payment or clear the order to cancel it.</p>
        <button type="button" onClick={() => setPaymentOpen(true)} className="underline">Resume payment</button>
      </div>}

      <div className="pos_layout">
        <section className="pos_catalog" aria-label="Product catalog">
          <div className="pos_catalog_toolbar">
            <div
              className="pos_category_selection"
              role="tablist"
              aria-label="Product categories"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === "All"}
                className={cn(activeCategory === "All" && "is_active")}
                onClick={() => setActiveCategory("All")}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === category.id}
                  className={cn(activeCategory === category.id && "is_active")}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {titleCase(category.name)}
                </button>
              ))}
            </div>

            <label className="pos_search">
              <Search />
              <input
                placeholder="Search product by name or SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          <div className="pos_product_grid_scroll">
            {products.isLoading ? (
              <div className="pos_product_grid" role="status" aria-label="Loading products">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-3 rounded-xl bg-white p-3">
                    <SkeletonBlock className="aspect-square w-full rounded-lg" />
                    <SkeletonBlock className="h-4 w-3/4" />
                    <SkeletonBlock className="h-4 w-1/3" />
                  </div>
                ))}
              </div>
            ) : products.error ? (
              <div className="p-8">
                <ErrorState error={products.error} fallback="Could not load products." onRetry={refetch} isRetrying={productsQuery.isFetching} />
              </div>
            ) : visibleProducts.length === 0 ? (
              <p className="p-8 text-sm text-gray-400">
                No active products in this category.
              </p>
            ) : (
              <div className="pos_product_grid">
                {visibleProducts.map((product) => {
                  const outOfStock = Number(product.quantityOnHand) <= 0;
                  const discountPercent =
                    product.discountActive && product.discountType === "PERCENTAGE"
                      ? Number(product.discountValue)
                      : null;
                  const activeVariants = [...product.variants]
                    .filter((v) => v.status === "ACTIVE")
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                  const prices = activeVariants.map((v) => Number(v.finalPrice));
                  const priceLabel =
                    prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
                      ? `$${Math.min(...prices).toFixed(2)}–$${Math.max(...prices).toFixed(2)}`
                      : `$${(prices[0] ?? 0).toFixed(2)}`;
                  // A single variant needs no picker — the whole card just adds it, same as a
                  // plain product used to. More than one means the variant itself must be
                  // chosen, so the generic +/- control doesn't apply.
                  const onlyVariant = activeVariants.length === 1 ? activeVariants[0] : null;
                  const inCart = cart
                    .filter((line) => line.product.id === product.id)
                    .reduce((sum, line) => sum + line.quantity, 0);

                  return (
                    <article
                      key={product.id}
                      className={cn("pos_product_card", outOfStock && "opacity-50")}
                    >
                      <div className="pos_product_media">
                        <ProductArtwork
                          accent={accentFor(product.id)}
                          imageUrl={product.imageUrl}
                        />
                        {discountPercent ? (
                          <span className="pos_discount_badge">{discountPercent}% Off</span>
                        ) : null}
                      </div>
                      <div className="pos_product_content">
                        <div className="pos_product_details">
                          <div className="pos_product_title_row">
                            <h2>{titleCase(product.name)}</h2>
                            <strong>{priceLabel}</strong>
                          </div>
                          <div className="pos_product_meta">
                            <span>In stock: {Number(product.quantityOnHand)}</span>
                            <span>{humanise(product.stockUnit)}</span>
                          </div>
                          {!onlyVariant ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {activeVariants.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  disabled={outOfStock}
                                  onClick={() => addToCart(product, variant)}
                                  className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 disabled:opacity-50"
                                >
                                  {humanise(variant.name)} ${Number(variant.finalPrice).toFixed(2)}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {onlyVariant ? (
                          <QuantityControl
                            quantity={inCart}
                            variant="product"
                            onIncrement={() => {
                              if (outOfStock) {
                                toast.error(`${product.name} is out of stock`);
                                return;
                              }
                              addToCart(product, onlyVariant);
                            }}
                            onDecrement={() => {
                              const line = [...cart]
                                .reverse()
                                .find((l) => l.product.id === product.id);
                              if (line) changeQuantity(line.key, -1);
                            }}
                          />
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="pos_order_panel" aria-label="Order summary">
          <div className="pos_order_header">
            <div>
              <h2>Order Summary</h2>
            </div>
            <div className="pos_order_header_actions">
              <button type="button" aria-label="Clear order" onClick={clearCart}>
                <X />
              </button>
            </div>
          </div>

          {/* CreateOrderRequest carries only items and a note — no dining option or table. */}
          <div className="pos_order_selects">
            <FormSelect
              label="Order note"
              value={note}
              onChange={(event) => { if (!pendingOrder && !confirmingRef.current) setNote(event.target.value); }}
              placeholder="No note"
            >
              <option value="Dine in">Dine in</option>
              <option value="Takeaway">Takeaway</option>
              <option value="Delivery">Delivery</option>
            </FormSelect>
          </div>

          <div className="pos_cart_list">
            {cart.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">
                Cart is empty. Tap a product to add it.
              </p>
            ) : (
              cart.map((line) => (
                <article key={line.key} className="pos_cart_item">
                  <ProductArtwork
                    accent={accentFor(line.product.id)}
                    imageUrl={line.product.imageUrl}
                    compact
                  />
                  <div className="pos_cart_item_content">
                    <h3>
                      {titleCase(line.product.name)} ({humanise(line.variant.name)})
                    </h3>
                    <div className="pos_cart_item_bottom">
                      <div className="pos_cart_price">
                        {line.product.discountActive ? (
                          <span className="is_struck">
                            ${Number(line.variant.price).toFixed(2)}
                          </span>
                        ) : null}
                        <strong>${Number(line.variant.finalPrice).toFixed(2)}</strong>
                      </div>
                      <QuantityControl
                        quantity={line.quantity}
                        variant="cart"
                        onIncrement={() => changeQuantity(line.key, 1)}
                        onDecrement={() => changeQuantity(line.key, -1)}
                      />
                    </div>
                  </div>
                  <div className="pos_cart_item_actions">
                    <button
                      type="button"
                      className="pos_cart_action is_remove"
                      aria-label={`Remove ${line.product.name}`}
                      onClick={() => removeLine(line.key)}
                    >
                      <X />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <dl className="pos_order_totals">
            <dt>Subtotal:</dt>
            <dd>
              ${grossTotal.toFixed(2)} - {itemCount} {itemCount === 1 ? "Item" : "Items"}
            </dd>
            <dt>Total Discount:</dt>
            <dd>${discount.toFixed(2)}</dd>
            <dt className="is_grand_total">Grand Total:</dt>
            <dd className="is_grand_total">${total.toFixed(2)}</dd>
          </dl>

          <div className="pos_order_ctas">
            <button
              type="button"
              className="btn_outline_black"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              <ShoppingBag />
              Clear
            </button>
            <button
              type="button"
              className="btn_primary_yellow"
              onClick={() => setPaymentOpen(true)}
              disabled={cart.length === 0 || (!isAdmin && !isBarista)}
            >
              Make a Payment
              <span aria-hidden className="pos_cta_arrow">
                →
              </span>
            </button>
          </div>
        </aside>
      </div>

      <PosPaymentModal
        open={paymentOpen}
        onOpenChange={(open) => {
          setPaymentOpen(open);
          if (!open) resetBakongState();
        }}
        items={paymentItems}
        total={Number(pendingOrder?.totalAmount ?? total)}
        orderTable={note || "Walk-in"}
        orderId={pendingOrder ? `#${pendingOrder.id.slice(0, 8)}` : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
        method={paymentMethod}
        onMethodChange={(next) => {
          setPaymentMethod(next);
          if (next === "cash") resetBakongState();
        }}
        onConfirm={handleConfirmPayment}
        isLoading={isCreating || isPaying}
        cash={{
          currency: cashCurrency,
          onCurrencyChange: setCashCurrency,
          khrPerUsdRate: exchangeRate ? Number(exchangeRate.khrPerUsdRate) : null,
        }}
        bakong={{
          currency: bakongCurrency,
          onCurrencyChange: (next) => {
            setBakongCurrency(next);
            resetBakongState();
          },
          qrDataUrl: bakongQr?.dataUrl ?? null,
          amount: bakongQr?.amount ?? null,
          isGenerating: isGeneratingBakong,
          secondsLeft: bakongSecondsLeft,
          isChecking: isCheckingBakong,
          failure: bakongFailure,
          onCheckPayment: () => { void handleCheckBakongPayment(); },
          onRetry: () => { void handleGenerateBakongQr(); },
        }}
      />
      <SaleCompleteModal sale={completedSale} onNewSale={() => setCompletedSale(null)} />
    </PageShell>
  );
}
