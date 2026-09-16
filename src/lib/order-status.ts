/**
 * 订单状态元数据。
 *
 * **本文件刻意不引入 Prisma 或任何服务端 API** —— 状态标签与配色要同时被
 * Server Component 和客户端组件使用，而 `lib/orders.ts` 里 import 了 Prisma，
 * 从客户端引用它会把 Prisma Client 打进浏览器包。
 */

export const ORDER_STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAID: "PAID",
  SHIPPED: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** 下单后的初始状态 */
export const INITIAL_ORDER_STATUS: OrderStatus = ORDER_STATUS.PENDING_PAYMENT;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "待付款",
  PAID: "已支付",
  SHIPPED: "已发货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-amber-200 bg-amber-50 text-amber-700",
  PAID: "border-green-200 bg-green-50 text-green-700",
  SHIPPED: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLETED: "border-gray-200 bg-gray-100 text-gray-600",
  CANCELLED: "border-gray-200 bg-gray-100 text-gray-400",
};

const FALLBACK_CLASS = "border-gray-200 bg-gray-100 text-gray-600";

/**
 * 只在 map 自身拥有该键时取值。
 *
 * 不能写 `map[status] ?? fallback`：status 为 `"toString"` / `"constructor"` 这类
 * 原型链上的键时，下标访问会返回继承来的**函数**（不是 undefined，`??` 挡不住），
 * 它会被当成 React child 渲染而抛错，或当成 className 输出乱码。
 */
function own<T>(map: Record<string, T>, status: string): T | undefined {
  return Object.hasOwn(map, status) ? map[status] : undefined;
}

/**
 * 数据库里 `Order.status` 是 String（不是 Prisma 枚举），理论上可能读到预期外的值
 * （手工改库、老数据）。取标签时统一在这里兜底，避免前端渲染出 undefined。
 */
export function orderStatusLabel(status: string): string {
  return own(ORDER_STATUS_LABEL, status) ?? status;
}

export function orderStatusClass(status: string): string {
  return own(ORDER_STATUS_CLASS, status) ?? FALLBACK_CLASS;
}

/**
 * 不可支付时展示的说明文案。
 *
 * 放在这里而不是页面里枚举状态字面量：页面写的是「三个已知状态 else 已取消」的白名单，
 * 任何预期外的值（`String` 类型的历史数据）都会掉进 else 被误报成「已取消」。
 * 这里对未知状态不编造结论，交回状态徽章去呈现。
 */
export function paymentNote(status: string): string {
  switch (status) {
    case ORDER_STATUS.PAID:
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.COMPLETED:
      return "订单已支付完成";
    case ORDER_STATUS.CANCELLED:
      return "订单已取消，无需支付";
    default:
      return `订单状态：${orderStatusLabel(status)}`;
  }
}

/**
 * 可支付的状态。只有待付款能付 —— 已支付/已发货/已完成/已取消都不能再付。
 * 判定逻辑放这里，前端按钮和后端接口共用同一份，避免两边写歪。
 */
export function canPay(status: string): boolean {
  return status === ORDER_STATUS.PENDING_PAYMENT;
}

/**
 * 允许的状态流转表，终态对应空数组。
 *
 * 后台按钮与后台接口共用同一份：接口据此校验请求（不合法直接 409），
 * 页面据此只渲染合法的按钮，避免渲染出「点了一定失败」的按钮。
 *
 * 刻意不放开回退（已支付→待付款）与「已取消→其他」：库存是在下单那一刻扣的、
 * 取消时归还，一旦允许回退就得重新扣减，而那时库存可能已被别人买走 ——
 * 扣不动只能失败，订单会卡在「已取消」与「已支付」之间。把终态钉死，这类补偿就不存在了。
 */
export const ORDER_STATUS_FLOW: Record<OrderStatus, readonly OrderStatus[]> = {
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

/** 从 status 出发允许流转到的状态。未知状态返回空数组（一律不许动） */
export function nextOrderStatuses(status: string): readonly OrderStatus[] {
  return own(ORDER_STATUS_FLOW, status) ?? [];
}

/** 状态流转是否合法。未知状态一律不合法 */
export function canTransition(from: string, to: string): boolean {
  return nextOrderStatuses(from).includes(to as OrderStatus);
}

/**
 * value 是否是已知的订单状态值。
 * 用于校验接口入参 —— `Order.status` 是 String，不能靠类型系统兜住非法值。
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && Object.hasOwn(ORDER_STATUS, value);
}
