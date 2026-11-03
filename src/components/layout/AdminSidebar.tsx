"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { navigationSections } from "@/constants/sidebar";
import { useState } from "react";
import SidebarProfile from "./MobileSidebar";
import { useI18n } from "@/contexts/I18nContext";
import { useSidebarCollapse } from "@/contexts/SidebarCollapseContext";
import { Menu, X } from "lucide-react";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { adminHome, canAccessAdminPage } from "@/lib/adminAccess";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isCollapsed } = useSidebarCollapse();
  const { t } = useI18n();
  const { role } = useCurrentRole();
  const sections = navigationSections.map((section) => ({ ...section, items: section.items.filter((item) => canAccessAdminPage(role, item.href)) })).filter((section) => section.items.length);
  // The most specific entry wins, so /inventory/history lights up "Inventory history" and not "Inventory" as well.
  const activeHref = sections
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => isNavItemActive(pathname, href))
    .sort((a, b) => b.length - a.length)[0];

  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  const logo = (
    <Link href={adminHome(role)} onClick={handleNavClick} className="logo_link">
      <Image src="/logos/logo-white.png" alt="590st CAFE" width={800} height={539} className="h-11 w-auto" priority />
    </Link>
  );

  const navItems = (
    <nav className="sidebar scrollbar">
      {sections.map((section) => (
        <div key={section.title || "home"} className="sidebar_section" data-divider={section.dividerBefore}>
          {section.title && ( <p className="title"> {t(section.titleKey, section.title)} </p> )}
          <div className="sidebar_wrap">
            {section.items.map((item) => {
              const isActive = item.href === activeHref;
              return (
                <Link key={item.name} href={item.href} onClick={handleNavClick} className={cn("sidebar_item", isActive ? "active" : "")}>
                  <item.icon className="icons" strokeWidth={2.2} />
                  <span className="sidebar_item_label">{t(item.label, item.name)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <div className="mobile_header">
        <div className="mobile_header_inner">
          {logo}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="mobile_menu_trigger" aria-label={t("sidebar_toggle.menu", "Toggle menu")}>
            {isMobileMenuOpen ? (
              <X className="mobile_trigger_icon" />
            ) : (
              <Menu className="mobile_trigger_icon" />
            )}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && ( <div className="mobile_overlay" onClick={() => setIsMobileMenuOpen(false)}/>)}
      <div className={cn("mobile_drawer", isMobileMenuOpen && "is_open")}> 
        {navItems}
        <SidebarProfile isMobile={true} onNavigate={handleNavClick} />
      </div>
      <div className={cn("desktop_sidebar", isCollapsed && "is_collapsed")}>
        <div className="logo_container">
          {logo}
        </div>
        {navItems}
        <SidebarProfile />
      </div>
    </>
  );
}
