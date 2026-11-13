"use client";

import UserManagementView from "@/features/user/components/UserManagementView";
import { useI18n } from "@/contexts/I18nContext";

export default function CustomerManagementView() {
  const { t } = useI18n();
  return (
    <UserManagementView
      role="CUSTOMER"
      title={t("users.customers.title", "Customers")}
      emptyLabel={t(
        "users.customers.empty",
        "No customer accounts yet. Customers appear here once they register."
      )}
    />
  );
}
