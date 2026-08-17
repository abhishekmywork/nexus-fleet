import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Settings,
  ShieldCheck,
  Building2,
  Car,
  MapPin,
  UserCheck,
  Radio,
  Signal,
  Bell,
  Fence,
  Map,
  ClipboardList,
  ScrollText,
  CreditCard,
  Crown,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Page permission required to see this item. Undefined = visible to all. */
  permission?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar navigation configuration. Add new routes here to extend the shell.
 * Items with a `permission` are only shown to users granted that page permission.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Live Map", href: "/live-map", icon: Map, permission: "page:live_map" },
      { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "page:dashboard" },
      { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "page:analytics" },
      { title: "Reports", href: "/reports", icon: ClipboardList, permission: "page:reports" },
    ],
  },
  {
    label: "Fleet",
    items: [
      { title: "Vehicles", href: "/vehicles", icon: Car, permission: "page:vehicles" },
      { title: "Serving Areas", href: "/serving-areas", icon: MapPin, permission: "page:serving_areas" },
      { title: "Drivers", href: "/drivers", icon: UserCheck, permission: "page:drivers" },
      { title: "GPS Devices", href: "/gps-devices", icon: Radio, permission: "page:gps_devices" },
      { title: "Telemetry", href: "/telemetry", icon: Signal, permission: "page:telemetry" },
      { title: "Events", href: "/events", icon: Bell, permission: "page:events" },
      { title: "Geofences", href: "/geofences", icon: Fence, permission: "page:geofences" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Users", href: "/users", icon: Users, permission: "page:users" },
      { title: "Products", href: "/products", icon: Package, permission: "page:products" },
    ],
  },
  {
    label: "Access control",
    items: [
      { title: "Roles", href: "/roles", icon: ShieldCheck, permission: "page:roles" },
      { title: "Tenants", href: "/tenants", icon: Building2, permission: "page:tenants" },
    ],
  },
  {
    label: "Billing",
    items: [
      { title: "Plans", href: "/subscription-plans", icon: CreditCard, permission: "page:subscription_plans" },
      { title: "Subscriptions", href: "/subscriptions", icon: Crown, permission: "page:subscriptions" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Activity Logs", href: "/activity-logs", icon: ScrollText, permission: "page:activity_logs" },
      { title: "Settings", href: "/settings", icon: Settings, permission: "page:settings" },
    ],
  },
];
