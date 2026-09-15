import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const PRODUCTS_PER_PAGE = 9;

/**
 * 页码上限。skip = (page - 1) * PRODUCTS_PER_PAGE 必须落在安全整数范围内，
 * 否则会算成 Infinity 传给 Prisma，抛 PrismaClientValidationError（接口 500）。
 */
const MAX_PAGE = 1_000_000;

/**
 * 把任意来源的 page 入参归一化为 [1, MAX_PAGE] 区间内的整数。
 *
 * - NaN / Infinity / 小数 / 负数 / 0 / null / undefined → 1
 *   （不能只靠 `?? 1`，它挡不住 NaN）
 * - 超大的有限值（如 1e308、1e20）→ MAX_PAGE
 *   （只判 Number.isFinite 是不够的：1e308 是有限数，但 (1e308 - 1) * 9 溢出成 Infinity）
 */
export function normalizePage(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_PAGE);
}

/** 商品列表：支持 search 模糊搜索、category（按 slug）筛选、page 分页 */
export async function getProducts(params: {
  search?: string;
  category?: string;
  page?: number;
}) {
  const search = params.search?.trim();
  const category = params.category?.trim();
  const page = normalizePage(params.page);

  const where: Prisma.ProductWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }
  if (category) {
    where.category = { slug: category };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PRODUCTS_PER_PAGE,
      take: PRODUCTS_PER_PAGE,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: PRODUCTS_PER_PAGE,
    totalPages: Math.ceil(total / PRODUCTS_PER_PAGE),
  };
}

/** 商品详情：包含关联的分类信息 */
export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
}

/** 分类列表：包含每个分类下的商品数量 */
export async function getCategoriesWithCount() {
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return categories.map(({ _count, ...rest }) => ({
    ...rest,
    productCount: _count.products,
  }));
}
