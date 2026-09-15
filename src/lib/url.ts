/**
 * 构造商品列表页 URL（首页 /）。
 * 空参数自动省略；page 为 1 或缺省时不写入，保证「全部」等链接干净。
 * 统一走 URLSearchParams，由它负责百分号编码。
 */
export function buildListUrl(params: {
  search?: string;
  category?: string;
  page?: number;
}): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.category) qs.set("category", params.category);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const query = qs.toString();
  return query ? `/?${query}` : "/";
}
