"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions, FormModal, FormInput, FormSelect } from "@/components/common/AdminKit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { useListBaristasQuery } from "@/store/api/userApi";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useListAttendanceQuery, useListMyAttendanceQuery, useGetCurrentShiftQuery,
  useCheckInMutation, useCheckOutMutation, useCreateAttendanceMutation,
  useUpdateAttendanceMutation, type AttendanceResponse, type AttendanceInput,
} from "@/store/api/attendanceApi";
import { titleCase } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePersistentState } from "@/hooks/usePersistentState";

const emptyForm: AttendanceInput = { baristaId: "", checkInAt: "", checkOutAt: "", note: "" };
const displayTime = (value: string | null) => value ? value.replace("T", " ").slice(0, 19) : "—";
// "YYYY-MM-DDTHH:mm" in the browser's own clock, which is what a datetime-local input expects.
const toLocalInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function AttendanceView() {
  const { isAdmin, isBarista } = useCurrentRole();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [page, setPage] = usePersistentState("attendance:page", 1);
  const [staffId, setStaffId] = usePersistentState("attendance:staffId", "");
  const [from, setFrom] = usePersistentState("attendance:from", "");
  const [to, setTo] = usePersistentState("attendance:to", "");
  const [form, setForm] = usePersistentState<AttendanceInput>("attendance:form", emptyForm);
  const [editing, setEditing] = usePersistentState<AttendanceResponse | null>("attendance:editing", null);
  const [formOpen, setFormOpen] = usePersistentState("attendance:formOpen", false);
  // Recomputed whenever the form opens, so the pickers never offer a time that has not happened.
  const [latestAllowed, setLatestAllowed] = useState(() => toLocalInput(new Date()));
  // Which row's one-click check-out is in flight, so only that button shows as busy.
  const [closingId, setClosingId] = useState<string | null>(null);
  const refresh = { pollingInterval: 30000 };
  const staff = useListBaristasQuery({ page: 1, size: 200 }, { skip: !isAdmin });
  const adminRecords = useListAttendanceQuery({ page, size: 15, ...(staffId ? { baristaId: staffId } : {}),
    ...(from ? { from: `${from}T00:00:00` } : {}), ...(to ? { to: `${to}T23:59:59` } : {}) }, { ...refresh, skip: !isAdmin });
  const ownRecords = useListMyAttendanceQuery({ page, size: 15 }, { ...refresh, skip: !isBarista });
  const currentShift = useGetCurrentShiftQuery(undefined, { ...refresh, skip: !isBarista });
  const records = isAdmin ? adminRecords : ownRecords;
  const [checkIn, checkInState] = useCheckInMutation();
  const [checkOut, checkOutState] = useCheckOutMutation();
  const [create, createState] = useCreateAttendanceMutation();
  const [update, updateState] = useUpdateAttendanceMutation();
  const busy = checkInState.isLoading || checkOutState.isLoading;

  const punch = async () => {
    if (busy || currentShift.isFetching || currentShift.error) return;
    try {
      if (currentShift.data) { await checkOut().unwrap(); toast.success("Checked out"); }
      else { await checkIn().unwrap(); toast.success("Checked in"); }
    } catch (error) { toast.error(apiErrorMessage(error as never, "Could not record attendance.")); }
  };
  const openForm = (record?: AttendanceResponse) => {
    setLatestAllowed(toLocalInput(new Date()));
    setEditing(record ?? null);
    setForm(record ? { baristaId: record.baristaId, checkInAt: record.checkInAt,
      checkOutAt: record.checkOutAt ?? "", note: record.note ?? "" } : emptyForm);
    setFormOpen(true);
  };
  /**
   * Closes an open shift from the list, in one click.
   *
   * Admins and super admins have no punch card of their own — the check in/out card is
   * barista-only, and /api/barista/attendance is hasRole("BARISTA") server-side — so the only
   * way for them to end a shift was the "Correct" dialog, which reads as a data fix rather
   * than "check this person out" and so was never found. This uses the same correction
   * endpoint with the check-out time set to now.
   *
   * The time is truncated to the current minute, which is always at or behind the server's
   * clock, so it can never trip the API's "check-out cannot be in the future" rule.
   */
  const closeShift = async (record: AttendanceResponse) => {
    if (!(await confirm({ title: "Check out", description: `Check ${record.baristaName} out now?` }))) return;
    setClosingId(record.id);
    try {
      await update({
        id: record.id,
        body: { checkInAt: record.checkInAt, checkOutAt: toLocalInput(new Date()) },
      }).unwrap();
      toast.success(`${record.baristaName} checked out`);
    } catch (error) {
      toast.error(apiErrorMessage(error as never, "Could not check this shift out."));
    } finally {
      setClosingId(null);
    }
  };

  const save = async () => {
    if (!form.baristaId || !form.checkInAt) { toast.error("Choose a staff member and check-in time."); return; }
    // Mirrors the API rule, so the mistake is caught in the form rather than after a round trip.
    const now = toLocalInput(new Date());
    if (form.checkInAt > now) { toast.error("Check-in cannot be in the future — that shift has not started yet."); return; }
    if (form.checkOutAt && form.checkOutAt > now) { toast.error("Check-out cannot be in the future — leave it empty if the shift is still running."); return; }
    if (form.checkOutAt && form.checkOutAt <= form.checkInAt) { toast.error("Check-out must be after check-in."); return; }
    if (editing?.checkOutAt && !form.checkOutAt) { toast.error("A completed shift must keep a check-out time."); return; }
    const body = { checkInAt: form.checkInAt, checkOutAt: form.checkOutAt || undefined, note: form.note };
    try {
      if (editing) await update({ id: editing.id, body }).unwrap();
      else await create({ ...body, baristaId: form.baristaId }).unwrap();
      toast.success("Attendance saved"); setFormOpen(false);
    } catch (error) { toast.error(apiErrorMessage(error as never, "Could not save attendance.")); }
  };
  return <PageShell>
    <PageHeader title="Staff attendance" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Staff attendance" }]} rightSlot={<AdminTopActions />} />
    <p className="text-sm text-gray-500">Work shifts for shop staff. Times are shown in Cambodia time.</p>
    {isBarista && <section className="my-4 flex items-center justify-between rounded-xl border bg-white p-5">
      <div><h2 className="font-semibold">My shift</h2>
        {currentShift.isLoading ? <p role="status">Loading shift...</p> : currentShift.error ?
          <p role="alert" className="text-red-600">{apiErrorMessage(currentShift.error as never, "Could not load shift.")}</p> :
          <p className="text-sm">{currentShift.data ? `Checked in at ${displayTime(currentShift.data.checkInAt)}` : "You are currently checked out."}</p>}
      </div>
      {currentShift.error ? <button type="button" onClick={() => { void currentShift.refetch(); }} className="underline">Retry</button> :
        <button type="button" className="btn_primary_yellow" disabled={busy || currentShift.isFetching} onClick={() => { void punch(); }}>
          {busy ? "Saving..." : currentShift.data ? "Check out" : "Check in"}
        </button>}
    </section>}
    {/* Same field styling as every other filter bar: label above control, one column on a
        phone, a row from tablet up. */}
    {isAdmin && <div className="my-4 grid grid-cols-1 items-end gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="form_field">
        <span className="form_field_label">Staff</span>
        <Select value={staffId || "__all__"} onValueChange={(next) => { setStaffId(next === "__all__" ? "" : next); setPage(1); }}>
          <SelectTrigger aria-label="Filter staff" className="form_field_select_trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="form_field_select_content">
            <SelectItem value="__all__" className="form_field_select_item">All staff</SelectItem>
            {staff.data?.content.map((member) => (
              <SelectItem key={member.id} value={member.id} className="form_field_select_item">
                {titleCase(member.fullName)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="form_field"><span className="form_field_label">From</span>
        <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="form_field_control" /></label>
      <label className="form_field"><span className="form_field_label">To</span>
        <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="form_field_control" /></label>
      <button type="button" className="btn_primary_yellow h-9 whitespace-nowrap" onClick={() => openForm()}>Add missed shift</button>
    </div>}
    {records.error && <div role="alert" className="my-3 text-red-600"><p>{apiErrorMessage(records.error as never, "Could not load attendance.")}</p>
      <button type="button" onClick={() => { void records.refetch(); }} className="underline">Retry</button></div>}
    <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
      {/* min-w: scroll sideways on a phone rather than crushing Note into a sliver that wraps a
          word per line and stretches every row. */}
      <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b bg-gray-50">
        {['Staff', 'Check in', 'Check out', 'Worked', 'Note', ...(isAdmin ? ['Action'] : [])].map((label) => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}
      </tr></thead><tbody>
        {records.isLoading && <tr><td colSpan={isAdmin ? 6 : 5} className="p-5" role="status">Loading attendance...</td></tr>}
        {!records.isLoading && !records.error && records.data?.content.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="p-5 text-center text-gray-500">No attendance records.</td></tr>}
        {records.data?.content.map((record) => <tr key={record.id} className="border-b last:border-0">
          <td className="whitespace-nowrap p-3">{titleCase(record.baristaName)}</td><td className="whitespace-nowrap p-3">{displayTime(record.checkInAt)}</td>
          <td className="whitespace-nowrap p-3">{record.open ? "On shift" : displayTime(record.checkOutAt)}</td>
          <td className="whitespace-nowrap p-3">{record.workedMinutes == null ? "—" : `${Math.floor(record.workedMinutes / 60)}h ${record.workedMinutes % 60}m`}</td>
          <td className="min-w-[220px] max-w-xs whitespace-pre-wrap p-3">{record.note || "—"}</td>
          {isAdmin && <td className="p-3">
            <div className="flex items-center gap-3 whitespace-nowrap">
              {record.open && <button type="button" className="btn_primary_yellow px-3 py-1 text-xs" disabled={closingId === record.id}
                onClick={() => { void closeShift(record); }}>{closingId === record.id ? "Checking out..." : "Check out"}</button>}
              <button type="button" onClick={() => openForm(record)} className="underline">Correct</button>
            </div>
          </td>}
        </tr>)}
      </tbody></table>
    </div>
    <div className="mt-3 flex items-center justify-between text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Previous</button>
      <span>Page {page} of {Math.max(1, records.data?.totalPages ?? 1)}</span>
      <button type="button" disabled={!records.data || page >= records.data.totalPages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next</button></div>
    <FormModal open={formOpen} onOpenChange={setFormOpen} title={editing ? "Correct staff attendance" : "Add missed staff shift"}
      submitLabel="Save attendance" onSubmit={save} isLoading={createState.isLoading || updateState.isLoading}>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <FormSelect label="Staff member" placeholder="Select staff" value={form.baristaId} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, baristaId: event.target.value })}>
          {staff.data?.content.map((member) => <option key={member.id} value={member.id}>{titleCase(member.fullName)}</option>)}
        </FormSelect>
        <FormInput label="Check in (Cambodia time)" type="datetime-local" max={latestAllowed} value={form.checkInAt} onChange={(event) => setForm({ ...form, checkInAt: event.target.value })} />
        <FormInput label="Check out (leave empty if still on shift)" type="datetime-local" min={form.checkInAt || undefined} max={latestAllowed} value={form.checkOutAt} onChange={(event) => setForm({ ...form, checkOutAt: event.target.value })} />
        <FormInput label="Correction note" maxLength={255} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
      </div>
    </FormModal>
    {confirmDialog}
  </PageShell>;
}
