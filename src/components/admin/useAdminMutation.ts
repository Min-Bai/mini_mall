"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const FALLBACK_ERROR = "操作失败，请稍后重试";

/**
 * 后台增删改的统一请求封装。三个管理页面的交互形状完全一样
 * （禁用控件 → 发请求 → 展示服务端错误 → 刷新服务端数据），抽出来避免抄三份。
 *
 * 两个关键点：
 * - **401 跳登录、403/409/400 展示服务端文案**：后端已经把失败原因写成中文，
 *   前端不再自己编，避免「文案对不上真正的失败原因」。
 * - **`router.refresh()` 放进 transition**：`refresh()` 返回 void，拿不到「新数据已渲染」
 *   的时机。放进 transition 后 `isPending` 覆盖到那一刻，`locked` 全程为 true，
 *   按钮保持禁用 —— 否则 busy 一复位就能再点一次，而那时页面还是旧状态，
 *   请求会撞上后端的 409「状态已变更」。
 */
export function useAdminMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function mutate(
    url: string,
    method: "POST" | "PUT" | "DELETE",
    body?: unknown,
  ): Promise<boolean> {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(url, {
        method,
        headers:
          body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (res.status === 401) {
        router.push("/login");
        return false;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? FALLBACK_ERROR);
        return false;
      }

      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("网络错误，请稍后重试");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    mutate,
    /** 请求进行中 */
    busy,
    /** 服务端数据刷新中 */
    isPending,
    /** 两者之一为真时就该禁用控件 */
    locked: busy || isPending,
    error,
    clearError: () => setError(""),
  };
}
