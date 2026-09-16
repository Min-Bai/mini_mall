"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // address 暂由服务端填占位值，结算页做出来后再改成用户填写
        body: JSON.stringify({}),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "提交订单失败，请稍后重试");
        return;
      }

      const { order } = (await res.json()) as { order: { id: string } };
      router.push(`/orders/${order.id}`);
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
        onClick={handleSubmit}
        disabled={disabled || busy}
        className="rounded-lg bg-red-600 px-6 py-2.5 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {busy ? "提交中…" : "提交订单"}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-md text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
