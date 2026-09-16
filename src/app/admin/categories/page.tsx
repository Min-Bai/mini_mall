import { redirect } from "next/navigation";
import { getAdminCategories } from "@/lib/admin";
import { categoryWhere, parseSearch } from "@/lib/admin-filters";
import { buildQueryUrl, firstParam, type SearchParamsPromise } from "@/lib/url";
import AdminFilterForm from "@/components/admin/AdminFilterForm";
import AdminPagination from "@/components/admin/AdminPagination";
import CategoryManager from "@/components/admin/CategoryManager";

const BASE_PATH = "/admin/categories";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const sp = await searchParams;
  const search = parseSearch(sp.search);

  const { items, total, page, totalPages } = await getAdminCategories({
    // 关键词要走带 ESCAPE 的 LIKE，所以 categoryWhere 是 async（见 lib/search.ts）
    where: await categoryWhere(search),
    // 原样把 URL 上的字符串交给取数函数，由它内部的 normalizePage 归一化 ——
    // 这里不要写 `Number(sp.page) || 1`，那挡不住 NaN 与 1e308（见 lib/queries.ts）
    page: firstParam(sp.page),
  });

  // 页码越界（如筛完后停在 ?page=2，或手改 ?page=99）收敛到最后一页，
  // 避免「没有符合条件的分类」与「第 99 / 2 页」自相矛盾
  if (total > 0 && page > totalPages) {
    redirect(buildQueryUrl(BASE_PATH, { search, page: totalPages }));
  }

  // 重置回不带任何筛选的干净 URL
  const clearHref = search ? BASE_PATH : null;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900">分类管理</h1>

      {/* key 用解析后的 search（不是原始 searchParams）：非法值在解析时已被丢弃，
          用它做 key 才不会为「本来就不生效的参数」白重挂一次表单 */}
      <AdminFilterForm key={search} action={BASE_PATH} resetHref={clearHref}>
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="搜索分类名称或 slug…"
          className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </AdminFilterForm>

      <CategoryManager
        categories={items}
        total={total}
        clearHref={clearHref}
      />

      <AdminPagination
        basePath={BASE_PATH}
        params={{ search }}
        page={page}
        totalPages={totalPages}
        total={total}
        unit="个"
      />
    </div>
  );
}
