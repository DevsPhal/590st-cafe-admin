"use client";
import { OrderFulfillmentDetails } from "@/components/common/OrderFulfillmentDetails";

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
  useStartPreparingOrderMutation,
} from "@/store/api/orderApi";
import type { OrderResponse, OrderStatus } from "@/store/api/types";
import { formatByCurrency, formatLevel, humanise, titleCase } from "@/lib/utils";
import { InvoiceActions } from "@/components/common/InvoiceActions";
import { useOrderInvoice } from "@/hooks/useOrderInvoice";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePersistentState } from "@/hooks/usePersistentState";

const ORDER_TABLE_HEADERS = [
  "No",
  "Order ID",
  "Customer",
  "Handled By",
  "Items",
  "Total",
  "Payment",
  "Order Date",
  "Status",
  "Action",
] as const;

const money = (value: number | null | undefined) =>
  value == null ? "-" : `$${Number(value).toFixed(2)}`;

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: OrderStatus): "success" | "warning" | "danger" | "info" {
  // DELIVERED is the delivery counterpart of COMPLETED: both mean the customer has it.
  if (status === "COMPLETED" || status === "DELIVERED") return "success";
  // Paid but not yet handed over — money is in, the drink is still owed.
  if (status === "PAID" || status === "PREPARING" || status === "OUT_FOR_DELIVERY") return "info";
  if (status === "PENDING") return "warning";
  return "danger";
}

/** "x2 Iced Latte, x1 Croissant" — the same summary the table and detail modal both want. */
function summariseItems(order: OrderResponse): string {
  if (order.items.length === 0) return "-";
  return order.items
    .map((item) => `x${item.quantity} ${titleCase(item.productName)}`)
    .join(", ");
}

type NextStep =
  | { kind: "action"; label: string; hint: string }
  // Something else has to happen first — always on the Payments page — before the button above
  // would do anything. Showing it unconditionally used to dead-end here: the API rejects
  // "start preparing" on an unpaid Bakong/still-unpriced-delivery order and "mark delivered" on
  // an unpaid cash one, with nothing on this screen able to recover from that.
  | { kind: "blocked"; message: string }
  | null;

/**
 * What "move this order along" means next, mirroring the backend's own fulfillment state
 * machine (prepare -> complete, or prepare -> dispatch -> deliver for delivery orders) and its
 * payment gates (a Bakong order must clear, a delivery order must be priced, cash collected
 * before completion/delivery — see requireDeliveryFeeQuoted/requirePaymentSettled on the API).
 */
function describeNextStep(order: OrderResponse): NextStep {
  if (order.status === "PENDING" || order.status === "PAID") {
    if (order.fulfillmentMethod === "DELIVERY" && order.deliveryFeeSetAt == null) {
      return { kind: "blocked", message: "Waiting for the delivery fee to be set before this can start." };
    }
    if (order.status === "PENDING" && order.paymentMethod === "BAKONG") {
      return { kind: "blocked", message: "Waiting for the Bakong transfer to be confirmed before this can start." };
    }
    if (order.status === "PENDING" && !order.paymentMethod) {
      return { kind: "blocked", message: "Waiting for the customer to choose how to pay." };
    }
    return { kind: "action", label: "Start Preparing", hint: "Send this order to the kitchen queue." };
  }
  if (order.status === "PREPARING") {
    if (
      order.fulfillmentMethod !== "DELIVERY" &&
      order.paymentMethod === "CASH" &&
      order.paidAt == null
    ) {
      return { kind: "blocked", message: "Cash hasn't been collected yet — take it from the Barista queue before completing this order." };
    }
    return order.fulfillmentMethod === "DELIVERY"
      ? { kind: "action", label: "Dispatch for Delivery", hint: "Send this order out with a courier." }
      : { kind: "action", label: "Mark Completed", hint: "Hand the order over at the counter." };
  }
  if (order.status === "OUT_FOR_DELIVERY") {
    if (order.paymentMethod === "CASH" && order.paidAt == null) {
      return { kind: "blocked", message: "Cash hasn't been collected yet — collect it before marking this delivered." };
    }
    return { kind: "action", label: "Mark Delivered", hint: "Confirm the courier has handed it over." };
  }
  return null;
}

export default function Orders() {
  const { confirm, confirmDialog } = useConfirmDialog();
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

  // A new order, or any status/fee change to one already on this page, reaches the table the
  // instant the API broadcasts it rather than on the next poll.
  useStaffOrderAlerts(useCallback(() => { void refetch(); }, [refetch]));

  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();
  const [setDeliveryFee, { isLoading: isSettingFee }] = useSetOrderDeliveryFeeMutation();
  const [startPreparing, { isLoading: isStartingPreparing }] = useStartPreparingOrderMutation();
  const [completeOrder, { isLoading: isCompleting }] = useCompleteOrderMutation();
  const [dispatchOrder, { isLoading: isDispatching }] = useDispatchAdminOrderMutation();
  const [markDelivered, { isLoading: isMarkingDelivered }] = useMarkDeliveredAdminOrderMutation();
  const isAdvancing = isStartingPreparing || isCompleting || isDispatching || isMarkingDelivered;

  const { printInvoice } = useOrderInvoice();

  const [selectedId, setSelectedId] = usePersistentState<string | null>("orders:selectedId", null);
  const [historyFor, setHistoryFor] = usePersistentState<string | null>("orders:historyFor", null);

  // Live rather than a frozen row snapshot, so the modal reflects a delivery fee or a status
  // change the moment it happens instead of only after the list page is closed and reopened.
  const { currentData: selected } = useGetOrderQuery(selectedId ?? "", { skip: !selectedId });

  // Only fetched while a history modal is actually open.
  const { currentData: history, isFetching: historyLoading, error: historyError, refetch: refetchHistory } = useGetOrderHistoryQuery(historyFor ?? "", {
    skip: !historyFor,
  });

  const orders = useMemo(() => orderPage?.content ?? [], [orderPage]);

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  // Revenue counts every order that has been paid for, not only the ones already handed over:
  // a drink still on the bar has been charged for and belongs in the takings.
  const pageRevenue = orders
    .filter((o) => o.paidAt != null)
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const handleCancel = async (order: OrderResponse) => {
    if (!(await confirm({ title: "Cancel order", description: `Cancel order ${order.id.slice(0, 8)}?`, confirmLabel: "Cancel order", tone: "danger" }))) return;
    try {
      await cancelOrder(order.id).unwrap();
      toast.success("Order cancelled");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not cancel the order."));
    }
  };

  const handleSetDeliveryFee = async (order: OrderResponse, fee: number) => {
    try {
      await setDeliveryFee({ id: order.id, body: { fee } }).unwrap();
      toast.success("Delivery fee saved");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not save the delivery fee."));
    }
  };

  const handleAdvance = async (order: OrderResponse) => {
    try {
      if (order.status === "PENDING" || order.status === "PAID") {
        await startPreparing(order.id).unwrap();
        toast.success("Order sent to the kitchen queue");
      } else if (order.status === "PREPARING" && order.fulfillmentMethod === "DELIVERY") {
        await dispatchOrder(order.id).unwrap();
        toast.success("Order dispatched for delivery");
      } else if (order.status === "PREPARING") {
        await completeOrder(order.id).unwrap();
        toast.success("Order marked completed");
      } else if (order.status === "OUT_FOR_DELIVERY") {
        await markDelivered(order.id).unwrap();
        toast.success("Order marked delivered");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not update the order."));
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Orders List"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Orders" },
          { label: "Orders List" },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile title="All Orders" value={String(orderPage?.totalElements ?? 0)} tone="gray" />
        <StatTile
          title="Unpaid (this page)"
          value={String(pendingCount)}
          tone={pendingCount > 0 ? "orange" : "gray"}
        />
        <StatTile title="Paid Value (this page)" value={money(pageRevenue)} tone="green" />
      </div>

      <FilterPanel>
        <SelectField
          label="Status"
          placeholder="All statuses"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="PENDING">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="PREPARING">Preparing</option>
          <option value="OUT_FOR_DELIVERY">Out for delivery</option>
          <option value="COMPLETED">Completed</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </SelectField>
        <FilterActions onClear={() => { setFilterStatus(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard title="Orders" meta={`Total Orders: ${orderPage?.totalElements ?? 0}`}>
        <SimpleTable headers={[...ORDER_TABLE_HEADERS]}>
          <TableState
            colSpan={ORDER_TABLE_HEADERS.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={orders.length === 0}
            emptyLabel="No orders match this filter."
            onRetry={refetch}
          />
          {list.showRows &&
            orders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(page - 1) * size + index + 1}</Cell>
                <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : "Walk-in"}</Cell>
                <Cell>{order.handledByName ? titleCase(order.handledByName) : "-"}</Cell>
                <Cell className="max-w-[16rem] truncate">{summariseItems(order)}</Cell>
                <Cell className="font-semibold">{money(order.totalAmount)}</Cell>
                <Cell>{order.paymentMethod ? humanise(order.paymentMethod) : "-"}</Cell>
                <Cell>{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge label={humanise(order.status)} tone={statusTone(order.status)} />
                    {order.fulfillmentMethod === "DELIVERY" && order.deliveryFeeSetAt == null && (
                      <StatusBadge label="Delivery fee needed" tone="warning" />
                    )}
                  </div>
                </Cell>
                <Cell>
                  <RowActions
                    onView={() => setSelectedId(order.id)}
                    onHistory={() => setHistoryFor(order.id)}
                    onPrint={order.paidAt != null ? () => printInvoice(order.id) : undefined}
                    onDelete={
                      order.status === "PENDING" ? () => handleCancel(order) : undefined
                    }
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
        title="Order Detail"
      >
        {selected && (
          <div className="admin_modal_form_wrap">
            <DetailGrid>
              <DetailItem label="Order ID">
                <span className="font-mono text-xs">#{selected.id.slice(0, 8).toUpperCase()}</span>
              </DetailItem>
              <DetailItem label="Status">
                <StatusBadge label={humanise(selected.status)} tone={statusTone(selected.status)} />
              </DetailItem>
              <DetailItem label="Customer">{selected.customerName ? titleCase(selected.customerName) : "Walk-in"}</DetailItem>
              <DetailItem label="Handled By">
                {selected.handledByName ? titleCase(selected.handledByName) : "-"}
                {selected.handledByRole ? ` (${humanise(selected.handledByRole)})` : ""}
              </DetailItem>
              <DetailItem label="Payment Method">
                {selected.paymentMethod ? humanise(selected.paymentMethod) : "Not paid"}
              </DetailItem>
              <DetailItem label="Total">{money(selected.totalAmount)}</DetailItem>
              <DetailItem label="Amount Tendered">
                {formatByCurrency(selected.amountTendered, selected.amountTenderedCurrency)}
              </DetailItem>
              <DetailItem label="Change Due">
                {formatByCurrency(selected.changeDue, selected.changeCurrency)}
              </DetailItem>
              <DetailItem label="Ordered At">
                {formatDateTime(selected.createdAt)}
              </DetailItem>
              <DetailItem label="Paid At">{formatDateTime(selected.paidAt)}</DetailItem>
              <DetailItem label="Note">{selected.note || "-"}</DetailItem>
              <DetailItem label="Fulfillment">
                <OrderFulfillmentDetails
                  order={selected}
                  onSetDeliveryFee={(fee) => handleSetDeliveryFee(selected, fee)}
                  isSettingFee={isSettingFee}
                />
              </DetailItem>
            </DetailGrid>

            <InvoiceActions order={selected} className="mt-4" />

            {(() => {
              const step = describeNextStep(selected);
              if (!step) return null;
              if (step.kind === "blocked") {
                return (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">Order progress</p>
                    <p className="mt-1 text-xs text-amber-800">{step.message}</p>
                    <Link href="/payments" className="mt-2 inline-block text-xs font-medium underline text-amber-900">
                      Go to Payments
                    </Link>
                  </div>
                );
              }
              return (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Order progress</p>
                    <p className="text-xs text-muted-foreground">{step.hint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdvance(selected)}
                    disabled={isAdvancing}
                    className="btn_primary_black shrink-0 text-xs font-medium disabled:opacity-50"
                  >
                    {isAdvancing ? "Updating..." : step.label}
                  </button>
                </div>
              );
            })()}

            <div className="mt-6">
              <p className="detail_item_label mb-2">Items :</p>
              <table className="data_table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Options</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td>{titleCase(item.productName)}</td>
                      <td className="text-xs text-muted-foreground">
                        {[
                          item.variantName ? humanise(item.variantName) : null,
                          item.sugarLevel && `Sugar ${formatLevel(item.sugarLevel)}`,
                          item.iceLevel && `Ice ${formatLevel(item.iceLevel)}`,
                          item.milkType && item.milkType !== "NONE" ? humanise(item.milkType) : null,
                          ...item.extras.map((extra) => titleCase(extra.name)),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPrice)}</td>
                      <td>{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={historyFor !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryFor(null);
        }}
        title="Order History"
      >
        <div className="admin_modal_form_wrap">
          {historyLoading ? <p role="status">Loading history...</p> : historyError ? <div role="alert">
            {apiErrorMessage(historyError as never, "Could not load order history.")} <button className="underline" onClick={() => refetchHistory()}>Retry</button>
          </div> : history && history.length > 0 ? (
            <table className="data_table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{humanise(entry.action)}</td>
                    <td>
                      {entry.actorName ?? "-"}
                      {entry.actorRole ? ` (${humanise(entry.actorRole)})` : ""}
                    </td>
                    <td>{formatDateTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No history recorded for this order.
            </p>
          )}
        </div>
      </DetailModal>
      {confirmDialog}
    </PageShell>
  );
}
