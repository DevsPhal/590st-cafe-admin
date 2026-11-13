"use client";

import { UnavailableFeature } from "@/components/common/UnavailableFeature";
import { useI18n } from "@/contexts/I18nContext";

export default function PointManagementView() {
  const { t } = useI18n();
  return <UnavailableFeature title={t("points.title", "Loyalty points")}
    description={t("points.description", "A loyalty program has not been set up. Customer accounts are available in the Customers directory.")}
    href="/customers" linkLabel={t("points.link", "View customer accounts")} />;
}