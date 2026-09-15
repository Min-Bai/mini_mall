/** 分 → 元字符串，如 1299 → "12.99" */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 分 → 带货币符号的价格字符串，如 1299 → "¥12.99" */
export function formatPrice(cents: number): string {
  return `¥${centsToYuan(cents)}`;
}

/** 元 → 分（四舍五入取整） */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}
