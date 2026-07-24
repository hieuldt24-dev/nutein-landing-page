import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  Mail,
  Newspaper,
  Package,
  ScrollText,
  Ticket,
  Users,
} from "lucide-react";

type NavIcon = typeof LayoutDashboard;

export interface AdminNavItem {
  href: string;
  label: string;
  icon: NavIcon;
  match: (pathname: string) => boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

export const STAFF_NAV: AdminNavGroup[] = [
  {
    id: "ops",
    label: "Vận hành",
    items: [
      {
        href: "/staff",
        label: "Tổng quan",
        icon: LayoutDashboard,
        match: (p) => p === "/staff",
      },
      {
        href: "/staff/orders",
        label: "Đơn hàng",
        icon: ClipboardList,
        match: (p) => p.startsWith("/staff/orders"),
      },
      {
        href: "/staff/products",
        label: "Sản phẩm",
        icon: Package,
        match: (p) => p.startsWith("/staff/products"),
      },
      {
        href: "/staff/contact",
        label: "Liên hệ",
        icon: Mail,
        match: (p) => p.startsWith("/staff/contact"),
      },
    ],
  },
  {
    id: "content",
    label: "Nội dung",
    items: [
      {
        href: "/staff/coupons",
        label: "Coupon",
        icon: Ticket,
        match: (p) => p.startsWith("/staff/coupons"),
      },
      {
        href: "/staff/blog",
        label: "Blog",
        icon: Newspaper,
        match: (p) => p.startsWith("/staff/blog"),
      },
      {
        href: "/staff/content",
        label: "Trang tĩnh",
        icon: FileText,
        match: (p) => p.startsWith("/staff/content"),
      },
    ],
  },
];

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Tổng quan",
    items: [
      {
        href: "/admin",
        label: "Tổng quan",
        icon: LayoutDashboard,
        match: (p) => p === "/admin",
      },
    ],
  },
  {
    id: "system",
    label: "Hệ thống",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        match: (p) => p.startsWith("/admin/users"),
      },
      {
        href: "/admin/audit",
        label: "Audit",
        icon: ScrollText,
        match: (p) => p.startsWith("/admin/audit"),
      },
    ],
  },
];
