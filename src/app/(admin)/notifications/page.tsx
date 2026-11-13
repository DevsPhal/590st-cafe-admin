"use client";

import { useEffect } from "react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions } from "@/components/common/AdminKit";
import {
  OperationalAlertsContent,
  useOperationalAlerts,
} from "@/components/common/OperationalAlerts";
import { ContactInbox } from "@/features/notification/ContactInbox";
import { useI18n } from "@/contexts/I18nContext";

export default function Page() {
  const { t } = useI18n();
  const alerts = useOperationalAlerts();
  const { markSeen, count } = alerts;
  useEffect(() => {
    if (count !== undefined) markSeen();
  }, [count, markSeen]);
  // Positioned so the scroller contains the sr-only labels; unpositioned, they stretch the document past the shell.
  return (
    <PageShell contentClassName="relative">
      <PageHeader
        title={t("notifications.title", "Current alerts")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("notifications.title", "Current alerts") },
        ]}
        rightSlot={<AdminTopActions />}
      />
      <OperationalAlertsContent alerts={alerts} showMessages={false} />
      <ContactInbox />
    </PageShell>
  );
}
