import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOrders } from "@/lib/orders";
import { formatDateTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";
import { canPay } from "@/lib/order-status";
import OrderStatusBadge from "@/components/OrderStatusBadge";

/** 列表里的一行商品摘要：单件直接列名，多件折叠成「首个 等 N 件商品」 */
function summarize(items: { productName: string; quantity: number }[]) {
  const first = items[0];
  if (!first) return "无商品";
  if (items.length === 1) return `${first.productName} ×${first.quantity}`;

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  return `${first.productName} ×${first.quantity} 等 ${totalQuantity} 件商品`;
}

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await getOrders(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">我的订单</h1>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-400">还没有订单</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {order.orderNo}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDateTime(order.createdAt)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                    {summarize(order.items)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-base font-semibold text-red-600">
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>
              </div>

              {canPay(order.status) && (
                <p className="mt-2 text-xs text-amber-600">
                  待付款 · 点击进入订单支付
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
