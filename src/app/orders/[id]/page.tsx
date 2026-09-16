import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOrderById } from "@/lib/orders";
import { formatDateTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";
import { canPay, paymentNote } from "@/lib/order-status";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import PayButton from "@/components/PayButton";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  // 按 userId 过滤，别人的订单一律 404
  const order = await getOrderById(user.id, id);
  if (!order) {
    notFound();
  }

  const hasDiscount = order.discount < 100;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/orders" className="hover:text-gray-900">
          我的订单
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">{order.orderNo}</span>
      </nav>

      {/* 订单头 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">订单号</p>
            <p className="mt-0.5 font-medium text-gray-900">{order.orderNo}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <dl className="mt-4 grid gap-2 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-gray-500">下单时间</dt>
            <dd className="text-gray-900">{formatDateTime(order.createdAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-gray-500">收货地址</dt>
            <dd className="text-gray-900">{order.address}</dd>
          </div>
        </dl>
      </div>

      {/* 商品明细 */}
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">商品</th>
              <th className="px-4 py-2 text-right font-medium">单价</th>
              <th className="px-4 py-2 text-right font-medium">数量</th>
              <th className="px-4 py-2 text-right font-medium">小计</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-gray-900">{item.productName}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {formatPrice(item.price)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {formatPrice(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 金额与操作 */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-gray-500">商品总额</dt>
            <dd className="text-gray-900">{formatPrice(order.originalAmount)}</dd>
          </div>
          {hasDiscount && (
            <div className="flex justify-between gap-8">
              <dt className="text-gray-500">会员优惠（{order.discount / 10} 折）</dt>
              <dd className="text-green-600">
                -{formatPrice(order.originalAmount - order.totalAmount)}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-8 border-t border-gray-100 pt-1">
            <dt className="font-medium text-gray-900">实付金额</dt>
            <dd className="text-xl font-bold text-red-600">
              {formatPrice(order.totalAmount)}
            </dd>
          </div>
        </dl>

        {canPay(order.status) ? (
          <div className="text-right">
            <PayButton orderId={order.id} />
            <p className="mt-1 text-xs text-gray-400">演示用途，不会产生真实扣款</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{paymentNote(order.status)}</p>
        )}
      </div>
    </div>
  );
}
