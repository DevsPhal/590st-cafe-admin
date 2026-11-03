import type { Role } from "@/store/api/types";

export function canAccessAdminPage(role: Role | undefined, pathname: string): boolean {
  if (!role || role === "CUSTOMER") return false;
  const route = pathname.split("/")[1] || "dashboard";
  if (route === "pos") return true;
  if (route === "profile" || route === "settings" || route === "attendance") return true;
  if (route === "barista-queue" || route === "notifications" || route === "stock-alerts") return true;
  if (route === "categories" || route === "reports") return true;
  if (route === "invoices") return true;
  if (route === "tables" || route === "payments") return true;
  // Baristas see stock and its history; the money side (reports) is for admins.
  if (route === "inventory") return role !== "BARISTA" || pathname.split("/")[2] !== "reports";
  if (route === "products" && pathname.replace(/\/$/, "") === "/products") return true;
  if (role === "BARISTA") return false;
  if (route === "users" || route === "customers") return role === "SUPER_ADMIN";
  return true;
}

export function adminHome(role: Role | undefined): string {
  return role === "BARISTA" ? "/barista-queue" : "/";
}
