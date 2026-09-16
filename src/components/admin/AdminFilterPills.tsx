import Link from "next/link";
import { buildQueryUrl, type QueryParams } from "@/lib/url";

/**
 * 后台列表页的一行筛选标签（分类 / 库存 / 状态共用）。
 *
 * 服务端组件，选项与计数都由页面算好传进来 —— 计数必须是**当前其它筛选条件下**的数字，
 * 否则会出现「标签写着 6 件、点进去只有 2 行」。
 *
 * props 用数据（`basePath` + `params` + `name`）而不是 `hrefFor` 函数：
 * 函数 prop 在服务端→服务端合法，但一旦这个元素被挪进客户端组件就编译失败，
 * 数据 prop 两种位置都能活。
 */
export default function AdminFilterPills({
  label,
  name,
  current,
  options,
  basePath,
  params,
}: {
  label: string;
  /** URL 参数名，如 "stock" */
  name: string;
  /** 当前生效的值，`""` = 全部 */
  current: string;
  /** `value: ""` 是「全部」那一项；`count` 省略则不显示数字 */
  options: { value: string; label: string; count?: number }[];
  basePath: string;
  /** 其它筛选条件的当前值（不含本行的 `name`，含也会被覆盖） */
  params: QueryParams;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      {options.map((option) => {
        const active = option.value === current;
        // 空值会被 buildQueryUrl 丢掉，于是「全部」自然得到一个干净的基础 URL
        const href = buildQueryUrl(basePath, {
          ...params,
          [name]: option.value,
        });

        return (
          <Link
            key={option.value || "__all__"}
            href={href}
            scroll={false}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={active ? "text-blue-100" : "text-gray-400"}>
                （{option.count}）
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
