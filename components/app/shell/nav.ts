import {
  BarChart3,
  Home,
  Inbox,
  Megaphone,
  Palette,
  Settings,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: (slug: string) => string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { id: "today", label: "Today", href: (s) => `/${s}/today`, icon: Home },
  { id: "review", label: "Review", href: (s) => `/${s}/review`, icon: Inbox },
  { id: "create", label: "Create", href: (s) => `/${s}/create`, icon: Sparkles },
  { id: "brand", label: "Brand", href: (s) => `/${s}/brand`, icon: Palette },
  { id: "leads", label: "Leads", href: (s) => `/${s}/leads`, icon: Users },
  { id: "campaigns", label: "Campaigns", href: (s) => `/${s}/campaigns`, icon: Megaphone },
  { id: "analytics", label: "Analytics", href: (s) => `/${s}/analytics`, icon: BarChart3 },
];

export const SECONDARY_NAV: NavItem[] = [
  { id: "billing", label: "Plan & credits", href: (s) => `/${s}/billing`, icon: Wallet },
  { id: "settings", label: "Settings", href: (s) => `/${s}/settings`, icon: Settings },
];

/** Mobile bottom tabs (spec §7.3): Today · Review · Create · Leads, the rest under More. */
export const MOBILE_TABS = ["today", "review", "create", "leads"];
