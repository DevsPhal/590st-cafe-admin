"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import toast, { type Toast } from "react-hot-toast";

import {
  consumeWelcomePending,
  firstName,
  initials,
  timeOfDayGreeting,
} from "@/lib/welcomeToast";
import { humanise } from "@/lib/utils";
import { useGetCurrentUserQuery } from "@/store/api/authApi";

const WELCOME_DURATION = 5000;

interface WelcomeToastCardProps {
  t: Toast;
  greeting: string;
  title: string;
  description: string;
  initials: string;
  avatarUrl?: string | null;
}

//toast card for the welcome toast, with a close button and a progress bar
function WelcomeToastCard({
  t,
  greeting,
  title,
  description,
  initials,
  avatarUrl,
}: WelcomeToastCardProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`welcome_toast ${t.visible ? "welcome_toast_enter" : "welcome_toast_leave"}`}
    >
      <span className="welcome_toast_avatar" aria-hidden="true">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            fill
            sizes="44px"
            className="welcome_toast_avatar_img"
          />
        ) : (
          initials
        )}
      </span>
      <div className="welcome_toast_text">
        <p className="welcome_toast_eyebrow">{greeting}</p>
        <p className="welcome_toast_title">{title}</p>
        <p className="welcome_toast_desc">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss"
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

/**
 * Greets the admin or barista by name right after they sign in (see lib/welcomeToast).
 * Mounted inside AuthGuard, so the profile is already loaded; renders nothing itself.
 */
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
          title={name ? `Welcome back, ${name}` : "Welcome back"}
          description={`Signed in as ${humanise(user.role)}`}
          initials={initials(user.fullName)}
          avatarUrl={user.avatarUrl}
        />
      ),
      { id: "login-welcome", duration: WELCOME_DURATION },
    );
  }, [user]);

  return null;
}
