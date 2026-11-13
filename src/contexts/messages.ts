// Every dictionary in public/locales, bundled with the app so a language switch is synchronous:
// no network round trip, no partially loaded language, and nothing stale to cache.
// Adding a page dictionary means adding its import for both languages below.
import type { Locale } from "./locales";
import type { TranslationMessages } from "./translate";

import en_attendance from "../../public/locales/en/attendance.json";
import en_audit from "../../public/locales/en/audit.json";
import en_auth from "../../public/locales/en/auth.json";
import en_banners from "../../public/locales/en/banners.json";
import en_barista from "../../public/locales/en/barista.json";
import en_categories from "../../public/locales/en/categories.json";
import en_common from "../../public/locales/en/common.json";
import en_dashboard from "../../public/locales/en/dashboard.json";
import en_events from "../../public/locales/en/events.json";
import en_inventory from "../../public/locales/en/inventory.json";
import en_notifications from "../../public/locales/en/notifications.json";
import en_orders from "../../public/locales/en/orders.json";
import en_payments from "../../public/locales/en/payments.json";
import en_points from "../../public/locales/en/points.json";
import en_pos from "../../public/locales/en/pos.json";
import en_products from "../../public/locales/en/products.json";
import en_profile from "../../public/locales/en/profile.json";
import en_promotions from "../../public/locales/en/promotions.json";
import en_reports from "../../public/locales/en/reports.json";
import en_settings from "../../public/locales/en/settings.json";
import en_sidebar from "../../public/locales/en/sidebar.json";
import en_staff from "../../public/locales/en/staff.json";
import en_stock_alerts from "../../public/locales/en/stock_alerts.json";
import en_tables from "../../public/locales/en/tables.json";
import en_users from "../../public/locales/en/users.json";

import kh_attendance from "../../public/locales/kh/attendance.json";
import kh_audit from "../../public/locales/kh/audit.json";
import kh_auth from "../../public/locales/kh/auth.json";
import kh_banners from "../../public/locales/kh/banners.json";
import kh_barista from "../../public/locales/kh/barista.json";
import kh_categories from "../../public/locales/kh/categories.json";
import kh_common from "../../public/locales/kh/common.json";
import kh_dashboard from "../../public/locales/kh/dashboard.json";
import kh_events from "../../public/locales/kh/events.json";
import kh_inventory from "../../public/locales/kh/inventory.json";
import kh_notifications from "../../public/locales/kh/notifications.json";
import kh_orders from "../../public/locales/kh/orders.json";
import kh_payments from "../../public/locales/kh/payments.json";
import kh_points from "../../public/locales/kh/points.json";
import kh_pos from "../../public/locales/kh/pos.json";
import kh_products from "../../public/locales/kh/products.json";
import kh_profile from "../../public/locales/kh/profile.json";
import kh_promotions from "../../public/locales/kh/promotions.json";
import kh_reports from "../../public/locales/kh/reports.json";
import kh_settings from "../../public/locales/kh/settings.json";
import kh_sidebar from "../../public/locales/kh/sidebar.json";
import kh_staff from "../../public/locales/kh/staff.json";
import kh_stock_alerts from "../../public/locales/kh/stock_alerts.json";
import kh_tables from "../../public/locales/kh/tables.json";
import kh_users from "../../public/locales/kh/users.json";

// Shared dictionaries sit at the root (e.g. "actions.save"); each page dictionary under its own name (e.g. "orders.title").
const en: TranslationMessages = {
  ...en_common,
  ...en_sidebar,
  attendance: en_attendance,
  audit: en_audit,
  auth: en_auth,
  banners: en_banners,
  barista: en_barista,
  categories: en_categories,
  dashboard: en_dashboard,
  events: en_events,
  inventory: en_inventory,
  notifications: en_notifications,
  orders: en_orders,
  payments: en_payments,
  points: en_points,
  pos: en_pos,
  products: en_products,
  profile: en_profile,
  promotions: en_promotions,
  reports: en_reports,
  settings: en_settings,
  staff: en_staff,
  stock_alerts: en_stock_alerts,
  tables: en_tables,
  users: en_users,
};

// Shared dictionaries sit at the root (e.g. "actions.save"); each page dictionary under its own name (e.g. "orders.title").
const kh: TranslationMessages = {
  ...kh_common,
  ...kh_sidebar,
  attendance: kh_attendance,
  audit: kh_audit,
  auth: kh_auth,
  banners: kh_banners,
  barista: kh_barista,
  categories: kh_categories,
  dashboard: kh_dashboard,
  events: kh_events,
  inventory: kh_inventory,
  notifications: kh_notifications,
  orders: kh_orders,
  payments: kh_payments,
  points: kh_points,
  pos: kh_pos,
  products: kh_products,
  profile: kh_profile,
  promotions: kh_promotions,
  reports: kh_reports,
  settings: kh_settings,
  staff: kh_staff,
  stock_alerts: kh_stock_alerts,
  tables: kh_tables,
  users: kh_users,
};

export const MESSAGES: Record<Locale, TranslationMessages> = { en, kh };
