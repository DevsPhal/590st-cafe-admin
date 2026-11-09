"use client";
import { OrderFulfillmentDetails } from "@/components/common/OrderFulfillmentDetails";
import { OrderEstimateEditor } from "@/components/common/OrderEstimateEditor";

import { useCallback, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  Banknote,
  Bike,
  CheckCheck,
  ChefHat,
  ClipboardList,
  Loader2,
  MessageSquareText,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  DetailGrid,
  DetailItem,
  DetailModal,
  ErrorState,
  FormInput,
  FormModal,
  FormSelect,
  ModalGrid,
  PaginationFooter,
  SkeletonBlock,
  StatTile,
  listLoadState,
  MoneyField,
} from "@/components/common/AdminKit";
import { apiErrorMessage, baseApi } from "@/store/api/baseApi";
import {
  useCancelBaristaOrderMutation,
  useCompleteBaristaOrderMutation,
  useDispatchBaristaOrderMutation,
  useMarkDeliveredBaristaOrderMutation,
  useCollectBaristaCashMutation,
  useGetBaristaOrderQuery,
  useGetBaristaOrderStatusSummaryQuery,
  useListAllBaristaOrdersQuery,
  usePayOrderCashMutation,
  useSetBaristaOrderDeliveryFeeMutation,
  useSetBaristaOrderEstimatedTimeMutation,
  useStartPreparingBaristaOrderMutation,
} from "@/store/api/baristaOrderApi";
import {
  useCancelOrderMutation,
  useCollectCashMutation,
  useCompleteOrderMutation,
  useDispatchAdminOrderMutation,
  useMarkDeliveredAdminOrderMutation,
  useGetOrderQuery,
  useGetOrderStatusSummaryQuery,
  useListOrdersQuery,
  usePayAdminOrderCashMutation,
  useSetOrderDeliveryFeeMutation,
  useSetOrderEstimatedTimeMutation,
  useStartPreparingOrderMutation,
} from "@/store/api/orderApi";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { useGetCurrentUserQuery } from "@/store/api/authApi";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { useAppDispatch } from "@/store/hooks";
import type {
  Currency,
  OrderResponse,
  OrderSearchParams,
  OrderStatus,
  PageResponse,
  SortDirection,
} from "@/store/api/types";
import { cn, formatByCurrency, titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import { enumLabel } from "@/lib/enumLabel";
import { shopDate } from "@/lib/shopDate";
import { InvoiceActions, toastPaidWithInvoice } from "@/components/common/InvoiceActions";
import { orderCode, useOrderInvoice } from "@/hooks/useOrderInvoice";
import { buildCashPaymentSchema } from "@/lib/validation";
import { amountDue, changeDue, rielTotalLabel } from "@/lib/khr";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useNow } from "@/hooks/useNow";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useI18n } from "@/contexts/I18nContext";
import { optionSummary } from "@/lib/drinkOptions";
import {
  DEFAULT_QUEUE_PAGE_SIZE,
  EMPTY_FILTERS,
  HISTORY_TABS,
  QUEUE_PAGE_SIZES,
  QUEUE_TABS,
  TAB_STATUSES,
  formatShopDateTime,
  hasActiveFilters,
  money,
  readFilters,
  readTab,
  statusTotals,
  toSearchParams,
  type QueueFilters,
  type QueueTab,
} from "../queue";
import { QueueStatusTabs } from "./QueueStatusTabs";
import { QueueFilterBar } from "./QueueFilterBar";
import { QueueOrderCard, QueueStatusBadge, type CardAction } from "./QueueOrderCard";
import { useFormErrors } from "@/hooks/useFormErrors";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { Card } from "@/components/common/Card";

type Roles = { isAdmin: boolean; isBarista: boolean };

type QueueListArgs = OrderSearchParams & {
  status?: OrderStatus[];
  direction: SortDirection;
  page: number;
  size: number;
};

const LIVE_POLL_MS = 15_000;
const HISTORY_POLL_MS = 30_000;
const CLOCK_TICK_MS = 30_000;
// Cards keep their own height rather than stretching to the tallest one in the row.
const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-4";

// Each staff role reads orders through its own endpoints; the other role's query stays skipped.
function useQueueOrders(args: QueueListArgs, { isAdmin, isBarista }: Roles, pollingInterval: number) {
  const admin = useListOrdersQuery(args, { skip: !isAdmin, pollingInterval });
  const barista = useListAllBaristaOrdersQuery(args, { skip: !isBarista, pollingInterval });
  return isAdmin ? admin : barista;
}

function useStatusSummary(args: OrderSearchParams | undefined, { isAdmin, isBarista }: Roles) {
  const admin = useGetOrderStatusSummaryQuery(args, { skip: !isAdmin, pollingInterval: LIVE_POLL_MS });
  const barista = useGetBaristaOrderStatusSummaryQuery(args, { skip: !isBarista, pollingInterval: LIVE_POLL_MS });
  return isAdmin ? admin : barista;
}

function useOrderDetail(id: string | null, skip: boolean, { isAdmin, isBarista }: Roles) {
  const admin = useGetOrderQuery(id ?? "", { skip: skip || !id || !isAdmin });
  const barista = useGetBaristaOrderQuery(id ?? "", { skip: skip || !id || !isBarista });
  return (isAdmin ? admin : barista).currentData;
}

function QueueSkeleton({ cards }: { cards: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("states.loading_label", "Loading")} className={CARD_GRID}>
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="space-y-3 rounded-xl border border-l-4 border-gray-200 border-l-gray-200 bg-white p-3.5"
        >
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="h-3 w-2/3" />
          <div className="flex gap-1.5">
            <SkeletonBlock className="h-4 w-14" />
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 w-20" />
          </div>
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-5/6" />
          <SkeletonBlock className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function QueueEmpty({ title, hint, onClear }: { title: string; hint?: string; onClear?: () => void }) {
  const { t } = useI18n();
  return (
    <Card padded={false} className="border-dashed">
      <EmptyState
        icon={onClear ? SearchX : ClipboardList}
        title={title}
        description={hint}
        action={
          onClear ? (
            <Button onClick={onClear} variant="outline">
              {t("barista.filters.clear", "Clear filters")}
            </Button>
          ) : undefined
        }
      />
    </Card>
  );
}

export default function BaristaQueueView() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const { isAdmin, isBarista, isLoading: isLoadingRole } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  const roles = { isAdmin, isBarista };
  const now = useNow(CLOCK_TICK_MS);
  const resultsTopRef = useRef<HTMLDivElement>(null);

  // The tab, filters and page survive refreshes, polling and visits to other pages in this session.
  const [storedTab, setTab] = usePersistentState<QueueTab>("barista-queue:tab", "ALL");
  const [storedFilters, setFilters] = usePersistentState<QueueFilters>("barista-queue:filters", EMPTY_FILTERS);
  const [storedDirection, setDirection] = usePersistentState<SortDirection>("barista-queue:direction", "DESC");
  const [page, setPage] = usePersistentState("barista-queue:page", 1);
  const [storedSize, setSize] = usePersistentState("barista-queue:size", DEFAULT_QUEUE_PAGE_SIZE);
  const tab = readTab(storedTab);
  const filters = useMemo(() => readFilters(storedFilters), [storedFilters]);
  const direction: SortDirection = storedDirection === "ASC" ? "ASC" : "DESC";
  const size = (QUEUE_PAGE_SIZES as readonly number[]).includes(storedSize) ? storedSize : DEFAULT_QUEUE_PAGE_SIZE;
  const filtering = hasActiveFilters(filters);
  const searchParams = useMemo(() => toSearchParams(filters), [filters]);

  const listQuery = useQueueOrders(
    { ...searchParams, status: TAB_STATUSES[tab], direction, page, size },
    roles,
    HISTORY_TABS.has(tab) ? HISTORY_POLL_MS : LIVE_POLL_MS
  );
  // Stat tiles describe the whole shop right now; tab counts follow the filters. With no filters both
  // use the same arguments, so they share one request.
  const overallSummary = useStatusSummary(undefined, roles);
  const filteredSummary = useStatusSummary(filtering ? searchParams : undefined, roles);

  // The order events invalidate every order query, which refetches the list and both summaries.
  useStaffOrderAlerts(useCallback(() => {}, []));

  const [baristaPayCash, { isLoading: isPayingBarista }] = usePayOrderCashMutation();
  const [baristaCollectCash, { isLoading: isCollectingBarista }] = useCollectBaristaCashMutation();
  const [adminPayCash, { isLoading: isPayingAdmin }] = usePayAdminOrderCashMutation();
  const [adminCollectCash, { isLoading: isCollectingAdmin }] = useCollectCashMutation();
  const [baristaCancel, { isLoading: isCancellingBarista }] =
    useCancelBaristaOrderMutation();
  const [adminCancel, { isLoading: isCancellingAdmin }] = useCancelOrderMutation();
  const [baristaStartPreparing, { isLoading: isStartingBarista }] =
    useStartPreparingBaristaOrderMutation();
  const [adminStartPreparing, { isLoading: isStartingAdmin }] =
    useStartPreparingOrderMutation();
  const [baristaComplete, { isLoading: isCompletingBarista }] =
    useCompleteBaristaOrderMutation();
  const [adminComplete, { isLoading: isCompletingAdmin }] = useCompleteOrderMutation();
  const [baristaDispatch, { isLoading: isDispatchingBarista }] =
    useDispatchBaristaOrderMutation();
  const [adminDispatch, { isLoading: isDispatchingAdmin }] = useDispatchAdminOrderMutation();
  const [baristaDeliver, { isLoading: isDeliveringBarista }] =
    useMarkDeliveredBaristaOrderMutation();
  const [adminDeliver, { isLoading: isDeliveringAdmin }] = useMarkDeliveredAdminOrderMutation();
  const [baristaSetDeliveryFee, { isLoading: isSettingFeeBarista }] =
    useSetBaristaOrderDeliveryFeeMutation();
  const [adminSetDeliveryFee, { isLoading: isSettingFeeAdmin }] = useSetOrderDeliveryFeeMutation();
  const [baristaSetEstimate, { isLoading: isSettingEstimateBarista }] =
    useSetBaristaOrderEstimatedTimeMutation();
  const [adminSetEstimate, { isLoading: isSettingEstimateAdmin }] = useSetOrderEstimatedTimeMutation();
  const { printInvoice } = useOrderInvoice();

  const { data: currentUser } = useGetCurrentUserQuery();
  const cashMutationFor = (order: OrderResponse) =>
    order.paymentMethod === "CASH"
      ? isAdmin ? adminCollectCash : baristaCollectCash
      : isAdmin ? adminPayCash : baristaPayCash;
  const canCancel = (order: OrderResponse) =>
    isAdmin || (order.customerId == null && order.handledById === currentUser?.id);

  const awaitingPaymentStep = (
    order: OrderResponse
  ):
    | { kind: "fee" | "prepare" | "cash"; label: string }
    | { kind: "waiting"; hint: string } => {
    if (order.fulfillmentMethod === "DELIVERY" && order.deliveryFeeSetAt == null) {
      return { kind: "fee", label: t("barista.actions.set_delivery_fee", "Set Delivery Fee") };
    }
    if (order.paymentMethod === "BAKONG") {
      return {
        kind: "waiting",
        hint: t("barista.hints.waiting_qr", "Waiting for the customer's QR payment — it confirms automatically."),
      };
    }
    if (order.paymentMethod === "CASH") {
      return order.customerId != null
        ? { kind: "prepare", label: t("barista.actions.start_preparing", "Start Preparing") }
        : { kind: "cash", label: t("barista.actions.take_cash", "Take Cash") };
    }
    if (order.customerId == null && order.handledById === currentUser?.id) {
      return { kind: "cash", label: t("barista.actions.take_cash", "Take Cash") };
    }
    return { kind: "waiting", hint: t("barista.hints.waiting_method", "Waiting for the customer to choose how to pay.") };
  };
  const cancelOrder = isAdmin ? adminCancel : baristaCancel;
  const startPreparing = isAdmin ? adminStartPreparing : baristaStartPreparing;
  const completeOrder = isAdmin ? adminComplete : baristaComplete;
  const dispatchOrder = isAdmin ? adminDispatch : baristaDispatch;
  const deliverOrder = isAdmin ? adminDeliver : baristaDeliver;
  const setDeliveryFee = isAdmin ? adminSetDeliveryFee : baristaSetDeliveryFee;
  const isSettingFee = isSettingFeeAdmin || isSettingFeeBarista;
  const setEstimate = isAdmin ? adminSetEstimate : baristaSetEstimate;
  const isSettingEstimate = isSettingEstimateAdmin || isSettingEstimateBarista;

  const isPaying = isPayingAdmin || isPayingBarista || isCollectingAdmin || isCollectingBarista;
  const isBusy =
    isPaying ||
    isCancellingAdmin ||
    isCancellingBarista ||
    isStartingAdmin ||
    isStartingBarista ||
    isCompletingAdmin ||
    isCompletingBarista ||
    isDispatchingAdmin ||
    isDispatchingBarista ||
    isDeliveringAdmin ||
    isDeliveringBarista ||
    isSettingFee;

  const { exchangeRate } = useExchangeRate();
  const khrPerUsdRate = exchangeRate ? Number(exchangeRate.khrPerUsdRate) : null;

  const [cashOrder, setCashOrder] = useState<OrderResponse | null>(null);
  const [amountTendered, setAmountTendered] = useState("");
  const [cashCurrency, setCashCurrency] = useState<Currency>("USD");

  // While another page of the same list loads, the current cards stay on screen (dimmed) instead of
  // collapsing to skeletons, so the list doesn't jump. A new tab or filter still starts from skeletons.
  const listKey = JSON.stringify([tab, searchParams, direction, size]);
  const [shownPage, setShownPage] = useState<{ key: string; data: PageResponse<OrderResponse> } | null>(null);
  if (listQuery.currentData && shownPage?.data !== listQuery.currentData) {
    setShownPage({ key: listKey, data: listQuery.currentData });
  }
  const pageData = listQuery.currentData ?? (shownPage?.key === listKey ? shownPage.data : undefined);
  const isChangingPage = listQuery.currentData === undefined && pageData !== undefined;
  const orders = useMemo(() => pageData?.content ?? [], [pageData]);
  const list = listLoadState({ ...listQuery, currentData: pageData });

  // The detail dialog shows the order as listed, so it updates with each refresh. If the order moves to
  // another tab while the dialog is open, it is fetched by id instead.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<OrderResponse | null>(null);
  const listedDetail = detailId ? orders.find((order) => order.id === detailId) : undefined;
  const fetchedDetail = useOrderDetail(detailId, listedDetail != null, roles);
  const detailOrder = listedDetail ?? fetchedDetail ?? detailSnapshot;
  const openDetail = (order: OrderResponse) => {
    setDetailId(order.id);
    setDetailSnapshot(order);
  };

  // A page can empty out when its orders move on (or a filter narrows the list); step back to the last page.
  const totalPages = pageData?.totalPages ?? 0;
  if (totalPages > 0 && page > totalPages) {
    setPage(totalPages);
  }

  // In riel the amount due is the total rounded to the nearest 100, the figure the API charges (lib/khr).
  const payableDue = (order: OrderResponse, targetCurrency: Currency): number =>
    amountDue(Number(order.totalAmount), targetCurrency, khrPerUsdRate);

  const exactAmountFor = (order: OrderResponse, targetCurrency: Currency): string => {
    const due = payableDue(order, targetCurrency);
    return targetCurrency === "KHR" ? String(due) : due.toFixed(2);
  };

  const openCashModal = (order: OrderResponse) => {
    setCashOrder(order);
    cashValidation.reset();
    setCashCurrency("USD");
    setAmountTendered(exactAmountFor(order, "USD"));
  };

  const handleCashCurrencyChange = (next: Currency) => {
    setCashCurrency(next);
    if (cashOrder) setAmountTendered(exactAmountFor(cashOrder, next));
  };

  const cashDue = cashOrder ? payableDue(cashOrder, cashCurrency) : 0;
  const cashValidation = useFormErrors(buildCashPaymentSchema(cashDue), { currency: cashCurrency, amountTendered });

  const overallTotals = overallSummary.data ? statusTotals(overallSummary.data) : undefined;
  const awaitingCount = overallTotals?.count(["PENDING"]);
  const toMake = overallTotals?.count(["PAID", "PREPARING"]);
  const unpaidValue = overallTotals?.amount("PENDING");
  const tabCounts = useMemo(() => {
    if (!filteredSummary.data) return undefined;
    const totals = statusTotals(filteredSummary.data);
    return Object.fromEntries(QUEUE_TABS.map((queueTab) => [queueTab, totals.count(TAB_STATUSES[queueTab])])) as Record<
      QueueTab,
      number
    >;
  }, [filteredSummary.data]);

  const selectTab = (next: string) => {
    setTab(readTab(next));
    setPage(1);
  };
  const updateFilters = useCallback(
    (next: QueueFilters) => {
      setFilters(next);
      setPage(1);
    },
    [setFilters, setPage]
  );
  const changeDirection = (next: SortDirection) => {
    setDirection(next);
    setPage(1);
  };
  const changePage = (next: number) => {
    setPage(next);
    resultsTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const refreshQueue = () => {
    dispatch(baseApi.util.invalidateTags([{ type: "Order", id: isAdmin ? "LIST" : "BARISTA_ALL" }]));
  };

  const handlePayCash = async () => {
    if (!cashOrder) return;
    const parsed = cashValidation.validate();
    if (!parsed) return;
    try {
      const updated = await cashMutationFor(cashOrder)({
        id: cashOrder.id,
        body: parsed,
      }).unwrap();
      toastPaidWithInvoice(
        Number(updated.changeDue) > 0
          ? t("barista.toast.paid_change", "Paid. Change: {change}", {
              change: formatByCurrency(updated.changeDue, updated.changeCurrency ?? cashCurrency),
            })
          : t("barista.toast.payment_recorded", "Payment recorded"),
        updated.id,
        printInvoice
      );
      setCashOrder(null);
    } catch (err) {
      cashValidation.showServerError(err, t("barista.errors.record_payment", "Could not record the payment."));
    }
  };

  const handleCancel = async (order: OrderResponse) => {
    const confirmed = await confirm({
      title: t("barista.confirm.cancel_title", "Cancel order"),
      description: t(
        "barista.confirm.cancel_description",
        "Cancel order #{id}? Only unpaid orders can be cancelled.",
        { id: orderCode(order.id) }
      ),
      confirmLabel: t("barista.confirm.cancel_confirm", "Cancel order"),
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await cancelOrder(order.id).unwrap();
      toast.success(t("barista.toast.order_cancelled", "Order cancelled"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("barista.errors.cancel_order", "Could not cancel the order.")));
    }
  };

  const handleStartPreparing = async (order: OrderResponse) => {
    try {
      await startPreparing(order.id).unwrap();
      toast.success(t("barista.toast.started_preparing", "Started preparing — the customer can see this"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("barista.errors.start_order", "Could not start this order.")));
    }
  };

  const handleComplete = async (order: OrderResponse) => {
    const isDelivery = order.fulfillmentMethod === "DELIVERY";
    try {
      if (isDelivery) {
        await dispatchOrder(order.id).unwrap();
        toast.success(t("barista.toast.out_for_delivery", "Out for delivery — the customer can see this"));
      } else {
        await completeOrder(order.id).unwrap();
        toast.success(t("barista.toast.order_completed", "Order completed"));
      }
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err as never,
          isDelivery
            ? t("barista.errors.dispatch_order", "Could not dispatch the order.")
            : t("barista.errors.complete_order", "Could not complete the order.")
        )
      );
    }
  };

  const handleDelivered = async (order: OrderResponse) => {
    try {
      await deliverOrder(order.id).unwrap();
      toast.success(t("barista.toast.marked_delivered", "Marked as delivered"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("barista.errors.mark_delivered", "Could not mark the order delivered.")));
    }
  };

  const handleSetDeliveryFee = async (order: OrderResponse, fee: number) => {
    try {
      await setDeliveryFee({ id: order.id, body: { fee } }).unwrap();
      toast.success(t("barista.toast.delivery_fee_saved", "Delivery fee saved"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("barista.errors.save_delivery_fee", "Could not save the delivery fee.")));
    }
  };

  const handleSetEstimate = async (order: OrderResponse, minutes: number) => {
    try {
      const updated = await setEstimate({ id: order.id, body: { minutes } }).unwrap();
      setDetailSnapshot((current) => (current?.id === updated.id ? updated : current));
      toast.success(t("barista.toast.estimate_set", "Estimated time set to {minutes} min", { minutes }));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("barista.errors.save_estimate", "Could not save the estimated time.")));
    }
  };

  // The next step for an order at its current status — the same buttons the status columns used to offer.
  const cardActions = (
    order: OrderResponse
  ): { primary?: CardAction; secondary?: CardAction; hint?: string; onCancel?: () => void } => {
    switch (order.status) {
      case "PENDING": {
        const step = awaitingPaymentStep(order);
        const onCancel = canCancel(order) ? () => handleCancel(order) : undefined;
        if (step.kind === "waiting") return { hint: step.hint, onCancel };
        return {
          primary: {
            label: step.label,
            icon: step.kind === "fee" ? Bike : step.kind === "prepare" ? ChefHat : Banknote,
            onClick: () => {
              if (step.kind === "fee") openDetail(order);
              else if (step.kind === "prepare") void handleStartPreparing(order);
              else openCashModal(order);
            },
          },
          secondary:
            step.kind === "prepare"
              ? { label: t("barista.actions.take_cash", "Take Cash"), onClick: () => openCashModal(order) }
              : undefined,
          onCancel,
        };
      }
      case "PAID":
        return {
          primary: {
            label: t("barista.actions.start_preparing", "Start Preparing"),
            icon: ChefHat,
            onClick: () => void handleStartPreparing(order),
          },
        };
      case "PREPARING": {
        const needsCash =
          order.paymentMethod === "CASH" && order.paidAt == null && order.fulfillmentMethod !== "DELIVERY";
        if (needsCash) {
          return {
            primary: {
              label: t("barista.actions.collect_cash", "Collect Cash"),
              icon: Banknote,
              onClick: () => openCashModal(order),
            },
          };
        }
        return {
          primary:
            order.fulfillmentMethod === "DELIVERY"
              ? {
                  label: t("barista.actions.out_for_delivery", "Out for Delivery"),
                  icon: Bike,
                  onClick: () => void handleComplete(order),
                }
              : {
                  label: t("barista.actions.mark_completed", "Mark Completed"),
                  icon: CheckCheck,
                  onClick: () => void handleComplete(order),
                },
        };
      }
      case "OUT_FOR_DELIVERY": {
        const needsCash = order.paymentMethod === "CASH" && order.paidAt == null;
        return {
          primary: needsCash
            ? {
                label: t("barista.actions.collect_cash", "Collect Cash"),
                icon: Banknote,
                onClick: () => openCashModal(order),
              }
            : {
                label: t("barista.actions.mark_delivered", "Mark Delivered"),
                icon: CheckCheck,
                onClick: () => void handleDelivered(order),
              },
        };
      }
      default:
        return {};
    }
  };

  const emptyTitle: Record<QueueTab, string> = {
    ALL: t("barista.empty.all", "No orders yet."),
    AWAITING_PAYMENT: t("barista.empty.awaiting_payment", "Nothing waiting to be paid."),
    NEW_PAID: t("barista.empty.new_paid", "No new paid orders."),
    PREPARING: t("barista.empty.preparing", "Nothing on the bar."),
    OUT_FOR_DELIVERY: t("barista.empty.out_for_delivery", "Nothing out for delivery."),
    COMPLETED: t("barista.empty.completed", "No completed orders yet."),
    CANCELLED: t("barista.empty.cancelled", "No cancelled orders."),
  };

  const total = pageData?.totalElements ?? 0;
  const firstShown = pageData && total > 0 ? (pageData.page - 1) * pageData.size + 1 : 0;
  const lastShown = pageData ? firstShown + pageData.content.length - 1 : 0;
  const updatedAt = listQuery.fulfilledTimeStamp
    ? formatLocalDate(new Date(listQuery.fulfilledTimeStamp), { hour: "2-digit", minute: "2-digit" })
    : null;

  let results;
  if (isLoadingRole || list.isLoading) {
    results = <QueueSkeleton cards={Math.min(size, 8)} />;
  } else if (list.error) {
    results = (
      <ErrorState
        error={list.error}
        fallback={t("barista.errors.load_queue", "Could not load the queue.")}
        onRetry={listQuery.refetch}
        isRetrying={listQuery.isFetching}
      />
    );
  } else if (orders.length === 0) {
    results = filtering ? (
      <QueueEmpty
        title={t("barista.empty.filtered", "No orders match these filters.")}
        hint={t("barista.empty.filtered_hint", "Try another search, date range or order type.")}
        onClear={() => updateFilters(EMPTY_FILTERS)}
      />
    ) : (
      <QueueEmpty title={emptyTitle[tab]} />
    );
  } else {
    results = (
      <div
        className={cn(CARD_GRID, "transition-opacity", isChangingPage && "pointer-events-none opacity-60")}
        aria-busy={isChangingPage || undefined}
      >
        {orders.map((order) => {
          const actions = cardActions(order);
          return (
            <QueueOrderCard
              key={order.id}
              order={order}
              now={now}
              primary={actions.primary}
              secondary={actions.secondary}
              hint={actions.hint}
              onCancel={actions.onCancel}
              onOpen={() => openDetail(order)}
              isBusy={isBusy}
            />
          );
        })}
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t("barista.title", "Order Queue")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("barista.breadcrumb.queue", "Barista Queue") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title={t("barista.stats.awaiting_payment", "Awaiting Payment")}
          value={awaitingCount == null ? "–" : String(awaitingCount)}
          tone={awaitingCount ? "orange" : "gray"}
        />
        <StatTile
          title={t("barista.stats.drinks_to_make", "Drinks To Make")}
          value={toMake == null ? "–" : String(toMake)}
          tone={toMake ? "yellow" : "gray"}
        />
        <StatTile
          title={t("barista.stats.unpaid_value", "Unpaid Value")}
          value={unpaidValue == null ? "–" : money(unpaidValue)}
          tone="gray"
        />
      </div>

      {!isLoadingRole && !isAdmin && !isBarista ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {t("barista.errors.role_cannot_read", "Your account role cannot read orders. Sign in as an admin or a barista.")}
        </div>
      ) : null}

      <TabsPrimitive.Root
        // Page changes scroll back to here; the toolbar itself can't be the target, as a stuck sticky
        // element already counts as in view.
        ref={resultsTopRef}
        value={tab}
        onValueChange={selectTab}
        // Arrow keys move between tabs and Enter opens one, so browsing the tabs doesn't load each of them.
        activationMode="manual"
        className="flex flex-col gap-4"
      >
        {/* Pinned while scrolling on tablets and desktops, but not on short screens (a phone held
            sideways), where it would cover most of the cards. */}
        <div className="z-20 flex flex-col gap-3 rounded-(--radius-card) border border-(--line-subtle) bg-(--surface) p-3 shadow-xs sm:p-4 md:[@media(min-height:600px)]:sticky md:[@media(min-height:600px)]:top-0">
          <QueueStatusTabs value={tab} counts={tabCounts} />
          <div className="border-t border-(--line-subtle) pt-3">
            <QueueFilterBar
              filters={filters}
              onChange={updateFilters}
              direction={direction}
              onDirectionChange={changeDirection}
              today={shopDate(new Date(now))}
            />
          </div>
        </div>

        <TabsPrimitive.Content value={tab} className="flex flex-col gap-3 outline-none">
          <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
            <p>
              {total > 0
                ? t("barista.results.showing", "Showing {from}–{to} of {total} orders", {
                    from: firstShown,
                    to: lastShown,
                    total,
                  })
                : null}
            </p>
            <div className="flex items-center gap-2">
              {updatedAt ? <span>{t("barista.results.updated", "Updated {time}", { time: updatedAt })}</span> : null}
              <button
                type="button"
                onClick={refreshQueue}
                disabled={isLoadingRole || (!isAdmin && !isBarista) || listQuery.isFetching}
                aria-label={t("barista.results.refresh", "Refresh the queue")}
                title={t("barista.results.refresh", "Refresh the queue")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full pointer-coarse:size-11 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-60"
              >
                {listQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {results}

          {total > 0 ? (
            <PaginationFooter
              page={pageData?.page ?? page}
              totalPages={totalPages || 1}
              size={size}
              totalElements={total}
              sizeOptions={QUEUE_PAGE_SIZES}
              onPageChange={changePage}
              onSizeChange={(next) => {
                setSize(next);
                setPage(1);
              }}
            />
          ) : null}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>

      <FormModal
        open={cashOrder !== null}
        onOpenChange={(open) => {
          if (!open) setCashOrder(null);
        }}
        title={t("barista.cash.title", "Take Cash Payment")}
        submitLabel={t("actions.confirm", "Confirm")}
        onSubmit={handlePayCash}
        isLoading={isPaying}
      >
        <ModalGrid>
          <FormInput
            label={t("barista.cash.total_due", "Total Due")}
            value={cashOrder ? formatByCurrency(cashDue, cashCurrency) : ""}
            readOnly
          />
          <FormSelect
            label={t("barista.cash.currency", "Currency")}
            value={cashCurrency}
            onChange={(e) => handleCashCurrencyChange(e.target.value as Currency)}
          >
            <option value="USD">USD</option>
            <option value="KHR" disabled={!khrPerUsdRate}>
              KHR{!khrPerUsdRate ? ` ${t("barista.cash.rate_unavailable", "(rate unavailable)")}` : ""}
            </option>
          </FormSelect>
          <MoneyField
            label={t("barista.cash.amount_tendered", "Amount Tendered")}
            currency={cashCurrency}
            value={amountTendered}
            error={cashValidation.errors.amountTendered}
            onValueChange={setAmountTendered}
            required
          />
          <FormInput
            label={t("barista.cash.change_due", "Change Due")}
            value={
              cashOrder && Number(amountTendered) >= cashDue
                ? formatByCurrency(changeDue(Number(amountTendered), cashDue, cashCurrency), cashCurrency)
                : "-"
            }
            readOnly
          />
        </ModalGrid>
      </FormModal>

      <DetailModal
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDetailSnapshot(null);
          }
        }}
        title={t("barista.detail.title", "Order Detail")}
      >
        {detailOrder && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label={t("fields.order", "Order")}>
                <span className="font-mono">#{orderCode(detailOrder.id)}</span>
              </DetailItem>
              <DetailItem label={t("fields.status", "Status")}>
                <QueueStatusBadge status={detailOrder.status} />
              </DetailItem>
              <DetailItem label={t("fields.customer", "Customer")}>
                {detailOrder.customerName ? titleCase(detailOrder.customerName) : t("barista.labels.walk_in", "Walk-in")}
              </DetailItem>
              <DetailItem label={t("barista.detail.placed", "Placed")}>
                {formatShopDateTime(detailOrder.createdAt)}
              </DetailItem>
              <DetailItem label={t("fields.payment_method", "Payment Method")}>
                {detailOrder.paymentMethod
                  ? enumLabel(t, "payment_method", detailOrder.paymentMethod)
                  : t("barista.detail.not_chosen_yet", "Not chosen yet")}
              </DetailItem>
              <DetailItem label={t("barista.detail.paid_at", "Paid At")}>
                {detailOrder.paidAt ? formatShopDateTime(detailOrder.paidAt) : t("barista.detail.not_paid_yet", "Not paid yet")}
              </DetailItem>
              <DetailItem label={t("barista.detail.handled_by", "Handled By")}>
                {detailOrder.handledByName
                  ? `${titleCase(detailOrder.handledByName)}${
                      detailOrder.handledByRole ? ` (${enumLabel(t, "role", detailOrder.handledByRole)})` : ""
                    }`
                  : "-"}
              </DetailItem>
              <DetailItem label={t("fields.total", "Total")}>{money(detailOrder.totalAmount)}</DetailItem>
              {rielTotalLabel(detailOrder) ? (
                <DetailItem label={t("barista.detail.total_khr", "Total in KHR")}>{rielTotalLabel(detailOrder)}</DetailItem>
              ) : null}
              {detailOrder.paymentMethod === "CASH" ? (
                <>
                  <DetailItem label={t("barista.cash.amount_tendered", "Amount Tendered")}>
                    {formatByCurrency(detailOrder.amountTendered, detailOrder.amountTenderedCurrency)}
                  </DetailItem>
                  <DetailItem label={t("barista.detail.change_given", "Change Given")}>
                    {formatByCurrency(detailOrder.changeDue, detailOrder.changeCurrency)}
                  </DetailItem>
                </>
              ) : null}
              {detailOrder.paymentMethod === "BAKONG" ? (
                <DetailItem label={t("barista.detail.bakong_amount", "Bakong Amount")}>
                  {detailOrder.bakongAmount == null
                    ? "-"
                    : `${Number(detailOrder.bakongAmount).toLocaleString()} ${
                        detailOrder.bakongCurrency ?? ""
                      }`}
                </DetailItem>
              ) : null}
            </DetailGrid>

            <InvoiceActions order={detailOrder} className="mt-4" />

            <OrderFulfillmentDetails
              key={detailOrder.id}
              order={detailOrder}
              onSetDeliveryFee={(fee) => handleSetDeliveryFee(detailOrder, fee)}
              isSettingFee={isSettingFee}
            />
            <OrderEstimateEditor
              order={detailOrder}
              onSave={(minutes) => handleSetEstimate(detailOrder, minutes)}
              isSaving={isSettingEstimate}
            />
            {detailOrder.note ? (
              <div className="mt-6 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-900">
                    {t("barista.detail.note_from_customer", "Note from customer")}
                  </p>
                  <p className="mt-0.5 text-sm whitespace-pre-line wrap-break-word text-amber-900">
                    {detailOrder.note}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-6">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <ChefHat className="h-4 w-4 text-gray-400" />
                {t("barista.detail.items", "Items ({count})", { count: detailOrder.items.length })}
              </h4>
              <div className="space-y-3">
                {detailOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 border-b border-dashed border-gray-200 pb-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {item.quantity}x {titleCase(item.productName)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {optionSummary({
                          variantName: item.variantName,
                          sugarLevel: item.sugarLevel,
                          iceLevel: item.iceLevel,
                          milkType: item.milkType,
                          extras: item.extras.map((extra) => ({ name: titleCase(extra.name) })),
                        }) || t("barista.labels.standard", "Standard")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {money(item.subtotal)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t("barista.detail.unit_price_each", "{price} each", { price: money(item.unitPrice) })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
