import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { INITIAL_ORDER_STATUS, orderStatusLabel } from "@/lib/order-status";

/** 后台概览。读取直接走 Prisma —— 与 CLAUDE.md「读取数据 → Server Component 直连 Prisma」一致 */
export default async function AdminHomePage() {
  const [productCount, categoryCount, orderCount, pendingCount, userCount] =
    await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: INITIAL_ORDER_STATUS } }),
      prisma.user.count(),
    ]);

  const cards = [
    {
      href: "/admin/products",
      label: "商品管理",
      value: productCount,
      unit: "件商品",
    },
    {
      href: "/admin/categories",
      label: "分类管理",
      value: categoryCount,
      unit: "个分类",
    },
    {
      href: "/admin/orders",
      label: "订单管理",
      value: orderCount,
      unit: "笔订单",
      extra: `${orderStatusLabel(INITIAL_ORDER_STATUS)} ${pendingCount} 笔`,
    },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900">概览</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {card.value}
              <span className="ml-1 text-sm font-normal text-gray-500">
                {card.unit}
              </span>
            </p>
            {card.extra && (
              <p className="mt-1 text-xs text-amber-600">{card.extra}</p>
            )}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-sm text-gray-500">注册用户：{userCount} 人</p>
    </div>
  );
}
