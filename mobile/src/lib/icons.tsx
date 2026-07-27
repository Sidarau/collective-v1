/**
 * One icon library, used consistently. No fake Apple SF Symbols.
 * `kind` values come from the data contracts; `name` values come from
 * mobile-routes.json and the More/settings fixtures.
 */

import { createElement } from "react";
import {
  Anchor,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Copy,
  Ellipsis,
  Euro,
  FileText,
  Inbox,
  Info,
  KeyRound,
  Landmark,
  LayoutGrid,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Mic,
  Minus,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Ship,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Sun,
  Terminal,
  Trash2,
  TriangleAlert,
  UserPlus,
  UserRound,
  UsersRound,
  UtensilsCrossed,
  Waves,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  // navigation + modules
  "calendar-days": CalendarDays,
  "users-round": UsersRound,
  landmark: Landmark,
  ellipsis: Ellipsis,
  inbox: Inbox,
  "user-plus": UserPlus,
  "message-square": MessageSquare,
  "layout-grid": LayoutGrid,
  "file-text": FileText,
  sun: Sun,
  euro: Euro,
  "book-open": BookOpen,
  "bar-chart-3": BarChart3,
  terminal: Terminal,
  settings: Settings,

  // operation kinds
  arrival: LogIn,
  departure: LogOut,
  access_request: KeyRound,
  application: UserPlus,
  follow_up: Bell,
  screening_call: Phone,
  space_reset: UsersRound,
  upkeep: Wrench,
  supplies: Package,
  contribution_due: Euro,
  contribution_received: Euro,
  stewardship_due: Euro,
  partner_payment: Euro,
  vendor_invoice: FileText,
  experience: UtensilsCrossed,
  note: StickyNote,

  // composer
  "key-round": KeyRound,
  wrench: Wrench,
  utensils: UtensilsCrossed,
  "sticky-note": StickyNote,

  // space types
  residence: Building2,
  studio: MapPin,
  berths: Anchor,
  land: Waves,
  boat: Ship,

  // ui
  check: Check,
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "arrow-left": ArrowLeft,
  search: Search,
  plus: Plus,
  minus: Minus,
  close: X,
  circle: Circle,
  "circle-check": CircleCheck,
  "circle-alert": CircleAlert,
  warning: TriangleAlert,
  info: Info,
  mic: Mic,
  send: Send,
  filters: SlidersHorizontal,
  phone: Phone,
  copy: Copy,
  trash: Trash2,
  pencil: Pencil,
  "calendar-range": CalendarRange,
  person: UserRound,
  verified: BadgeCheck,
  sparkles: Sparkles,
};

/** Falls back to a neutral dot rather than throwing on an unmapped kind. */
export function iconFor(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Circle;
}

/**
 * Renders an icon by name.
 *
 * Callers pass a string rather than resolving a component themselves: binding
 * a looked-up component to a capitalised local inside render makes React treat
 * it as a freshly created component type, which breaks reconciliation identity
 * across renders. `createElement` with the resolved type avoids that.
 */
export function Icon({
  name,
  size = 18,
  strokeWidth = 1.6,
  className,
  style,
}: {
  name: string | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return createElement(iconFor(name), {
    size,
    strokeWidth,
    className,
    style,
    "aria-hidden": true,
  });
}

export type { LucideIcon };
