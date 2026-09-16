"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import type { CartItemView } from "@/lib/cart";

export default function CartItemRow({ item }: { item: CartItemView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // router.refresh() 返回 void，拿不到「刷新完成」的时机。放进 transition 才能通过
  // isPending 知道新的服务端数据何时到位 —— 否则 busy 已复位、item.quantity 还是旧值，
  // 这期间再点一次「+」会用同一个陈旧数字算出同样的绝对值，连点两下只加一件。
  const [isPending, startTransition] = useTransition();
  const locked = busy || isPending;

  async function mutate(method: "PUT" | "DELETE", body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/cart/${item.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "操作失败，请稍后重试");
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  const productUrl = `/products/${item.product.id}`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex gap-3">
        <Link
          href={productUrl}
          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={productUrl}
              className="line-clamp-1 text-sm font-medium text-gray-900 hover:text-blue-600"
            >
              {item.product.name}
            </Link>
            <p className="mt-0.5 text-xs text-gray-500">
              单价 {formatPrice(item.product.price)}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center rounded-lg border border-gray-200">
              <button
                type="button"
                aria-label="减少数量"
                onClick={() => mutate("PUT", { quantity: item.quantity - 1 })}
                disabled={locked || item.quantity <= 1}
                className="h-7 w-7 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                −
              </button>
              <span className="w-10 text-center text-sm text-gray-900">
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label="增加数量"
                onClick={() => mutate("PUT", { quantity: item.quantity + 1 })}
                disabled={locked || item.quantity >= item.product.stock}
                className="h-7 w-7 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-red-600">
                {formatPrice(item.subtotal)}
              </span>
              <button
                type="button"
                onClick={() => mutate("DELETE")}
                disabled={locked}
                className="text-xs text-gray-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      {item.quantity >= item.product.stock && (
        <p className="mt-2 text-xs text-amber-600">
          已达库存上限（{item.product.stock} 件）
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
