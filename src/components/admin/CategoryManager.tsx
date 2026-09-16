"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import type { AdminCategory } from "@/lib/admin";
import { useAdminMutation } from "./useAdminMutation";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

export default function CategoryManager({
  categories,
  total,
  clearHref,
}: {
  categories: AdminCategory[];
  /** 命中总数。**不能用 `categories.length`** —— 分页后那只是本页数量 */
  total: number;
  /** 有筛选生效时给「清除筛选」的链接；null = 无筛选 */
  clearHref: string | null;
}) {
  const { mutate, locked, error, clearError } = useAdminMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function openCreate() {
    clearError();
    setName("");
    setSlug("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    clearError();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await mutate("/api/admin/categories", "POST", { name, slug });
    if (ok) close();
  }

  async function remove(category: AdminCategory) {
    const confirmed = confirm(`删除分类「${category.name}」？`);
    if (!confirmed) return;
    // 分类下还有商品时后端会回 409，文案里带着商品数量，直接展示即可
    await mutate(`/api/admin/categories/${category.id}`, "DELETE");
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {clearHref ? `匹配 ${total} 个分类` : `共 ${total} 个分类`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          disabled={locked}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          新增分类
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {open && (
        <form
          onSubmit={submit}
          className="mb-4 rounded-lg border border-gray-200 bg-white p-4"
        >
          <h2 className="mb-4 font-medium text-gray-900">新增分类</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="c-name">
                分类名称
              </label>
              <input
                id="c-name"
                className={inputClass}
                placeholder="数码电子"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="c-slug">
                slug
              </label>
              <input
                id="c-slug"
                className={inputClass}
                placeholder="digital"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                小写字母、数字与连字符，需唯一
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={locked}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {locked ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={locked}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">分类名称</th>
              <th className="px-4 py-2 font-medium">slug</th>
              <th className="px-4 py-2 text-right font-medium">商品数</th>
              <th className="px-4 py-2 font-medium">创建时间</th>
              <th className="px-4 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  {/* 空结果有两种含义，文案必须分开 —— 「还没有分类」会让
                      筛了关键词的管理员以为分类被删光了 */}
                  {clearHref ? (
                    <>
                      没有符合条件的分类，
                      <Link
                        href={clearHref}
                        className="text-blue-600 hover:underline"
                      >
                        清除筛选
                      </Link>
                    </>
                  ) : (
                    "还没有分类"
                  )}
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-3 text-gray-900">{category.name}</td>
                  <td className="px-4 py-3 text-gray-500">{category.slug}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {category.productCount}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                    {formatDateTime(category.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(category)}
                      disabled={locked}
                      className="text-gray-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
