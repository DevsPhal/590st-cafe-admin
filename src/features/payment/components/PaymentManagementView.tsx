"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  FormInput,
  FormModal,
  FormSelect,
  ModalGrid,
  PaginationFooter,
  Row,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableState,
  listLoadState,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useAcceptBakongPaymentMutation,
  useCollectCashMutation,
  useListAwaitingBakongConfirmationQuery,
  useListAwaitingDeliveryFeeQuery,
  useListAwaitingPickupQuery,
  useListDeliveryBoardQuery,
  useMarkDeliveredAdminOrderMutation,
  useSetOrderDeliveryFeeMutation,
} from "@/store/api/orderApi";
import { useGetExchangeRateQuery } from "@/store/api/reportApi";
import type { Currency, OrderResponse } from "@/store/api/types";
import { formatByCurrency, titleCase } from "@/lib/utils";
import { buildCashPaymentSchema, deliveryFeeSchema, firstIssueMessage } from "@/lib/validation";
import { useDefaultPageSize, useRefreshOptions } from "@/contexts/AdminPreferencesContext";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePersistentState } from "@/hooks/usePersistentState";

const DELIVERY_FEE_HEADERS = [
  "No",
  "Order ID",
  "Customer",
  "Address",
  "Distance",
  "Ordered At",
  "Action",
] as const;

const PICKUP_HEADERS = [
  "No",
  "Order ID",
  "Customer",
  "Items",
  "Amount Due",
  "Ordered At",
  "Action",
] as const;

const BAKONG_HEADERS = [
  "No",
  "Order ID",
  "Customer",
  "Items",
  "Amount",
  "Currency",
  "Ordered At",
  "Action",
] as const;

const DELIVERY_BOARD_HEADERS = [
  "No",
  "Order ID",
  "Customer",
  "Address",
  "Payment",
  "Dispatched At",
  "Action",
] as const;

const money = (value: number | null | undefined) =>
  value == null ? "-" : `$${Number(value).toFixed(2)}`;

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const summarise = (order: OrderResponse) =>
  order.items.map((i) => `x${i.quantity} ${titleCase(i.productName)}`).join(", ") || "-";

/**
 * The two payment queues the API exposes: cash-on-pickup orders waiting for staff to take
 * the money, and Bakong transfers the customer says they have sent, pending confirmation.
 */
export default function PaymentManagementView() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [deliveryFeePage, setDeliveryFeePage] = usePersistentState("payments:deliveryFeePage", 1);
  const [pickupPage, setPickupPage] = usePersistentState("payments:pickupPage", 1);
  const [bakongPage, setBakongPage] = usePersistentState("payments:bakongPage", 1);
  const [deliveryBoardPage, setDeliveryBoardPage] = usePersistentState("payments:deliveryBoardPage", 1);
  const size = useDefaultPageSize();
  const refresh = useRefreshOptions();

  const deliveryFeeQuery = useListAwaitingDeliveryFeeQuery({ page: deliveryFeePage, size }, refresh);
  const { data: deliveryFeeData, refetch: refetchDeliveryFee } = deliveryFeeQuery;
  const deliveryFeeList = listLoadState(deliveryFeeQuery);

  const pickupQuery = useListAwaitingPickupQuery({ page: pickupPage, size }, refresh);
  const { data: pickupData, refetch: refetchPickup } = pickupQuery;
  const pickupList = listLoadState(pickupQuery);

  const bakongQuery = useListAwaitingBakongConfirmationQuery({ page: bakongPage, size }, refresh);
  const { data: bakongData, refetch: refetchBakong } = bakongQuery;
  const bakongList = listLoadState(bakongQuery);

  const deliveryBoardQuery = useListDeliveryBoardQuery({ page: deliveryBoardPage, size }, refresh);
  const { data: deliveryBoardData, refetch: refetchDeliveryBoard } = deliveryBoardQuery;
  const deliveryBoardList = listLoadState(deliveryBoardQuery);

  // A customer pinning a delivery location, or choosing Cash, reaches this the instant the API
  // broadcasts it, instead of waiting up to `refresh`'s poll interval (or forever, if the staff
  // member turned live refresh off in Settings) to see it show up as needing attention.
  useStaffOrderAlerts(
    useCallback(() => {
      void refetchDeliveryFee();
      void refetchPickup();
      void refetchBakong();
      void refetchDeliveryBoard();
    }, [refetchDeliveryFee, refetchPickup, refetchBakong, refetchDeliveryBoard])
  );

  const [collectCash, { isLoading: isCollecting }] = useCollectCashMutation();
  const [acceptBakong, { isLoading: isAccepting }] = useAcceptBakongPaymentMutation();
  const [setDeliveryFee, { isLoading: isSettingFee }] = useSetOrderDeliveryFeeMutation();
  const [markDelivered, { isLoading: isMarkingDelivered }] = useMarkDeliveredAdminOrderMutation();

  const [feeOrder, setFeeOrder] = useState<OrderResponse | null>(null);
  const [feeInput, setFeeInput] = useState("");

  const openFeeModal = (order: OrderResponse) => {
    setFeeOrder(order);
    setFeeInput("");
  };

  const handleSetDeliveryFee = async () => {
    if (!feeOrder) return;
    const parsed = deliveryFeeSchema.safeParse({ fee: feeInput });
    if (!parsed.success) {
      toast.error(firstIssueMessage(parsed.error));
      return;
    }
    try {
      await setDeliveryFee({ id: feeOrder.id, body: parsed.data }).unwrap();
      toast.success("Delivery fee set — the customer can now choose how to pay.");
      setFeeOrder(null);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not save the delivery fee."));
    }
  };

  // Cash is always tallied in USD by default; KHR only unlocks once the exchange rate has
  // loaded, since the till otherwise has no way to convert the USD-denominated total.
  const { data: exchangeRate } = useGetExchangeRateQuery();
  const khrPerUsdRate = exchangeRate ? Number(exchangeRate.khrPerUsdRate) : null;

  const [cashOrder, setCashOrder] = useState<OrderResponse | null>(null);
  const [amountTendered, setAmountTendered] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");

  // What's actually owed, converted into whichever currency is selected — totalAmount itself
  // is always the USD-equivalent figure, never the KHR one.
  const payableDue = (order: OrderResponse, targetCurrency: Currency): number =>
    targetCurrency === "USD" || !khrPerUsdRate
      ? Number(order.totalAmount)
      : Number(order.totalAmount) * khrPerUsdRate;

  const exactAmountFor = (order: OrderResponse, targetCurrency: Currency): string => {
    const due = payableDue(order, targetCurrency);
    return targetCurrency === "KHR" ? String(Math.round(due)) : due.toFixed(2);
  };

  const openCashModal = (order: OrderResponse) => {
    setCashOrder(order);
    setCurrency("USD");
    // Pre-fill with the exact amount — the common case is the customer paying to the cent.
    setAmountTendered(exactAmountFor(order, "USD"));
  };

  // Switching currency mid-entry must reseed the amount too — a USD figure left over after
  // flipping to KHR would look like a valid tender while being off by ~4000x.
  const handleCashCurrencyChange = (next: Currency) => {
    setCurrency(next);
    if (cashOrder) setAmountTendered(exactAmountFor(cashOrder, next));
  };

  const cashDue = cashOrder ? payableDue(cashOrder, currency) : 0;

  const handleCollectCash = async () => {
    if (!cashOrder) return;
    const parsed = buildCashPaymentSchema(cashDue).safeParse({
      currency,
      amountTendered,
    });
    if (!parsed.success) {
      toast.error(firstIssueMessage(parsed.error));
      return;
    }

    try {
      const updated = await collectCash({
        id: cashOrder.id,
        body: parsed.data,
      }).unwrap();
      toast.success(
        updated.changeDue && Number(updated.changeDue) > 0
          ? `Paid. Change due: ${formatByCurrency(updated.changeDue, updated.changeCurrency ?? currency)}`
          : "Payment collected"
      );
      setCashOrder(null);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not record the cash payment."));
    }
  };

  const handleAcceptBakong = async (order: OrderResponse) => {
    if (!(await confirm({ title: "Confirm payment", description: `Confirm the Bakong payment for #${order.id.slice(0, 8)}?` }))) return;
    try {
      await acceptBakong(order.id).unwrap();
      toast.success("Bakong payment confirmed");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not confirm the payment."));
    }
  };

  /**
   * A cash delivery can be dispatched unpaid (the courier collects it on arrival), so this
   * board offers two different actions per row rather than one that would just fail: collect
   * the cash first if it's still owed — the API rejects "delivered" until that's settled.
   */
  const handleMarkDelivered = async (order: OrderResponse) => {
    try {
      await markDelivered(order.id).unwrap();
      toast.success("Order marked delivered");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not mark the order delivered."));
    }
  };

  const deliveryFeeOrders = deliveryFeeData?.content ?? [];
  const pickupOrders = pickupData?.content ?? [];
  const bakongOrders = bakongData?.content ?? [];
  const deliveryBoardOrders = deliveryBoardData?.content ?? [];

  // Separated by payment method, so cash and Bakong each get their own total rather than one
  // combined figure — the two queues below are already split the same way. totalAmount is the
  // canonical USD-equivalent figure on every order; bakongAmount is only comparable within its
  // own bakongCurrency (USD or KHR) and isn't safe to sum across orders issued in different ones.
  const pickupTotal = pickupOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const bakongTotal = bakongOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const unpaidOnBoard = deliveryBoardOrders.filter(
    (o) => o.paymentMethod === "CASH" && o.paidAt == null
  ).length;

  return (
    <PageShell>
      <PageHeader
        title="Payments"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Payments" },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          title="Awaiting Delivery Fee"
          value={String(deliveryFeeData?.totalElements ?? 0)}
          hint="Customer pinned a location — quote a fee to unlock payment"
          tone={(deliveryFeeData?.totalElements ?? 0) > 0 ? "orange" : "gray"}
        />
        <StatTile
          title="Awaiting Cash Pickup"
          value={String(pickupData?.totalElements ?? 0)}
          tone={(pickupData?.totalElements ?? 0) > 0 ? "orange" : "gray"}
        />
        <StatTile title="Cash Due (this page)" value={money(pickupTotal)} tone="green" />
        <StatTile
          title="Awaiting Bakong Confirmation"
          value={String(bakongData?.totalElements ?? 0)}
          tone={(bakongData?.totalElements ?? 0) > 0 ? "orange" : "gray"}
        />
        <StatTile title="Bakong Due (this page)" value={money(bakongTotal)} tone="green" />
        <StatTile
          title="Out for Delivery"
          value={String(deliveryBoardData?.totalElements ?? 0)}
          hint={unpaidOnBoard > 0 ? `${unpaidOnBoard} still owe cash on arrival` : "All out-for-delivery orders are paid"}
          tone={unpaidOnBoard > 0 ? "orange" : "gray"}
        />
      </div>

      <DataCard
        title="Awaiting Delivery Fee"
        meta={`Waiting: ${deliveryFeeData?.totalElements ?? 0}`}
      >
        <SimpleTable headers={[...DELIVERY_FEE_HEADERS]}>
          <TableState
            colSpan={DELIVERY_FEE_HEADERS.length}
            isLoading={deliveryFeeList.isLoading}
            error={deliveryFeeList.error}
            isEmpty={deliveryFeeOrders.length === 0}
            emptyLabel="No delivery orders are waiting for a fee."
            onRetry={refetchDeliveryFee}
          />
          {deliveryFeeList.showRows &&
            deliveryFeeOrders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(deliveryFeePage - 1) * size + index + 1}</Cell>
                <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : "Walk-in"}</Cell>
                <Cell className="max-w-[16rem] truncate">{order.deliveryAddress || "-"}</Cell>
                <Cell>
                  {order.distanceMeters != null ? formatDistance(Number(order.distanceMeters)) : "-"}
                </Cell>
                <Cell>{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <button
                    type="button"
                    className="btn_primary_yellow text-xs"
                    onClick={() => openFeeModal(order)}
                    disabled={isSettingFee}
                  >
                    Set Fee
                  </button>
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={deliveryFeeData?.page ?? deliveryFeePage}
          totalPages={deliveryFeeData?.totalPages ?? 1}
          size={size}
          totalElements={deliveryFeeData?.totalElements}
          onPageChange={setDeliveryFeePage}
        />
      </DataCard>

      <DataCard
        title="Cash on Pickup"
        meta={`Waiting: ${pickupData?.totalElements ?? 0}`}
      >
        <SimpleTable headers={[...PICKUP_HEADERS]}>
          <TableState
            colSpan={PICKUP_HEADERS.length}
            isLoading={pickupList.isLoading}
            error={pickupList.error}
            isEmpty={pickupOrders.length === 0}
            emptyLabel="No orders are waiting for cash collection."
            onRetry={refetchPickup}
          />
          {pickupList.showRows &&
            pickupOrders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(pickupPage - 1) * size + index + 1}</Cell>
                <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : "Walk-in"}</Cell>
                <Cell className="max-w-[16rem] truncate">{summarise(order)}</Cell>
                <Cell className="font-semibold">{money(order.totalAmount)}</Cell>
                <Cell>{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <button
                    type="button"
                    className="btn_primary_yellow text-xs"
                    onClick={() => openCashModal(order)}
                    disabled={isCollecting}
                  >
                    Collect Cash
                  </button>
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={pickupData?.page ?? pickupPage}
          totalPages={pickupData?.totalPages ?? 1}
          size={size}
          totalElements={pickupData?.totalElements}
          onPageChange={setPickupPage}
        />
      </DataCard>

      <DataCard
        title="Bakong Confirmations"
        meta={`Waiting: ${bakongData?.totalElements ?? 0}`}
      >
        <SimpleTable headers={[...BAKONG_HEADERS]}>
          <TableState
            colSpan={BAKONG_HEADERS.length}
            isLoading={bakongList.isLoading}
            error={bakongList.error}
            isEmpty={bakongOrders.length === 0}
            emptyLabel="No Bakong payments are waiting for confirmation."
            onRetry={refetchBakong}
          />
          {bakongList.showRows &&
            bakongOrders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(bakongPage - 1) * size + index + 1}</Cell>
                <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : "Walk-in"}</Cell>
                <Cell className="max-w-[16rem] truncate">{summarise(order)}</Cell>
                <Cell className="font-semibold">
                  {order.bakongAmount != null
                    ? Number(order.bakongAmount).toLocaleString()
                    : money(order.totalAmount)}
                </Cell>
                <Cell>
                  <StatusBadge
                    label={order.bakongCurrency ?? "USD"}
                    tone="info"
                  />
                </Cell>
                <Cell>{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <button
                    type="button"
                    className="btn_primary_yellow text-xs"
                    onClick={() => handleAcceptBakong(order)}
                    disabled={isAccepting}
                  >
                    Confirm
                  </button>
                </Cell>
              </Row>
            ))}
        </SimpleTable>
        <PaginationFooter
          page={bakongData?.page ?? bakongPage}
          totalPages={bakongData?.totalPages ?? 1}
          size={size}
          totalElements={bakongData?.totalElements}
          onPageChange={setBakongPage}
        />
      </DataCard>

      <DataCard
        title="Delivery Board"
        meta={`Out with a courier: ${deliveryBoardData?.totalElements ?? 0}`}
      >
        <SimpleTable headers={[...DELIVERY_BOARD_HEADERS]}>
          <TableState
            colSpan={DELIVERY_BOARD_HEADERS.length}
            isLoading={deliveryBoardList.isLoading}
            error={deliveryBoardList.error}
            isEmpty={deliveryBoardOrders.length === 0}
            emptyLabel="Nothing is out for delivery."
            onRetry={refetchDeliveryBoard}
          />
          {deliveryBoardList.showRows &&
            deliveryBoardOrders.map((order, index) => {
              const needsCash = order.paymentMethod === "CASH" && order.paidAt == null;
              return (
                <Row key={order.id} striped={index % 2 === 1}>
                  <Cell>{(deliveryBoardPage - 1) * size + index + 1}</Cell>
                  <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                  <Cell>{order.customerName ? titleCase(order.customerName) : "Walk-in"}</Cell>
                  <Cell className="max-w-[16rem] truncate">{order.deliveryAddress || "-"}</Cell>
                  <Cell>
                    <StatusBadge
                      label={needsCash ? "Cash due on arrival" : "Paid"}
                      tone={needsCash ? "warning" : "success"}
                    />
                  </Cell>
                  <Cell>{formatDateTime(order.dispatchedAt)}</Cell>
                  <Cell>
                    <button
                      type="button"
                      className="btn_primary_yellow text-xs"
                      onClick={() => (needsCash ? openCashModal(order) : handleMarkDelivered(order))}
                      disabled={needsCash ? isCollecting : isMarkingDelivered}
                    >
                      {needsCash ? "Collect Cash" : "Mark Delivered"}
                    </button>
                  </Cell>
                </Row>
              );
            })}
        </SimpleTable>
        <PaginationFooter
          page={deliveryBoardData?.page ?? deliveryBoardPage}
          totalPages={deliveryBoardData?.totalPages ?? 1}
          size={size}
          totalElements={deliveryBoardData?.totalElements}
          onPageChange={setDeliveryBoardPage}
        />
      </DataCard>

      <FormModal
        open={feeOrder !== null}
        onOpenChange={(open) => {
          if (!open) setFeeOrder(null);
        }}
        title="Set Delivery Fee"
        submitLabel="Save Fee"
        onSubmit={handleSetDeliveryFee}
        isLoading={isSettingFee}
      >
        <ModalGrid>
          <FormInput label="Customer" value={feeOrder?.customerName ? titleCase(feeOrder.customerName) : "Walk-in"} readOnly />
          <FormInput label="Address" value={feeOrder?.deliveryAddress ?? "-"} readOnly />
          <FormInput
            label="Distance"
            value={feeOrder?.distanceMeters != null ? formatDistance(Number(feeOrder.distanceMeters)) : "Not available"}
            readOnly
          />
          <FormInput label="Items Subtotal" value={feeOrder ? money(feeOrder.totalAmount) : ""} readOnly />
          <FormInput
            label="Delivery Fee (USD)"
            type="number"
            min="0"
            placeholder="0.00"
            value={feeInput}
            onChange={(e) => setFeeInput(e.target.value)}
            required
          />
          <FormInput
            label="Customer's Grand Total"
            value={
              feeOrder && feeInput.trim() && Number.isFinite(Number(feeInput))
                ? money(Number(feeOrder.totalAmount) + Number(feeInput))
                : "-"
            }
            readOnly
          />
        </ModalGrid>
        {feeOrder?.deliveryLatitude != null && feeOrder?.deliveryLongitude != null && (
          <a
            href={`https://www.google.com/maps?q=${feeOrder.deliveryLatitude},${feeOrder.deliveryLongitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs underline"
          >
            View pinned location on map
          </a>
        )}
      </FormModal>

      <FormModal
        open={cashOrder !== null}
        onOpenChange={(open) => {
          if (!open) setCashOrder(null);
        }}
        title="Collect Cash"
        submitLabel="Confirm Payment"
        onSubmit={handleCollectCash}
        isLoading={isCollecting}
      >
        <ModalGrid>
          <FormInput
            label="Total Due"
            value={cashOrder ? formatByCurrency(cashDue, currency) : ""}
            readOnly
          />
          <FormSelect
            label="Currency"
            value={currency}
            onChange={(e) => handleCashCurrencyChange(e.target.value as Currency)}
          >
            <option value="USD">USD</option>
            <option value="KHR" disabled={!khrPerUsdRate}>
              KHR{!khrPerUsdRate ? " (rate unavailable)" : ""}
            </option>
          </FormSelect>
          <FormInput
            label="Amount Tendered"
            type="number"
            step={currency === "KHR" ? "1" : "0.01"}
            placeholder={currency === "KHR" ? "0" : "0.00"}
            value={amountTendered}
            onChange={(e) => setAmountTendered(e.target.value)}
            required
          />
          <FormInput
            label="Change Due"
            value={
              cashOrder && Number(amountTendered) >= cashDue
                ? formatByCurrency(Number(amountTendered) - cashDue, currency)
                : "-"
            }
            readOnly
          />
        </ModalGrid>
      </FormModal>
      {confirmDialog}
    </PageShell>
  );
}
