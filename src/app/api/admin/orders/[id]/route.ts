import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, adminGuard } from "@/lib/admin";
import { updateOrderStatus } from "@/lib/admin-orders";
import { isOrderStatus, type OrderStatus } from "@/lib/order-status";

/**
 * 目标状态必须是已知值。用 `z.custom` 配类型守卫而不是 `z.enum`：
 * 状态值定义在 `ORDER_STATUS` 常量里，这里直接复用 `isOrderStatus`，
 * 避免枚举再抄一遍、以后加状态时漏改。
 */
const statusSchema = z.object({
  status: z.custom<OrderStatus>(isOrderStatus, "未知的订单状态"),
});

// PUT /api/admin/orders/:id —— 更新订单状态（按 lib/order-status.ts 的流转表校验）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 },
    );
  }

  try {
    const order = await updateOrderStatus(id, parsed.data.status);
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
