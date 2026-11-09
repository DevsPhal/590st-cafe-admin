"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { BellRing, Copy, Download, Loader2, Minus, Pencil, Plus, Printer, QrCode, Trash2, Users, X } from "lucide-react";

import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  DataCard,
  ErrorState,
  FormInput,
  FormModal,
  FormSelect,
  SkeletonBlock,
} from "@/components/common/AdminKit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/contexts/I18nContext";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { orderCode, useOrderInvoice } from "@/hooks/useOrderInvoice";
import { useRealtimeTopic } from "@/hooks/useRealtimeTopic";
import { useStaffCallAlerts } from "@/hooks/useStaffCallAlerts";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useCreateTableMutation,
  useGetMenuLinkQuery,
  useDeleteTableMutation,
  useListTableOrdersQuery,
  useListBaristaTablesQuery,
  useListTablesQuery,
  useUpdateBaristaTableStatusMutation,
  useUpdateTableMutation,
  useUpdateTableStatusMutation,
} from "@/store/api/tableApi";
import type { OrderResponse, OrderStatus, TableActivityResponse, TableResponse, TableSize, TableStatus } from "@/store/api/types";
import { cn, timeAgo, titleCase } from "@/lib/utils";
import { staffCallReasonLabel } from "@/lib/staffCall";
import { enumLabel } from "@/lib/enumLabel";
import { tableSchema } from "@/lib/formSchemas";
import { useFormErrors } from "@/hooks/useFormErrors";

const STATUS_LABEL: Record<TableStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
};

const SIZE_LABEL: Record<TableSize, string> = {
  SMALL: "Small (2 seats)",
  MEDIUM: "Medium (4 seats)",
  LARGE: "Large (6 seats)",
};

// Dine-in orders move Ordered → Paid → Preparing → Completed.
const ORDER_STEPS: { label: string; reached: (status: OrderStatus) => boolean }[] = [
  { label: "Ordered", reached: () => true },
  { label: "Paid", reached: (s) => s !== "PENDING" },
  { label: "Preparing", reached: (s) => s === "PREPARING" || s === "COMPLETED" || s === "DELIVERED" },
  { label: "Completed", reached: (s) => s === "COMPLETED" || s === "DELIVERED" },
];

const money = (value: number | string | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

type TableForm = { tableNumber: string; size: TableSize; capacity: string };
const EMPTY_FORM: TableForm = { tableNumber: "", size: "SMALL", capacity: "" };

export default function TableManagementView() {
  const { t } = useI18n();
  const { isAdmin, isBarista } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  // Admins use the admin table API; baristas get the same floor (plus open orders and staff calls) from theirs.
  const adminTables = useListTablesQuery({ page: 1, size: 500 }, { skip: !isAdmin });
  const baristaTables = useListBaristaTablesQuery(undefined, { skip: !isBarista });
  const { isLoading, isFetching, error, refetch } = isBarista ? baristaTables : adminTables;
  const tables = useMemo(
    () => (isBarista ? (baristaTables.data ?? []).map((activity) => activity.table) : adminTables.data?.content ?? []),
    [isBarista, baristaTables.data, adminTables.data]
  );
  const activityById = useMemo(
    () => new Map((baristaTables.data ?? []).map((activity) => [activity.table.id, activity])),
    [baristaTables.data]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tables.find((table) => table.id === selectedId) ?? null;
  const [sheetOpen, setSheetOpen] = useState(false);
  // Matches the .table_layout breakpoint: at this width the details panel sits beside the floor.
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TableResponse | null>(null);
  const [form, setForm] = useState<TableForm>(EMPTY_FORM);
  const validation = useFormErrors(tableSchema, form);
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);
  const { data: menuLink } = useGetMenuLinkQuery(undefined, { skip: !isAdmin });

  const showMenuQr = () => {
    if (!menuLink) return;
    setQrTarget({
      title: t("tables.qr.menu", "Menu QR"),
      heading: "Scan to order",
      caption: "One QR for the whole shop. Customers open the menu and type their table number at checkout.",
      url: menuLink.url,
      fileName: "590st-menu-qr.png",
    });
  };

  const showTableQr = (table: TableResponse) =>
    setQrTarget({
      title: t("tables.qr.table_title", "Table {number} QR", { number: table.tableNumber }),
      heading: `Table ${table.tableNumber}`,
      caption: "Scan to see the menu and order — the table number is filled in for you.",
      url: table.scanUrl,
      fileName: `table-${table.tableNumber}-qr.png`,
    });

  const [createTable, { isLoading: isCreating }] = useCreateTableMutation();
  const [updateTable, { isLoading: isUpdating }] = useUpdateTableMutation();
  const [deleteTable] = useDeleteTableMutation();

  const refreshFloor = useCallback(() => { void refetch(); }, [refetch]);
  useRealtimeTopic("/topic/tables", refreshFloor);
  // Baristas also see open orders and staff calls on the floor, so refresh when either changes.
  useStaffCallAlerts(useCallback(() => { if (isBarista) refreshFloor(); }, [isBarista, refreshFloor]));
  useStaffOrderAlerts(useCallback(() => { if (isBarista) refreshFloor(); }, [isBarista, refreshFloor]));

  const counts = useMemo(() => {
    const result: Record<TableStatus, number> = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0 };
    for (const table of tables) result[table.status] += 1;
    return result;
  }, [tables]);

  const selectTable = (table: TableResponse) => {
    setSelectedId(table.id);
    setSheetOpen(true);
  };

  const openForm = (table?: TableResponse) => {
    setEditing(table ?? null);
    setForm(table ? { tableNumber: table.tableNumber, size: table.size, capacity: String(table.capacity) } : EMPTY_FORM);
    validation.reset();
    setFormOpen(true);
  };

  const saveTable = async () => {
    const parsed = validation.validate();
    if (!parsed) return;
    const { tableNumber, capacity } = parsed;
    try {
      if (editing) {
        await updateTable({ id: editing.id, body: { tableNumber, size: form.size, capacity } }).unwrap();
        toast.success(t("tables.toast.updated", "Table {number} updated", { number: tableNumber }));
      } else {
        const created = await createTable({ tableNumber, size: form.size, capacity }).unwrap();
        setSelectedId(created.id);
        toast.success(t("tables.toast.added", "Table {number} added", { number: created.tableNumber }));
      }
      setFormOpen(false);
    } catch (err) {
      validation.showServerError(err, t("tables.toast.save_error", "Could not save the table."));
    }
  };

  const removeTable = async (table: TableResponse) => {
    const ok = await confirm({
      title: t("tables.confirm.delete_title", "Delete table"),
      description: t("tables.confirm.delete_description", "Delete table {number}? Its printed QR code will stop working.", {
        number: table.tableNumber,
      }),
      confirmLabel: t("actions.delete", "Delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTable(table.id).unwrap();
      setSelectedId(null);
      setSheetOpen(false);
      toast.success(t("tables.toast.deleted", "Table {number} deleted", { number: table.tableNumber }));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("tables.toast.delete_error", "Could not delete the table.")));
    }
  };

  const detail = selected ? (
    <TableDetail
      table={selected}
      activity={activityById.get(selected.id)}
      onActivityChange={refetch}
      isAdmin={isAdmin}
      isBarista={isBarista}
      onShowQr={() => showTableQr(selected)}
      onEdit={() => openForm(selected)}
      onDelete={() => removeTable(selected)}
    />
  ) : (
    <div className="table_detail_empty">
      <QrCode className="h-8 w-8" />
      <p>{t("tables.detail.empty", "Tap a table to see who's seated and what they ordered.")}</p>
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title={t("tables.title", "Tables")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("tables.breadcrumb.operations", "Operations") },
          { label: t("tables.title", "Tables") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="table_layout">
        <DataCard
          title={t("tables.card.title", "QR Table Management")}
          meta={
            isAdmin
              ? t(
                  "tables.card.meta_admin",
                  "Customers scan the menu QR (or a table QR) and enter their table number at checkout. Tables turn occupied when they order."
                )
              : t("tables.card.meta_barista", "Tap a table to see its orders. Clear it once the guests have left.")
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <button type="button" className="btn_outline_black" onClick={showMenuQr} disabled={!menuLink}>
                  <QrCode />
                  {t("tables.qr.menu", "Menu QR")}
                </button>
              ) : null}
              {isAdmin ? (
                <button type="button" className="btn_primary_black" onClick={() => openForm()}>
                  <Plus />
                  {t("tables.actions.add_table", "Add table")}
                </button>
              ) : null}
            </div>
          }
        >
          <div className="table_legend" aria-label={t("tables.floor.status_counts", "Table status counts")}>
            {(Object.keys(STATUS_LABEL) as TableStatus[]).map((status) => (
              <span key={status} className="table_legend_item">
                <span className={cn("table_legend_dot", `is_${status.toLowerCase()}`)} />
                {STATUS_LABEL[status]}
                <b>{counts[status]}</b>
              </span>
            ))}
          </div>

          {isLoading ? (
            <div className="table_grid" role="status" aria-label={t("tables.floor.loading", "Loading tables")}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <ErrorState
                error={error}
                fallback={t("tables.floor.load_error", "Could not load tables.")}
                onRetry={refetch}
                isRetrying={isFetching}
              />
            </div>
          ) : tables.length === 0 ? (
            <div className="table_detail_empty">
              <QrCode className="h-8 w-8" />
              <p>
                {isAdmin
                  ? t("tables.floor.empty_admin", "No tables yet. Use Add table, then print each table's QR code.")
                  : t("tables.floor.empty_barista", "No tables have been set up yet.")}
              </p>
            </div>
          ) : (
            <div className="table_grid">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => selectTable(table)}
                  aria-pressed={table.id === selectedId}
                  aria-label={t("tables.floor.tile_label", "Table {number}, {status}", {
                    number: table.tableNumber,
                    status: STATUS_LABEL[table.status],
                  })}
                  className={cn("table_tile", `is_${table.status.toLowerCase()}`, table.id === selectedId && "is_selected")}
                >
                  <span className="table_tile_number">{table.tableNumber}</span>
                  {(activityById.get(table.id)?.openStaffCallCount ?? 0) > 0 ? (
                    <span className="table_tile_call" aria-label={t("tables.floor.calling_staff", "Customer is calling staff")}>
                      <BellRing />
                    </span>
                  ) : null}
                  <span className="table_tile_meta">
                    <Users />
                    {table.status === "OCCUPIED" ? `${table.guestCount}/${table.capacity}` : table.capacity}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DataCard>

        {/* iPad landscape and up: details sit beside the floor. Phones and iPad portrait use a bottom sheet. */}
        <aside className="table_detail_aside">{detail}</aside>
      </div>

      <Sheet open={!isWide && sheetOpen && selected !== null} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="table_detail_sheet [&>button:last-child]:hidden">
          <SheetTitle className="sr-only">
            {selected
              ? t("tables.detail.sheet_title", "Table {number}", { number: selected.tableNumber })
              : t("tables.detail.sheet_title_empty", "Table")}
          </SheetTitle>
          <button type="button" className="table_sheet_close" onClick={() => setSheetOpen(false)} aria-label={t("actions.close", "Close")}>
            <X />
          </button>
          {detail}
        </SheetContent>
      </Sheet>

      <FormModal
        open={isAdmin && formOpen}
        onOpenChange={setFormOpen}
        title={
          editing
            ? t("tables.form.edit_title", "Edit table {number}", { number: editing.tableNumber })
            : t("tables.actions.add_table", "Add table")
        }
        submitLabel={t("tables.form.submit", "Save table")}
        onSubmit={saveTable}
        isLoading={isCreating || isUpdating}
      >
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <FormInput
            label={t("tables.form.table_number", "Table number")}
            required
            placeholder={t("tables.form.table_number_placeholder", "e.g. 01")}
            maxLength={20}
            value={form.tableNumber}
            error={validation.errors.tableNumber}
            onChange={(e) => setForm({ ...form, tableNumber: e.target.value.toUpperCase() })}
          />
          <FormSelect
            label={t("tables.form.size", "Size")}
            value={form.size}
            error={validation.errors.size}
            onChange={(e) => setForm({ ...form, size: e.target.value as TableSize })}
          >
            {(Object.keys(SIZE_LABEL) as TableSize[]).map((size) => (
              <option key={size} value={size}>{SIZE_LABEL[size]}</option>
            ))}
          </FormSelect>
          <FormInput
            label={t("tables.form.seats", "Seats (optional)")}
            inputMode="numeric"
            placeholder={t("tables.form.seats_placeholder", "Uses the size default")}
            value={form.capacity}
            error={validation.errors.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/\D/g, "") })}
          />
        </div>
      </FormModal>

      <QrDialog target={qrTarget} onClose={() => setQrTarget(null)} />
      {confirmDialog}
    </PageShell>
  );
}

function TableDetail({
  table,
  activity,
  onActivityChange,
  isAdmin,
  isBarista,
  onShowQr,
  onEdit,
  onDelete,
}: {
  table: TableResponse;
  activity?: TableActivityResponse;
  onActivityChange: () => void;
  isAdmin: boolean;
  isBarista: boolean;
  onShowQr: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  // Baristas already have this table's orders from the floor request; admins fetch them per table.
  const adminOrders = useListTableOrdersQuery(table.id, { skip: isBarista });
  const orders = isBarista ? activity?.activeOrders : adminOrders.data;
  const isLoading = isBarista ? !activity : adminOrders.isLoading;
  const error = isBarista ? undefined : adminOrders.error;
  const isFetching = adminOrders.isFetching;
  const refetch = isBarista ? onActivityChange : adminOrders.refetch;
  const [updateAdminStatus, { isLoading: isSavingAdmin }] = useUpdateTableStatusMutation();
  const [updateBaristaStatus, { isLoading: isSavingBarista }] = useUpdateBaristaTableStatusMutation();
  const updateStatus = isBarista ? updateBaristaStatus : updateAdminStatus;
  const isSaving = isSavingAdmin || isSavingBarista;
  const openCalls = activity?.openStaffCalls ?? [];
  const { printInvoice, isBusy } = useOrderInvoice();
  const guests = Math.max(table.guestCount, 1);

  useStaffOrderAlerts(
    useCallback(
      (message) => {
        if (message.order.tableNumber === table.tableNumber) void refetch();
      },
      [refetch, table.tableNumber]
    )
  );

  const activeOrders = orders ?? [];
  const tableTotal = activeOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

  const setStatus = async (status: TableStatus, guestCount = guests) => {
    try {
      await updateStatus({ id: table.id, body: { status, guestCount: status === "OCCUPIED" ? guestCount : 0 } }).unwrap();
      if (status !== table.status) {
        toast.success(
          t("tables.toast.status_changed", "Table {number} is {status}", {
            number: table.tableNumber,
            status: STATUS_LABEL[status].toLowerCase(),
          })
        );
      }
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("tables.toast.update_error", "Could not update the table.")));
    }
  };

  const changeGuests = (delta: number) => {
    const next = Math.min(Math.max(guests + delta, 1), table.capacity);
    if (next !== table.guestCount) void setStatus("OCCUPIED", next);
  };

  return (
    <div className="table_detail">
      <div className="table_detail_header">
        <h2>{t("tables.detail.heading", "Table #{number}", { number: table.tableNumber })}</h2>
        <span className="table_status_pill">
          <span className={cn("table_legend_dot", `is_${table.status.toLowerCase()}`)} />
          {STATUS_LABEL[table.status]}
        </span>
      </div>
      <p className="table_detail_sub">
        {enumLabel(t, "table_size", table.size)} · {t("tables.detail.seats", "seats {count}", { count: table.capacity })}
      </p>

      <div className="table_detail_section">
        <span className="table_detail_label">{t("tables.detail.table_status", "Table status")}</span>
        <div className="table_status_switch" role="group" aria-label={t("tables.detail.table_status", "Table status")}>
          {(Object.keys(STATUS_LABEL) as TableStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              disabled={isSaving}
              className={cn(table.status === status && "is_selected")}
              onClick={() => table.status !== status && setStatus(status)}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
        {table.status === "OCCUPIED" ? (
          <div className="table_guest_row">
            <span>{t("tables.detail.guests", "Guests")}</span>
            <div className="table_guest_stepper">
              <button
                type="button"
                onClick={() => changeGuests(-1)}
                disabled={isSaving || guests <= 1}
                aria-label={t("tables.detail.fewer_guests", "Fewer guests")}
              >
                <Minus />
              </button>
              <b>{guests}</b>
              <button
                type="button"
                onClick={() => changeGuests(1)}
                disabled={isSaving || guests >= table.capacity}
                aria-label={t("tables.detail.more_guests", "More guests")}
              >
                <Plus />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {openCalls.length > 0 ? (
        <div className="table_detail_section">
          <span className="table_detail_label">{t("tables.detail.calling_staff", "Calling staff")}</span>
          <ul className="table_call_list">
            {openCalls.map((call) => (
              <li key={`${call.orderId}-${call.calledAt}`}>
                <BellRing aria-hidden />
                <span>
                  <b>{staffCallReasonLabel(call.reason)}</b>
                  {call.note ? ` · ${call.note}` : ""}
                </span>
                <small>{timeAgo(call.calledAt)}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="table_detail_section">
        <span className="table_detail_label">{t("tables.detail.customer_orders", "Customer orders")}</span>
        {isLoading ? (
          <SkeletonBlock className="h-24 w-full rounded-xl" />
        ) : error ? (
          <ErrorState
            error={error}
            fallback={t("tables.detail.orders_error", "Could not load this table's orders.")}
            onRetry={refetch}
            isRetrying={isFetching}
          />
        ) : activeOrders.length === 0 ? (
          <p className="table_detail_hint">{t("tables.detail.no_orders", "No open orders at this table.")}</p>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <TableOrderCard
                key={order.id}
                order={order}
                onPrint={() => printInvoice(order.id)}
                isPrinting={isBusy(order.id, "print")}
              />
            ))}
            {activeOrders.length > 1 ? (
              <div className="table_total_row">
                <span>{t("tables.detail.table_total", "Table total")}</span>
                <b>{money(tableTotal)}</b>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {table.status === "OCCUPIED" && activeOrders.length === 0 && !isLoading ? (
        <button type="button" className="btn_outline_black w-full justify-center" disabled={isSaving} onClick={() => setStatus("AVAILABLE")}>
          {t("tables.actions.clear_table", "Clear table")}
        </button>
      ) : null}

      <div className="table_detail_actions">
        <button type="button" className="btn_outline_black" onClick={onShowQr}>
          <QrCode />
          {t("tables.qr.table", "Table QR")}
        </button>
        {isAdmin ? (
          <>
            <button type="button" className="btn_outline_black" onClick={onEdit}>
              <Pencil />
              {t("actions.edit", "Edit")}
            </button>
            <button
              type="button"
              className="btn_outline_black text-red-600"
              onClick={onDelete}
              disabled={table.status === "OCCUPIED"}
              title={table.status === "OCCUPIED" ? t("tables.detail.delete_disabled", "Clear the table before deleting it") : undefined}
            >
              <Trash2 />
              {t("actions.delete", "Delete")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function TableOrderCard({ order, onPrint, isPrinting }: { order: OrderResponse; onPrint: () => void; isPrinting: boolean }) {
  const { t } = useI18n();
  const stepLabels: Record<string, string> = {
    Ordered: t("tables.order.steps.ordered", "Ordered"),
    Paid: t("tables.order.steps.paid", "Paid"),
    Preparing: t("tables.order.steps.preparing", "Preparing"),
    Completed: t("tables.order.steps.completed", "Completed"),
  };
  return (
    <div className="table_order_card">
      <div className="table_order_head">
        <b>#{orderCode(order.id)}</b>
        <span>{order.customerName ? titleCase(order.customerName) : t("tables.order.walk_in", "Walk-in")}</span>
      </div>
      <ul className="table_order_items">
        {order.items.map((item) => (
          <li key={item.id}>
            <span>
              {item.quantity}x {titleCase(item.productName)}
              {item.variantName ? <small> · {enumLabel(t, "variant", item.variantName)}</small> : null}
            </span>
            <b>{money(item.subtotal)}</b>
          </li>
        ))}
      </ul>
      <div className="table_total_row">
        <span>{t("fields.total", "Total")}</span>
        <b>{money(order.totalAmount)}</b>
      </div>
      <ol className="table_order_steps" aria-label={t("tables.order.progress", "Order progress")}>
        {ORDER_STEPS.map((step) => (
          <li key={step.label} className={cn(step.reached(order.status) && "is_reached")}>
            {stepLabels[step.label] ?? step.label}
          </li>
        ))}
      </ol>
      {order.paidAt ? (
        <button type="button" className="btn_primary_black w-full justify-center" onClick={onPrint} disabled={isPrinting}>
          {isPrinting ? <Loader2 className="animate-spin" /> : <Printer />}
          {isPrinting ? t("states.preparing", "Preparing...") : t("tables.order.print_bill", "Print Bill")}
        </button>
      ) : (
        <p className="table_detail_hint">{t("tables.order.not_paid", "Not paid yet — the bill can be printed once it's paid.")}</p>
      )}
    </div>
  );
}

type QrTarget = { title: string; heading: string; caption: string; url: string; fileName: string };

function QrDialog({ target, onClose }: { target: QrTarget | null; onClose: () => void }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);

  useEffect(() => {
    if (!target) return;
    let active = true;
    QRCode.toDataURL(target.url, { errorCorrectionLevel: "M", margin: 2, width: 640 })
      .then((dataUrl) => { if (active) setQr({ url: target.url, dataUrl }); })
      .catch(() => toast.error(t("tables.toast.qr_draw_error", "Could not draw the QR code.")));
    return () => { active = false; };
  }, [target, t]);

  const dataUrl = target && qr?.url === target.url ? qr.dataUrl : null;

  const printQr = () => {
    if (!target || !dataUrl) return;
    const win = window.open("", "_blank", "width=480,height=640");
    if (!win) {
      toast.error(t("tables.toast.popup_blocked", "Allow pop-ups to print the QR code."));
      return;
    }
    const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
    win.document.write(`<!doctype html><title>${escape(target.heading)}</title>
      <body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center">
      <h1 style="margin:0 0 8px">${escape(target.heading)}</h1>
      <p style="margin:0 0 16px;color:#555">${escape(target.caption)}</p>
      <img src="${dataUrl}" style="width:320px;height:320px" onload="window.print()" />
      </body>`);
    win.document.close();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="admin_modal sm:max-w-[420px]">
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">{target?.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 p-4 text-center">
          <p className="text-sm text-gray-600">{target?.caption}</p>
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={target?.title} className="h-60 w-60 rounded-xl border" />
          ) : (
            <SkeletonBlock className="h-60 w-60 rounded-xl" />
          )}
          <p className="break-all text-xs text-gray-500">{target?.url}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn_primary_black" onClick={printQr} disabled={!dataUrl}>
              <Printer />
              {t("actions.print", "Print")}
            </button>
            {dataUrl ? (
              <a className="btn_outline_black" href={dataUrl} download={target?.fileName}>
                <Download />
                {t("actions.download", "Download")}
              </a>
            ) : null}
            {target ? (
              <button
                type="button"
                className="btn_outline_black"
                onClick={() => {
                  void navigator.clipboard?.writeText(target.url).then(
                    () => toast.success(t("tables.toast.link_copied", "Link copied")),
                    () => toast.error(t("tables.toast.copy_error", "Could not copy the link."))
                  );
                }}
              >
                <Copy />
                {t("tables.qr.copy_link", "Copy link")}
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
