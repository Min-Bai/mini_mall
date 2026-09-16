import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrderById, OrderError, payOrder } from "@/lib/orders";

// GET /api/orders/:id —— 订单详情
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  // getOrderById 内部已按 userId 过滤，别人的订单在这里就是 null
  const order = await getOrderById(user.id, id);
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

// PUT /api/orders/:id —— 模拟支付（待付款 → 已支付）
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await payOrder(user.id, id);
    return NextResponse.json({ order });
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
