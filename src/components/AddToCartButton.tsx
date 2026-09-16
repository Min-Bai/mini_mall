"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AddToCartButton({
  productId,
  disabled = false,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-lg bg-gray-300 px-6 py-3 text-white"
      >
        已售罄
      </button>
    );
  }

  async function handleAdd() {
    setBusy(true);
    setError("");
    // 每次重试都清掉上一次的成功提示。否则「加购成功 → 再点一次失败（如已售罄）」
    // 会让绿色的「已加入购物车，去结算」和红色报错同时挂在页面上，
    // 而那个「去结算」链接对应的其实是一次并未成功的加购
    setAdded(false);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "加入购物车失败，请稍后重试");
        return;
      }

      setAdded(true);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "加入中…" : "加入购物车"}
      </button>

      {added && (
        <p className="mt-2 text-sm text-green-600">
          已加入购物车，
          <Link href="/cart" className="text-blue-600 hover:underline">
            去结算
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
