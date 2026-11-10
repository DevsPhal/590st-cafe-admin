"use client";
import { cancelBlockedMessage, cancellationLabel, useCancelOrderDialog } from "@/features/order/components/useCancelOrderDialog";
import { cancelPolicy } from "@/lib/orderCancel";
import { OrderFulfillmentDetails } from "@/components/common/OrderFulfillmentDetails";
import { rielTotalLabel } from "@/lib/khr";
import { OrderEstimateEditor } from "@/components/common/OrderEstimateEditor";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  DetailGrid,
  DetailItem,
  DetailModal,
  FilterActions,
  FilterPanel,
  PaginationFooter,
  Row,
  RowActions,
  SelectField,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableState,
  listLoadState,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize, useRefreshOptions } from "@/contexts/AdminPreferencesContext";
import {
  useCancelOrderMutation,
  useCompleteOrderMutation,
  useDispatchAdminOrderMutation,
  useGetOrderHistoryQuery,
  useGetOrderQuery,
  useListOrdersQuery,
  useMarkDeliveredAdminOrderMutation,
  useSetOrderDeliveryFeeMutation,
  useSetOrderEstimatedTimeMutation,
  useStartPreparingOrderMutation,
} from "@/store/api/orderApi";
import type { OrderResponse, OrderStatus } from "@/store/api/types";
import { formatByCurrency, fulfillmentLabel, titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import { enumLabel } from "@/lib/enumLabel";
import { InvoiceActions } from "@/components/common/InvoiceActions";
import { useOrderInvoice } from "@/hooks/useOrderInvoice";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useI18n } from "@/contexts/I18nContext";
import { optionSummary } from "@/lib/drinkOptions";
import { Button } from "@/components/common/Button";

type Translate = ReturnType<typeof useI18n>["t"];

const money = (value: number | null | undefined) =>
  value == null ? "-" : `$${Number(value).toFixed(2)}`;

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalDate(parsed, { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatLocalDate(parsed, { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalDate(parsed, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: OrderStatus): "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED" || status === "DELIVERED") return "success";
  if (status === "PAID" || status === "PREPARING" || status === "OUT_FOR_DELIVERY") return "info";
  if (status === "PENDING") return "warning";
  return "danger";
}

function summariseItems(order: OrderResponse): string {
  if (order.items.length === 0) return "-";
  return order.items
    .map((item) => `x${item.quantity} ${titleCase(item.productName)}`)
    .join(", ");
}

type NextStep =
  | { kind: "action"; label: string; hint: string }
  | { kind: "blocked"; message: string }
  | null;

function describeNextStep(order: OrderResponse, t: Translate): NextStep {
  if (order.status === "PENDING" || order.status === "PAID") {
    if (order.fulfillmentMethod === "DELIVERY" && order.deliveryFeeSetAt == null) {
      return { kind: "blocked", message: t("orders.progress.waiting_delivery_fee", "Waiting for the delivery fee to be set before this can start.") };
    }
    if (order.status === "PENDING" && order.paymentMethod === "BAKONG") {
      return { kind: "blocked", message: t("orders.progress.waiting_qr_payment", "Waiting for the customer's QR payment — it confirms automatically, then this can start.") };
    }
    if (order.status === "PENDING" && !order.paymentMethod) {
      return { kind: "blocked", message: t("orders.progress.waiting_payment_choice", "Waiting for the customer to choose how to pay.") };
    }
    return { kind: "action", label: t("orders.progress.start_preparing", "Start Preparing"), hint: t("orders.progress.start_preparing_hint", "Send this order to the kitchen queue.") };
  }
  if (order.status === "PREPARING") {
    if (
      order.fulfillmentMethod !== "DELIVERY" &&
      order.paymentMethod === "CASH" &&
      order.paidAt == null
    ) {
      return { kind: "blocked", message: t("orders.progress.cash_not_collected_complete", "Cash hasn't been collected yet — take it from the Barista queue before completing this order.") };
    }
    return order.fulfillmentMethod === "DELIVERY"
      ? { kind: "action", label: t("orders.progress.dispatch", "Dispatch for Delivery"), hint: t("orders.progress.dispatch_hint", "Send this order out with a courier.") }
      : { kind: "action", label: t("orders.progress.mark_completed", "Mark Completed"), hint: t("orders.progress.mark_completed_hint", "Hand the order over at the counter.") };
  }
  if (order.status === "OUT_FOR_DELIVERY") {
    if (order.paymentMethod === "CASH" && order.paidAt == null) {
      return { kind: "blocked", message: t("orders.progress.cash_not_collected_deliver", "Cash hasn't been collected yet — collect it before marking this delivered.") };
    }
    return { kind: "action", label: t("orders.progress.mark_delivered", "Mark Delivered"), hint: t("orders.progress.mark_delivered_hint", "Confirm the courier has handed it over.") };
  }
  return null;
}

export default function Orders() {
  const { t } = useI18n();
  const [page, setPage] = usePersistentState("orders:page", 1);
  const [size, setSize] = usePageSize();
  const refresh = useRefreshOptions();
  const [filterStatus, setFilterStatus] = usePersistentState("orders:filterStatus", "");

  const {
    data: orderPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListOrdersQuery({
    page,
    size,
    ...(filterStatus ? { status: filterStatus as OrderStatus } : {}),
  }, refresh);
  const list = listLoadState({ isFetching, currentData, error });

  useStaffOrderAlerts(useCallback(() => { void refetch(); }, [refetch]));

  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();
  const { askCancel, cancelDialog } = useCancelOrderDialog();
  const [setDeliveryFee, { isLoading: isSettingFee }] = useSetOrderDeliveryFeeMutation();
  const [setEstimate, { isLoading: isSettingEstimate }] = useSetOrderEstimatedTimeMutation();
  const [startPreparing, { isLoading: isStartingPreparing }] = useStartPreparingOrderMutation();
  const [completeOrder, { isLoading: isCompleting }] = useCompleteOrderMutation();
  const [dispatchOrder, { isLoading: isDispatching }] = useDispatchAdminOrderMutation();
  const [markDelivered, { isLoading: isMarkingDelivered }] = useMarkDeliveredAdminOrderMutation();
  const isAdvancing = isStartingPreparing || isCompleting || isDispatching || isMarkingDelivered;

  const { printInvoice } = useOrderInvoice();

  const [selectedId, setSelectedId] = usePersistentState<string | null>("orders:selectedId", null);
  const [historyFor, setHistoryFor] = usePersistentState<string | null>("orders:historyFor", null);

  const { currentData: selected } = useGetOrderQuery(selectedId ?? "", { skip: !selectedId });

  const { currentData: history, isFetching: historyLoading, error: historyError, refetch: refetchHistory } = useGetOrderHistoryQuery(historyFor ?? "", {
    skip: !historyFor,
  });

  const orders = useMemo(() => orderPage?.content ?? [], [orderPage]);

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  // Refunded (cancelled) orders are not sales.
  const pageRevenue = orders
    .filter((o) => o.paidAt != null && o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const orderTableHeaders = [
    t("table.no", "No"),
    t("orders.table.order_id", "Order ID"),
    t("fields.customer", "Customer"),
    t("fields.type", "Type"),
    t("orders.table.handled_by", "Handled By"),
    t("orders.table.items", "Items"),
    t("fields.total", "Total"),
    t("orders.table.payment", "Payment"),
    t("orders.table.order_date", "Order Date"),
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];

  // Admins can cancel any order that isn't finished; a paid cash order is a refund (see lib/orderCancel).
  const policyFor = (order: OrderResponse) => cancelPolicy(order, { role: "ADMIN" });
  const handleCancel = async (order: OrderResponse) => {
    const policy = policyFor(order);
    if (!policy.allowed) {
      toast.error(cancelBlockedMessage(t, policy.why));
      return;
    }
    const body = await askCancel(order, policy);
    if (!body) return;
    try {
      await cancelOrder({ id: order.id, body }).unwrap();
      toast.success(t("orders.toast.cancelled", "Order cancelled"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("orders.errors.cancel", "Could not cancel the order.")));
    }
  };

  const handleSetDeliveryFee = async (order: OrderResponse, fee: number) => {
    try {
      await setDeliveryFee({ id: order.id, body: { fee } }).unwrap();
      toast.success(t("orders.toast.delivery_fee_saved", "Delivery fee saved"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("orders.errors.delivery_fee", "Could not save the delivery fee.")));
    }
  };

  const handleSetEstimate = async (order: OrderResponse, minutes: number) => {
    try {
      await setEstimate({ id: order.id, body: { minutes } }).unwrap();
      toast.success(t("orders.toast.estimate_set", "Estimated time set to {minutes} min", { minutes }));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("orders.errors.estimate", "Could not save the estimated time.")));
    }
  };

  const handleAdvance = async (order: OrderResponse) => {
    try {
      if (order.status === "PENDING" || order.status === "PAID") {
        await startPreparing(order.id).unwrap();
        toast.success(t("orders.toast.sent_to_kitchen", "Order sent to the kitchen queue"));
      } else if (order.status === "PREPARING" && order.fulfillmentMethod === "DELIVERY") {
        await dispatchOrder(order.id).unwrap();
        toast.success(t("orders.toast.dispatched", "Order dispatched for delivery"));
      } else if (order.status === "PREPARING") {
        await completeOrder(order.id).unwrap();
        toast.success(t("orders.toast.completed", "Order marked completed"));
      } else if (order.status === "OUT_FOR_DELIVERY") {
        await markDelivered(order.id).unwrap();
        toast.success(t("orders.toast.delivered", "Order marked delivered"));
      }
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("orders.errors.update", "Could not update the order.")));
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={t("orders.title", "Orders List")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("orders.breadcrumb.orders", "Orders") },
          { label: t("orders.title", "Orders List") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile title={t("orders.stats.all_orders", "All Orders")} value={String(orderPage?.totalElements ?? 0)} tone="gray" />
        <StatTile
          title={t("orders.stats.unpaid_page", "Unpaid (this page)")}
          value={String(pendingCount)}
          tone={pendingCount > 0 ? "orange" : "gray"}
        />
        <StatTile title={t("orders.stats.paid_value_page", "Paid Value (this page)")} value={money(pageRevenue)} tone="green" />
      </div>

      <FilterPanel>
        <SelectField
          label={t("fields.status", "Status")}
          placeholder={t("orders.filters.all_statuses", "All statuses")}
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="PENDING">{t("alerts.unpaid", "Unpaid")}</option>
          <option value="PAID">{enumLabel(t, "order_status", "PAID")}</option>
          <option value="PREPARING">{enumLabel(t, "order_status", "PREPARING")}</option>
          <option value="OUT_FOR_DELIVERY">{enumLabel(t, "order_status", "OUT_FOR_DELIVERY")}</option>
          <option value="COMPLETED">{enumLabel(t, "order_status", "COMPLETED")}</option>
          <option value="DELIVERED">{enumLabel(t, "order_status", "DELIVERED")}</option>
          <option value="CANCELLED">{enumLabel(t, "order_status", "CANCELLED")}</option>
        </SelectField>
        <FilterActions onClear={() => { setFilterStatus(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard title={t("orders.card.title", "Orders")} meta={t("orders.card.meta", "Total Orders: {count}", { count: orderPage?.totalElements ?? 0 })}>
        <SimpleTable headers={orderTableHeaders}>
          <TableState
            colSpan={orderTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={orders.length === 0}
            emptyLabel={t("orders.empty.list", "No orders match this filter.")}
            onRetry={refetch}
          />
          {list.showRows &&
            orders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(page - 1) * size + index + 1}</Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : t("orders.common.walk_in", "Walk-in")}</Cell>
                <Cell className={order.fulfillmentMethod === "DINE_IN" ? "whitespace-nowrap font-semibold" : "whitespace-nowrap"}>
                  {fulfillmentLabel(order) || "-"}
                </Cell>
                <Cell>{order.handledByName ? titleCase(order.handledByName) : "-"}</Cell>
                <Cell className="max-w-[11rem] truncate">{summariseItems(order)}</Cell>
                <Cell className="whitespace-nowrap font-semibold">{money(order.totalAmount)}</Cell>
                <Cell className="whitespace-nowrap">{order.paymentMethod ? enumLabel(t, "payment_method", order.paymentMethod) : "-"}</Cell>
                <Cell className="whitespace-nowrap">
                  <span className="block">{formatDate(order.createdAt)}</span>
                  <span className="block text-[11px] text-gray-500">{formatTime(order.createdAt)}</span>
                </Cell>
                <Cell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge label={enumLabel(t, "order_status", order.status)} tone={statusTone(order.status)} />
                    {order.fulfillmentMethod === "DELIVERY" && order.deliveryFeeSetAt == null && (
                      <StatusBadge label={t("orders.badge.delivery_fee_needed", "Delivery fee needed")} tone="warning" />
                    )}
                  </div>
                </Cell>
                <Cell>
                  <RowActions
                    onView={() => setSelectedId(order.id)}
                    onHistory={() => setHistoryFor(order.id)}
                    onPrint={order.paidAt != null ? () => printInvoice(order.id) : undefined}
                    onDelete={policyFor(order).allowed ? () => handleCancel(order) : undefined}
                    deleteLabel={t("orders.confirm.cancel_title", "Cancel order")}
                    isLoading={isCancelling}
                  />
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={orderPage?.page ?? page}
          totalPages={orderPage?.totalPages ?? 1}
          size={size}
          totalElements={orderPage?.totalElements}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </DataCard>

      <DetailModal
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={t("orders.detail.title", "Order Detail")}
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label={t("orders.table.order_id", "Order ID")}>
                <span className="font-mono text-xs">#{selected.id.slice(0, 8).toUpperCase()}</span>
              </DetailItem>
              <DetailItem label={t("fields.status", "Status")}>
                <StatusBadge label={enumLabel(t, "order_status", selected.status)} tone={statusTone(selected.status)} />
              </DetailItem>
              <DetailItem label={t("fields.customer", "Customer")}>{selected.customerName ? titleCase(selected.customerName) : t("orders.common.walk_in", "Walk-in")}</DetailItem>
              <DetailItem label={t("orders.table.handled_by", "Handled By")}>
                {selected.handledByName ? titleCase(selected.handledByName) : "-"}
                {selected.handledByRole ? ` (${enumLabel(t, "role", selected.handledByRole)})` : ""}
              </DetailItem>
              <DetailItem label={t("fields.payment_method", "Payment Method")}>
                {selected.paymentMethod ? enumLabel(t, "payment_method", selected.paymentMethod) : t("orders.detail.not_paid", "Not paid")}
              </DetailItem>
              <DetailItem label={t("fields.total", "Total")}>{money(selected.totalAmount)}</DetailItem>
              {cancellationLabel(t, selected) ? (
                <DetailItem label={t("orders.cancel.cancellation", "Cancellation")} wide>
                  {cancellationLabel(t, selected)}
                </DetailItem>
              ) : null}
              {rielTotalLabel(selected) ? (
                <DetailItem label={t("orders.detail.total_khr", "Total in KHR")}>{rielTotalLabel(selected)}</DetailItem>
              ) : null}
              <DetailItem label={t("orders.detail.amount_tendered", "Amount Tendered")}>
                {formatByCurrency(selected.amountTendered, selected.amountTenderedCurrency)}
              </DetailItem>
              <DetailItem label={t("orders.detail.change_due", "Change Due")}>
                {formatByCurrency(selected.changeDue, selected.changeCurrency)}
              </DetailItem>
              <DetailItem label={t("orders.detail.ordered_at", "Ordered At")}>
                {formatDateTime(selected.createdAt)}
              </DetailItem>
              <DetailItem label={t("orders.detail.paid_at", "Paid At")}>{formatDateTime(selected.paidAt)}</DetailItem>
              <DetailItem label={t("fields.note", "Note")} wide={Boolean(selected.note)}>{selected.note || "-"}</DetailItem>
              <DetailItem label={t("orders.detail.fulfillment", "Fulfillment")} wide>
                <OrderFulfillmentDetails
                  order={selected}
                  onSetDeliveryFee={(fee) => handleSetDeliveryFee(selected, fee)}
                  isSettingFee={isSettingFee}
                />
              </DetailItem>
            </DetailGrid>
            <OrderEstimateEditor
              order={selected}
              onSave={(minutes) => handleSetEstimate(selected, minutes)}
              isSaving={isSettingEstimate}
            />

            <InvoiceActions order={selected} className="mt-4" />

            {(() => {
              const step = describeNextStep(selected, t);
              if (!step) return null;
              if (step.kind === "blocked") {
                return (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">{t("orders.progress.title", "Order progress")}</p>
                    <p className="mt-1 text-xs text-amber-800">{step.message}</p>
                    <Link href="/payments" className="mt-2 inline-block text-xs font-medium underline text-amber-900">
                      {t("orders.progress.go_to_payments", "Go to Payments")}
                    </Link>
                  </div>
                );
              }
              return (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{t("orders.progress.title", "Order progress")}</p>
                    <p className="text-xs text-muted-foreground">{step.hint}</p>
                  </div>
                  <Button
                   
                    onClick={() => handleAdvance(selected)}
                    disabled={isAdvancing}
                    variant="primary" className="w-full shrink-0 justify-center text-xs font-medium disabled:opacity-50 sm:w-auto"
                  >
                    {isAdvancing ? t("states.updating", "Updating...") : step.label}
                  </Button>
                </div>
              );
            })()}

            <div className="mt-6">
              <p className="detail_item_label mb-2">{t("orders.detail.items_label", "Items :")}</p>
              <div className="data_table_wrap">
              <table className="data_table is_stack_mobile">
                <thead>
                  <tr>
                    <th>{t("fields.product", "Product")}</th>
                    <th>{t("orders.detail.options", "Options")}</th>
                    <th>{t("orders.detail.qty", "Qty")}</th>
                    <th>{t("orders.detail.unit_price", "Unit Price")}</th>
                    <th>{t("orders.detail.subtotal", "Subtotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td>{titleCase(item.productName)}</td>
                      <td data-label={t("orders.detail.options", "Options")} className="text-xs text-muted-foreground">
                        {optionSummary({
                          variantName: item.variantName,
                          sugarLevel: item.sugarLevel,
                          iceLevel: item.iceLevel,
                          milkType: item.milkType,
                          extras: item.extras.map((extra) => ({ name: titleCase(extra.name) })),
                        }) || "-"}
                      </td>
                      <td data-label={t("orders.detail.qty", "Qty")}>{item.quantity}</td>
                      <td data-label={t("orders.detail.unit_price", "Unit Price")}>{money(item.unitPrice)}</td>
                      <td data-label={t("orders.detail.subtotal", "Subtotal")}>{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={historyFor !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryFor(null);
        }}
        title={t("orders.history.title", "Order History")}
      >
        <div className="admin_modal_form_wrap">
          {historyLoading ? <p role="status">{t("orders.history.loading", "Loading history...")}</p> : historyError ? <div role="alert">
            {apiErrorMessage(historyError as never, t("orders.history.error", "Could not load order history."))} <button className="underline" onClick={() => refetchHistory()}>{t("actions.retry", "Retry")}</button>
          </div> : history && history.length > 0 ? (
            <div className="data_table_wrap">
            <table className="data_table is_stack_mobile">
              <thead>
                <tr>
                  <th>{t("orders.history.action", "Action")}</th>
                  <th>{t("orders.history.actor", "Actor")}</th>
                  <th>{t("orders.history.when", "When")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{enumLabel(t, "audit_action", entry.action)}</td>
                    <td data-label={t("orders.history.actor", "Actor")}>
                      {entry.actorName ?? "-"}
                      {entry.actorRole ? ` (${enumLabel(t, "role", entry.actorRole)})` : ""}
                    </td>
                    <td data-label={t("orders.history.when", "When")}>{formatDateTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("orders.history.empty", "No history recorded for this order.")}
            </p>
          )}
        </div>
      </DetailModal>
      {cancelDialog}
    </PageShell>
  );
}
