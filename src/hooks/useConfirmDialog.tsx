"use client";

import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/common/AdminKit";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = (next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const settle = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  const confirmDialog = (
    <ConfirmDialog
      open={options !== null}
      title={options?.title ?? ""}
      description={options?.description}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      tone={options?.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
