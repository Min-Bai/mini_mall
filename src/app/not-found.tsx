import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-500">页面不存在或商品已下架</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        返回首页
      </Link>
    </div>
  );
}
