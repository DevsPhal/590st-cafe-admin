"use client";

import { useI18n } from "@/contexts/I18nContext";

export default function Error() {
  const { t } = useI18n();
  return <div>{t("errors.page", "Something went wrong!")}</div>;
}
