"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // 前端先拦一道，避免为一个必然失败的请求往返一次
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "注册失败，请稍后重试");
        return;
      }

      // 注册成功后端已写入会话，直接进首页
      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">注册</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm text-gray-700">
            昵称
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="怎么称呼你？"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-gray-700">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-gray-700">
            密码
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="至少 6 位"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1 block text-sm text-gray-700">
            确认密码
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
            placeholder="再输入一次"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "注册中…" : "注册"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        已有账号？
        <Link href="/login" className="ml-1 text-blue-600 hover:underline">
          去登录
        </Link>
      </p>
    </div>
  );
}
