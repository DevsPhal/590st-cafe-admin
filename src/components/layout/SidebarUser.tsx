"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useGetCurrentUserQuery, useLogoutMutation } from "@/store/api/authApi";
import { humanise, titleCase } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

//sidebar user card, with avatar, name, role, and a logout button. Clicking the name takes you to the profile page.
export function SidebarUser() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading } = useGetCurrentUserQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const { confirm, confirmDialog } = useConfirmDialog();

  const name = user?.fullName
    ? titleCase(user.fullName)
    : isLoading
      ? "Loading..."
      : "Account";
  const role = user?.role ? humanise(user.role) : (user?.email ?? "");
  const isOnProfile = pathname === "/profile";

  const handleLogout = async () => {
    if (
      !(await confirm({
        title: "Sign out?",
        description:
          "You'll need to log in again to access the admin dashboard.",
        confirmLabel: "Sign out",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await logout().unwrap();
    } catch {
      // onQueryStarted clears the session either way.
    }
    router.replace("/auth/login");
  };

  return (
    <div className="flex items-center gap-3 sidebar_user">
      <Link
        href="/profile"
        aria-current={isOnProfile ? "page" : undefined}
        title="View and edit your profile"
        className="sidebar_user_link flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:opacity-80"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-black">
          {user?.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </span>
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
        aria-label="Sign out"
        title="Sign out"
        className="sidebar_user_logout shrink-0 text-white/65 transition hover:text-white disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
      </button>
      {confirmDialog}
    </div>
  );
}
