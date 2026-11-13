"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { FormInput, FormModal, FormSelect } from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";
import { checkInSchema } from "@/lib/formSchemas";
import { shopDateTimeInput } from "@/lib/shopDate";
import { titleCase } from "@/lib/utils";
import { useCheckInStaffMutation, useListAttendanceQuery } from "@/store/api/attendanceApi";
import { useListBaristasQuery } from "@/store/api/userApi";
import { useFormErrors } from "@/hooks/useFormErrors";

/** Starts a shift. Collects only who and when — never a check-out time. */
export function CheckInForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const staff = useListBaristasQuery({ page: 1, size: 200 }, { skip: !open });
  const onShift = useListAttendanceQuery({ open: true, page: 1, size: 200 }, { skip: !open, refetchOnMountOrArgChange: true });
  const [checkInStaff, { isLoading }] = useCheckInStaffMutation();
  const [form, setForm] = useState(() => ({ baristaId: "", checkInAt: shopDateTimeInput(), note: "" }));
  const validation = useFormErrors(checkInSchema({ now: shopDateTimeInput() }), form);

  // Someone already on shift is eligible for check-out, not a second check-in.
  const onShiftIds = new Set(onShift.data?.content.map((record) => record.baristaId));
  const eligible = (staff.data?.content ?? []).filter((member) => member.status === "ACTIVE" && !onShiftIds.has(member.id));
  const loaded = Boolean(staff.data && onShift.data);

  const save = async () => {
    const parsed = validation.validate();
    if (!parsed) return;
    const name = titleCase(eligible.find((member) => member.id === parsed.baristaId)?.fullName ?? "");
    try {
      await checkInStaff(parsed).unwrap();
      toast.success(t("attendance.toast.member_checked_in", "{name} checked in", { name }));
      onClose();
    } catch (error) {
      validation.showServerError(error, t("attendance.toast.check_in_failed", "Could not check this staff member in."));
    }
  };

  return (
    <FormModal open={open} onOpenChange={(next) => { if (!next) onClose(); }} size="compact"
      title={t("attendance.check_in_form.title", "Check in staff")}
      submitLabel={t("attendance.check_in_form.submit", "Save check-in")}
      onSubmit={save} isLoading={isLoading} submitDisabled={loaded && eligible.length === 0}>
      <div className="admin_modal_form_wrap grid gap-4 sm:grid-cols-2">
        <FormSelect label={t("attendance.check_in_form.staff_member", "Staff member")} required
          placeholder={t("attendance.check_in_form.staff_placeholder", "Select staff")}
          value={form.baristaId} onChange={(event) => setForm({ ...form, baristaId: event.target.value })}
          error={validation.errors.baristaId}>
          {eligible.map((member) => <option key={member.id} value={member.id}>{titleCase(member.fullName)}</option>)}
        </FormSelect>
        <FormInput label={t("attendance.check_in_form.check_in_at", "Check-in date & time (Cambodia time)")} required
          type="datetime-local" max={shopDateTimeInput()} value={form.checkInAt}
          onChange={(event) => setForm({ ...form, checkInAt: event.target.value })} error={validation.errors.checkInAt} />
        {loaded && eligible.length === 0 && (
          <p role="status" className="text-sm text-gray-500 sm:col-span-2">
            {t("attendance.check_in_form.no_eligible_staff", "Every active staff member is already on shift.")}
          </p>
        )}
        <div className="sm:col-span-2">
          <FormInput label={t("attendance.form.note_optional", "Correction note (optional)")} maxLength={255}
            placeholder={t("attendance.form.note_placeholder", "Reason, if recorded late or on their behalf")}
            value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} error={validation.errors.note} />
        </div>
      </div>
    </FormModal>
  );
}
