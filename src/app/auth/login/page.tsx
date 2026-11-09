"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import type { z } from "zod";
import {
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  useLazyGetCurrentUserQuery,
  useLoginMutation,
  useLoginPhoneMutation,
  useLogoutMutation,
  useResendOtpMutation,
  useVerifyLoginOtpMutation,
} from "@/store/api/authApi";
import { formatPhoneInput, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER } from "@/lib/phone";
import { emailLoginSchema, otpSchema, phoneLoginSchema } from "@/lib/formSchemas";
import { cn } from "@/lib/utils";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { useI18n } from "@/contexts/I18nContext";
import { ForgotPasswordDialog } from "@/features/auth/components/ForgotPasswordDialog";
import { LoginBrandVisual } from "@/features/auth/components/LoginBrandVisual";
import { LogoMark } from "@/components/common/LogoMark";
import {
  AUTH_DIALOG_BADGE_CLASS,
  AUTH_DIALOG_CLASS,
  AUTH_FIELD_CLASS as FIELD_CLASS,
  AUTH_SUBMIT_CLASS as SUBMIT_CLASS,
} from "@/features/auth/authStyles";
import { AuthFieldError, authInvalidProps } from "@/features/auth/components/AuthFieldError";
import { useFormErrors } from "@/hooks/useFormErrors";

function resolveNextPath(): string {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

type LoginMethod = "EMAIL" | "PHONE";

const LOGIN_METHOD_KEY = "loginMethod";

const parseLoginMethod = (raw: string | null): LoginMethod =>
  raw === "PHONE" || raw === "TELEGRAM" ? "PHONE" : "EMAIL";

type FieldName = "email" | "password" | "phoneNumber";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_IDS: Record<FieldName, string> = {
  email: "login-email",
  password: "login-password",
  phoneNumber: "login-phone",
};

// Same schemas as before; their messages now sit under the field they belong to instead of in a toast.
function issuesByField(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "password" || field === "phoneNumber") && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function focusFirstInvalid(errors: FieldErrors) {
  const first = (Object.keys(FIELD_IDS) as FieldName[]).find((field) => errors[field]);
  if (first) document.getElementById(FIELD_IDS[first])?.focus();
}


function FieldIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-(--cafe-subtle)"
    />
  );
}

const fieldClass = (invalid: boolean, extra: string) =>
  cn(
    FIELD_CLASS,
    extra,
    invalid && "border-(--color-danger) hover:border-(--color-danger) focus:border-(--color-danger) focus:ring-(--color-danger)/15",
  );

export default function AuthPage() {
  const router = useRouter();
  const { t } = useI18n();

  const loginMethods: {
    value: LoginMethod;
    label: string;
    icon: typeof Mail;
    hint: string;
  }[] = [
    {
      value: "EMAIL",
      label: t("fields.email", "Email"),
      icon: Mail,
      hint: t(
        "auth.login.hints.email",
        "Enter your email and password to access the admin dashboard",
      ),
    },
    {
      value: "PHONE",
      label: t("auth.login.phone_number", "Phone number"),
      icon: Phone,
      hint: t(
        "auth.login.hints.phone",
        "Invited over Telegram? Enter your phone number and we'll send a code to your Telegram",
      ),
    },
  ];

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [rememberMe, setRememberMe] = useState(true);
  const [method, setMethod] = useLocalStorageState<LoginMethod>(
    LOGIN_METHOD_KEY,
    parseLoginMethod,
  );
  const chooseMethod = (next: LoginMethod) => {
    setMethod(next);
    setFieldErrors({});
    setFormError(null);
  };
  const clearFieldError = (field: FieldName) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [loginTicket, setLoginTicket] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const otpValidation = useFormErrors(otpSchema, { otp });

  const [login, { isLoading: isLoggingIn }] = useLoginMutation();
  const [loginPhone, { isLoading: isSendingPhoneCode }] =
    useLoginPhoneMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyLoginOtpMutation();
  const [resendOtp, { isLoading: isResending }] = useResendOtpMutation();
  const [fetchCurrentUser] = useLazyGetCurrentUserQuery();
  const [logout] = useLogoutMutation();
  const finishSignIn = async () => {
    let role;
    try {
      role = (await fetchCurrentUser(undefined, false).unwrap()).role;
    } catch {
      role = undefined;
    }
    if (role !== "CUSTOMER") {
      router.push(resolveNextPath());
      return;
    }
    try {
      await logout().unwrap();
    } catch {}
    setLoginTicket(null);
    setOtp("");
    setPassword("");
    setFormError(
      t(
        "auth.toast.customer_account",
        "This is a customer account. Customer accounts can't open the staff dashboard — sign in with an admin or barista account.",
      ),
    );
  };

  const handleCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const checked = emailLoginSchema.safeParse({ email, password });
    if (!checked.success) {
      const errors = issuesByField(checked.error);
      setFieldErrors(errors);
      focusFirstInvalid(errors);
      return;
    }
    setFieldErrors({});
    const credentials = checked.data;

    try {
      const result = await login({ ...credentials, remember: rememberMe }).unwrap();
      if (result.otpRequired && result.loginTicket) {
        setLoginTicket(result.loginTicket);
      } else {
        await finishSignIn();
      }
    } catch (err) {
      setFormError(
        apiErrorMessage(
          err as Parameters<typeof apiErrorMessage>[0],
          t(
            "auth.errors.login_failed",
            "Login failed. Check your credentials and try again.",
          ),
        ),
      );
    }
  };

  const handlePhone = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const checked = phoneLoginSchema.safeParse({ phoneNumber: phone });
    if (!checked.success) {
      const errors = issuesByField(checked.error);
      setFieldErrors(errors);
      focusFirstInvalid(errors);
      return;
    }
    setFieldErrors({});
    const parsed = checked.data;

    try {
      const result = await loginPhone(parsed).unwrap();
      if (result.loginTicket) setLoginTicket(result.loginTicket);
    } catch (err) {
      setFormError(
        apiErrorMessage(
          err as Parameters<typeof apiErrorMessage>[0],
          t(
            "auth.errors.send_code_failed",
            "Could not send a code to this number. Please try again.",
          ),
        ),
      );
    }
  };

  const handleOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loginTicket) return;
    const parsed = otpValidation.validate();
    if (!parsed) return;

    try {
      await verifyOtp({
        loginTicket,
        otp: parsed.otp,
        remember: rememberMe,
      }).unwrap();
      await finishSignIn();
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err as Parameters<typeof apiErrorMessage>[0],
          t(
            "auth.errors.code_not_accepted",
            "That code was not accepted. Check it and try again.",
          ),
        ),
      );
    }
  };

  const handleResend = async () => {
    if (!loginTicket) return;
    try {
      await resendOtp({ purpose: "LOGIN", loginTicket }).unwrap();
    } catch (err) {
      toast.error(apiErrorMessage(err as Parameters<typeof apiErrorMessage>[0]));
    }
  };

  const otpStage = loginTicket !== null;
  const [otpSentBefore, otpSentAfter] = (
    method === "PHONE"
      ? t(
          "auth.otp.sent_telegram",
          "We sent a 6-digit verification code to your Telegram for {target}",
        )
      : t("auth.otp.sent_email", "We sent a 6-digit verification code to {target}")
  ).split("{target}");

  const backToCredentials = () => {
    setLoginTicket(null);
    setOtp("");
  };

  const errorId = (field: FieldName) => `${FIELD_IDS[field]}-error`;
  const describedBy = (field: FieldName, ...extra: string[]) =>
    [fieldErrors[field] ? errorId(field) : null, ...extra].filter(Boolean).join(" ") || undefined;

  // "Keep me logged in" applies to both sign-in methods; "Forgot password?" only to email.
  const rememberRow: ReactNode = (
    <div className="mt-5 short:mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-(--cafe-muted) select-none">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-md border border-(--cafe-line-strong) bg-white text-transparent transition-colors peer-checked:border-(--cafe-espresso) peer-checked:bg-(--cafe-espresso) peer-checked:text-(--cafe-foam) peer-focus-visible:ring-2 peer-focus-visible:ring-(--cafe-caramel) peer-focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        {t("auth.login.remember_me", "Keep me logged in")}
      </label>
      {method === "EMAIL" ? (
        <button
          type="button"
          onClick={() => setForgotOpen(true)}
          className="rounded text-sm font-semibold text-(--cafe-caramel-text) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-(--cafe-caramel) focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {t("auth.login.forgot_password", "Forgot password?")}
        </button>
      ) : null}
    </div>
  );

  const formAlert = formError ? (
    <div
      role="alert"
      className="mt-5 flex items-start gap-2.5 rounded-xl border border-(--color-danger)/30 bg-(--danger-bg) px-3.5 py-3 text-sm text-(--color-danger)"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>{formError}</p>
    </div>
  ) : null;

  const submitClass = cn(SUBMIT_CLASS, "mt-6 short:mt-5 inline-flex items-center justify-center gap-2");

  return (
    <main className="flex min-h-dvh items-center bg-(--cafe-cream) px-3 py-4 text-(--cafe-espresso) sm:px-6 sm:py-8 short:sm:py-4">
      <div className="mx-auto grid w-full max-w-[1180px] overflow-hidden rounded-[24px] bg-white shadow-[0_30px_70px_-40px_color-mix(in_srgb,var(--shadow-espresso)_45%,transparent)] ring-1 ring-(--cafe-line) sm:rounded-[28px] lg:min-h-[min(780px,calc(100dvh-4rem))] short:lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="flex items-center justify-center px-5 py-9 sm:px-12 sm:py-12 lg:px-14 short:sm:py-8">
          <div className="w-full max-w-[400px]">
            <LogoMark className="h-12 w-auto short:h-10" />

            <p className="mt-10 short:mt-6 text-xs font-semibold tracking-[0.18em] text-(--cafe-caramel-text) uppercase">
              {t("auth.login.eyebrow", "Staff sign-in")}
            </p>
            <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-tight sm:text-[2.25rem]">
              {t("auth.login.heading", "Welcome back.")}
            </h1>
            <p className="mt-2 text-[15px] text-(--cafe-muted)">
              {t("auth.login.subtitle", "Sign in to manage your café operations.")}
            </p>

            <div
              role="group"
              aria-label={t("auth.login.method_aria", "Sign-in method")}
              className="mt-8 short:mt-5 grid grid-cols-2 gap-1 rounded-xl bg-(--cafe-sand) p-1"
            >
              {loginMethods.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={method === value}
                  onClick={() => chooseMethod(value)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-(--cafe-caramel) focus-visible:outline-none motion-reduce:transition-none",
                    method === value
                      ? "bg-white text-(--cafe-espresso) shadow-[0_1px_3px_color-mix(in_srgb,var(--shadow-espresso)_12%,transparent)]"
                      : "text-(--cafe-muted) hover:text-(--cafe-espresso)",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </button>
              ))}
            </div>
            <p aria-live="polite" className="mt-3 short:mt-2 text-[13px] leading-relaxed text-(--cafe-muted)">
              {loginMethods.find(({ value }) => value === method)?.hint}
            </p>

            {method === "PHONE" ? (
              <form onSubmit={handlePhone} noValidate className="mt-5 short:mt-4">
                <label htmlFor={FIELD_IDS.phoneNumber} className="block text-sm font-medium">
                  {t("auth.login.phone_number", "Phone number")}
                </label>
                <div className="relative mt-2">
                  <input
                    id={FIELD_IDS.phoneNumber}
                    type="tel"
                    inputMode="tel"
                    className={fieldClass(Boolean(fieldErrors.phoneNumber), "pr-4 pl-11 tabular-nums")}
                    placeholder={PHONE_PLACEHOLDER}
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatPhoneInput(e.target.value));
                      clearFieldError("phoneNumber");
                    }}
                    maxLength={PHONE_MAX_LENGTH}
                    autoComplete="tel-national"
                    aria-invalid={Boolean(fieldErrors.phoneNumber)}
                    aria-describedby={describedBy("phoneNumber", "login-phone-help")}
                    required
                  />
                  <FieldIcon icon={Phone} />
                </div>
                <AuthFieldError id={errorId("phoneNumber")} message={fieldErrors.phoneNumber} />
                <p id="login-phone-help" className="mt-2 text-xs leading-relaxed text-(--cafe-muted)">
                  {t(
                    "auth.login.phone_help",
                    "The number your admin invited. The code arrives in the Telegram chat that accepted the invite.",
                  )}
                </p>

                {rememberRow}
                {formAlert}

                <button type="submit" disabled={isSendingPhoneCode} className={submitClass}>
                  {isSendingPhoneCode ? (
                    <>
                      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
                      {t("auth.shared.sending_code", "Sending code...")}
                    </>
                  ) : (
                    t("auth.login.send_code", "Send code")
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCredentials} noValidate className="mt-5 short:mt-4">
                <label htmlFor={FIELD_IDS.email} className="block text-sm font-medium">
                  {t("fields.email", "Email")}
                </label>
                <div className="relative mt-2">
                  <input
                    id={FIELD_IDS.email}
                    type="email"
                    inputMode="email"
                    className={fieldClass(Boolean(fieldErrors.email), "pr-4 pl-11")}
                    placeholder="admin@590st.cafe"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError("email");
                    }}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={describedBy("email")}
                    required
                  />
                  <FieldIcon icon={Mail} />
                </div>
                <AuthFieldError id={errorId("email")} message={fieldErrors.email} />

                <label htmlFor={FIELD_IDS.password} className="mt-5 short:mt-4 block text-sm font-medium">
                  {t("fields.password", "Password")}
                </label>
                <div className="relative mt-2">
                  <input
                    id={FIELD_IDS.password}
                    type={showPassword ? "text" : "password"}
                    className={fieldClass(Boolean(fieldErrors.password), "pr-12 pl-11")}
                    placeholder={t("fields.password", "Password")}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError("password");
                    }}
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={describedBy("password")}
                    required
                  />
                  <FieldIcon icon={LockKeyhole} />
                  <button
                    type="button"
                    className="absolute top-1/2 right-1.5 grid size-9 pointer-coarse:size-11 -translate-y-1/2 place-items-center rounded-lg text-(--cafe-subtle) transition-colors hover:bg-(--cafe-sand) hover:text-(--cafe-espresso) focus-visible:ring-2 focus-visible:ring-(--cafe-caramel) focus-visible:outline-none motion-reduce:transition-none"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-controls={FIELD_IDS.password}
                    aria-label={
                      showPassword
                        ? t("auth.shared.hide_password", "Hide password")
                        : t("auth.shared.show_password", "Show password")
                    }
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden className="size-4.5" />
                    ) : (
                      <Eye aria-hidden className="size-4.5" />
                    )}
                  </button>
                </div>
                <AuthFieldError id={errorId("password")} message={fieldErrors.password} />

                {rememberRow}
                {formAlert}

                <button type="submit" disabled={isLoggingIn} className={submitClass}>
                  {isLoggingIn ? (
                    <>
                      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
                      {t("auth.shared.signing_in", "Signing in...")}
                    </>
                  ) : (
                    t("auth.login.submit", "Sign in")
                  )}
                </button>
              </form>
            )}
          </div>
        </section>

        <div className="hidden p-3 lg:block">
          <LoginBrandVisual />
        </div>
      </div>

      <Dialog
        open={otpStage}
        onOpenChange={(next) => {
          if (!next && !isVerifying) backToCredentials();
        }}
      >
        <DialogContent className={AUTH_DIALOG_CLASS}>
          <form onSubmit={handleOtp} className="px-6 py-10 sm:px-10">
            <div className={AUTH_DIALOG_BADGE_CLASS}>
              <ShieldCheck className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold">
                {t("auth.otp.heading", "Enter your code")}
              </h1>
              <p className="mt-3 text-sm text-(--cafe-muted)">
                {otpSentBefore}
                <span className="font-medium text-(--cafe-espresso)">
                  {method === "PHONE" ? phone : email}
                </span>
                {otpSentAfter}
              </p>
            </div>

            <label className="mt-8 block text-sm font-medium">
              {t("auth.shared.verification_code", "Verification code")}
              <input
                className={`${FIELD_CLASS} mt-2 h-12 text-center text-2xl tracking-[0.5em]`}
                placeholder="000000"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                {...authInvalidProps("login-otp-error", otpValidation.errors.otp)}
              />
              <AuthFieldError id="login-otp-error" message={otpValidation.errors.otp} />
            </label>

            <button
              type="submit"
              disabled={isVerifying || otp.length !== 6}
              className={SUBMIT_CLASS}
            >
              {isVerifying
                ? t("auth.otp.verifying", "Verifying...")
                : t("auth.otp.verify", "Verify and sign in")}
            </button>

            <div className="mt-6 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-(--cafe-muted) underline disabled:opacity-60"
              >
                {isResending
                  ? t("states.sending", "Sending...")
                  : t("auth.shared.resend_code", "Resend code")}
              </button>
              <button
                type="button"
                onClick={backToCredentials}
                className="text-(--cafe-muted) underline"
              >
                {t("auth.otp.different_account", "Use a different account")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ForgotPasswordDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        initialEmail={email}
        onReset={(resetEmail) => {
          setEmail(resetEmail);
          setPassword("");
          toast.success(
            t(
              "auth.toast.password_reset",
              "Password reset. Log in with your new password.",
            ),
          );
        }}
      />
    </main>
  );
}
