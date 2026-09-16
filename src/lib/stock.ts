/**
 * 库存档位与库存筛选。
 *
 * **刻意不引 Prisma** —— `ProductManager`（客户端组件）要 import 这里的档位与配色，
 * 引了 Prisma 会把它拖进客户端 bundle。与 `lib/order-status.ts` 同样的理由。
 */

/**
 * 低库存阈值。**必须印在筛选标签上** —— 否则「低库存」没有可见定义，
 * 管理员只能猜边界在哪（见 `STOCK_FILTER_LABEL`）。
 */
export const LOW_STOCK_THRESHOLD = 10;

/** 库存档位。`ok` 只用于表格展示，**不可作为筛选项**：筛「库存正常」没有意义 */
export const STOCK_LEVEL = {
  OUT: "out",
  LOW: "low",
  OK: "ok",
} as const;

export type StockLevel = (typeof STOCK_LEVEL)[keyof typeof STOCK_LEVEL];

/** 可筛选的档位 = 展示档位去掉 `ok` */
export type StockFilter = Exclude<StockLevel, typeof STOCK_LEVEL.OK>;

/**
 * `?stock=` 的白名单守卫。筛选值会被直接拼进 Prisma 条件，
 * 不能用「非空即有效」—— 任意字符串会变成无意义的 where 或直接抛错。
 */
export function isStockFilter(value: unknown): value is StockFilter {
  return value === STOCK_LEVEL.OUT || value === STOCK_LEVEL.LOW;
}

/**
 * 库存 → 档位。用 `<= 0` 而不是 `=== 0`：schema 上库存不允许为负，
 * 但手工改库或老数据可能出现负数，那些同样是「卖不了」。
 */
export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return STOCK_LEVEL.OUT;
  if (stock <= LOW_STOCK_THRESHOLD) return STOCK_LEVEL.LOW;
  return STOCK_LEVEL.OK;
}

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  out: "缺货",
  low: "低库存",
  ok: "",
};

/** 无边框的淡色底：表格里每行都出现，做成实心徽章会喧宾夺主 */
export const STOCK_LEVEL_CLASS: Record<StockLevel, string> = {
  out: "bg-red-50 text-red-700",
  low: "bg-amber-50 text-amber-700",
  ok: "text-gray-600",
};

/** 筛选项的文案。低库存把阈值写进标签，让「低库存」这个说法有可见定义 */
export const STOCK_FILTER_LABEL: Record<StockFilter, string> = {
  out: "缺货",
  low: `低库存（≤${LOW_STOCK_THRESHOLD}）`,
};
