import type { Prisma } from "@prisma/client";
import { isOrderStatus, type OrderStatus } from "./order-status";
import {
  matchingAdminProductIds,
  matchingCategoryIds,
  matchingOrderIds,
} from "./search";
import { isStockFilter, LOW_STOCK_THRESHOLD, type StockFilter } from "./stock";
import { firstParam, type QueryParams, type RawSearchParams } from "./url";

/**
 * 后台列表页的筛选参数解析。
 *
 * 这里是**校验与归一化的唯一入口**：非法值在解析阶段就变成 `""`（= 不筛），
 * 于是页面拿到的 filters 与 URL 上生效的条件永远一致 —— 不会出现
 * 「地址栏写着 ?stock=xxx、界面显示全部、实际又按某个库存条件查了」这种三方打架。
 *
 * 一条规则管全部：**非法值丢弃该条件**。不报错（筛选条是浏览工具，不是表单校验），
 * 也不静默篡改（把 `priceMin > priceMax` 交换过来只是看起来友好，实际是改了用户的意思）。
 */

export const MAX_SEARCH_LENGTH = 100;

/**
 * 关键词的唯一入口。**截断而不是丢弃** —— 超长关键词多半是粘贴手滑，
 * 截断后还能搜到东西；丢弃则变成「搜了但输入框也空了」，用户不知道发生了什么。
 */
export function parseSearch(value: string | string[] | undefined): string {
  return firstParam(value).trim().slice(0, MAX_SEARCH_LENGTH);
}

export type ProductFilters = {
  search: string;
  /**
   * 分类 **slug**（不是 categoryId）。
   *
   * 同一页上两种词汇是必要的：筛选条走 URL，slug 可读、可分享；
   * 而 `ProductManager` 的表单 `<select>` 要提交 `categoryId` 给后台接口。
   * 别把两者混用 —— 用 id 拼 URL 会让人看不懂，用 slug 提交表单接口不认。
   */
  category: string;
  /** `""` = 全部 */
  stock: StockFilter | "";
};

export function parseProductFilters(
  sp: RawSearchParams,
  knownSlugs: ReadonlySet<string>,
): ProductFilters {
  const category = firstParam(sp.category);
  const stock = firstParam(sp.stock);

  return {
    search: parseSearch(sp.search),
    // 不在当前分类集合里的 slug 直接丢弃：留着会让筛选条选不中任何一项，
    // 出现「URL 写着筛了某分类、筛选条却显示全部」的自相矛盾
    category: knownSlugs.has(category) ? category : "",
    // 白名单守卫：筛选值会被直接拼进 Prisma 条件，不能「非空即有效」
    stock: isStockFilter(stock) ? stock : "",
  };
}

/**
 * 商品列表要用的三个条件，**一次算好一起返回**。
 *
 * 三者共用同一份「关键词命中的 id」（见 `lib/search.ts`：关键词必须走带 `ESCAPE`
 * 的 LIKE，不能交给 Prisma 的 `contains`），所以必须一起返回 ——
 * 拆成三个各自 async 的函数，同一句 id 查询会在同一个请求里跑三遍。
 *
 * 三个条件的嵌套关系是刻意设计，不是重复：
 * - `searchOnly`   → 分类筛选条的计数基底（选中分类自身不参与，否则其余分类全变 0）
 * - `searchAndCategory` → 库存筛选条的计数基底（在选中的分类下数缺货）
 * - `list`         → 列表查询本体
 */
export async function productWheres(f: ProductFilters): Promise<{
  searchOnly: Prisma.ProductWhereInput;
  searchAndCategory: Prisma.ProductWhereInput;
  list: Prisma.ProductWhereInput;
}> {
  const searchOnly: Prisma.ProductWhereInput = {};
  if (f.search) {
    // 命中为空集时 `in: []` 恰好表示「谁都不匹配」，正是想要的结果；
    // 因此只需区分「有关键词」（哪怕是空集）与「没关键词」两种情形
    searchOnly.id = { in: await matchingAdminProductIds(f.search) };
  }

  const searchAndCategory: Prisma.ProductWhereInput = { ...searchOnly };
  if (f.category) searchAndCategory.category = { slug: f.category };

  const list: Prisma.ProductWhereInput = { ...searchAndCategory };
  if (f.stock === "out") {
    // `lte: 0` 而非 `equals: 0`：schema 上库存不允许为负，但历史数据可能有负数
    list.stock = { lte: 0 };
  } else if (f.stock === "low") {
    // `gt: 0` 让「低库存」与「缺货」互斥 —— 否则同一件商品会同时出现在两个筛选结果里
    list.stock = { gt: 0, lte: LOW_STOCK_THRESHOLD };
  }

  return { searchOnly, searchAndCategory, list };
}

/** 回填输入框 + 拼链接用的扁平参数。**不含 page**，页码由调用方叠加 */
export function productFilterParams(f: ProductFilters): QueryParams {
  return { search: f.search, category: f.category, stock: f.stock };
}

export function hasProductFilters(f: ProductFilters): boolean {
  return Boolean(f.search || f.category || f.stock);
}

export type OrderFilters = {
  search: string;
  /** `""` = 全部 */
  status: OrderStatus | "";
};

export function parseOrderFilters(sp: RawSearchParams): OrderFilters {
  const status = firstParam(sp.status);
  return {
    search: parseSearch(sp.search),
    // 复用后台接口同一份守卫（lib/order-status.ts），顺带挡住 "toString" 这类原型链键
    status: isOrderStatus(status) ? status : "",
  };
}

/**
 * 订单列表要用的两个条件，一次算好一起返回（理由同 `productWheres`：
 * 共用同一份关键词命中的 id，拆开会让 id 查询重复跑）。
 *
 * - `searchOnly` → 状态筛选条的计数基底（选中状态自身不参与，否则其余状态全变 0）
 * - `list`       → 列表查询本体
 */
export async function orderWheres(f: OrderFilters): Promise<{
  searchOnly: Prisma.OrderWhereInput;
  list: Prisma.OrderWhereInput;
}> {
  const searchOnly: Prisma.OrderWhereInput = {};
  if (f.search) {
    // 订单号 / 买家姓名 / 买家邮箱 三项跨表，全在 lib/search.ts 的 raw 查询里完成；
    // 这里只拿 id —— 也就不再需要 `user: { is: ... }` 那套关联条件了
    searchOnly.id = { in: await matchingOrderIds(f.search) };
  }

  const list: Prisma.OrderWhereInput = { ...searchOnly };
  if (f.status) list.status = f.status;

  return { searchOnly, list };
}

export function orderFilterParams(f: OrderFilters): QueryParams {
  return { search: f.search, status: f.status };
}

export function hasOrderFilters(f: OrderFilters): boolean {
  return Boolean(f.search || f.status);
}

/**
 * 分类只有关键词一个筛选维度，不值得为它建一套 filters 类型 ——
 * 但沿用同一个 `parseSearch`，保证三个页面的截断/去空格规则是同一份。
 *
 * async 是因为关键词要走 `lib/search.ts` 带 `ESCAPE` 的 LIKE 查命中 id。
 */
export async function categoryWhere(
  search: string,
): Promise<Prisma.CategoryWhereInput> {
  if (!search) return {};
  return { id: { in: await matchingCategoryIds(search) } };
}
