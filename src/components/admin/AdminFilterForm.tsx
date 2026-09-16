"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";

/**
 * 后台列表页的筛选表单外壳。
 *
 * 筛选字段由页面作为 `children` 传进来（服务端渲染的原生 input/select）——
 * 这个组件因此**不需要认识任何筛选词汇**，加筛选项只改页面。
 *
 * 保留真正的 `<form action method="get">` 作无 JS 兜底：直接提交就是一个普通的
 * GET 表单，URL 照样正确。有 JS 时拦截提交改走 `router.push` 软导航，好处有二：
 * 页面不必整页重载，且 `ProductManager` 上开着的「新增商品」面板不会被重置
 * （整页重载会丢掉全部客户端状态）。
 *
 * 空字段在客户端就丢掉，URL 因此保持干净；无 JS 兜底那条路径会带上 `?search=`，
 * 服务端的解析对空值本来就视作「不筛」，两条路径结果一致。
 */
export default function AdminFilterForm({
  action,
  children,
  resetHref,
}: {
  action: string;
  children: ReactNode;
  /** 有筛选生效时给「重置」的链接；null = 当前没有筛选，不渲染重置 */
  resetHref: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const qs = new URLSearchParams();
    data.forEach((value, key) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if (trimmed === "") return;
      qs.set(key, trimmed);
    });

    const query = qs.toString();
    // scroll: false —— 筛选条就在页面顶部，重载后跳回顶部反而把刚点的位置顶走
    startTransition(() => {
      router.push(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  return (
    <form
      action={action}
      method="get"
      onSubmit={submit}
      className="mb-4 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "查询中…" : "查询"}
        </button>
        {/* 重置必须是 <Link>，不能是带 name 的按钮 —— FormData 会把带 name 的
            按钮也当成一个字段收进去，变成 URL 上的垃圾参数 */}
        {resetHref && (
          <Link
            href={resetHref}
            scroll={false}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            重置
          </Link>
        )}
      </div>
    </form>
  );
}
