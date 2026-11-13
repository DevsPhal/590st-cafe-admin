"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { History, LogIn, LogOut } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions, FormModal, FormInput, FormSelect, StatusBadge, TableState } from "@/components/common/AdminKit";
import { DatePickerInput } from "@/components/forms/DatePickerInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { useListBaristasQuery } from "@/store/api/userApi";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useListAttendanceQuery, useListMyAttendanceQuery, useGetCurrentShiftQuery,
  useCreateAttendanceMutation, useUpdateAttendanceMutation, type AttendanceResponse, type AttendanceInput,
} from "@/store/api/attendanceApi";
import { titleCase } from "@/lib/utils";
import { usePersistentState } from "@/hooks/usePersistentState";
import { attendanceSchema } from "@/lib/formSchemas";
import { shopDateTimeInput } from "@/lib/shopDate";
import { useI18n } from "@/contexts/I18nContext";
import { CheckInForm } from "./CheckInForm";
import { CheckOutForm } from "./CheckOutForm";
import { MyShiftDialog } from "./MyShiftDialog";
import { formatShiftTime, shiftWorkedMinutes } from "./shiftTime";
import { useFormErrors } from "@/hooks/useFormErrors";
import { Button } from "@/components/common/Button";

const emptyForm: AttendanceInput = { baristaId: "", checkInAt: "", checkOutAt: "", note: "" };

// The barista's own check-in/out dialog; `shift` is the open shift when it was opened (null = checking in).
type MyShiftState = { open: boolean; shift: AttendanceResponse | null; session: number };

type ShiftDialog = { kind: "check-in" | "check-out" | null; staffId?: string; session: number };

export default function AttendanceView() {
  const { t } = useI18n();
  const { isAdmin, isBarista } = useCurrentRole();
  const [page, setPage] = usePersistentState("attendance:page", 1);
  const [staffId, setStaffId] = usePersistentState("attendance:staffId", "");
  const [from, setFrom] = usePersistentState("attendance:from", "");
  const [to, setTo] = usePersistentState("attendance:to", "");
  // Missed attendance and corrections only — normal check-in and check-out have their own forms below.
  const [form, setForm] = usePersistentState<AttendanceInput>("attendance:form", emptyForm);
  const [editing, setEditing] = usePersistentState<AttendanceResponse | null>("attendance:editing", null);
  const [formOpen, setFormOpen] = usePersistentState("attendance:formOpen", false);
  const [latestAllowed, setLatestAllowed] = useState(() => shopDateTimeInput());
  // A new session remounts the form, so each opening starts from fresh values.
  const [shiftDialog, setShiftDialog] = useState<ShiftDialog>({ kind: null, session: 0 });
  const [myShift, setMyShift] = useState<MyShiftState>({ open: false, shift: null, session: 0 });
  const refresh = { pollingInterval: 30000 };
  const staff = useListBaristasQuery({ page: 1, size: 200 }, { skip: !isAdmin });
  const adminRecords = useListAttendanceQuery({ page, size: 15, ...(staffId ? { baristaId: staffId } : {}),
    ...(from ? { from: `${from}T00:00:00` } : {}), ...(to ? { to: `${to}T23:59:59` } : {}) }, { ...refresh, skip: !isAdmin });
  const ownRecords = useListMyAttendanceQuery({ page, size: 15 }, { ...refresh, skip: !isBarista });
  const currentShift = useGetCurrentShiftQuery(undefined, { ...refresh, skip: !isBarista });
  const records = isAdmin ? adminRecords : ownRecords;
  const [create, createState] = useCreateAttendanceMutation();
  const [update, updateState] = useUpdateAttendanceMutation();
  // Adding a missed shift records a finished one; a correction may leave a still-running shift open.
  const requireCheckOut = !editing || Boolean(editing.checkOutAt);
  const columnCount = isAdmin ? 7 : 6;

  const openMyShift = () =>
    setMyShift((current) => ({ open: true, shift: currentShift.data ?? null, session: current.session + 1 }));
  const workedLabel = (record: AttendanceResponse) => {
    if (record.open) return t("attendance.table.on_shift", "On shift");
    const minutes = shiftWorkedMinutes(record);
    return minutes == null ? "—" : t("attendance.table.worked_value", "{hours}h {minutes}m",
      { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  };
  const openShiftDialog = (kind: "check-in" | "check-out", forStaffId?: string) =>
    setShiftDialog((current) => ({ kind, staffId: forStaffId, session: current.session + 1 }));
  const closeShiftDialog = () => setShiftDialog((current) => ({ ...current, kind: null }));
  const openForm = (record?: AttendanceResponse) => {
    setLatestAllowed(shopDateTimeInput());
    setEditing(record ?? null);
    setForm(record ? { baristaId: record.baristaId, checkInAt: record.checkInAt,
      checkOutAt: record.checkOutAt ?? "", note: record.note ?? "" } : emptyForm);
    validation.reset();
    setFormOpen(true);
  };

  const validation = useFormErrors(
    attendanceSchema({ now: shopDateTimeInput(), requireCheckOut }),
    { ...form, checkOutAt: form.checkOutAt ?? "", note: form.note ?? "" },
  );
  const save = async () => {
    const parsed = validation.validate();
    if (!parsed) return;
    const body = { checkInAt: parsed.checkInAt, checkOutAt: parsed.checkOutAt, note: parsed.note ?? "" };
    try {
      if (editing) await update({ id: editing.id, body }).unwrap();
      else await create({ ...body, baristaId: parsed.baristaId }).unwrap();
      toast.success(t("attendance.toast.saved", "Attendance saved")); setFormOpen(false);
    } catch (error) { validation.showServerError(error, t("attendance.toast.save_failed", "Could not save attendance.")); }
  };
  return <PageShell>
    <PageHeader title={t("attendance.title", "Staff attendance")} breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }, { label: t("attendance.title", "Staff attendance") }]} rightSlot={<AdminTopActions />} />
    <p className="text-sm text-gray-500">{t("attendance.description", "Work shifts for shop staff. Times are shown in Cambodia time.")}</p>
    {isBarista && <section className="ui_card is_padded my-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h2 className="font-semibold">{t("attendance.my_shift.title", "My shift")}</h2>
        {currentShift.isLoading ? <p role="status">{t("attendance.my_shift.loading", "Loading shift...")}</p> : currentShift.error ?
          <p role="alert" className="text-red-600">{apiErrorMessage(currentShift.error as never, t("attendance.my_shift.load_failed", "Could not load shift."))}</p> :
          <p className="text-sm">{currentShift.data ? t("attendance.my_shift.checked_in_at", "Checked in at {time}", { time: formatShiftTime(currentShift.data.checkInAt) }) : t("attendance.my_shift.checked_out", "You are currently checked out.")}</p>}
        {currentShift.data?.note && <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-gray-500">
          {t("attendance.my_shift.note", "Note: {note}", { note: currentShift.data.note })}</p>}
      </div>
      {currentShift.error ? <button type="button" onClick={() => { void currentShift.refetch(); }} className="underline">{t("actions.retry", "Retry")}</button> :
        <Button variant="accent" disabled={currentShift.isLoading} onClick={openMyShift}>
          {currentShift.data ? <LogOut aria-hidden /> : <LogIn aria-hidden />}
          {currentShift.data ? t("attendance.actions.check_out", "Check out") : t("attendance.actions.check_in", "Check in")}
        </Button>}
    </section>}
    {isAdmin && <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button variant="accent" onClick={() => openShiftDialog("check-in")}>
        <LogIn aria-hidden />{t("attendance.actions.check_in", "Check in")}
      </Button>
      <Button variant="primary" onClick={() => openShiftDialog("check-out")}>
        <LogOut aria-hidden />{t("attendance.actions.check_out", "Check out")}
      </Button>
      <Button variant="outline" className="sm:ml-auto" onClick={() => openForm()}>
        <History aria-hidden />{t("attendance.actions.add_missed_attendance", "Add missed attendance")}
      </Button>
    </div>}
    {isAdmin && <div className="ui_card is_padded my-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="form_field">
        <span className="form_field_label">{t("attendance.filters.staff", "Staff")}</span>
        <Select value={staffId || "__all__"} onValueChange={(next) => { setStaffId(next === "__all__" ? "" : next); setPage(1); }}>
          <SelectTrigger aria-label={t("attendance.filters.filter_staff", "Filter staff")} className="form_field_select_trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="form_field_select_content">
            <SelectItem value="__all__" className="form_field_select_item">{t("attendance.filters.all_staff", "All staff")}</SelectItem>
            {staff.data?.content.map((member) => (
              <SelectItem key={member.id} value={member.id} className="form_field_select_item">
                {titleCase(member.fullName)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="form_field"><span className="form_field_label">{t("attendance.filters.from", "From")}</span>
        <DatePickerInput type="date" value={from} max={to || undefined} onChange={(next) => { setFrom(next); setPage(1); }} aria-label={t("attendance.filters.from", "From")} /></label>
      <label className="form_field"><span className="form_field_label">{t("attendance.filters.to", "To")}</span>
        <DatePickerInput type="date" value={to} min={from || undefined} onChange={(next) => { setTo(next); setPage(1); }} aria-label={t("attendance.filters.to", "To")} /></label>
    </div>}
    <div className="ui_card mt-4 overflow-x-auto overflow-y-hidden">
      <table className="w-full min-w-[860px] text-left text-sm"><thead><tr className="border-b bg-gray-50">
        {[t("attendance.table.staff", "Staff"), t("attendance.table.check_in", "Check in"), t("attendance.table.check_out", "Check out"), t("attendance.table.status", "Status"), t("attendance.table.worked", "Worked"), t("fields.note", "Note"), ...(isAdmin ? [t("table.action", "Action")] : [])].map((label) => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}
      </tr></thead><tbody>
        <TableState colSpan={columnCount} isLoading={records.isLoading} error={records.error} onRetry={() => { void records.refetch(); }}
          isEmpty={!records.isLoading && !records.error && records.data?.content.length === 0} emptyLabel={t("attendance.empty.no_records", "No attendance records.")} />
        {records.data?.content.map((record) => <tr key={record.id} className="border-b last:border-0">
          <td className="whitespace-nowrap p-3">{titleCase(record.baristaName)}</td><td className="whitespace-nowrap p-3">{formatShiftTime(record.checkInAt)}</td>
          <td className="whitespace-nowrap p-3">{formatShiftTime(record.checkOutAt)}</td>
          <td className="whitespace-nowrap p-3">{record.open
            ? <StatusBadge tone="success" label={t("attendance.table.on_shift", "On shift")} />
            : <StatusBadge tone="neutral" label={t("attendance.table.completed", "Completed")} />}</td>
          <td className={`whitespace-nowrap p-3${record.open ? " text-gray-500" : ""}`}>{workedLabel(record)}</td>
          <td className="min-w-[220px] max-w-xs whitespace-pre-wrap wrap-break-word p-3">{record.note?.trim() || "—"}</td>
          {isAdmin && <td className="p-3">
            <div className="flex items-center gap-3 whitespace-nowrap">
              {record.open && <Button variant="accent" className="px-3 py-1 text-xs"
                onClick={() => openShiftDialog("check-out", record.baristaId)}>{t("attendance.actions.check_out", "Check out")}</Button>}
              <button type="button" onClick={() => openForm(record)} className="underline">{t("attendance.actions.correct", "Correct")}</button>
            </div>
          </td>}
        </tr>)}
      </tbody></table>
    </div>
    <div className="mt-3 flex items-center justify-between text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">{t("actions.previous", "Previous")}</button>
      <span>{t("attendance.pagination.page_of", "Page {page} of {total}", { page, total: Math.max(1, records.data?.totalPages ?? 1) })}</span>
      <button type="button" disabled={!records.data || page >= records.data.totalPages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">{t("actions.next", "Next")}</button></div>
    {isBarista && <MyShiftDialog key={`my-shift-${myShift.session}`} open={myShift.open} shift={myShift.shift}
      onClose={() => setMyShift((current) => ({ ...current, open: false }))} />}
    {isAdmin && <>
      <CheckInForm key={`check-in-${shiftDialog.session}`} open={shiftDialog.kind === "check-in"} onClose={closeShiftDialog} />
      <CheckOutForm key={`check-out-${shiftDialog.session}`} open={shiftDialog.kind === "check-out"}
        initialStaffId={shiftDialog.staffId} onClose={closeShiftDialog} />
    </>}
    <FormModal open={formOpen} onOpenChange={setFormOpen} title={editing ? t("attendance.form.title_correct", "Correct staff attendance") : t("attendance.form.title_add", "Add missed attendance")}
      submitLabel={t("attendance.form.submit", "Save attendance")} onSubmit={save} isLoading={createState.isLoading || updateState.isLoading}>
      {!editing && <p className="px-4 text-sm text-gray-500">{t("attendance.form.missed_hint", "For a past shift that was never recorded. Enter both check-in and check-out times — use Check in for a shift that is still running.")}</p>}
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <FormSelect label={t("attendance.form.staff_member", "Staff member")} placeholder={t("attendance.form.staff_placeholder", "Select staff")} value={form.baristaId} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, baristaId: event.target.value })} error={validation.errors.baristaId}>
          {staff.data?.content.map((member) => <option key={member.id} value={member.id}>{titleCase(member.fullName)}</option>)}
        </FormSelect>
        <FormInput label={t("attendance.form.check_in", "Check in (Cambodia time)")} type="datetime-local" max={latestAllowed} value={form.checkInAt} onChange={(event) => setForm({ ...form, checkInAt: event.target.value })} error={validation.errors.checkInAt} />
        <FormInput label={requireCheckOut ? t("attendance.form.check_out_required", "Check out (Cambodia time)") : t("attendance.form.check_out", "Check out (leave empty if still on shift)")} type="datetime-local" min={form.checkInAt || undefined} max={latestAllowed} value={form.checkOutAt} onChange={(event) => setForm({ ...form, checkOutAt: event.target.value })} error={validation.errors.checkOutAt} />
        <FormInput label={t("attendance.form.note", "Correction note")} maxLength={255} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} error={validation.errors.note} />
      </div>
    </FormModal>
  </PageShell>;
}
