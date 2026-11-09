"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import { FormInput, FormModal, FormTextarea } from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";
import { useNow } from "@/hooks/useNow";
import { shopDateTimeInput } from "@/lib/shopDate";
import { optionalText } from "@/lib/validation";
import { useCheckInMutation, useCheckOutMutation, type AttendanceResponse } from "@/store/api/attendanceApi";
import { formatShiftTime, minutesSoFar } from "./shiftTime";
import { useFormErrors } from "@/hooks/useFormErrors";

// Matches the API's @Size(max = 255) on the attendance note.
const NOTE_MAX = 255;
const noteSchema = z.object({ note: optionalText("Note", NOTE_MAX) });

/**
 * A barista's own check-in (no `shift` yet) or check-out of `shift`, with an optional note saved on the shift.
 * Checking out starts from the note written at check-in, so editing it never silently drops it.
 */
export function MyShiftDialog({ open, onClose, shift }: {
  open: boolean;
  onClose: () => void;
  shift: AttendanceResponse | null;
}) {
  const { t } = useI18n();
  const [checkIn, checkInState] = useCheckInMutation();
  const [checkOut, checkOutState] = useCheckOutMutation();
  const [note, setNote] = useState(() => shift?.note ?? "");
  const validation = useFormErrors(noteSchema, { note });
  const now = useNow(30000);
  const elapsed = shift ? minutesSoFar(shift.checkInAt, shopDateTimeInput(new Date(now))) : null;

  const save = async () => {
    const parsed = validation.validate();
    if (!parsed) return;
    const body = parsed.note ? { note: parsed.note } : undefined;
    try {
      if (shift) {
        await checkOut(body).unwrap();
        toast.success(t("attendance.toast.checked_out", "Checked out"));
      } else {
        await checkIn(body).unwrap();
        toast.success(t("attendance.toast.checked_in", "Checked in"));
      }
      onClose();
    } catch (error) {
      validation.showServerError(error, t("attendance.toast.record_failed", "Could not record attendance."));
    }
  };

  return (
    <FormModal open={open} onOpenChange={(next) => { if (!next) onClose(); }} size="compact"
      title={shift ? t("attendance.my_shift_form.check_out_title", "Check out") : t("attendance.my_shift_form.check_in_title", "Check in")}
      submitLabel={shift ? t("attendance.my_shift_form.check_out_submit", "Confirm check-out") : t("attendance.my_shift_form.check_in_submit", "Confirm check-in")}
      onSubmit={save} isLoading={checkInState.isLoading || checkOutState.isLoading}>
      <div className="admin_modal_form_wrap grid gap-4 sm:grid-cols-2">
        {shift ? (
          <>
            <FormInput label={t("attendance.check_out_form.checked_in_at", "Checked in at (Cambodia time)")} readOnly
              value={formatShiftTime(shift.checkInAt)} />
            <div className="form_field">
              <span className="form_field_label">{t("attendance.my_shift_form.on_shift_for", "On shift so far")}</span>
              <p className="flex h-9 items-center text-sm font-medium">
                {elapsed == null ? "—" : t("attendance.table.worked_value", "{hours}h {minutes}m",
                  { hours: Math.floor(elapsed / 60), minutes: elapsed % 60 })}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 sm:col-span-2">
            {t("attendance.my_shift_form.check_in_hint", "Your check-in time is recorded when you confirm (Cambodia time).")}
          </p>
        )}
        <div className="sm:col-span-2">
          <FormTextarea label={t("attendance.my_shift_form.note", "Note (optional)")} rows={3} maxLength={NOTE_MAX}
            placeholder={shift
              ? t("attendance.my_shift_form.check_out_placeholder", "e.g. Leaving early — feeling unwell")
              : t("attendance.my_shift_form.check_in_placeholder", "e.g. Arrived late because of traffic")}
            value={note} onChange={(event) => setNote(event.target.value)} error={validation.errors.note} />
          <p className="mt-1 flex justify-between gap-3 text-xs text-gray-500">
            <span>{shift?.note
              ? t("attendance.my_shift_form.note_from_check_in", "This is the note from your check-in. Edit it if anything changed — leaving it empty keeps it.")
              : t("attendance.my_shift_form.note_help", "Saved with this shift. Your manager can see it.")}</span>
            <span className="shrink-0 tabular-nums" aria-live="polite">{note.length}/{NOTE_MAX}</span>
          </p>
        </div>
      </div>
    </FormModal>
  );
}
