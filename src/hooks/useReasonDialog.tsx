"use client";

import { useRef, useState, type ReactNode } from "react";
import { FormModal, FormTextarea } from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";

type ReasonOptions = {
  title: string;
  description?: ReactNode;
  label: string;
  confirmLabel?: string;
  placeholder?: string;
  /** A reason must be typed (admin overrides); otherwise it may be left empty. */
  required?: boolean;
  maxLength?: number;
};

/**
 * Asks for a short reason before an action, like useConfirmDialog but with a text box.
 * Resolves to the trimmed reason ("" when optional and left empty), or null when cancelled.
 */
export function useReasonDialog() {
  const { t } = useI18n();
  const [options, setOptions] = useState<ReasonOptions | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const askReason = (next: ReasonOptions) => {
    setOptions(next);
    setReason("");
    setError(undefined);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const settle = (result: string | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  const submit = () => {
    const trimmed = reason.trim();
    if (options?.required && !trimmed) {
      setError(t("reason_dialog.required", "Give a reason."));
      return;
    }
    settle(trimmed);
  };

  const reasonDialog = (
    <FormModal
      open={options !== null}
      onOpenChange={(open) => { if (!open) settle(null); }}
      title={options?.title ?? ""}
      submitLabel={options?.confirmLabel ?? t("actions.confirm", "Confirm")}
      onSubmit={submit}
      size="compact"
    >
      <div className="grid gap-3 p-4">
        {options?.description ? <div className="text-sm text-gray-600">{options.description}</div> : null}
        <FormTextarea
          label={options?.label ?? ""}
          required={options?.required}
          rows={3}
          maxLength={options?.maxLength ?? 300}
          placeholder={options?.placeholder}
          value={reason}
          error={error}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError(undefined);
          }}
        />
      </div>
    </FormModal>
  );

  return { askReason, reasonDialog };
}
