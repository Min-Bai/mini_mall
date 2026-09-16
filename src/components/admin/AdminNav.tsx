"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "概览", exact: true },
  { href: "/admin/products", label: "商品管理", exact: false },
  { href: "/admin/categories", label: "分类管理", exact: false },
  { href: "/admin/orders", label: "订单管理", exact: false },
];

/** 后台横向导航。用 usePathname 高亮当前项，因此必须是客户端组件 */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-gray-200">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-blue-600 font-medium text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
