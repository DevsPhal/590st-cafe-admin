import {
  Archive,
  BadgePercent,
  BarChart3,
  CircleDollarSign,
  CircleUserRound,
  Coffee,
  Home,
  Images,
  Bell,
  CalendarDays,
  CreditCard,
  TriangleAlert,
  Package,
  ClipboardList,
  ScrollText,
  Settings,
  Stamp,
  Tags,
  UserCog,
  UsersRound,
} from "lucide-react";

const navigationSections = [
  {
    title: "",
    dividerBefore: false,
    items: [{ name: "Home", href: "/", icon: Home, label: "nav_home" }],
  },
  {
    title: "Operations",
    dividerBefore: true,
    items: [
      {
        name: "POS",
        href: "/pos",
        icon: CircleDollarSign,
        label: "nav_pos",
      },
      {
        name: "Orders",
        href: "/orders",
        icon: ClipboardList,
        label: "nav_orders",
      },
      { name: "Barista", href: "/barista-queue", icon: Coffee, label: "nav_barista" },
      { name: "Payments", href: "/payments", icon: CreditCard, label: "nav_payments" },
      { name: "Current alerts", href: "/notifications", icon: Bell, label: "nav_notifications" },
    ],
  },
  {
    title: "Catalog",
    dividerBefore: false,
    items: [
      {
        name: "Products",
        href: "/products",
        icon: Package,
        label: "nav_products",
      },
      {
        name: "Categories",
        href: "/categories",
        icon: Tags,
        label: "nav_categories",
      },
      {
        name: "Inventory",
        href: "/inventory",
        icon: Archive,
        label: "nav_inventory",
      },
      { name: "Stock alerts", href: "/stock-alerts", icon: TriangleAlert, label: "nav_stock_alerts" },
      { name: "Events", href: "/events", icon: CalendarDays, label: "nav_events" },
      { name: "Banners", href: "/banners", icon: Images, label: "nav_banners" },
    ],
  },
  {
    title: "Customer & Rating",
    dividerBefore: false,
    items: [
      {
        name: "Customers",
        href: "/customers",
        icon: UsersRound,
        label: "nav_customers",
      },
      {
        name: "Promotion",
        href: "/promotions",
        icon: BadgePercent,
        label: "nav_promotion",
      },
      {
        name: "Points",
        href: "/points",
        icon: Stamp,
        label: "nav_points",
      },
      // { name: "Ratings", href: "/ratings", icon: Star, label: "nav_ratings" },
    ],
  },
  {
    title: "Analytics & Admin",
    dividerBefore: true,
    items: [
      { name: "Report", href: "/reports", icon: BarChart3, label: "nav_report" },
      { name: "User accounts", href: "/users", icon: UsersRound, label: "nav_users" },
      {
        name: "Staff",
        href: "/staff",
        icon: UserCog,
        label: "nav_staff",
      },
      { name: "Staff attendance", href: "/attendance", icon: CalendarDays, label: "nav_attendance" },
      {
        name: "Audit Trail",
        href: "/audit-logs",
        icon: ScrollText,
        label: "nav_audit",
      },
      {
        name: "My Profile",
        href: "/profile",
        icon: CircleUserRound,
        label: "nav_profile",
      },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        label: "nav_settings",
      },
    ],
  },
];

const navigation = navigationSections.flatMap((section) => section.items);

export { navigation, navigationSections };
