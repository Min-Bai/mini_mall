import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { normalizePage, type Paginated } from "./queries";
import { prisma } from "./prisma";
import { LOW_STOCK_THRESHOLD } from "./stock";

/** 管理员角色值。`User.role` 是 String（不是 Prisma 枚举），判定统一走这里 */
export const ADMIN_ROLE = "ADMIN";

/**
 * 后台列表每页条数。
 *
 * 取 10 而不是常见的 20：现有 16 件商品正好铺满 2 页，分页功能在开发库上就能直接看见，
 * 不必为了测试临时改小。想调随时改这一行。
 */
export const ADMIN_PAGE_SIZE = 10;

/**
 * 可预期的业务失败（映射成 4xx），后台接口统一抛它。
 *
 * 与 `lib/orders.ts` 的 `OrderError` 同构，差异只在归属：那个面向买家侧，
 * 这个面向后台侧。后台各路由因此只需 catch 一个错误类型。
 */
export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

/**
 * 后台接口的统一鉴权闸门：管理员放行返回 null，否则返回「应当直接 return」的响应。
 *
 * 用法：
 *   const denied = await adminGuard();
 *   if (denied) return denied;
 *
 * 401 与 403 分开：未登录回 401（前端据此跳登录页），
 * 已登录但不是管理员回 403（前端据此提示「需要管理员权限」，不会被误跳登录）。
 *
 * 判定读的是数据库（`getCurrentUser`），不是 Cookie 里签发时的 role 快照 ——
 * 用户被降权后，旧 Cookie 里的 ADMIN 不该继续生效。
 */
export async function adminGuard(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (user.role !== ADMIN_ROLE) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  return null;
}

/**
 * 后台页面的权限判定：管理员返回用户对象，未登录或非管理员返回 null。
 * 与 `adminGuard` 分开是因为页面要的是 `redirect()`，不是 JSON 响应。
 */
export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== ADMIN_ROLE) return null;
  return user;
}

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** 单位：分 */
  price: number;
  imageUrl: string;
  stock: number;
  categoryId: string;
  category: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 后台分类视图。字段与 `lib/queries.ts` 的 `getCategoriesWithCount()` 返回值对齐 ——
 * 那边已经算好了 `productCount`（拿 `_count` 拍平），后台直接用，不必再查一次。
 */
export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  productCount: number;
};

export type AdminOrder = {
  id: string;
  orderNo: string;
  status: string;
  /** 折前金额（分） */
  originalAmount: number;
  discount: number;
  /** 实付金额（分） */
  totalAmount: number;
  address: string;
  createdAt: Date;
  user: { id: string; email: string; name: string };
  items: {
    id: string;
    productName: string;
    price: number;
    quantity: number;
  }[];
};

/**
 * 分页的公共部分。三个后台列表的 skip/take 与 totalPages 算法完全一致，集中在这里 ——
 * 散着写容易在某一处漏掉 `total === 0`（`Math.ceil(0/10)` 是 0 不是 1）。
 *
 * 两个函数都要求传入**已归一化**的 page，归一化在各查询函数开头统一做一次。
 * `page` 的入参类型是 `unknown` 而不是 `number`：它直接来自 URL（字符串），
 * 由 `normalizePage` 负责把 `"abc"` / `"1e308"` / `"-1"` 统统收敛掉。
 */
function skipTake(page: number) {
  return { skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE };
}

function envelope<T>(page: number, items: T[], total: number): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    totalPages: Math.ceil(total / ADMIN_PAGE_SIZE),
  };
}

/**
 * 后台商品列表，按创建时间倒序分页。
 *
 * 接 `where` 而不是筛选字段：筛选语义归 `lib/admin-filters.ts`，
 * 这里只管「把给定的条件查出来并分页」。两者分开后，加筛选项不用动这个文件。
 *
 * `createdAt` 只精确到毫秒，同毫秒内的行序由 SQLite 自行决定且不保证稳定 ——
 * 翻页时同一个查询重跑可能给出不同顺序，导致漏行或重复行。补 `id` 作 tie-break。
 */
export async function getAdminProducts(params: {
  where?: Prisma.ProductWhereInput;
  page?: unknown;
}): Promise<Paginated<AdminProduct>> {
  const where = params.where ?? {};
  const page = normalizePage(params.page);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...skipTake(page),
    }),
    prisma.product.count({ where }),
  ]);

  return envelope(page, items, total);
}

/**
 * 后台订单列表：所有用户的订单，带下单人与商品明细，按下单时间倒序分页。
 */
export async function getAdminOrders(params: {
  where?: Prisma.OrderWhereInput;
  page?: unknown;
}): Promise<Paginated<AdminOrder>> {
  const where = params.where ?? {};
  const page = normalizePage(params.page);

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...skipTake(page),
    }),
    prisma.order.count({ where }),
  ]);

  return envelope(page, items, total);
}

/**
 * 后台分类列表，按创建时间正序分页（与首页分类条、后台商品表单的下拉框同序）。
 *
 * 与 `lib/queries.ts` 的 `getCategoriesWithCount()` **并存**而不是复用它：
 * 那个函数有另外三个调用方（首页、`/api/categories`、商品表单的下拉框），
 * 它们都需要全量分类，动它会连带改掉那些调用方的返回形状。
 */
export async function getAdminCategories(params: {
  where?: Prisma.CategoryWhereInput;
  page?: unknown;
}): Promise<Paginated<AdminCategory>> {
  const where = params.where ?? {};
  const page = normalizePage(params.page);

  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...skipTake(page),
    }),
    prisma.category.count({ where }),
  ]);

  const items = rows.map(({ _count, ...rest }) => ({
    ...rest,
    productCount: _count.products,
  }));

  return envelope(page, items, total);
}

/**
 * 各分类下的商品命中数，键是 `categoryId`。传进来的 `where` 应**只含关键词条件**
 * （不含分类本身，也不含库存），这样数字的含义是「在当前关键词下，各分类各有多少件」，
 * 与点进该分类后看到的行数一致。
 *
 * `groupBy` 只返回命中数 ≥ 1 的分类，**调用方要拿全量分类列表兜底补 0** ——
 * 否则筛完关键词后，零命中的分类会整个从筛选条上消失，用户没法把范围放宽回来。
 */
export async function getAdminCategoryCounts(
  where: Prisma.ProductWhereInput,
): Promise<{ all: number; byCategory: Record<string, number> }> {
  const [all, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where,
      _count: { _all: true },
    }),
  ]);

  const byCategory: Record<string, number> = {};
  for (const row of rows) byCategory[row.categoryId] = row._count._all;
  return { all, byCategory };
}

/**
 * 库存筛选条的计数。传进来的 `where` 应**只含关键词与分类**（不含库存）——
 * 数字的含义因此是「在当前的搜索与分类下，缺货/低库存各有多少件」。
 *
 * `out` 用 `lte: 0` 容错历史负数，`low` 用 `gt: 0` 与它互斥：
 * 两个档位必须不重叠，否则同一件商品会同时出现在两个筛选结果里。
 */
export async function getAdminStockCounts(
  where: Prisma.ProductWhereInput,
): Promise<{ all: number; out: number; low: number }> {
  const [all, out, low] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count({ where: { ...where, stock: { lte: 0 } } }),
    prisma.product.count({
      where: { ...where, stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
    }),
  ]);
  return { all, out, low };
}

/**
 * 订单状态筛选条的计数。传进来的 `where` 应**只含关键词**（不含状态）。
 *
 * `all` 与 `byStatus` 各算各的：库里若有预期外的状态值（`Order.status` 是 String，
 * 手工改库或老数据都可能出现），它会落进 `all` 但不在五个标签里，
 * 于是「各标签之和 < all」是**正确**的，不要为了凑数去改。
 */
export async function getAdminOrderStatusCounts(
  where: Prisma.OrderWhereInput,
): Promise<{ all: number; byStatus: Record<string, number> }> {
  const [all, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of rows) byStatus[row.status] = row._count._all;
  return { all, byStatus };
}
