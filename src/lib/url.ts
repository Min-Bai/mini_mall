/**
 * 列表页 URL 构造。全站约定：
 *
 * - 空值（`""` / `null` / `undefined`）自动省略，保证「全部」这类链接干净
 * - **`page <= 1` 不写入 URL** —— 第 1 页是默认值，写进去只会让同一份列表有两个地址
 * - 一律走 URLSearchParams，由它负责百分号编码
 *
 * 输出必须是**确定的**：`buildQueryUrl` 按 `params` 的键序生成查询串，
 * 所以调用方拼参数时保持固定顺序（服务端与客户端算出的 href 才能逐字符相同）。
 */
export type QueryParams = Record<string, string | number | null | undefined>;

export function buildQueryUrl(
  basePath: string,
  params: QueryParams = {},
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    // 用 `!(n > 1)` 而不是 `n <= 1`：`Number("abc") <= 1` 是 false，
    // 会把非法值原样写成 `page=abc`，而 `!(NaN > 1)` 为 true，正确丢弃
    if (key === "page" && !(Number(value) > 1)) continue;
    qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * 前台商品列表页（首页 `/`）的 URL。
 *
 * 保留独立函数而不是让调用方直接写 `buildQueryUrl("/", ...)`：
 * 首页是唯一一个基路径为 `/` 的列表页，`buildQueryUrl("/", {})` 会得到 `"/"`
 * 这个正确但读起来费解的结果，且改名基路径时只有一处要动。
 */
export function buildListUrl(params: {
  search?: string;
  category?: string;
  page?: number;
}): string {
  return buildQueryUrl("/", {
    search: params.search,
    category: params.category,
    page: params.page,
  });
}

/** await 之后的 searchParams。同名参数出现多次时对应值是数组 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * 页面 props 里 searchParams 的类型（未 await）。
 *
 * 手写而不用 Next 生成的 `PageProps<'/admin/products'>`：后者来自 `.next/types`，
 * 那是构建产物 —— 删掉 `.next` 后 `tsc` 会因为没有生成类型而报错。
 * `admin/layout.tsx` 已经立了同样的先例。
 */
export type SearchParamsPromise = Promise<RawSearchParams>;

/**
 * 取 searchParams 里的单个字符串值。
 *
 * 同名参数出现多次时 Next 给的是数组（`?a=1&a=2`），这里返回 `""` 而不是取首个 ——
 * 列表页的筛选参数都是单值语义，数组意味着请求被手工构造过，当成「没填」比
 * 悄悄采纳其中一个更可预期。
 */
export function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
