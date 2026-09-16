import { prisma } from "./prisma";

/**
 * 搜索关键词的 LIKE 转义。
 *
 * **为什么不能直接用 Prisma 的 `contains`**：它在 SQLite 上生成 `LIKE ?`，
 * 而**不带 `ESCAPE` 子句**（实测参数是 `"%%%"`），于是关键词里的 `%` / `_` 被
 * SQLite 当作通配符 —— 搜一个 `%` 会命中全表 16 件商品，搜 `a_c` 会命中 `abc`。
 *
 * 转义只在 SQL 里配了 `ESCAPE '\'` 才生效，而 Prisma 没有任何往 `where` 里注入
 * SQL 片段的口子（`where` 只接受结构化条件），所以命中 id 只能走 `$queryRaw`。
 *
 * 反斜杠必须**一起**转义：漏掉它的话，用户输入的 `\%` 会变成
 * 「被转义掉的反斜杠 + 未被转义的 `%`」，`%` 仍然是通配符。
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** `%已转义的词%` —— 配上 `ESCAPE '\'` 就是「包含该字面子串」 */
function likePattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

/**
 * 搜索的命中 id。
 *
 * 设计上**只查 id，取数仍交给 Prisma 的 `findMany`**：这样 include / orderBy /
 * skip / take / count 一条都不用重写，也就不存在「raw 版与 Prisma 版两套取数逻辑
 * 慢慢漂移」的问题 —— raw SQL 里只剩「哪些行命中」这一件事。
 * 命中的 id 交给 `where: { id: { in: [...] } }`，**空数组恰好表示「谁都不匹配」**，
 * 不需要为「关键词无命中」特判。
 *
 * ⚠️ 已知上限：命中集会被拼成 `id IN (...)`，行数极多时会撞上 SQLite 的绑定变量
 * 上限（本版本 32766）。演示数据量下远不可及；真到那个量级，要换成「在 SQL 里连
 * 分页一起做」的 raw 查询，而不是继续用 id 预筛。
 */

/** 前台商品搜索：名称或描述包含关键词 */
export async function matchingStorefrontProductIds(
  term: string,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM Product
    WHERE name LIKE ${likePattern(term)} ESCAPE '\\'
       OR description LIKE ${likePattern(term)} ESCAPE '\\'
  `;
  return rows.map((row) => row.id);
}

/** 后台商品搜索：名称或 slug 包含关键词 */
export async function matchingAdminProductIds(
  term: string,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM Product
    WHERE name LIKE ${likePattern(term)} ESCAPE '\\'
       OR slug LIKE ${likePattern(term)} ESCAPE '\\'
  `;
  return rows.map((row) => row.id);
}

/**
 * 后台订单搜索：订单号 / 买家姓名 / 买家邮箱 任一包含关键词。
 * 姓名与邮箱在 `User` 上，所以这里要 JOIN —— `Order.userId` 是必填外键，
 * 内连接不会漏掉任何订单。
 * `Order` 是 SQL 保留字，必须加双引号。
 */
export async function matchingOrderIds(term: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT o.id FROM "Order" o
    JOIN "User" u ON u.id = o.userId
    WHERE o.orderNo LIKE ${likePattern(term)} ESCAPE '\\'
       OR u.name    LIKE ${likePattern(term)} ESCAPE '\\'
       OR u.email   LIKE ${likePattern(term)} ESCAPE '\\'
  `;
  return rows.map((row) => row.id);
}

/** 后台分类搜索：名称或 slug 包含关键词 */
export async function matchingCategoryIds(term: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM Category
    WHERE name LIKE ${likePattern(term)} ESCAPE '\\'
       OR slug LIKE ${likePattern(term)} ESCAPE '\\'
  `;
  return rows.map((row) => row.id);
}
