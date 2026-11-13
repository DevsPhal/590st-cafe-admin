"use client";

import { SidebarUser } from "@/components/layout/SidebarUser";

interface SidebarProfileProps {
  isMobile?: boolean;
  /** Called when the profile link is tapped, so the mobile menu can close. */
  onNavigate?: () => void;
}

function SidebarProfile({ isMobile = false, onNavigate }: SidebarProfileProps) {
  return (
    <div className={`${isMobile ? "px-4 py-4" : "px-4 pb-4"} text-white`}>
      <SidebarUser onNavigate={onNavigate} />
    </div>
  );
}

export default SidebarProfile;
