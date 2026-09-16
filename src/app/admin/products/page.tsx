import { redirect } from "next/navigation";
import {
  getAdminCategoryCounts,
  getAdminProducts,
  getAdminStockCounts,
} from "@/lib/admin";
import {
  hasProductFilters,
  parseProductFilters,
  productFilterParams,
  productWheres,
} from "@/lib/admin-filters";
import { getCategoriesWithCount } from "@/lib/queries";
import { LOW_STOCK_THRESHOLD, STOCK_FILTER_LABEL } from "@/lib/stock";
import { buildQueryUrl, firstParam, type SearchParamsPromise } from "@/lib/url";
import AdminFilterForm from "@/components/admin/AdminFilterForm";
import AdminFilterPills from "@/components/admin/AdminFilterPills";
import AdminPagination from "@/components/admin/AdminPagination";
import ProductManager from "@/components/admin/ProductManager";

const BASE_PATH = "/admin/products";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const sp = await searchParams;

  // 分类必须先查：筛选参数里的 category 是 slug，要拿全集校验才知道它是否有效，
  // 而 where 又依赖校验结果。所以这里**不能像首页那样把两次查询并进一个 Promise.all**，
  // 得分两轮。本地 SQLite 读一次约 1ms，用这点开销换「显示 = 生效」的一致性。
  const categories = await getCategoriesWithCount();
  const filters = parseProductFilters(
    sp,
    new Set(categories.map((c) => c.slug)),
  );

  // 三个 where 一起算：它们共用同一份「关键词命中的 id」，分开算会把同一句
  // id 查询跑三遍（关键词必须走带 ESCAPE 的 LIKE，见 lib/search.ts）
  const { searchOnly, searchAndCategory, list } = await productWheres(filters);

  const [{ items, total, page, totalPages }, categoryCounts, stockCounts] =
    await Promise.all([
      getAdminProducts({ where: list, page: firstParam(sp.page) }),
      // 分类标签的计数**只按关键词算，不含分类自身** —— 否则选中某个分类后，
      // 其余分类的计数会全变成 0，筛选条就没法用来横向比较了
      getAdminCategoryCounts(searchOnly),
      // 库存标签的计数则**要含当前分类** —— 它的含义是「这个分类下有多少缺货」
      getAdminStockCounts(searchAndCategory),
    ]);

  // 页码越界（如筛完后停在 ?page=2，或手改 ?page=99）收敛到最后一页
  if (total > 0 && page > totalPages) {
    redirect(
      buildQueryUrl(BASE_PATH, {
        ...productFilterParams(filters),
        page: totalPages,
      }),
    );
  }

  const clearHref = hasProductFilters(filters) ? BASE_PATH : null;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900">商品管理</h1>

      <AdminFilterForm
        key={`${filters.search}|${filters.category}|${filters.stock}`}
        action={BASE_PATH}
        resetHref={clearHref}
      >
        <input
          type="search"
          name="search"
          defaultValue={filters.search}
          placeholder="搜索商品名称或 slug…"
          className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </AdminFilterForm>

      <AdminFilterPills
        label="分类"
        name="category"
        current={filters.category}
        basePath={BASE_PATH}
        params={productFilterParams(filters)}
        options={[
          { value: "", label: "全部", count: categoryCounts.all },
          ...categories.map((category) => ({
            value: category.slug,
            label: category.name,
            count: categoryCounts.byCategory[category.id] ?? 0,
          })),
        ]}
      />

      <AdminFilterPills
        label="库存"
        name="stock"
        current={filters.stock}
        basePath={BASE_PATH}
        params={productFilterParams(filters)}
        options={[
          { value: "", label: "全部", count: stockCounts.all },
          { value: "out", label: STOCK_FILTER_LABEL.out, count: stockCounts.out },
          {
            value: "low",
            label: STOCK_FILTER_LABEL.low,
            count: stockCounts.low,
          },
        ]}
      />

      <ProductManager
        products={items}
        // 下拉框必须是**全量**分类：分页/筛选后的子集会让商品无法改到别的分类下
        categories={categories.map(({ id, name }) => ({ id, name }))}
        total={total}
        clearHref={clearHref}
      />

      <AdminPagination
        basePath={BASE_PATH}
        params={productFilterParams(filters)}
        page={page}
        totalPages={totalPages}
        total={total}
        unit="件"
      />
    </div>
  );
}
