"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import toast, { type Toast } from "react-hot-toast";

import { UserAvatar } from "@/components/common/UserAvatar";
import {
  consumeWelcomePending,
  firstName,
  timeOfDayGreeting,
} from "@/lib/welcomeToast";
import { humanise } from "@/lib/utils";
import { useGetCurrentUserQuery } from "@/store/api/authApi";
import { translate, useI18n } from "@/contexts/I18nContext";

const WELCOME_DURATION = 5000;

interface WelcomeToastCardProps {
  t: Toast;
  greeting: string;
  title: string;
  description: string;
  fullName: string;
  avatarUrl?: string | null;
}

function WelcomeToastCard({
  t,
  greeting,
  title,
  description,
  fullName,
  avatarUrl,
}: WelcomeToastCardProps) {
  const { t: tr } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`welcome_toast ${t.visible ? "welcome_toast_enter" : "welcome_toast_leave"}`}
    >
      <span aria-hidden="true" className="contents">
        <UserAvatar src={avatarUrl} name={fullName} sizes="44px" className="welcome_toast_avatar" />
      </span>
      <div className="welcome_toast_text">
        <p className="welcome_toast_eyebrow">{greeting}</p>
        <p className="welcome_toast_title">{title}</p>
        <p className="welcome_toast_desc">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label={tr("toast.dismiss_short", "Dismiss")}
        className="welcome_toast_close"
      >
        <X aria-hidden="true" />
      </button>
      <span
        className="welcome_toast_progress"
        style={{ animationDuration: `${WELCOME_DURATION}ms` }}
      />
    </div>
  );
}

export function LoginWelcome() {
  const { data: user } = useGetCurrentUserQuery();

  useEffect(() => {
    if (!user || !consumeWelcomePending()) return;

    const name = firstName(user.fullName);
    toast.custom(
      (t) => (
        <WelcomeToastCard
          t={t}
          greeting={timeOfDayGreeting()}
          title={name ? translate("welcome.back_name", "Welcome back, {name}", { name }) : translate("welcome.back", "Welcome back")}
          description={translate("welcome.signed_in_as", "Signed in as {role}", { role: translate(`enums.role.${user.role}`, humanise(user.role)) })}
          fullName={user.fullName}
          avatarUrl={user.avatarUrl}
        />
      ),
      { id: "login-welcome", duration: WELCOME_DURATION },
    );
  }, [user]);

  return null;
}
