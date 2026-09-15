import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getProducts,
  getCategoriesWithCount,
  normalizePage,
} from "@/lib/queries";
import { buildListUrl } from "@/lib/url";
import ProductCard from "@/components/ProductCard";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = str(sp.search);
  const category = str(sp.category);
  const page = normalizePage(str(sp.page));

  const [categories, { items, total, totalPages }] = await Promise.all([
    getCategoriesWithCount(),
    getProducts({ search, category, page }),
  ]);

  // 页码越界（如 ?page=99）收敛到最后一页，避免「没有找到相关商品」
  // 与「第 99 / 2 页」自相矛盾，也避免用户要一页页倒退回有数据的位置
  if (total > 0 && page > totalPages) {
    redirect(buildListUrl({ search, category, page: totalPages }));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">商品列表</h1>

      {/* 搜索框。key 跟随实际生效的筛选条件：软导航改变筛选后强制重挂载，
          避免残留用户已输入但未提交的关键词，造成「显示的值 ≠ 生效的值」 */}
      <form action="/" method="get" className="mb-4 flex gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        <input
          key={`${search}|${category}`}
          type="search"
          name="search"
          defaultValue={search}
          placeholder="搜索商品名称或描述…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          搜索
        </button>
      </form>

      {/* 分类标签 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={buildListUrl({ search })}
          className={`rounded-full px-4 py-1.5 text-sm ${
            category === ""
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          全部
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={buildListUrl({ search, category: c.slug })}
            className={`rounded-full px-4 py-1.5 text-sm ${
              category === c.slug
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            {c.name}（{c.productCount}）
          </Link>
        ))}
      </div>

      {/* 商品网格 */}
      {items.length === 0 ? (
        <p className="py-16 text-center text-gray-400">没有找到相关商品</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={buildListUrl({ search, category, page: page - 1 })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              上一页
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-300">
              上一页
            </span>
          )}
          <span className="text-sm text-gray-500">
            第 {page} / {totalPages} 页 · 共 {total} 件
          </span>
          {page < totalPages ? (
            <Link
              href={buildListUrl({ search, category, page: page + 1 })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              下一页
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-300">
              下一页
            </span>
          )}
        </div>
      )}
    </div>
  );
}
