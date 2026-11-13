"use client";

import { PanelLeft } from "lucide-react";
import { useSidebarCollapse } from "@/contexts/SidebarCollapseContext";
import { useI18n } from "@/contexts/I18nContext";

export function SidebarCollapseTrigger() {
  const { isCollapsed, toggleSidebar } = useSidebarCollapse();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="sidebar_collapse_trigger"
      aria-label={isCollapsed ? t("sidebar_toggle.expand", "Expand sidebar") : t("sidebar_toggle.collapse", "Collapse sidebar")}
      aria-expanded={!isCollapsed}
    >
      <PanelLeft className="sidebar_collapse_icon" strokeWidth={2.2} />
    </button>
  );
}
