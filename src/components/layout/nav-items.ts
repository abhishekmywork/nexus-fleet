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
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Permission required to see this item. Undefined = visible to all. */
  permission?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar navigation configuration. Add new routes here to extend the shell.
 * Items with a `permission` are only shown to users granted that permission.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Live Map", href: "/live-map", icon: Map, permission: "telemetry:read" },
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Analytics", href: "/analytics", icon: BarChart3 },
      { title: "Reports", href: "/reports", icon: ClipboardList },
    ],
  },
  {
    label: "Fleet",
    items: [
      { title: "Vehicles", href: "/vehicles", icon: Car, permission: "vehicles:read" },
      { title: "Serving Areas", href: "/serving-areas", icon: MapPin, permission: "serving_areas:read" },
      { title: "Drivers", href: "/drivers", icon: UserCheck, permission: "drivers:read" },
      { title: "GPS Devices", href: "/gps-devices", icon: Radio, permission: "gps_devices:read" },
      { title: "Telemetry", href: "/telemetry", icon: Signal, permission: "telemetry:read" },
      { title: "Events", href: "/events", icon: Bell, permission: "events:read" },
      { title: "Geofences", href: "/geofences", icon: Fence, permission: "geofences:read" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Users", href: "/users", icon: Users, permission: "users:read" },
      { title: "Products", href: "/products", icon: Package },
    ],
  },
  {
    label: "Access control",
    items: [
      { title: "Roles", href: "/roles", icon: ShieldCheck, permission: "roles:read" },
      { title: "Tenants", href: "/tenants", icon: Building2, permission: "tenants:read" },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: "/settings", icon: Settings }],
  },
];
