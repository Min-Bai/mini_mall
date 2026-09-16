import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCart, MAX_CART_QUANTITY } from "@/lib/cart";
import { prisma } from "@/lib/prisma";

// GET /api/cart —— 当前用户的购物车
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json(await getCart(user.id));
}

const addSchema = z.object({
  productId: z.string().min(1, "缺少商品 ID"),
  quantity: z.coerce
    .number()
    .int("数量必须是整数")
    .min(1, "数量至少为 1")
    .max(MAX_CART_QUANTITY, `单个商品最多 ${MAX_CART_QUANTITY} 件`)
    .default(1),
});

// POST /api/cart —— 加入购物车（已存在则累加数量）
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 },
    );
  }
  const { productId, quantity } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, stock: true },
  });
  if (!product) {
    return NextResponse.json({ error: "商品不存在" }, { status: 404 });
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
    select: { quantity: true },
  });
  const nextQuantity = (existing?.quantity ?? 0) + quantity;

  if (nextQuantity > MAX_CART_QUANTITY) {
    return NextResponse.json(
      { error: `单个商品最多 ${MAX_CART_QUANTITY} 件` },
      { status: 400 },
    );
  }
  // 加入时不扣减库存，真正的扣减发生在下单；这里只做前置拦截，避免购物车明显超出库存
  if (nextQuantity > product.stock) {
    return NextResponse.json(
      {
        error:
          product.stock === 0
            ? `「${product.name}」已售罄`
            : `「${product.name}」库存不足，当前仅剩 ${product.stock} 件`,
      },
      { status: 400 },
    );
  }

  // 用 increment 而不是写入上面算好的 nextQuantity：
  // 两个标签页同时加购时，各自都会读到同一份 existing，写入绝对值会让后写的那次
  // 覆盖前一次（两次点击只加了一件）。increment 由数据库做加法，不会丢更新。
  // 代价是 nextQuantity 那次读只对「加量时的库存拦截」有意义，属建议性提示，
  // 真正的库存扣减在下单事务里。
  const runUpsert = () =>
    prisma.cartItem.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId, quantity },
      update: { quantity: { increment: quantity } },
    });

  try {
    await runUpsert();
  } catch (error) {
    // 行还不存在时，并发的首次加购可能同时走 create 分支，输的一方撞
    // userId_productId 唯一约束抛 P2002。此时行已被对方建好，重试一次即走 update 分支。
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await runUpsert();
    } else {
      throw error;
    }
  }

  return NextResponse.json({ cart: await getCart(user.id) }, { status: 201 });
}
