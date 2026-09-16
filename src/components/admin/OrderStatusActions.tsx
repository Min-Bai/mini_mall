"use client";

import { ORDER_STATUS, nextOrderStatuses, orderStatusLabel } from "@/lib/order-status";
import { useAdminMutation } from "./useAdminMutation";

function actionLabel(next: string): string {
  return next === ORDER_STATUS.CANCELLED
    ? "取消订单"
    : `标记为${orderStatusLabel(next)}`;
}

/**
 * 订单状态流转按钮。可选项来自 `nextOrderStatuses`（与后端同一份流转表），
 * 所以这里不会渲染出「点了一定被 409 拒绝」的按钮；终态订单显示为「已完结」。
 */
export default function OrderStatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const { mutate, locked, error } = useAdminMutation();
  const options = nextOrderStatuses(status);

  function change(next: string) {
    if (
      next === ORDER_STATUS.CANCELLED &&
      !confirm(
        "取消订单会把该单占用的库存归还给商品；如果这单已经支付，用户的累计消费也会相应扣减（会员等级不回退）。确定取消吗？",
      )
    ) {
      return;
    }
    void mutate(`/api/admin/orders/${orderId}`, "PUT", { status: next });
  }

  if (options.length === 0) {
    return <span className="text-xs text-gray-400">已完结</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((next) => (
        <button
          key={next}
          type="button"
          onClick={() => change(next)}
          disabled={locked}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            next === ORDER_STATUS.CANCELLED
              ? "border-red-200 text-red-600 hover:bg-red-50"
              : "border-blue-200 text-blue-600 hover:bg-blue-50"
          }`}
        >
          {actionLabel(next)}
        </button>
      ))}

      {error && (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
