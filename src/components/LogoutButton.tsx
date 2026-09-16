"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // refresh() 让根布局重新读取会话，页头才会退回未登录态
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="text-gray-500 transition-colors hover:text-gray-900 disabled:opacity-50"
    >
      {loading ? "退出中…" : "退出登录"}
    </button>
  );
}
