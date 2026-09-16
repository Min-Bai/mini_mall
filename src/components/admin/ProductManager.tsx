"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { centsToYuan, formatPrice } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import {
  STOCK_LEVEL_CLASS,
  STOCK_LEVEL_LABEL,
  stockLevel,
} from "@/lib/stock";
import type { AdminProduct } from "@/lib/admin";
import { useAdminMutation } from "./useAdminMutation";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

/** 表单里数字一律按字符串存：input 的 value 本来就是字符串，交给服务端 zod 去 coerce */
type FormState = {
  name: string;
  slug: string;
  categoryId: string;
  priceYuan: string;
  stock: string;
  imageUrl: string;
  description: string;
};

function emptyForm(categoryId: string): FormState {
  return {
    name: "",
    slug: "",
    categoryId,
    priceYuan: "",
    stock: "0",
    imageUrl: "",
    description: "",
  };
}

/** 编辑时把「分」换回「元」填进表单，与服务端 yuanToCents 对称 */
function formOf(product: AdminProduct): FormState {
  return {
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    priceYuan: centsToYuan(product.price),
    stock: String(product.stock),
    imageUrl: product.imageUrl,
    description: product.description,
  };
}

/** 库存单元格。用函数而不是内联表达式，好在 map 里拿到 stockLevel 的中间值 */
function StockCell({ stock }: { stock: number }) {
  const level = stockLevel(stock);
  const label = STOCK_LEVEL_LABEL[level];
  return (
    <td className="px-4 py-3 text-right">
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs ${STOCK_LEVEL_CLASS[level]}`}
      >
        {stock}
        {label && <span className="ml-1">{label}</span>}
      </span>
    </td>
  );
}

export default function ProductManager({
  products,
  categories,
  total,
  clearHref,
}: {
  products: AdminProduct[];
  /**
   * **必须是全量分类**，不是筛选后的子集。它同时驱动三处：
   * `noCategory` 空态守卫、`emptyForm` 的默认选中项、以及表单里的 `<select>` ——
   * 传子集会让商品无法被改到当前筛选范围之外的分类下。
   */
  categories: { id: string; name: string }[];
  /** 命中总数。**不能用 `products.length`** —— 分页后那只是本页数量 */
  total: number;
  /** 有筛选生效时给「清除筛选」的链接；null = 无筛选 */
  clearHref: string | null;
}) {
  const { mutate, locked, error, clearError } = useAdminMutation();
  const [open, setOpen] = useState(false);
  /** null = 新增；非 null = 正在编辑这件商品 */
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(categories[0]?.id ?? ""),
  );

  const noCategory = categories.length === 0;

  function openCreate() {
    clearError();
    setEditing(null);
    setForm(emptyForm(categories[0]?.id ?? ""));
    setOpen(true);
  }

  function openEdit(product: AdminProduct) {
    clearError();
    setEditing(product);
    setForm(formOf(product));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEditing(null);
    clearError();
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = editing
      ? await mutate(`/api/admin/products/${editing.id}`, "PUT", form)
      : await mutate("/api/admin/products", "POST", form);
    // 失败时不关表单：错误提示就在表单上方，用户改完可以直接重提
    if (ok) close();
  }

  async function remove(product: AdminProduct) {
    const confirmed = confirm(
      `删除「${product.name}」？\n\n` +
        `该商品会同时从所有用户的购物车中移除。\n` +
        `历史订单不受影响 —— 订单里存的是下单时的商品名与价格快照。`,
    );
    if (!confirmed) return;
    await mutate(`/api/admin/products/${product.id}`, "DELETE");
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {clearHref ? `匹配 ${total} 件商品` : `共 ${total} 件商品`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          disabled={noCategory || locked}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          新增商品
        </button>
      </div>

      {noCategory && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          还没有任何分类，商品必须挂在分类下。请先到{" "}
          <Link href="/admin/categories" className="underline">
            分类管理
          </Link>{" "}
          创建一个分类。
        </p>
      )}

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
          <h2 className="mb-4 font-medium text-gray-900">
            {editing ? `编辑「${editing.name}」` : "新增商品"}
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="p-name">
                商品名称
              </label>
              <input
                id="p-name"
                className={inputClass}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="p-slug">
                slug
              </label>
              <input
                id="p-slug"
                className={inputClass}
                placeholder="iphone-15-pro"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                小写字母、数字与连字符，全站唯一
              </p>
            </div>

            <div>
              <label className={labelClass} htmlFor="p-category">
                分类
              </label>
              <select
                id="p-category"
                className={inputClass}
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="p-price">
                  价格（元）
                </label>
                <input
                  id="p-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={inputClass}
                  placeholder="89.99"
                  value={form.priceYuan}
                  onChange={(e) => set("priceYuan", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="p-stock">
                  库存
                </label>
                <input
                  id="p-stock"
                  type="number"
                  step="1"
                  min="0"
                  className={inputClass}
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="p-image">
                图片地址
              </label>
              <input
                id="p-image"
                className={inputClass}
                placeholder="https://picsum.photos/seed/demo/600/600"
                value={form.imageUrl}
                onChange={(e) => set("imageUrl", e.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="p-description">
                商品描述
              </label>
              <textarea
                id="p-description"
                rows={3}
                className={inputClass}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                required
              />
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
              <th className="px-4 py-2 font-medium">商品</th>
              <th className="px-4 py-2 font-medium">分类</th>
              <th className="px-4 py-2 text-right font-medium">价格</th>
              <th className="px-4 py-2 text-right font-medium">库存</th>
              <th className="px-4 py-2 font-medium">更新时间</th>
              <th className="px-4 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  {/* 空结果有两种含义，文案必须分开 —— 「还没有商品」会让
                      筛了关键词的管理员以为商品被删光了 */}
                  {clearHref ? (
                    <>
                      没有符合条件的商品，
                      <Link
                        href={clearHref}
                        className="text-blue-600 hover:underline"
                      >
                        清除筛选
                      </Link>
                    </>
                  ) : (
                    "还没有商品"
                  )}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/products/${product.id}`}
                          className="line-clamp-1 text-gray-900 hover:text-blue-600"
                        >
                          {product.name}
                        </Link>
                        <p className="text-xs text-gray-400">{product.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {product.category.name}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatPrice(product.price)}
                  </td>
                  <StockCell stock={product.stock} />

                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                    {formatDateTime(product.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        disabled={locked}
                        className="text-blue-600 transition-colors hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(product)}
                        disabled={locked}
                        className="text-gray-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
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
