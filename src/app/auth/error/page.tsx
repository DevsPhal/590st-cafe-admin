"use client";

import { clearTokens } from "@/lib/authStorage";
import { useI18n } from "@/contexts/I18nContext";

export default function Unauthorized() {
  const { t } = useI18n();
  const handleGoHome = () => {
    clearTokens();
    window.location.href = "/auth/login";
  };
  const [needRoleBefore, needRoleAfter] = t(
    "auth.error_page.need_role",
    "You need {role} role to access this application.",
  ).split("{role}");

  return (
    <div className="flex flex-col items-center justify-center h-dvh text-center bg-gray-100 text-gray-900">
      <h1 className="text-4xl font-bold mb-4">
        {t("auth.error_page.title", "Access Denied")}
      </h1>
      <p className="text-lg mb-6">
        {needRoleBefore}
        <span className="font-semibold">ADMIN</span>
        {needRoleAfter}
      </p>
      <button
        onClick={handleGoHome}
        className="mt-4 px-6 py-3 cursor-pointer bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
      >
        {t("auth.error_page.go_back", "Go Back")}
      </button>
    </div>
  );
}
