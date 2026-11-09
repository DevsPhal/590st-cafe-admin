"use client";

import { useState } from "react";
import type { z } from "zod";
import toast from "react-hot-toast";
import { apiErrorMessage, apiFieldErrors } from "@/store/api/baseApi";
import { firstIssueMessage, zodFieldErrors, type FieldErrors } from "@/lib/validation";

/**
 * One form's validation. The same rules run in the browser (zod, mirroring the API's DTOs) and on
 * the server (Bean Validation); either way each message lands under its own field:
 *
 *   const form = useFormErrors(schema, values);
 *   const parsed = form.validate();                  // null when invalid; messages show inline
 *   catch (err) { form.showServerError(err, "Could not save."); }
 *   <FormInput error={form.errors.name} ... />
 *
 * After a failed submit the messages follow the values: each disappears as soon as its field is
 * fixed. A server message stays until its field is edited.
 */
export function useFormErrors<S extends z.ZodType>(schema: S, values: z.input<S>) {
  const [attempted, setAttempted] = useState(false);
  const [server, setServer] = useState<{ errors: FieldErrors; values: unknown } | null>(null);

  const errors: FieldErrors = {};
  if (attempted) {
    const result = schema.safeParse(values);
    if (!result.success) Object.assign(errors, zodFieldErrors(result.error));
  }
  if (server) {
    for (const [field, message] of Object.entries(server.errors)) {
      if (!(field in errors) && sameField(server.values, values, field)) errors[field] = message;
    }
  }

  const validate = (): z.output<S> | null => {
    setServer(null);
    const result = schema.safeParse(values);
    if (result.success) {
      setAttempted(false);
      return result.data;
    }
    setAttempted(true);
    // The first problem also goes in a toast: the field may be scrolled out of view in a long
    // dialog, or be a value with no input of its own (a map pin, a rule spanning two fields).
    toast.error(firstIssueMessage(result.error));
    return null;
  };

  /**
   * Puts the API's per-field messages under their fields, and its summary in a toast.
   * `rename` maps an API field to this form's key when they differ, e.g. { newPassword: "next" }.
   */
  const showServerError = (error: unknown, fallback: string, rename: Record<string, string> = {}) => {
    const fields: FieldErrors = {};
    for (const [field, message] of Object.entries(apiFieldErrors(error))) fields[rename[field] ?? field] = message;
    if (Object.keys(fields).length > 0) setServer({ errors: fields, values });
    toast.error(apiErrorMessage(error as never, fallback));
  };

  const reset = () => {
    setAttempted(false);
    setServer(null);
  };

  return { errors, validate, showServerError, reset };
}

// "items[0].quantity" or "items.0.quantity" belongs to the top-level value "items".
function sameField(before: unknown, now: unknown, field: string): boolean {
  const key = field.split(/[.[]/)[0];
  const read = (values: unknown) => (values && typeof values === "object" ? (values as Record<string, unknown>)[key] : undefined);
  return JSON.stringify(read(before)) === JSON.stringify(read(now));
}
