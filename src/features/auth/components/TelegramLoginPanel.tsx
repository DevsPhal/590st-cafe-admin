"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Phone, Send, ShieldCheck } from "lucide-react";

import { clearTokens } from "@/lib/authStorage";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useLoginTelegramMutation } from "@/store/api/authApi";
import type { TelegramWidgetAuthRequest } from "@/store/api/types";

declare global {
  interface Window {
    /** Telegram's widget calls this by name once the user confirms the login. */
    onTelegramAuth?: (user: TelegramWidgetAuthRequest) => void;
  }
}

const STEPS = [
  { icon: Send, text: "Tap “Log in with Telegram” below." },
  { icon: Phone, text: "Enter the phone number of your Telegram account." },
  { icon: ShieldCheck, text: "Confirm the login in your Telegram app." },
];

/** The `role` claim from a freshly issued access token — only read to keep customers out. */
function roleFromToken(accessToken: string): string | null {
  try {
    const payload = accessToken
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return (JSON.parse(atob(payload)) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

//login panel for Telegram login, with steps and a Telegram widget. The widget calls window.onTelegramAuth when the user confirms the login, which calls the API to log in and store the tokens. If the role is not ADMIN or BARISTA, it clears the tokens and shows an error.
export function TelegramLoginPanel({
  remember,
  onSuccess,
}: {
  remember: boolean;
  onSuccess: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loginTelegram, { isLoading }] = useLoginTelegramMutation();
  const [error, setError] = useState("");
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  // Read by the widget callback without re-injecting the script whenever these change.
  const latest = useRef({ remember, onSuccess });
  latest.current = { remember, onSuccess };

  useEffect(() => {
    const container = containerRef.current;
    if (!botUsername || !container) return;

    window.onTelegramAuth = async (user) => {
      setError("");
      try {
        const tokens = await loginTelegram({
          ...user,
          remember: latest.current.remember,
        }).unwrap();
        const role = roleFromToken(tokens.accessToken);
        if (role !== "ADMIN" && role !== "BARISTA") {
          clearTokens();
          setError(
            "This Telegram account isn't linked to a staff account. Use the Telegram account " +
              "that accepted your invite, or ask your admin to send the invite again.",
          );
          return;
        }
        latest.current.onSuccess();
      } catch (err) {
        setError(
          apiErrorMessage(
            err as never,
            "Telegram login failed. Please try again.",
          ),
        );
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername.replace(/^@/, ""));
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      container.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botUsername]);

  return (
    <div>
      <ol className="space-y-3">
        {STEPS.map(({ icon: Icon, text }, index) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#229ED9]/10 text-[#229ED9]">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-gray-700">
              <span className="mr-1 font-semibold text-gray-900">
                {index + 1}.
              </span>
              {text}
            </span>
          </li>
        ))}
      </ol>

      {botUsername ? (
        <div className="mt-8 flex min-h-12 flex-col items-center justify-center gap-3">
          <div ref={containerRef} className="flex justify-center" />
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Telegram login isn&apos;t configured. Set
          NEXT_PUBLIC_TELEGRAM_BOT_USERNAME to the bot&apos;s username and
          rebuild the dashboard.
        </p>
      )}

      {error ? (
        <p className="mt-4 text-center text-sm text-red-600">{error}</p>
      ) : null}

      <p className="mt-6 flex items-start gap-2 text-xs text-gray-500">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        For admins and baristas invited through Telegram. Use the same Telegram
        account that accepted your invite.
      </p>
    </div>
  );
}
