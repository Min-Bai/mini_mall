import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_ROLE } from "@/lib/admin";
import LogoutButton from "@/components/LogoutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini Mall · 迷你商城",
  description: "微型电商项目演示",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 依赖 cookies()，会让所有页面退出静态预渲染转为动态渲染
  const user = await getCurrentUser();

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Mini Mall
            </Link>

            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/cart"
                className="text-gray-600 transition-colors hover:text-gray-900"
              >
                购物车
              </Link>

              {user ? (
                <>
                  <Link
                    href="/orders"
                    className="text-gray-600 transition-colors hover:text-gray-900"
                  >
                    我的订单
                  </Link>
                  {/* 后台入口只给管理员看。真正的权限判定在 /admin/layout.tsx 与各接口里，
                      这里隐藏链接纯粹是为了不让普通用户点进一个必然被拒的页面 */}
                  {user.role === ADMIN_ROLE && (
                    <Link
                      href="/admin"
                      className="text-gray-600 transition-colors hover:text-gray-900"
                    >
                      后台管理
                    </Link>
                  )}
                  <span className="text-gray-700">{user.name}</span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-600 transition-colors hover:text-gray-900"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-white transition-colors hover:bg-blue-700"
                  >
                    注册
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
          Mini Mall · 演示项目
        </footer>
      </body>
    </html>
  );
}
