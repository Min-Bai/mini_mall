/**
 * 格式化为 `YYYY-MM-DD HH:mm`（服务器本地时区）。
 *
 * 刻意不用 `toLocaleString` —— 它的输出依赖运行环境的 ICU/时区，
 * 会把「服务端渲染的结果」和开发者的预期悄悄错开。
 */
export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";

  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}`
  );
}
