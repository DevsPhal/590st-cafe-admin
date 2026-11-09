import { CircleAlert } from "lucide-react";

/** The inline message under a sign-in field (login, verification code, forgot password), in the café palette. */
export function AuthFieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-(--color-danger)">
      <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
      {message}
    </p>
  );
}

/** aria props tying a sign-in input to its AuthFieldError. */
export function authInvalidProps(id: string, message?: string) {
  return message ? { "aria-invalid": true as const, "aria-describedby": id } : {};
}
