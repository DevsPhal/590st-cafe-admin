"use client";

import { ClipboardList, Clock3, History, ReceiptText } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  DetailGrid,
  DetailItem,
  DetailModal,
  ErrorState,
  PaginationFooter,
  Row,
  SimpleTable,
  SkeletonBlock,
  StatusBadge,
  TableState,
  listLoadState,
} from "@/components/common/AdminKit";
import {
  useGetOrderHistoryQuery,
  useListOrdersQuery,
} from "@/store/api/orderApi";
import {
  useGetAttendanceHistoryQuery,
  useListAttendanceQuery,
  type AttendanceResponse,
} from "@/store/api/attendanceApi";
import {
  usePageSize,
  useRefreshOptions,
} from "@/contexts/AdminPreferencesContext";
import type { OrderResponse, OrderStatus, Role } from "@/store/api/types";
import { cn, humanise, timeAgo, titleCase } from "@/lib/utils";
import { usePersistentState } from "@/hooks/usePersistentState";

type Source = "orders" | "attendance";
type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const SOURCES: { value: Source; label: string; icon: typeof ReceiptText }[] = [
  { value: "orders", label: "Orders", icon: ReceiptText },
  { value: "attendance", label: "Attendance", icon: Clock3 },
];

const ORDER_HEADERS = [
  "No",
  "Order",
  "Customer",
  "Total",
  "Payment",
  "Placed",
  "Status",
  "History",
];
const ATTENDANCE_HEADERS = [
  "No",
  "Barista",
  "Check In",
  "Check Out",
  "Worked",
  "Status",
  "History",
];

/** What each recorded order step means, in the words a manager would use. */
const ORDER_ACTIONS: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: "Order placed", tone: "neutral" },
  CASH_SELECTED: { label: "Chose to pay cash", tone: "neutral" },
  BAKONG_QR_GENERATED: { label: "Bakong QR generated", tone: "neutral" },
  DELIVERY_FEE_SET: { label: "Delivery fee set", tone: "info" },
  CASH_COLLECTED: { label: "Cash collected", tone: "success" },
  BAKONG_CONFIRMED: { label: "Bakong payment confirmed", tone: "success" },
  PREPARING: { label: "Started preparing", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Sent out for delivery", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

const TONE_DOT: Record<Tone, string> = {
  success: "bg-green-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  neutral: "bg-gray-400",
};

const money = (value: number | null | undefined) =>
  value == null ? "-" : `$${Number(value).toFixed(2)}`;

function formatDateTime(value: string | null | undefined) {
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

function formatWorked(minutes: number | null) {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function orderTone(status: OrderStatus): Tone {
  if (status === "COMPLETED" || status === "DELIVERED") return "success";
  if (
    status === "PAID" ||
    status === "PREPARING" ||
    status === "OUT_FOR_DELIVERY"
  )
    return "info";
  if (status === "PENDING") return "warning";
  return "danger";
}

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

//doing purposeful null checks on the data to avoid errors when the data is not available yet. The data is fetched from the API and may not be available immediately. The null checks ensure that the component does not crash when the data is not available yet.
export default function AuditManagementView() {
  const polling = useRefreshOptions();
  const [source, setSource] = usePersistentState<Source>(
    "audit:source",
    "orders",
  );
  const [page, setPage] = usePersistentState("audit:page", 1);
  const [size, setSize] = usePageSize();
  const [selectedOrder, setSelectedOrder] =
    usePersistentState<OrderResponse | null>("audit:selectedOrder", null);
  const [selectedShift, setSelectedShift] =
    usePersistentState<AttendanceResponse | null>("audit:selectedShift", null);

  const orders = useListOrdersQuery(
    { page, size },
    { ...polling, skip: source !== "orders" },
  );
  const attendance = useListAttendanceQuery(
    { page, size },
    { ...polling, skip: source !== "attendance" },
  );
  const records = source === "orders" ? orders : attendance;
  const list = listLoadState(records);
  const headers = source === "orders" ? ORDER_HEADERS : ATTENDANCE_HEADERS;
  const rowNumber = (index: number) => (page - 1) * size + index + 1;

  const chooseSource = (next: Source) => {
    setSource(next);
    setPage(1);
  };

  return (
    <PageShell>
      <PageHeader
        title="Audit Trail"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Audit Trail" }]}
        rightSlot={<AdminTopActions />}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Every step taken on an order or a shift, with who did it and when.
        </p>
        <div
          role="tablist"
          aria-label="History source"
          className="inline-flex gap-1 rounded-lg bg-gray-100 p-1"
        >
          {SOURCES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={source === value}
              onClick={() => chooseSource(value)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors",
                source === value
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-500 hover:text-gray-800",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <DataCard
        title={source === "orders" ? "Orders" : "Attendance"}
        meta={
          records.currentData
            ? `${records.currentData.totalElements} records`
            : undefined
        }
      >
        <SimpleTable headers={headers}>
          <TableState
            colSpan={headers.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={list.showRows && !records.currentData?.content.length}
            emptyLabel={
              source === "orders" ? "No orders yet." : "No shifts recorded yet."
            }
            onRetry={records.refetch}
          />
          {list.showRows && source === "orders"
            ? orders.currentData?.content.map((order, index) => (
                <Row key={order.id}>
                  <Cell>{rowNumber(index)}</Cell>
                  <Cell>
                    <span className="font-mono text-xs">
                      #{shortId(order.id)}
                    </span>
                  </Cell>
                  <Cell>
                    {order.customerName
                      ? titleCase(order.customerName)
                      : "Walk-in"}
                  </Cell>
                  <Cell>{money(order.totalAmount)}</Cell>
                  <Cell>
                    {order.paymentMethod ? humanise(order.paymentMethod) : "-"}
                  </Cell>
                  <Cell>
                    <span className="block">
                      {formatDateTime(order.createdAt)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {timeAgo(order.createdAt)}
                    </span>
                  </Cell>
                  <Cell>
                    <StatusBadge
                      label={humanise(order.status)}
                      tone={orderTone(order.status)}
                    />
                  </Cell>
                  <Cell>
                    <ViewHistoryButton
                      onClick={() => setSelectedOrder(order)}
                    />
                  </Cell>
                </Row>
              ))
            : null}
          {list.showRows && source === "attendance"
            ? attendance.currentData?.content.map((shift, index) => (
                <Row key={shift.id}>
                  <Cell>{rowNumber(index)}</Cell>
                  <Cell>{titleCase(shift.baristaName)}</Cell>
                  <Cell>{formatDateTime(shift.checkInAt)}</Cell>
                  <Cell>
                    {shift.checkOutAt ? formatDateTime(shift.checkOutAt) : "-"}
                  </Cell>
                  <Cell>{formatWorked(shift.workedMinutes)}</Cell>
                  <Cell>
                    <StatusBadge
                      label={shift.open ? "On shift" : "Closed"}
                      tone={shift.open ? "info" : "neutral"}
                    />
                  </Cell>
                  <Cell>
                    <ViewHistoryButton
                      onClick={() => setSelectedShift(shift)}
                    />
                  </Cell>
                </Row>
              ))
            : null}
        </SimpleTable>
        <PaginationFooter
          page={page}
          size={size}
          totalElements={records.currentData?.totalElements}
          totalPages={records.currentData?.totalPages ?? 0}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </DataCard>

      <OrderHistoryModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
      <ShiftHistoryModal
        shift={selectedShift}
        onClose={() => setSelectedShift(null)}
      />
    </PageShell>
  );
}

function ViewHistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn_outline_black" onClick={onClick}>
      <History />
      View
    </button>
  );
}

function OrderHistoryModal({
  order,
  onClose,
}: {
  order: OrderResponse | null;
  onClose: () => void;
}) {
  const history = useGetOrderHistoryQuery(order?.id ?? "", { skip: !order });

  return (
    <DetailModal
      open={order !== null}
      onOpenChange={(open) => !open && onClose()}
      title={order ? `Order #${shortId(order.id)}` : "Order history"}
    >
      {order && (
        <div className="admin_modal_form_wrap">
          <DetailGrid>
            <DetailItem label="Customer">
              {order.customerName ? titleCase(order.customerName) : "Walk-in"}
            </DetailItem>
            <DetailItem label="Status">
              <StatusBadge
                label={humanise(order.status)}
                tone={orderTone(order.status)}
              />
            </DetailItem>
            <DetailItem label="Total">{money(order.totalAmount)}</DetailItem>
            <DetailItem label="Placed">
              {formatDateTime(order.createdAt)}
            </DetailItem>
          </DetailGrid>
          <Timeline
            query={history}
            entries={history.currentData?.map((entry) => ({
              id: entry.id,
              createdAt: entry.createdAt,
              actorName: entry.actorName,
              actorRole: entry.actorRole,
              note: null,
              ...(ORDER_ACTIONS[entry.action] ?? {
                label: humanise(entry.action),
                tone: "neutral" as Tone,
              }),
            }))}
          />
        </div>
      )}
    </DetailModal>
  );
}

function ShiftHistoryModal({
  shift,
  onClose,
}: {
  shift: AttendanceResponse | null;
  onClose: () => void;
}) {
  const history = useGetAttendanceHistoryQuery(shift?.id ?? "", {
    skip: !shift,
  });

  return (
    <DetailModal
      open={shift !== null}
      onOpenChange={(open) => !open && onClose()}
      title={
        shift ? `${titleCase(shift.baristaName)}'s shift` : "Shift history"
      }
    >
      {shift && (
        <div className="admin_modal_form_wrap">
          <DetailGrid>
            <DetailItem label="Check In">
              {formatDateTime(shift.checkInAt)}
            </DetailItem>
            <DetailItem label="Check Out">
              {shift.checkOutAt
                ? formatDateTime(shift.checkOutAt)
                : "Still on shift"}
            </DetailItem>
            <DetailItem label="Worked">
              {formatWorked(shift.workedMinutes)}
            </DetailItem>
            <DetailItem label="Status">
              <StatusBadge
                label={shift.open ? "On shift" : "Closed"}
                tone={shift.open ? "info" : "neutral"}
              />
            </DetailItem>
          </DetailGrid>
          <Timeline
            query={history}
            entries={history.currentData?.map((entry) => ({
              id: entry.id,
              createdAt: entry.createdAt,
              actorName: entry.actorName,
              actorRole: entry.actorRole,
              note: entry.note,
              label: humanise(entry.action),
              tone: "info" as Tone,
            }))}
          />
        </div>
      )}
    </DetailModal>
  );
}

type TimelineEntry = {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorRole: Role | null;
  note: string | null;
  label: string;
  tone: Tone;
};

/** Oldest first, so the history reads as the story of the record from start to finish. */
function Timeline({
  query,
  entries,
}: {
  query: {
    isFetching: boolean;
    currentData?: unknown;
    error?: unknown;
    refetch: () => unknown;
  };
  entries: TimelineEntry[] | undefined;
}) {
  const state = listLoadState(query);
  const sorted = [...(entries ?? [])].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return (
    <section className="mt-6">
      <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <ClipboardList className="h-4 w-4 text-gray-400" />
        Activity
      </h4>

      {state.isLoading ? (
        <ol className="space-y-5" role="status" aria-label="Loading history">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3">
              <SkeletonBlock className="mt-1 h-3 w-3 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-1/2" />
                <SkeletonBlock className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ol>
      ) : state.error ? (
        <ErrorState
          error={state.error}
          fallback="Could not load the history."
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : sorted.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
          Nothing has been recorded for this yet.
        </p>
      ) : (
        <ol className="relative space-y-5 border-l border-gray-200 pl-5">
          {sorted.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                className={cn(
                  "absolute top-1.5 -left-6.5 h-3 w-3 rounded-full ring-4 ring-white",
                  TONE_DOT[entry.tone],
                )}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold text-gray-900">
                  {entry.label}
                </p>
                <time
                  dateTime={entry.createdAt}
                  className="text-xs text-gray-400"
                >
                  {formatDateTime(entry.createdAt)}
                </time>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {entry.actorName
                  ? `by ${titleCase(entry.actorName)}${entry.actorRole ? ` · ${humanise(entry.actorRole)}` : ""}`
                  : "Automatic"}
              </p>
              {entry.note ? (
                <p className="mt-1 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
                  {entry.note}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
