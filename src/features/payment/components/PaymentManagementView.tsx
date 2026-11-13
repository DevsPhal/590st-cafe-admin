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
  MoneyField,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useCollectCashMutation,
  useListAwaitingBakongConfirmationQuery,
  useListAwaitingDeliveryFeeQuery,
  useListAwaitingPickupQuery,
  useListDeliveryBoardQuery,
  useMarkDeliveredAdminOrderMutation,
  useSetOrderDeliveryFeeMutation,
} from "@/store/api/orderApi";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import {
  useCollectBaristaCashMutation,
  useListBaristaAwaitingBakongConfirmationQuery,
  useListBaristaAwaitingDeliveryFeeQuery,
  useListBaristaAwaitingPickupQuery,
  useListBaristaDeliveryBoardQuery,
  useMarkDeliveredBaristaOrderMutation,
  useSetBaristaOrderDeliveryFeeMutation,
} from "@/store/api/baristaOrderApi";
import type { Currency, OrderResponse } from "@/store/api/types";
import { formatByCurrency, titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import { buildCashPaymentSchema, deliveryFeeSchema } from "@/lib/validation";
import { amountDue, changeDue } from "@/lib/khr";
import { useDefaultPageSize, useRefreshOptions } from "@/contexts/AdminPreferencesContext";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/contexts/I18nContext";
import { useFormErrors } from "@/hooks/useFormErrors";
import { Button } from "@/components/common/Button";

const money = (value: number | null | undefined) =>
  value == null ? "-" : `$${Number(value).toFixed(2)}`;

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalDate(parsed, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const summarise = (order: OrderResponse) =>
  order.items.map((i) => `x${i.quantity} ${titleCase(i.productName)}`).join(", ") || "-";

export default function PaymentManagementView() {
  const { t } = useI18n();
  const [deliveryFeePage, setDeliveryFeePage] = usePersistentState("payments:deliveryFeePage", 1);
  const [pickupPage, setPickupPage] = usePersistentState("payments:pickupPage", 1);
  const [bakongPage, setBakongPage] = usePersistentState("payments:bakongPage", 1);
  const [deliveryBoardPage, setDeliveryBoardPage] = usePersistentState("payments:deliveryBoardPage", 1);
  const size = useDefaultPageSize();
  const refresh = useRefreshOptions();

  // Baristas handle payments too: same screen, served from the barista API.
  const { isAdmin, isBarista } = useCurrentRole();
  const asAdmin = { ...refresh, skip: !isAdmin };
  const asBarista = { ...refresh, skip: !isBarista };

  const adminDeliveryFee = useListAwaitingDeliveryFeeQuery({ page: deliveryFeePage, size }, asAdmin);
  const baristaDeliveryFee = useListBaristaAwaitingDeliveryFeeQuery({ page: deliveryFeePage, size }, asBarista);
  const deliveryFeeQuery = isBarista ? baristaDeliveryFee : adminDeliveryFee;
  const { data: deliveryFeeData, refetch: refetchDeliveryFee } = deliveryFeeQuery;
  const deliveryFeeList = listLoadState(deliveryFeeQuery);

  const adminPickup = useListAwaitingPickupQuery({ page: pickupPage, size }, asAdmin);
  const baristaPickup = useListBaristaAwaitingPickupQuery({ page: pickupPage, size }, asBarista);
  const pickupQuery = isBarista ? baristaPickup : adminPickup;
  const { data: pickupData, refetch: refetchPickup } = pickupQuery;
  const pickupList = listLoadState(pickupQuery);

  const adminBakong = useListAwaitingBakongConfirmationQuery({ page: bakongPage, size }, asAdmin);
  const baristaBakong = useListBaristaAwaitingBakongConfirmationQuery({ page: bakongPage, size }, asBarista);
  const bakongQuery = isBarista ? baristaBakong : adminBakong;
  const { data: bakongData, refetch: refetchBakong } = bakongQuery;
  const bakongList = listLoadState(bakongQuery);

  const adminDeliveryBoard = useListDeliveryBoardQuery({ page: deliveryBoardPage, size }, asAdmin);
  const baristaDeliveryBoard = useListBaristaDeliveryBoardQuery({ page: deliveryBoardPage, size }, asBarista);
  const deliveryBoardQuery = isBarista ? baristaDeliveryBoard : adminDeliveryBoard;
  const { data: deliveryBoardData, refetch: refetchDeliveryBoard } = deliveryBoardQuery;
  const deliveryBoardList = listLoadState(deliveryBoardQuery);

  useStaffOrderAlerts(
    useCallback(() => {
      void refetchDeliveryFee();
      void refetchPickup();
      void refetchBakong();
      void refetchDeliveryBoard();
    }, [refetchDeliveryFee, refetchPickup, refetchBakong, refetchDeliveryBoard])
  );

  const [adminCollectCash, adminCollectState] = useCollectCashMutation();
  const [baristaCollectCash, baristaCollectState] = useCollectBaristaCashMutation();
  const [adminSetFee, adminFeeState] = useSetOrderDeliveryFeeMutation();
  const [baristaSetFee, baristaFeeState] = useSetBaristaOrderDeliveryFeeMutation();
  const [adminMarkDelivered, adminDeliveredState] = useMarkDeliveredAdminOrderMutation();
  const [baristaMarkDelivered, baristaDeliveredState] = useMarkDeliveredBaristaOrderMutation();
  const collectCash = isBarista ? baristaCollectCash : adminCollectCash;
  const setDeliveryFee = isBarista ? baristaSetFee : adminSetFee;
  const markDelivered = isBarista ? baristaMarkDelivered : adminMarkDelivered;
  const isCollecting = adminCollectState.isLoading || baristaCollectState.isLoading;
  const isSettingFee = adminFeeState.isLoading || baristaFeeState.isLoading;
  const isMarkingDelivered = adminDeliveredState.isLoading || baristaDeliveredState.isLoading;
  const bakongDue = (order: OrderResponse) =>
    order.bakongAmount != null
      ? formatByCurrency(order.bakongAmount, order.bakongCurrency ?? "USD")
      : money(order.totalAmount);

  const [feeOrder, setFeeOrder] = useState<OrderResponse | null>(null);
  const [feeInput, setFeeInput] = useState("");
  const feeValidation = useFormErrors(deliveryFeeSchema, { fee: feeInput });

  const openFeeModal = (order: OrderResponse) => {
    setFeeOrder(order);
    setFeeInput("");
    feeValidation.reset();
  };

  const handleSetDeliveryFee = async () => {
    if (!feeOrder) return;
    const parsed = feeValidation.validate();
    if (!parsed) return;
    try {
      await setDeliveryFee({ id: feeOrder.id, body: parsed }).unwrap();
      toast.success(t("payments.toast.fee_set", "Delivery fee set — the customer can now choose how to pay."));
      setFeeOrder(null);
    } catch (err) {
      feeValidation.showServerError(err, t("payments.errors.fee", "Could not save the delivery fee."));
    }
  };

  const { khrPerUsdRate } = useExchangeRate();

  const [cashOrder, setCashOrder] = useState<OrderResponse | null>(null);
  const [amountTendered, setAmountTendered] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");

  // In riel the amount due is the total rounded to the nearest 100, the figure the API charges (lib/khr).
  const payableDue = (order: OrderResponse, targetCurrency: Currency): number =>
    amountDue(Number(order.totalAmount), targetCurrency, khrPerUsdRate);

  const exactAmountFor = (order: OrderResponse, targetCurrency: Currency): string => {
    const due = payableDue(order, targetCurrency);
    return targetCurrency === "KHR" ? String(due) : due.toFixed(2);
  };

  const openCashModal = (order: OrderResponse) => {
    setCashOrder(order);
    setCurrency("USD");
    setAmountTendered(exactAmountFor(order, "USD"));
    cashValidation.reset();
  };

  const handleCashCurrencyChange = (next: Currency) => {
    setCurrency(next);
    if (cashOrder) setAmountTendered(exactAmountFor(cashOrder, next));
  };

  const cashDue = cashOrder ? payableDue(cashOrder, currency) : 0;
  const cashValidation = useFormErrors(buildCashPaymentSchema(cashDue), { currency, amountTendered });

  const handleCollectCash = async () => {
    if (!cashOrder) return;
    const parsed = cashValidation.validate();
    if (!parsed) return;

    try {
      const updated = await collectCash({
        id: cashOrder.id,
        body: parsed,
      }).unwrap();
      toast.success(
        updated.changeDue && Number(updated.changeDue) > 0
          ? t("payments.toast.paid_change_due", "Paid. Change due: {amount}", { amount: formatByCurrency(updated.changeDue, updated.changeCurrency ?? currency) })
          : t("payments.toast.payment_collected", "Payment collected")
      );
      setCashOrder(null);
    } catch (err) {
      cashValidation.showServerError(err, t("payments.errors.cash", "Could not record the cash payment."));
    }
  };

  const handleMarkDelivered = async (order: OrderResponse) => {
    try {
      await markDelivered(order.id).unwrap();
      toast.success(t("payments.toast.delivered", "Order marked delivered"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("payments.errors.delivered", "Could not mark the order delivered.")));
    }
  };

  const walkIn = t("payments.common.walk_in", "Walk-in");
  const deliveryFeeHeaders = [
    t("table.no", "No"),
    t("payments.table.order_id", "Order ID"),
    t("fields.customer", "Customer"),
    t("payments.table.address", "Address"),
    t("payments.table.distance", "Distance"),
    t("payments.table.ordered_at", "Ordered At"),
    t("table.action", "Action"),
  ];
  const pickupHeaders = [
    t("table.no", "No"),
    t("payments.table.order_id", "Order ID"),
    t("fields.customer", "Customer"),
    t("payments.table.items", "Items"),
    t("payments.table.amount_due", "Amount Due"),
    t("fields.status", "Status"),
    t("payments.table.ordered_at", "Ordered At"),
    t("table.action", "Action"),
  ];
  const bakongHeaders = [
    t("table.no", "No"),
    t("payments.table.order_id", "Order ID"),
    t("fields.customer", "Customer"),
    t("payments.table.items", "Items"),
    t("fields.amount", "Amount"),
    t("payments.table.currency", "Currency"),
    t("payments.table.ordered_at", "Ordered At"),
    t("fields.status", "Status"),
  ];
  const deliveryBoardHeaders = [
    t("table.no", "No"),
    t("payments.table.order_id", "Order ID"),
    t("fields.customer", "Customer"),
    t("payments.table.address", "Address"),
    t("payments.table.payment", "Payment"),
    t("payments.table.dispatched_at", "Dispatched At"),
    t("table.action", "Action"),
  ];

  const deliveryFeeOrders = deliveryFeeData?.content ?? [];
  const pickupOrders = pickupData?.content ?? [];
  const bakongOrders = bakongData?.content ?? [];
  const now = useNow(15_000);
  const deliveryBoardOrders = deliveryBoardData?.content ?? [];

  const pickupTotal = pickupOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const bakongTotal = bakongOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const unpaidOnBoard = deliveryBoardOrders.filter(
    (o) => o.paymentMethod === "CASH" && o.paidAt == null
  ).length;

  return (
    <PageShell>
      <PageHeader
        title={t("payments.title", "Payments")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("payments.title", "Payments") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          title={t("payments.stats.awaiting_fee", "Awaiting Delivery Fee")}
          value={String(deliveryFeeData?.totalElements ?? 0)}
          hint={t("payments.stats.awaiting_fee_hint", "Customer pinned a location — quote a fee to unlock payment")}
          tone={(deliveryFeeData?.totalElements ?? 0) > 0 ? "orange" : "gray"}
        />
        <StatTile
          title={t("payments.stats.awaiting_cash", "Awaiting Cash Pickup")}
          value={String(pickupData?.totalElements ?? 0)}
          hint={t("payments.stats.awaiting_cash_hint", "Unpaid cash orders, including ones being prepared")}
          tone={(pickupData?.totalElements ?? 0) > 0 ? "orange" : "gray"}
        />
        <StatTile title={t("payments.stats.cash_due_page", "Cash Due (this page)")} value={money(pickupTotal)} tone="green" />
        <StatTile
          title={t("payments.stats.awaiting_qr", "Awaiting QR Payment")}
          value={String(bakongData?.totalElements ?? 0)}
          hint={t("payments.stats.awaiting_qr_hint", "Confirmed automatically once the customer pays")}
          tone={(bakongData?.totalElements ?? 0) > 0 ? "orange" : "gray"}
        />
        <StatTile title={t("payments.stats.qr_due_page", "QR Due (this page)")} value={money(bakongTotal)} tone="green" />
        <StatTile
          title={t("payments.stats.out_for_delivery", "Out for Delivery")}
          value={String(deliveryBoardData?.totalElements ?? 0)}
          hint={unpaidOnBoard > 0 ? t("payments.stats.owe_cash_hint", "{count} still owe cash on arrival", { count: unpaidOnBoard }) : t("payments.stats.all_paid_hint", "All out-for-delivery orders are paid")}
          tone={unpaidOnBoard > 0 ? "orange" : "gray"}
        />
      </div>

      <DataCard
        title={t("payments.stats.awaiting_fee", "Awaiting Delivery Fee")}
        meta={t("payments.cards.waiting_meta", "Waiting: {count}", { count: deliveryFeeData?.totalElements ?? 0 })}
      >
        <SimpleTable headers={deliveryFeeHeaders}>
          <TableState
            colSpan={deliveryFeeHeaders.length}
            isLoading={deliveryFeeList.isLoading}
            error={deliveryFeeList.error}
            isEmpty={deliveryFeeOrders.length === 0}
            emptyLabel={t("payments.empty.delivery_fee", "No delivery orders are waiting for a fee.")}
            onRetry={refetchDeliveryFee}
          />
          {deliveryFeeList.showRows &&
            deliveryFeeOrders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(deliveryFeePage - 1) * size + index + 1}</Cell>
                <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : walkIn}</Cell>
                <Cell className="max-w-[16rem] truncate">{order.deliveryAddress || "-"}</Cell>
                <Cell>
                  {order.distanceMeters != null ? formatDistance(Number(order.distanceMeters)) : "-"}
                </Cell>
                <Cell>{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <Button
                   
                    variant="accent" className="text-xs"
                    onClick={() => openFeeModal(order)}
                    disabled={isSettingFee}
                  >
                    {t("payments.actions.set_fee", "Set Fee")}
                  </Button>
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
        title={t("payments.cards.cash_on_pickup", "Cash on Pickup")}
        meta={t("payments.cards.waiting_meta", "Waiting: {count}", { count: pickupData?.totalElements ?? 0 })}
      >
        <SimpleTable headers={pickupHeaders}>
          <TableState
            colSpan={pickupHeaders.length}
            isLoading={pickupList.isLoading}
            error={pickupList.error}
            isEmpty={pickupOrders.length === 0}
            emptyLabel={t("payments.empty.pickup", "No unpaid cash orders.")}
            onRetry={refetchPickup}
          />
          {pickupList.showRows &&
            pickupOrders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(pickupPage - 1) * size + index + 1}</Cell>
                <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : walkIn}</Cell>
                <Cell className="max-w-[16rem] truncate">{summarise(order)}</Cell>
                <Cell className="font-semibold">{money(order.totalAmount)}</Cell>
                <Cell>
                  <StatusBadge
                    label={order.status === "PREPARING" ? "Preparing" : "Waiting"}
                    tone={order.status === "PREPARING" ? "info" : "warning"}
                  />
                </Cell>
                <Cell>{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <Button
                   
                    variant="accent" className="text-xs"
                    onClick={() => openCashModal(order)}
                    disabled={isCollecting}
                  >
                    {t("payments.actions.collect_cash", "Collect Cash")}
                  </Button>
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
        title={t("payments.cards.bakong", "Bakong QR Payments")}
        meta={t("payments.cards.bakong_meta", "Auto-confirming: {count}", { count: bakongData?.totalElements ?? 0 })}
      >
        <SimpleTable headers={bakongHeaders}>
          <TableState
            colSpan={bakongHeaders.length}
            isLoading={bakongList.isLoading}
            error={bakongList.error}
            isEmpty={bakongOrders.length === 0}
            emptyLabel={t("payments.empty.bakong", "No QR payments are pending.")}
            onRetry={refetchBakong}
          />
          {bakongList.showRows &&
            bakongOrders.map((order, index) => (
              <Row key={order.id} striped={index % 2 === 1}>
                <Cell>{(bakongPage - 1) * size + index + 1}</Cell>
                <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                <Cell>{order.customerName ? titleCase(order.customerName) : walkIn}</Cell>
                <Cell className="max-w-[16rem] truncate">{summarise(order)}</Cell>
                <Cell className="font-semibold">{bakongDue(order)}</Cell>
                <Cell>
                  <StatusBadge
                    label={order.bakongCurrency ?? "USD"}
                    tone="info"
                  />
                </Cell>
                <Cell>{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <QrPaymentStatus expiresAt={order.bakongExpiresAt} now={now} />
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
        title={t("payments.cards.delivery_board", "Delivery Board")}
        meta={t("payments.cards.delivery_board_meta", "Out with a courier: {count}", { count: deliveryBoardData?.totalElements ?? 0 })}
      >
        <SimpleTable headers={deliveryBoardHeaders}>
          <TableState
            colSpan={deliveryBoardHeaders.length}
            isLoading={deliveryBoardList.isLoading}
            error={deliveryBoardList.error}
            isEmpty={deliveryBoardOrders.length === 0}
            emptyLabel={t("payments.empty.delivery_board", "Nothing is out for delivery.")}
            onRetry={refetchDeliveryBoard}
          />
          {deliveryBoardList.showRows &&
            deliveryBoardOrders.map((order, index) => {
              const needsCash = order.paymentMethod === "CASH" && order.paidAt == null;
              return (
                <Row key={order.id} striped={index % 2 === 1}>
                  <Cell>{(deliveryBoardPage - 1) * size + index + 1}</Cell>
                  <Cell className="font-mono text-xs">#{order.id.slice(0, 8)}</Cell>
                  <Cell>{order.customerName ? titleCase(order.customerName) : walkIn}</Cell>
                  <Cell className="max-w-[16rem] truncate">{order.deliveryAddress || "-"}</Cell>
                  <Cell>
                    <StatusBadge
                      label={needsCash ? t("payments.badge.cash_due_on_arrival", "Cash due on arrival") : t("payments.badge.paid", "Paid")}
                      tone={needsCash ? "warning" : "success"}
                    />
                  </Cell>
                  <Cell>{formatDateTime(order.dispatchedAt)}</Cell>
                  <Cell>
                    <Button
                     
                      variant="accent" className="text-xs"
                      onClick={() => (needsCash ? openCashModal(order) : handleMarkDelivered(order))}
                      disabled={needsCash ? isCollecting : isMarkingDelivered}
                    >
                      {needsCash ? t("payments.actions.collect_cash", "Collect Cash") : t("payments.actions.mark_delivered", "Mark Delivered")}
                    </Button>
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
        title={t("payments.fee_modal.title", "Set Delivery Fee")}
        submitLabel={t("payments.fee_modal.submit", "Save Fee")}
        onSubmit={handleSetDeliveryFee}
        isLoading={isSettingFee}
      >
        <ModalGrid>
          <FormInput label={t("fields.customer", "Customer")} value={feeOrder?.customerName ? titleCase(feeOrder.customerName) : walkIn} readOnly />
          <FormInput label={t("payments.table.address", "Address")} value={feeOrder?.deliveryAddress ?? "-"} readOnly />
          <FormInput
            label={t("payments.table.distance", "Distance")}
            value={feeOrder?.distanceMeters != null ? formatDistance(Number(feeOrder.distanceMeters)) : t("payments.fee_modal.not_available", "Not available")}
            readOnly
          />
          <FormInput label={t("payments.fee_modal.items_subtotal", "Items Subtotal")} value={feeOrder ? money(feeOrder.totalAmount) : ""} readOnly />
          <MoneyField
            label={t("payments.fee_modal.delivery_fee", "Delivery Fee (USD)")}
            value={feeInput}
            error={feeValidation.errors.fee}
            onValueChange={setFeeInput}
            required
          />
          <FormInput
            label={t("payments.fee_modal.grand_total", "Customer's Grand Total")}
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
            {t("payments.fee_modal.view_on_map", "View pinned location on map")}
          </a>
        )}
      </FormModal>

      <FormModal
        open={cashOrder !== null}
        onOpenChange={(open) => {
          if (!open) setCashOrder(null);
        }}
        title={t("payments.actions.collect_cash", "Collect Cash")}
        submitLabel={t("payments.cash_modal.submit", "Confirm Payment")}
        onSubmit={handleCollectCash}
        isLoading={isCollecting}
      >
        <ModalGrid>
          <FormInput
            label={t("payments.cash_modal.total_due", "Total Due")}
            value={cashOrder ? formatByCurrency(cashDue, currency) : ""}
            readOnly
          />
          <FormSelect
            label={t("payments.table.currency", "Currency")}
            value={currency}
            onChange={(e) => handleCashCurrencyChange(e.target.value as Currency)}
          >
            <option value="USD">USD</option>
            <option value="KHR" disabled={!khrPerUsdRate}>
              KHR{!khrPerUsdRate ? t("payments.cash_modal.rate_unavailable", " (rate unavailable)") : ""}
            </option>
          </FormSelect>
          <MoneyField
            label={t("payments.cash_modal.amount_tendered", "Amount Tendered")}
            currency={currency}
            value={amountTendered}
            error={cashValidation.errors.amountTendered}
            onValueChange={setAmountTendered}
            required
          />
          <FormInput
            label={t("payments.cash_modal.change_due", "Change Due")}
            value={
              cashOrder && Number(amountTendered) >= cashDue
                ? formatByCurrency(changeDue(Number(amountTendered), cashDue, currency), currency)
                : "-"
            }
            readOnly
          />
        </ModalGrid>
      </FormModal>
    </PageShell>
  );
}

// Customers get one QR payment window; once it closes the order is cancelled after a final check with Bakong.
function QrPaymentStatus({ expiresAt, now }: { expiresAt?: string | null; now: number }) {
  const { t } = useI18n();
  const deadline = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  if (Number.isNaN(deadline)) {
    return <StatusBadge label={t("payments.qr.waiting", "Waiting for QR payment")} tone="warning" />;
  }
  const minutesLeft = Math.ceil((deadline - now) / 60_000);
  return minutesLeft > 0 ? (
    <StatusBadge label={t("payments.qr.minutes_left", "Waiting · {minutes} min left", { minutes: minutesLeft })} tone="warning" />
  ) : (
    <StatusBadge label={t("payments.qr.times_up", "Time's up · final check")} tone="neutral" />
  );
}
