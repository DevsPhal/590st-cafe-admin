"use client";

import { UnavailableFeature } from "@/components/common/UnavailableFeature";
import { useI18n } from "@/contexts/I18nContext";

export default function PromotionManagementView() {
  const { t } = useI18n();
  return <UnavailableFeature title={t("promotions.title", "Promotion codes")}
    description={t("promotions.description", "Promotion codes and redemption tracking are not supported yet. You can manage product discounts on the Products page.")}
    href="/products" linkLabel={t("promotions.link", "Manage product discounts")} />;
}