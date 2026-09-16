import { orderStatusClass, orderStatusLabel } from "@/lib/order-status";

/** 纯展示组件，无 hooks，Server / Client 组件里都能用 */
export default function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${orderStatusClass(status)}`}
    >
      {orderStatusLabel(status)}
    </span>
  );
}
