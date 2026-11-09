"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { Minus, Pencil, Plus, Search, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions, ErrorState, FormSelect, SkeletonBlock, Thumbnail, listLoadState } from "@/components/common/AdminKit";
import {
  PosPaymentModal,
  type PosCartItem,
  type PosPaymentMethod,
} from "@/features/pos/components/PosPaymentModal";
import { EMPTY_CART_COUNTS, PosProductCard, type CartCounts } from "@/features/pos/components/PosProductCard";
import { PosOptionsDialog, type PosExtra, type PosLineOptions } from "@/features/pos/components/PosOptionsDialog";
import { SaleCompleteModal } from "@/components/common/InvoiceActions";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useCreateBaristaOrderMutation,
  usePayOrderCashMutation as usePayBaristaOrderCashMutation,
  useCancelBaristaOrderMutation,
  useGenerateBakongQrMutation as useGenerateBaristaBakongQrMutation,
  useConfirmBakongPaymentMutation as useConfirmBaristaBakongPaymentMutation,
  useGetBaristaOrderQuery,
} from "@/store/api/baristaOrderApi";
import {
  useCreateAdminOrderMutation,
  usePayAdminOrderCashMutation,
  useCancelOrderMutation,
  useGenerateAdminBakongQrMutation,
  useConfirmAdminBakongPaymentMutation,
  useGetOrderQuery,
} from "@/store/api/orderApi";
import { useListCategoriesQuery } from "@/store/api/categoryApi";
import { useListProductsQuery } from "@/store/api/productApi";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useListPublicTablesQuery } from "@/store/api/tableApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type {
  Currency,
  IceLevel,
  MilkType,
  OrderItemRequest,
  OrderResponse,
  OrderType,
  ProductResponse,
  ProductVariantResponse,
  SugarLevel,
} from "@/store/api/types";
import { cn, titleCase } from "@/lib/utils";
import { hasDrinkOptions, optionSummary } from "@/lib/drinkOptions";
import { hasStockFor } from "@/lib/stockUnits";
import { useCatalogAlerts } from "@/hooks/useCatalogAlerts";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { useI18n } from "@/contexts/I18nContext";

const BAKONG_POLL_MS = 4000;
// The API's ValidationPatterns.MAX_ITEM_QUANTITY: the most of one item a single line can hold.
const MAX_LINE_QUANTITY = 999;

type CartLine = {
  key: string;
  product: ProductResponse;
  variant: ProductVariantResponse;
  quantity: number;
  // Drink choices (carts saved before these existed have none).
  sugarLevel?: SugarLevel;
  iceLevel?: IceLevel;
  milkType?: MilkType;
  extras?: PosExtra[];
};

// One line per product, size and set of drink choices, so "Large, less sugar" and "Large, no ice" stay apart.
function lineKey(productId: string, options: PosLineOptions): string {
  const extraIds = options.extras.map((extra) => extra.extraId).sort().join(",");
  return [productId, options.variant.id, options.sugarLevel ?? "", options.iceLevel ?? "", options.milkType ?? "", extraIds].join(":");
}

// Extras are charged at their own price on top of the (possibly discounted) drink, as the API prices them.
const extrasTotal = (line: CartLine) => (line.extras ?? []).reduce((sum, extra) => sum + extra.price, 0);
const lineUnitPrice = (line: CartLine) => Number(line.variant.finalPrice) + extrasTotal(line);
const lineUnitOriginal = (line: CartLine) => Number(line.variant.price) + extrasTotal(line);
const lineOptions = (line: CartLine) =>
  optionSummary({
    variantName: line.product.variants.filter((v) => v.status === "ACTIVE").length > 1 ? line.variant.name : null,
    sugarLevel: line.sugarLevel,
    iceLevel: line.iceLevel,
    milkType: line.milkType,
    extras: (line.extras ?? []).map((extra) => ({ name: titleCase(extra.name) })),
  });

type OptionsRequest = { id: number; product: ProductResponse; initial: Partial<PosLineOptions>; editKey?: string };

function accentFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${hash}, 45%, 35%)`;
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
  const { t } = useI18n();
  return (
    <div className={cn("pos_qty_control", variant === "cart" && "is_cart")}>
      <button type="button" aria-label={t("pos.quantity.decrease", "Decrease quantity")} onClick={onDecrement}>
        <Minus />
      </button>
      <span>{quantity}</span>
      <button type="button" aria-label={t("pos.quantity.increase", "Increase quantity")} onClick={onIncrement}>
        <Plus />
      </button>
    </div>
  );
}

export default function PosView() {
  const { t } = useI18n();
  const { isAdmin, isBarista } = useCurrentRole();

  const [activeCategory, setActiveCategory] = usePersistentState<string>("pos:activeCategory", "All");
  const [search, setSearch] = usePersistentState("pos:search", "");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [cart, setCart] = usePersistentState<CartLine[]>("pos:cart", []);
  const [storedOrderType, setOrderType] = usePersistentState<OrderType>("pos:orderType", "DINE_IN");
  // Dine in unless take-away was picked (also covers a stale or missing saved value).
  const orderType: OrderType = storedOrderType === "TAKE_AWAY" ? "TAKE_AWAY" : "DINE_IN";
  const [tableNumber, setTableNumber] = usePersistentState("pos:tableNumber", "");
  const isDineIn = orderType === "DINE_IN";
  const { data: tables } = useListPublicTablesQuery(undefined, { skip: !isDineIn });
  const [pendingOrder, setPendingOrder] = usePersistentState<OrderResponse | null>("pos:pendingOrder", null);
  const confirmingRef = useRef(false);
  const [completedSale, setCompletedSale] = usePersistentState<OrderResponse | null>("pos:completedSale", null);

  const [cashCurrency, setCashCurrency] = useState<Currency>("USD");
  const { exchangeRate } = useExchangeRate();

  const [bakongCurrency, setBakongCurrency] = useState<Currency>("USD");
  const [bakongQr, setBakongQr] = useState<{ dataUrl: string; amount: number } | null>(null);
  const [bakongSecondsLeft, setBakongSecondsLeft] = useState<number | null>(null);
  const [bakongFailure, setBakongFailure] = useState<string | null>(null);
  const [isGeneratingBakong, setIsGeneratingBakong] = useState(false);
  const isGeneratingBakongRef = useRef(false);
  const bakongCheckErrorRef = useRef<string | null>(null);
  const isCheckingBakongRef = useRef(false);

  const { data: categoryPage, refetch: refetchCategories } = useListCategoriesQuery({ page: 1, size: 100 });
  const productsQuery = useListProductsQuery({
    page: 1,
    size: 500,
    ...(activeCategory !== "All" ? { categoryId: activeCategory } : {}),
  });
  const { data: productPage, refetch } = productsQuery;
  const products = listLoadState(productsQuery);

  useCatalogAlerts(
    useCallback(() => {
      void refetch();
      void refetchCategories();
    }, [refetch, refetchCategories])
  );
  // Sales, deliveries and waste on any till change what is left, including how many recipe drinks can be made.
  useInventoryAlerts(useCallback(() => { void refetch(); }, [refetch]));

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
      if (product.status !== "ACTIVE" || product.categoryGroup === "INGREDIENT") return false;
      if (!product.variants.some((v) => v.status === "ACTIVE")) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term)
      );
    });
  }, [productPage, search]);

  const addToCart = (product: ProductResponse, options: PosLineOptions) => {
    if (pendingOrder || confirmingRef.current) {
      toast.error(t("pos.toast.finish_payment_first", "Finish or cancel the payment before editing the order."));
      return;
    }
    if (!hasStockFor(product, options.variant, cart)) {
      toast.error(t("pos.toast.not_enough_stock", "{name} does not have enough stock.", { name: product.name }));
      return;
    }
    const key = lineKey(product.id, options);
    if ((cart.find((line) => line.key === key)?.quantity ?? 0) >= MAX_LINE_QUANTITY) {
      toast.error(t("pos.toast.line_limit", "One line can hold at most {max}.", { max: MAX_LINE_QUANTITY }));
      return;
    }

    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { key, product, quantity: 1, ...options }];
    });
  };

  const [optionsRequest, setOptionsRequest] = useState<OptionsRequest | null>(null);

  // Opens the drink options, starting from how this drink was last made in the order ("same again" is one tap).
  const openOptions = (product: ProductResponse, variant: ProductVariantResponse) => {
    if (pendingOrder || confirmingRef.current) {
      toast.error(t("pos.toast.finish_payment_first", "Finish or cancel the payment before editing the order."));
      return;
    }
    const last = [...cart].reverse().find((line) => line.product.id === product.id);
    setOptionsRequest({
      id: Date.now(),
      product,
      initial: { variant, sugarLevel: last?.sugarLevel, iceLevel: last?.iceLevel, milkType: last?.milkType, extras: last?.extras ?? [] },
    });
  };

  const editLine = (line: CartLine) => {
    if (pendingOrder || confirmingRef.current) return;
    setOptionsRequest({ id: Date.now(), product: line.product, initial: { ...line, extras: line.extras ?? [] }, editKey: line.key });
  };

  const confirmOptions = (options: PosLineOptions) => {
    if (!optionsRequest) return;
    const { product, editKey } = optionsRequest;
    setOptionsRequest(null);
    if (!editKey) {
      addToCart(product, options);
      return;
    }
    // Switching a line from a can to a carton (or to another size) can take more stock than it did.
    const editing = cart.find((line) => line.key === editKey);
    if (editing && !hasStockFor(product, options.variant, cart.filter((line) => line.key !== editKey), editing.quantity)) {
      toast.error(t("pos.toast.not_enough_stock", "{name} does not have enough stock.", { name: product.name }));
      return;
    }
    const key = lineKey(product.id, options);
    const twinQuantity = cart.find((line) => line.key === key && line.key !== editKey)?.quantity ?? 0;
    if (editing && twinQuantity + editing.quantity > MAX_LINE_QUANTITY) {
      toast.error(t("pos.toast.line_limit", "One line can hold at most {max}.", { max: MAX_LINE_QUANTITY }));
      return;
    }
    setCart((current) => {
      const edited = current.find((line) => line.key === editKey);
      if (!edited) return current;
      const twin = current.find((line) => line.key === key && line.key !== editKey);
      // Changed to match another line: merge them; otherwise update the line where it is.
      return twin
        ? current
            .filter((line) => line.key !== editKey)
            .map((line) => (line.key === key ? { ...line, quantity: line.quantity + edited.quantity } : line))
        : current.map((line) => (line.key === editKey ? { ...line, ...options, key } : line));
    });
  };

  const changeQuantity = (key: string, delta: number) => {
    if (pendingOrder || confirmingRef.current) return;
    const item = cart.find((line) => line.key === key);
    if (item && delta > 0) {
      if (item.quantity + delta > MAX_LINE_QUANTITY) {
        toast.error(t("pos.toast.line_limit", "One line can hold at most {max}.", { max: MAX_LINE_QUANTITY }));
        return;
      }
      if (!hasStockFor(item.product, item.variant, cart, delta)) {
        toast.error(t("pos.toast.not_enough_stock", "{name} does not have enough stock.", { name: item.product.name }));
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

  // The product card's minus takes one off the most recently added size of that product.
  const decreaseProduct = (product: ProductResponse) => {
    const line = [...cart].reverse().find((l) => l.product.id === product.id);
    if (line) changeQuantity(line.key, -1);
  };

  // Product cards are memoised, so hand them stable callbacks that always run the latest cart logic.
  const cartActions = useRef({ addToCart, decreaseProduct, openOptions });
  useLayoutEffect(() => {
    cartActions.current = { addToCart, decreaseProduct, openOptions };
  });
  const handleAddProduct = useCallback(
    (product: ProductResponse, variant: ProductVariantResponse) =>
      cartActions.current.addToCart(product, { variant, extras: [] }),
    []
  );
  const handleCustomizeProduct = useCallback(
    (product: ProductResponse, variant: ProductVariantResponse) => cartActions.current.openOptions(product, variant),
    []
  );
  const handleDecreaseProduct = useCallback(
    (product: ProductResponse) => cartActions.current.decreaseProduct(product),
    []
  );

  const cartCounts = useMemo(() => {
    const counts = new Map<string, { total: number; byVariant: Record<string, number> }>();
    for (const line of cart) {
      const entry = counts.get(line.product.id) ?? { total: 0, byVariant: {} };
      entry.total += line.quantity;
      entry.byVariant[line.variant.id] = (entry.byVariant[line.variant.id] ?? 0) + line.quantity;
      counts.set(line.product.id, entry);
    }
    return counts as ReadonlyMap<string, CartCounts>;
  }, [cart]);

  const resetBakongState = () => {
    setBakongQr(null);
    setBakongSecondsLeft(null);
    setBakongFailure(null);
  };

  const resetCart = () => {
    setPendingOrder(null);
    setCart([]);
    setOrderType("DINE_IN");
    setTableNumber("");
    setPaymentMethod("cash");
    setCashCurrency("USD");
    resetBakongState();
  };
  // The pending order is remembered across reloads, so it can go stale: it may have been paid, or cancelled
  // from another screen or because its QR expired. Re-read it from the server and live updates.
  const adminPendingQuery = useGetOrderQuery(pendingOrder?.id ?? "", {
    skip: !pendingOrder || !isAdmin,
    refetchOnMountOrArgChange: true,
  });
  const baristaPendingQuery = useGetBaristaOrderQuery(pendingOrder?.id ?? "", {
    skip: !pendingOrder || isAdmin,
    refetchOnMountOrArgChange: true,
  });
  const latestPendingOrder = isAdmin ? adminPendingQuery.data : baristaPendingQuery.data;

  const settlePendingOrder = (latest: OrderResponse) => {
    if (!pendingOrder || latest.id !== pendingOrder.id || latest.status === "PENDING") return;
    setPaymentOpen(false);
    if (latest.paidAt) {
      resetCart();
      setCompletedSale(latest);
      return;
    }
    // Cancelled elsewhere: forget the order but keep the cart, so the sale can be rung up again.
    setPendingOrder(null);
    resetBakongState();
    toast(
      t(
        "pos.toast.order_cancelled",
        "Order #{id} was cancelled. The cart is kept — take payment again to start a new order.",
        { id: latest.id.slice(0, 8) }
      )
    );
  };

  useEffect(() => {
    if (!latestPendingOrder) return;
    const timer = setTimeout(() => settlePendingOrder(latestPendingOrder), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestPendingOrder]);

  useStaffOrderAlerts((message) => settlePendingOrder(message.order));

  const clearCart = async () => {
    if (confirmingRef.current || isCancelling) return;
    try {
      if (pendingOrder?.status === "PENDING" || (pendingOrder && latestPendingOrder?.status === "PENDING")) {
        await cancelOrder(pendingOrder.id).unwrap();
      }
      resetCart();
    } catch (error) {
      const refreshed = isAdmin ? await adminPendingQuery.refetch() : await baristaPendingQuery.refetch();
      if (refreshed.data && refreshed.data.status !== "PENDING") {
        resetCart();
        return;
      }
      toast.error(apiErrorMessage(error as never, t("pos.errors.cancel_pending", "Could not cancel the pending order. Check its payment status.")));
    }
  };

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);

  const grossTotal = cart.reduce((sum, line) => sum + lineUnitOriginal(line) * line.quantity, 0);
  const discount = Math.max(grossTotal - total, 0);

  const orderTypeLabels: Record<OrderType, string> = {
    DINE_IN: t("pos.order.type_dine_in", "Dine in"),
    TAKE_AWAY: t("pos.order.type_take_away", "Take away"),
  };
  const orderTypeSummary =
    isDineIn && tableNumber
      ? t("pos.order.table_option", "Table {number}", { number: tableNumber })
      : orderTypeLabels[orderType];
  // The type is part of the order once it's created, so it can't change mid-payment.
  const isOrderLocked = pendingOrder != null;
  const chooseOrderType = (next: OrderType) => {
    if (isOrderLocked || confirmingRef.current) return;
    setOrderType(next);
    if (next === "TAKE_AWAY") setTableNumber("");
  };

  const paymentItems: PosCartItem[] = cart.map((line) => ({
    id: line.key,
    name: lineOptions(line) ? `${titleCase(line.product.name)} (${lineOptions(line)})` : titleCase(line.product.name),
    price: lineUnitPrice(line) * line.quantity,
    originalPrice: line.product.discountActive
      ? lineUnitOriginal(line) * line.quantity
      : undefined,
    quantity: line.quantity,
    accent: accentFor(line.product.id),
  }));

  const ensureOrder = async (): Promise<OrderResponse> => {
    if (pendingOrder) return pendingOrder;
    const items: OrderItemRequest[] = cart.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      variantId: line.variant.id,
      ...(line.sugarLevel ? { sugarLevel: line.sugarLevel } : {}),
      ...(line.iceLevel ? { iceLevel: line.iceLevel } : {}),
      ...(line.milkType ? { milkType: line.milkType } : {}),
      ...(line.extras?.length ? { extraIds: line.extras.map((extra) => extra.extraId) } : {}),
    }));
    const order = await createOrder({
      items,
      orderType,
      tableNumber: isDineIn && tableNumber ? tableNumber : undefined,
    }).unwrap();
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

      setPaymentOpen(false);
      resetCart();
      setCompletedSale(paid);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("pos.errors.complete_sale", "Could not complete the sale.")));
    } finally {
      confirmingRef.current = false;
    }
  };

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
      setBakongFailure(apiErrorMessage(err as never, t("pos.errors.generate_qr", "Could not generate the payment QR.")));
    } finally {
      isGeneratingBakongRef.current = false;
      setIsGeneratingBakong(false);
    }
  };

  const handleCheckBakongPayment = async () => {
    if (!pendingOrder || isCheckingBakongRef.current) return;
    isCheckingBakongRef.current = true;
    try {
      const updated = await confirmBakongPayment(pendingOrder.id).unwrap();
      bakongCheckErrorRef.current = null;
      if (updated.paidAt) {
        setPaymentOpen(false);
        resetCart();
        setCompletedSale(updated);
      }
    } catch (err) {
      const message = apiErrorMessage(err as never, t("pos.errors.check_payment", "Could not check the payment."));
      if (bakongCheckErrorRef.current !== message) toast.error(message);
      bakongCheckErrorRef.current = message;
    } finally {
      isCheckingBakongRef.current = false;
    }
  };

  useEffect(() => {
    if (paymentOpen && paymentMethod === "bakong" && !bakongQr && !isGeneratingBakongRef.current) {
      void handleGenerateBakongQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOpen, paymentMethod, bakongCurrency]);

  useEffect(() => {
    if (paymentMethod !== "bakong" || bakongSecondsLeft === null || bakongSecondsLeft <= 0) return;
    const timer = setTimeout(() => setBakongSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [paymentMethod, bakongSecondsLeft]);

  useEffect(() => {
    if (paymentMethod !== "bakong" || !bakongQr || (bakongSecondsLeft ?? 0) <= 0) return;
    const interval = setInterval(() => { void handleCheckBakongPayment(); }, BAKONG_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, bakongQr, bakongSecondsLeft !== null && bakongSecondsLeft > 0]);

  return (
    <PageShell contentClassName="is_pos_page">
      <PageHeader
        title={t("pos.title", "POS")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("pos.breadcrumb.point_of_sale", "Point of Sale") },
        ]}
        rightSlot={<AdminTopActions />}
      />
      {pendingOrder && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p>
          {t(
            "pos.pending.awaiting_payment",
            "Order #{id} is awaiting payment. Retry payment or clear the order to cancel it.",
            { id: pendingOrder.id.slice(0, 8) }
          )}
        </p>
        <button type="button" onClick={() => setPaymentOpen(true)} className="underline">{t("pos.pending.resume_payment", "Resume payment")}</button>
      </div>}

      <div className="pos_layout">
        <section className="pos_catalog" aria-label={t("pos.catalog.aria_label", "Product catalog")}>
          <div className="pos_catalog_toolbar">
            <div
              className="pos_category_selection"
              role="tablist"
              aria-label={t("pos.catalog.categories_aria_label", "Product categories")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === "All"}
                className={cn(activeCategory === "All" && "is_active")}
                onClick={() => setActiveCategory("All")}
              >
                {t("pos.catalog.all", "All")}
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

            <div className="pos_search">
              <Search aria-hidden />
              <input
                type="search"
                aria-label={t("pos.catalog.search_placeholder", "Search product by name or SKU")}
                placeholder={t("pos.catalog.search_placeholder", "Search product by name or SKU")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                }}
              />
              {search ? (
                <button
                  type="button"
                  className="pos_search_clear"
                  aria-label={t("pos.catalog.clear_search", "Clear search")}
                  onClick={() => setSearch("")}
                >
                  <X aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="pos_product_grid_scroll">
            {products.isLoading ? (
              <div className="pos_product_grid" role="status" aria-label={t("pos.catalog.loading_aria_label", "Loading products")}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="pos_product_card">
                    <div className="pos_product_media">
                      <SkeletonBlock className="h-full w-full rounded-none" />
                    </div>
                    <div className="pos_product_body">
                      <SkeletonBlock className="h-4 w-4/5" />
                      <SkeletonBlock className="h-4 w-2/5" />
                      <SkeletonBlock className="h-3 w-3/5" />
                      <SkeletonBlock className="mt-1 h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.error ? (
              <div className="p-8">
                <ErrorState error={products.error} fallback={t("pos.catalog.load_error", "Could not load products.")} onRetry={refetch} isRetrying={productsQuery.isFetching} />
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="pos_catalog_empty">
                <Search aria-hidden />
                {search.trim() ? (
                  <>
                    <p>{t("pos.catalog.no_match", "No products match “{term}”.", { term: search.trim() })}</p>
                    <button type="button" className="btn_outline_black" onClick={() => setSearch("")}>
                      {t("pos.catalog.clear_search", "Clear search")}
                    </button>
                  </>
                ) : (
                  <p>{t("pos.catalog.empty", "No active products in this category.")}</p>
                )}
              </div>
            ) : (
              <div className="pos_product_grid">
                {visibleProducts.map((product) => (
                  <PosProductCard
                    key={product.id}
                    product={product}
                    counts={cartCounts.get(product.id) ?? EMPTY_CART_COUNTS}
                    onAdd={handleAddProduct}
                    onCustomize={handleCustomizeProduct}
                    onDecrease={handleDecreaseProduct}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside id="pos-order-panel" className="pos_order_panel" aria-label={t("pos.order.aria_label", "Order summary")}>
          <div className="pos_order_header">
            <div>
              <h2>{t("pos.order.title", "Order Summary")}</h2>
            </div>
            <div className="pos_order_header_actions">
              <button type="button" aria-label={t("pos.order.clear_aria_label", "Clear order")} onClick={clearCart}>
                <X />
              </button>
            </div>
          </div>

          <div className="pos_order_selects">
            <div className="form_field pos_order_type">
              <span id="pos-order-type-label" className="form_field_label">
                {t("pos.order.type_label", "Order type")}
              </span>
              <div className="pos_order_type_options" role="radiogroup" aria-labelledby="pos-order-type-label">
                {(["DINE_IN", "TAKE_AWAY"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={orderType === type}
                    disabled={isOrderLocked}
                    onClick={() => chooseOrderType(type)}
                    className="pos_order_type_option"
                  >
                    {type === "DINE_IN" ? <UtensilsCrossed aria-hidden /> : <ShoppingBag aria-hidden />}
                    {orderTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>
            {isDineIn ? (
              <FormSelect
                label={t("pos.order.table_label", "Table")}
                value={tableNumber}
                onChange={(event) => { if (!isOrderLocked && !confirmingRef.current) setTableNumber(event.target.value); }}
                placeholder={t("pos.order.table_placeholder", "No table")}
              >
                {(tables ?? []).map((table) => (
                  <option key={table.id} value={table.tableNumber}>
                    {t("pos.order.table_option", "Table {number}", { number: table.tableNumber })}
                  </option>
                ))}
              </FormSelect>
            ) : null}
          </div>

          <div className="pos_cart_list">
            {cart.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">
                {t("pos.cart.empty", "Cart is empty. Tap a product to add it.")}
              </p>
            ) : (
              cart.map((line) => (
                <article key={line.key} className="pos_cart_item">
                  <Thumbnail src={line.product.imageUrl} kind="product" />
                  <div className="pos_cart_item_content">
                    <h3>{titleCase(line.product.name)}</h3>
                    {lineOptions(line) ? <p className="pos_cart_options">{lineOptions(line)}</p> : null}
                    <div className="pos_cart_price">
                      {line.product.discountActive ? (
                        <span className="is_struck">
                          ${lineUnitOriginal(line).toFixed(2)}
                        </span>
                      ) : null}
                      <strong>${lineUnitPrice(line).toFixed(2)}</strong>
                      <span>{t("pos.cart.each", "each")}</span>
                    </div>
                    <div className="pos_cart_item_bottom">
                      <QuantityControl
                        quantity={line.quantity}
                        variant="cart"
                        onIncrement={() => changeQuantity(line.key, 1)}
                        onDecrement={() => changeQuantity(line.key, -1)}
                      />
                      <strong className="pos_cart_line_total">
                        ${(lineUnitPrice(line) * line.quantity).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                  <div className="pos_cart_item_actions">
                    {hasDrinkOptions(line.product) ? (
                      <button
                        type="button"
                        className="pos_cart_action is_edit"
                        aria-haspopup="dialog"
                        aria-label={t("pos.cart.edit_item", "Change options for {name}", { name: line.product.name })}
                        onClick={() => editLine(line)}
                      >
                        <Pencil />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pos_cart_action is_remove"
                      aria-label={t("pos.cart.remove_item", "Remove {name}", { name: line.product.name })}
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
            <dt>{t("pos.totals.subtotal", "Subtotal:")}</dt>
            <dd>
              ${grossTotal.toFixed(2)} -{" "}
              {itemCount === 1
                ? t("pos.totals.items_one", "{count} Item", { count: itemCount })
                : t("pos.totals.items_other", "{count} Items", { count: itemCount })}
            </dd>
            <dt>{t("pos.totals.total_discount", "Total Discount:")}</dt>
            <dd>${discount.toFixed(2)}</dd>
            <dt className="is_grand_total">{t("pos.totals.grand_total", "Grand Total:")}</dt>
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
              {t("actions.clear", "Clear")}
            </button>
            <button
              type="button"
              className="btn_primary_yellow"
              onClick={() => setPaymentOpen(true)}
              disabled={cart.length === 0 || (!isAdmin && !isBarista)}
            >
              {t("pos.actions.make_payment", "Make a Payment")}
              <span aria-hidden className="pos_cta_arrow">
                →
              </span>
            </button>
          </div>
        </aside>
      </div>

      {/* Phones and iPad portrait: the summary sits below the products, so keep the order one tap away. */}
      {itemCount > 0 ? (
        <button
          type="button"
          className="pos_mobile_order_bar"
          onClick={() => document.getElementById("pos-order-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span className="pos_mobile_order_count">{itemCount}</span>
          <span>{t("pos.actions.view_order", "View order")}</span>
          <b>${total.toFixed(2)}</b>
        </button>
      ) : null}
      {optionsRequest ? (
        <PosOptionsDialog
          key={optionsRequest.id}
          product={optionsRequest.product}
          initial={optionsRequest.initial}
          mode={optionsRequest.editKey ? "edit" : "add"}
          onConfirm={confirmOptions}
          onClose={() => setOptionsRequest(null)}
        />
      ) : null}
      <PosPaymentModal
        open={paymentOpen}
        onOpenChange={(open) => {
          setPaymentOpen(open);
          if (!open) resetBakongState();
        }}
        items={paymentItems}
        total={Number(pendingOrder?.totalAmount ?? total)}
        orderTable={orderTypeSummary}
        orderId={
          pendingOrder
            ? `#${pendingOrder.id.slice(0, 8)}`
            : itemCount === 1
              ? t("pos.order.item_count_one", "{count} item", { count: itemCount })
              : t("pos.order.item_count_other", "{count} items", { count: itemCount })
        }
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
          failure: bakongFailure,
          onRetry: () => { void handleGenerateBakongQr(); },
        }}
      />
      <SaleCompleteModal sale={completedSale} onNewSale={() => setCompletedSale(null)} />
    </PageShell>
  );
}
