"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { UserAvatar } from "@/components/common/UserAvatar";
import { useGetCurrentUserQuery, useLogoutMutation } from "@/store/api/authApi";
import { titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useI18n } from "@/contexts/I18nContext";

export function SidebarUser({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading } = useGetCurrentUserQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { t } = useI18n();

  const name = user?.fullName
    ? titleCase(user.fullName)
    : isLoading
      ? t("states.loading", "Loading...")
      : t("account.account", "Account");
  const role = user?.role ? enumLabel(t, "role", user.role) : (user?.email ?? "");
  const isOnProfile = pathname === "/profile";

  const handleLogout = async () => {
    if (
      !(await confirm({
        title: t("account.sign_out_title", "Sign out?"),
        description: t(
          "account.sign_out_description",
          "You'll need to log in again to access the admin dashboard.",
        ),
        confirmLabel: t("actions.sign_out", "Sign out"),
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await logout().unwrap();
    } catch {
    }
    router.replace("/auth/login");
  };

  return (
    <div className="flex items-center gap-3 sidebar_user">
      <Link
        href="/profile"
        onClick={onNavigate}
        aria-current={isOnProfile ? "page" : undefined}
        title={t("account.view_profile", "View and edit your profile")}
        className="sidebar_user_link flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:opacity-80"
      >
        <UserAvatar
          src={user?.avatarUrl}
          name={user?.fullName}
          sizes="36px"
          className="h-9 w-9 bg-(--brand-lime) text-sm font-semibold text-(--brand-ink)"
        />
        <span className="sidebar_user_text min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">
            {name}
          </span>
          <span className="block truncate text-xs text-white/65">{role}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label={t("actions.sign_out", "Sign out")}
        title={t("actions.sign_out", "Sign out")}
        className="sidebar_user_logout shrink-0 text-white/65 transition hover:text-white disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
      </button>
      {confirmDialog}
    </div>
  );
}
