import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createOrderFromCart, getOrders, OrderError } from "@/lib/orders";

const createSchema = z.object({
  address: z.string().trim().max(200, "收货地址过长").optional(),
});

// POST /api/orders —— 从购物车创建订单
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // address 是可选字段，所以允许空 body —— 此时 request.json() 会抛错，改用 text() 先探一下
  const raw = await request.text();
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "请求体必须是合法 JSON" },
        { status: 400 },
      );
    }
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 },
    );
  }

  try {
    const order = await createOrderFromCart(user.id, parsed.data.address);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}

// GET /api/orders —— 我的订单列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json({ orders: await getOrders(user.id) });
}
