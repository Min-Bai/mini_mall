import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCart, MAX_CART_QUANTITY } from "@/lib/cart";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  quantity: z.coerce
    .number()
    .int("数量必须是整数")
    .min(1, "数量至少为 1")
    .max(MAX_CART_QUANTITY, `单个商品最多 ${MAX_CART_QUANTITY} 件`),
});

// PUT /api/cart/:id —— 修改数量
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 },
    );
  }

  // 连同 userId 一起过滤。别人的条目一律当作「不存在」返回 404，
  // 既不越权修改，也不泄露该条目是否存在
  const item = await prisma.cartItem.findFirst({
    where: { id, userId: user.id },
    select: { quantity: true, product: { select: { name: true, stock: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "购物车中没有该商品" }, { status: 404 });
  }

  // 只在「加量」时卡库存，减量一律放行。
  // 否则库存被下调后（购物车 5 件、库存降到 2），用户点「−」发出 {quantity:4}，
  // 会因 4 > 2 被拒；而失败时前端不刷新，数量一直停在 5，
  // 于是 5→4→3 每次都失败、永远减不到 2，恢复路径被自己堵死。
  const isIncrease = parsed.data.quantity > item.quantity;
  if (isIncrease && parsed.data.quantity > item.product.stock) {
    return NextResponse.json(
      {
        error: `「${item.product.name}」库存不足，当前仅剩 ${item.product.stock} 件`,
      },
      { status: 400 },
    );
  }

  // 写语句自身带 userId 过滤：单条语句内完成鉴权与写入，
  // 不依赖上面那次读的「历史结论」
  const { count } = await prisma.cartItem.updateMany({
    where: { id, userId: user.id },
    data: { quantity: parsed.data.quantity },
  });
  // 上面的读之后、这次写之前，条目被另一个标签页删掉了
  if (count === 0) {
    return NextResponse.json({ error: "购物车中没有该商品" }, { status: 404 });
  }

  return NextResponse.json({ cart: await getCart(user.id) });
}

// DELETE /api/cart/:id —— 删除某项
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  // deleteMany 带 userId 条件：单条语句内完成鉴权与删除，
  // 删别人的条目等于删 0 条，天然防越权
  const result = await prisma.cartItem.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "购物车中没有该商品" }, { status: 404 });
  }

  return NextResponse.json({ cart: await getCart(user.id) });
}
