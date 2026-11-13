"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useForgotPasswordMutation,
  useResendOtpMutation,
  useResetPasswordMutation,
} from "@/store/api/authApi";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/formSchemas";
import { useI18n } from "@/contexts/I18nContext";
import {
  AUTH_DIALOG_BADGE_CLASS,
  AUTH_DIALOG_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_SUBMIT_CLASS,
} from "../authStyles";
import { AuthFieldError, authInvalidProps } from "@/features/auth/components/AuthFieldError";
import { useFormErrors } from "@/hooks/useFormErrors";

type Step = "REQUEST" | "RESET";

type ApiError = Parameters<typeof apiErrorMessage>[0];

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  initialEmail,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail: string;
  onReset: (email: string) => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("REQUEST");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const requestValidation = useFormErrors(forgotPasswordSchema, { email });
  const resetValidation = useFormErrors(resetPasswordSchema, { otp, newPassword, confirmPassword });

  const [forgotPassword, { isLoading: isRequesting }] = useForgotPasswordMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetPasswordMutation();
  const [resendOtp, { isLoading: isResending }] = useResendOtpMutation();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("REQUEST");
      setEmail(initialEmail.trim());
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      requestValidation.reset();
      resetValidation.reset();
    }
  }

  const busy = isRequesting || isResetting;

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = requestValidation.validate();
    if (!parsed) return;

    try {
      await forgotPassword(parsed).unwrap();
      setEmail(parsed.email);
      setStep("RESET");
    } catch (err) {
      requestValidation.showServerError(err, t("auth.forgot.errors.send_failed", "Could not send a reset code. Please try again."));
    }
  };

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetValidation.validate()) return;

    try {
      await resetPassword({ email, otp, newPassword }).unwrap();
      onReset(email);
      onOpenChange(false);
    } catch (err) {
      resetValidation.showServerError(err, t("auth.errors.code_not_accepted", "That code was not accepted. Check it and try again."));
    }
  };

  const handleResend = async () => {
    try {
      await resendOtp({ purpose: "RESET_PASSWORD", email }).unwrap();
      toast.success(
        t(
          "auth.forgot.toast.code_resent",
          "A new code is on its way. Codes from earlier emails no longer work.",
        ),
      );
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err as ApiError,
          t("auth.forgot.errors.resend_failed", "Could not resend the code. Please try again."),
        ),
      );
    }
  };

  const backToEmail = () => {
    setStep("REQUEST");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const [resetIntroBefore, resetIntroAfter] = t(
    "auth.forgot.reset_intro",
    "If an account exists for {email}, we sent it a 6-digit code. Enter it below with your new password.",
  ).split("{email}");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className={AUTH_DIALOG_CLASS}>
        {step === "REQUEST" ? (
          <form onSubmit={handleRequest} noValidate className="px-6 py-10 sm:px-10">
            <div className={AUTH_DIALOG_BADGE_CLASS}>
              <KeyRound className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold">{t("auth.forgot.heading", "Forgot your password?")}</h1>
              <p className="mt-3 text-sm text-gray-500">
                {t(
                  "auth.forgot.intro",
                  "Enter the email of your staff account and we'll email you a 6-digit code to set a new password.",
                )}
              </p>
            </div>

            <label className="mt-8 block text-sm font-medium">
              {t("fields.email", "Email")}
              <span className="relative mt-2 block">
                <input
                  type="email"
                  className={`${AUTH_FIELD_CLASS} px-11`}
                  placeholder="admin@590st.cafe"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                  {...authInvalidProps("forgot-email-error", requestValidation.errors.email)}
                />
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-700" />
              </span>
              <AuthFieldError id="forgot-email-error" message={requestValidation.errors.email} />
            </label>

            <button type="submit" disabled={isRequesting} className={AUTH_SUBMIT_CLASS}>
              {isRequesting
                ? t("auth.shared.sending_code", "Sending code...")
                : t("auth.forgot.send_reset_code", "Send reset code")}
            </button>

            <div className="mt-6 text-center text-sm">
              <button type="button" onClick={() => onOpenChange(false)} className="text-gray-600 underline">
                {t("auth.forgot.back_to_login", "Back to login")}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReset} noValidate className="px-6 py-10 sm:px-10">
            <div className={AUTH_DIALOG_BADGE_CLASS}>
              <KeyRound className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold">{t("auth.forgot.reset_heading", "Set a new password")}</h1>
              <p className="mt-3 text-sm text-gray-500">
                {resetIntroBefore}
                <span className="font-medium text-gray-700">{email}</span>
                {resetIntroAfter}
              </p>
            </div>

            <label className="mt-8 block text-sm font-medium">
              {t("auth.shared.verification_code", "Verification code")}
              <input
                className={`${AUTH_FIELD_CLASS} mt-2 h-12 text-center text-2xl tracking-[0.5em]`}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                {...authInvalidProps("forgot-otp-error", resetValidation.errors.otp)}
              />
              <AuthFieldError id="forgot-otp-error" message={resetValidation.errors.otp} />
            </label>

            <label className="mt-6 block text-sm font-medium">
              {t("auth.forgot.new_password", "New password")}
              <span className="relative mt-2 block">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${AUTH_FIELD_CLASS} px-4 pr-11`}
                  placeholder={t("auth.forgot.new_password", "New password")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  {...authInvalidProps("forgot-new-password-error", resetValidation.errors.newPassword)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? t("auth.shared.hide_password", "Hide password")
                      : t("auth.shared.show_password", "Show password")
                  }
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
              <AuthFieldError id="forgot-new-password-error" message={resetValidation.errors.newPassword} />
            </label>
            <p className="mt-2 text-xs text-gray-500">
              {t(
                "auth.forgot.password_hint",
                "At least 8 characters, including an uppercase letter, a lowercase letter, a number and a symbol.",
              )}
            </p>

            <label className="mt-6 block text-sm font-medium">
              {t("auth.forgot.confirm_new_password", "Confirm new password")}
              <input
                type={showPassword ? "text" : "password"}
                className={`${AUTH_FIELD_CLASS} mt-2 px-4`}
                placeholder={t("auth.forgot.confirm_new_password", "Confirm new password")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                {...authInvalidProps("forgot-confirm-password-error", resetValidation.errors.confirmPassword)}
              />
              <AuthFieldError id="forgot-confirm-password-error" message={resetValidation.errors.confirmPassword} />
            </label>

            <button
              type="submit"
              disabled={isResetting || otp.length !== 6 || !newPassword || !confirmPassword}
              className={AUTH_SUBMIT_CLASS}
            >
              {isResetting
                ? t("auth.forgot.resetting", "Resetting...")
                : t("auth.forgot.reset_password", "Reset password")}
            </button>

            <div className="mt-6 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-gray-600 underline disabled:opacity-60"
              >
                {isResending ? t("states.sending", "Sending...") : t("auth.shared.resend_code", "Resend code")}
              </button>
              <button type="button" onClick={backToEmail} className="text-gray-600 underline">
                {t("auth.forgot.different_email", "Use a different email")}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
