import Link from "next/link";
import { buildQueryUrl, type QueryParams } from "@/lib/url";

/**
 * 后台列表页的分页条。样式与文案照抄前台首页 `src/app/page.tsx`，保证前后台一致。
 *
 * 链接由 `basePath` + `params` + `page` 现算，**筛选条件因此自动跟着翻页走** ——
 * 不会出现「第 2 页把筛选丢了」。
 *
 * 与 `AdminFilterPills` 同理用数据 props 而非 `hrefFor` 函数。
 */
export default function AdminPagination({
  basePath,
  params,
  page,
  totalPages,
  total,
  unit,
}: {
  basePath: string;
  /** 当前筛选条件（不含 page） */
  params: QueryParams;
  page: number;
  totalPages: number;
  total: number;
  /** 计数单位，如「件」「笔」「个」 */
  unit: string;
}) {
  // totalPages 为 0 也不能进 —— 空结果时 `Math.ceil(0 / 10)` 是 0，
  // 用 `>= 1` 判断会渲染出「第 1 / 0 页」这种自相矛盾的分页条
  if (totalPages <= 1) return null;

  const href = (target: number) => buildQueryUrl(basePath, { ...params, page: target });

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          scroll={false}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          上一页
        </Link>
      ) : (
        <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-300">
          上一页
        </span>
      )}
      <span className="text-sm text-gray-500">
        第 {page} / {totalPages} 页 · 共 {total} {unit}
      </span>
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          scroll={false}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          下一页
        </Link>
      ) : (
        <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-300">
          下一页
        </span>
      )}
    </div>
  );
}
