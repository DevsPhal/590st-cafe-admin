import type { Role } from "@/store/api/types";

/** Mirrors the API's staff roles; the server remains the authorization boundary. */
export function canAccessAdminPage(role: Role | undefined, pathname: string): boolean {
  if (!role || role === "CUSTOMER") return false;
  const route = pathname.split("/")[1] || "dashboard";
  // Admin and barista each ring up walk-in sales against their own endpoint pair
  // (/api/admin/orders vs /api/barista/orders) — both are staffed tills, not a barista-only one.
  if (route === "pos") return true;
  // Every signed-in staff account owns its profile and its own preferences, so both are open
  // to baristas too — the admin-only controls inside Settings are gated in the page itself.
  if (route === "profile" || route === "settings" || route === "attendance") return true;
  if (route === "barista-queue" || route === "notifications" || route === "stock-alerts") return true;
  if (route === "categories" || route === "reports") return true;
  // Opened from an order on either the dashboard or the queue board; the API picks the endpoint.
  if (route === "invoices") return true;
  if (route === "inventory") return true;
  // Product creation and configuration are separate pages with write controls.
  if (route === "products" && pathname.replace(/\/$/, "") === "/products") return true;
  if (role === "BARISTA") return false;
  if (route === "users" || route === "customers") return role === "SUPER_ADMIN";
  return true;
}

export function adminHome(role: Role | undefined): string {
  return role === "BARISTA" ? "/barista-queue" : "/";
}
