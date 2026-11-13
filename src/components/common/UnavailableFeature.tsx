"use client";

import Link from "next/link";
import { PageShell } from "./PageShell";
import { PageHeader } from "./PageHeader";
import { AdminTopActions } from "./AdminKit";
import { useI18n } from "@/contexts/I18nContext";

export function UnavailableFeature({ title, description, href, linkLabel }: {
  title: string; description: string; href?: string; linkLabel?: string;
}) {
  const { t } = useI18n();
  return <PageShell>
    <PageHeader title={title} breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }, { label: title }]} rightSlot={<AdminTopActions />} />
    <section className="rounded-xl border p-6">
      <h2 className="font-semibold">{t("unavailable.heading", "{title} is not available yet", { title })}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {href && <Link href={href} className="mt-4 inline-block text-sm underline">{linkLabel}</Link>}
    </section>
  </PageShell>;
}
