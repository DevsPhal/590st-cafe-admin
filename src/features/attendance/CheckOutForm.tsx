"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { FormInput, FormModal, FormSelect } from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";
import { checkOutSchema } from "@/lib/formSchemas";
import { shopDateTimeInput } from "@/lib/shopDate";
import { titleCase } from "@/lib/utils";
import { useCheckOutStaffMutation, useListAttendanceQuery } from "@/store/api/attendanceApi";
import { formatShiftTime, minutesBetween } from "./shiftTime";
import { useFormErrors } from "@/hooks/useFormErrors";

/** Ends the open shift of someone on shift. Shows their check-in read-only; never asks for it again. */
export function CheckOutForm({ open, onClose, initialStaffId = "" }: {
  open: boolean;
  onClose: () => void;
  initialStaffId?: string;
}) {
  const { t } = useI18n();
  const onShift = useListAttendanceQuery({ open: true, page: 1, size: 200 }, { skip: !open, refetchOnMountOrArgChange: true });
  const [checkOutStaff, { isLoading }] = useCheckOutStaffMutation();
  const [form, setForm] = useState(() => ({ baristaId: initialStaffId, checkOutAt: shopDateTimeInput() }));
  // null until the admin edits it: the field shows the shift's current note (e.g. the barista's check-in
  // note), so saving never replaces it unseen.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  const openShifts = onShift.data?.content ?? [];
  const shift = openShifts.find((record) => record.baristaId === form.baristaId);
  const note = noteDraft ?? shift?.note ?? "";
  const shiftMinutes = shift && form.checkOutAt ? minutesBetween(shift.checkInAt, form.checkOutAt) : null;
  const nobodyOnShift = Boolean(onShift.data) && openShifts.length === 0;

  const validation = useFormErrors(
    checkOutSchema({ now: shopDateTimeInput(), checkInAt: shift?.checkInAt ?? "" }),
    { ...form, note, baristaId: shift ? form.baristaId : "" },
  );
  const save = async () => {
    const parsed = validation.validate();
    if (!parsed || !shift) return;
    try {
      await checkOutStaff(parsed).unwrap();
      toast.success(t("attendance.toast.member_checked_out", "{name} checked out", { name: titleCase(shift.baristaName) }));
      onClose();
    } catch (error) {
      validation.showServerError(error, t("attendance.toast.check_out_failed", "Could not check this shift out."));
    }
  };

  return (
    <FormModal open={open} onOpenChange={(next) => { if (!next) onClose(); }} size="compact"
      title={t("attendance.check_out_form.title", "Check out staff")}
      submitLabel={t("attendance.check_out_form.submit", "Save check-out")}
      onSubmit={save} isLoading={isLoading} submitDisabled={nobodyOnShift}>
      <div className="admin_modal_form_wrap grid gap-4 sm:grid-cols-2">
        <FormSelect label={t("attendance.check_out_form.staff_member", "Staff member on shift")} required
          placeholder={t("attendance.check_out_form.staff_placeholder", "Select staff on shift")}
          value={shift ? form.baristaId : ""} onChange={(event) => { setForm({ ...form, baristaId: event.target.value }); setNoteDraft(null); }}
          error={validation.errors.baristaId}>
          {openShifts.map((record) => <option key={record.id} value={record.baristaId}>{titleCase(record.baristaName)}</option>)}
        </FormSelect>
        <FormInput label={t("attendance.check_out_form.checked_in_at", "Checked in at (Cambodia time)")} readOnly
          placeholder={t("attendance.check_out_form.checked_in_placeholder", "Select a staff member first")}
          value={shift ? formatShiftTime(shift.checkInAt) : ""} />
        {nobodyOnShift && (
          <p role="status" className="text-sm text-gray-500 sm:col-span-2">
            {t("attendance.check_out_form.nobody_on_shift", "No one is on shift right now — check someone in first.")}
          </p>
        )}
        <FormInput label={t("attendance.check_out_form.check_out_at", "Check-out date & time (Cambodia time)")} required
          type="datetime-local" min={shift?.checkInAt.slice(0, 16)} max={shopDateTimeInput()} value={form.checkOutAt}
          onChange={(event) => setForm({ ...form, checkOutAt: event.target.value })} error={validation.errors.checkOutAt} />
        <div className="form_field">
          <span className="form_field_label">{t("attendance.check_out_form.shift_length", "Shift length")}</span>
          <p className="flex h-9 items-center text-sm font-medium" aria-live="polite">
            {shiftMinutes == null ? "—" : t("attendance.table.worked_value", "{hours}h {minutes}m",
              { hours: Math.floor(shiftMinutes / 60), minutes: shiftMinutes % 60 })}
          </p>
        </div>
        <div className="sm:col-span-2">
          <FormInput label={t("attendance.form.note_optional", "Correction note (optional)")} maxLength={255}
            placeholder={t("attendance.form.note_placeholder", "Reason, if recorded late or on their behalf")}
            value={note} onChange={(event) => setNoteDraft(event.target.value)} error={validation.errors.note} />
        </div>
      </div>
    </FormModal>
  );
}
