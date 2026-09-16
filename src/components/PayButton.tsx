"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "PUT" });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "支付失败，请稍后重试");
        return;
      }

      // 支付成功后刷新，服务端会渲染出新状态（按钮随之消失）
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="rounded-lg bg-red-600 px-6 py-2.5 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "支付中…" : "模拟支付"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
