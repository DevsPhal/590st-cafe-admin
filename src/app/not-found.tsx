"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gray-50 text-center">
      <h1 className="text-6xl font-black text-gray-900">404</h1>
      <p className="text-xl font-semibold text-gray-700">{t("not_found.title", "Page Not Found")}</p>
      <p className="text-sm text-gray-500">
        {t("not_found.description", "The page you are looking for does not exist.")}
      </p>
      <Link
        href="/dashboard"
        className="h-10 rounded-md bg-black px-6 text-sm font-semibold text-white leading-10 hover:bg-(--brand-ink-hover) transition"
      >
        {t("not_found.back", "Back to Dashboard")}
      </Link>
    </div>
  );
}
