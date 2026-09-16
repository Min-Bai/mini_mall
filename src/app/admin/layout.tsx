import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_ROLE } from "@/lib/admin";
import AdminNav from "@/components/admin/AdminNav";

/**
 * 后台布局 = 后台的权限闸门。放在 layout 而不是每个页面里，
 * 是为了「新增一个后台页面时不可能忘记加校验」。
 *
 * 注意这里只挡住了页面渲染。真正的写入口是 `/api/admin/*`，
 * 每个路由各自调 `adminGuard()` 再校验一次 —— 接口可以被直接请求，
 * 不能依赖「页面挡过了」这个假设。
 *
 * `proxy.ts`（页面级跳转保护）尚未实现，所以这个 layout 目前是唯一的页面级防线。
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role !== ADMIN_ROLE) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900">需要管理员权限</h1>
        <p className="mt-2 text-sm text-gray-500">
          当前账号（{user.email}）不是管理员，无法访问后台。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <AdminNav />
      <div className="pt-6">{children}</div>
    </div>
  );
}
