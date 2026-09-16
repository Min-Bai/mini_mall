import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  INITIAL_ORDER_STATUS,
  ORDER_STATUS,
  orderStatusLabel,
} from "./order-status";

/**
 * 折扣百分比，100 = 不打折。
 * TODO: 接入 lib/member.ts 的心悦等级折扣后改这里（注意：触发升级的那一单仍按升级前的折扣结算）。
 */
const DEFAULT_DISCOUNT = 100;

/** `Order.address` 是 NOT NULL，结算页做出来之前先用占位值兜底 */
export const DEFAULT_ADDRESS = "未填写收货地址";

/**
 * 可预期的业务失败（映射成 4xx）。
 * 在事务回调里抛出它来触发回滚，由路由层捕获后转成对应状态码。
 */
export class OrderError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

/** 订单号 = 14 位时间戳 + 6 位随机数。撞号概率极低，真撞了由 orderNo 唯一约束兜底 */
function generateOrderNo(): string {
  const now = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const ts =
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${ts}${p(randomInt(0, 1_000_000), 6)}`;
}

/**
 * 从购物车创建订单：建单 → 扣库存 → 清购物车，三步在同一事务内，任一失败整体回滚。
 *
 * 库存用「条件更新」扣减而不是「先读再写」：
 * `UPDATE product SET stock = stock - n WHERE id = ? AND stock >= n`
 * 比较与写入发生在同一条语句里，两笔并发下单都读到够库存时，后到的那笔
 * count 会是 0，从而抛错回滚 —— 不会超卖。
 */
export async function createOrderFromCart(userId: string, address?: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: {
          product: {
            select: { id: true, name: true, price: true, stock: true },
          },
        },
      });

      if (cartItems.length === 0) {
        throw new OrderError("购物车是空的，无法提交订单");
      }

      // 先做一次只读体检，好处是能一次性列出所有缺货商品。
      // 它不承担并发安全（那由下面的条件更新负责），只为把报错说得更全。
      const shortages = cartItems.filter((i) => i.quantity > i.product.stock);
      if (shortages.length > 0) {
        throw new OrderError(
          `以下商品库存不足，请返回购物车调整：${shortages
            .map(
              (i) =>
                `「${i.product.name}」仅剩 ${i.product.stock} 件（需 ${i.quantity} 件）`,
            )
            .join("；")}`,
        );
      }

      // 真正的并发防线
      for (const item of cartItems) {
        const { count } = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (count === 0) {
          throw new OrderError(`「${item.product.name}」库存不足`);
        }
      }

      const originalAmount = cartItems.reduce(
        (sum, i) => sum + i.product.price * i.quantity,
        0,
      );
      const discount = DEFAULT_DISCOUNT;
      const totalAmount = Math.round((originalAmount * discount) / 100);

      const order = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          userId,
          originalAmount,
          discount,
          totalAmount,
          status: INITIAL_ORDER_STATUS,
          address: address?.trim() || DEFAULT_ADDRESS,
          // 快照商品名与价格，之后商品改名/改价不影响历史订单
          items: {
            create: cartItems.map((i) => ({
              productId: i.productId,
              productName: i.product.name,
              price: i.product.price,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // 只删本次下单消费掉的条目，而不是 deleteMany({ userId })：
      // 事务期间用户若在另一个标签页加购，按 userId 清会把新加的条目一起抹掉
      await tx.cartItem.deleteMany({
        where: { id: { in: cartItems.map((i) => i.id) } },
      });

      return order;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new OrderError("订单号冲突，请重试", 409);
    }
    throw error;
  }
}

/** 我的订单列表（按下单时间倒序） */
export async function getOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

/**
 * 订单详情。**必须同时按 userId 过滤** —— 别人的订单一律当作「不存在」返回 404，
 * 既不越权也不泄露订单是否存在。
 */
export async function getOrderById(userId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });
}

/**
 * 模拟支付：待付款 → 已支付，并累计 User.totalSpent。
 *
 * 状态判断写进 UPDATE 的 WHERE 里（而不是「先查状态再改」），
 * 避免并发重复支付把 totalSpent 加两次。
 */
export async function payOrder(userId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, totalAmount: true },
    });
    if (!order) {
      throw new OrderError("订单不存在", 404);
    }

    const { count } = await tx.order.updateMany({
      where: { id: order.id, userId, status: INITIAL_ORDER_STATUS },
      data: { status: ORDER_STATUS.PAID },
    });
    if (count === 0) {
      throw new OrderError(
        `订单当前状态为「${orderStatusLabel(order.status)}」，无法支付`,
        409,
      );
    }

    // 累计消费只统计已支付订单的实付金额（心悦等级的计算依据）
    await tx.user.update({
      where: { id: userId },
      data: { totalSpent: { increment: order.totalAmount } },
    });

    // 取值同样带上 userId，不依赖上面那次读的所有权结论
    return tx.order.findFirstOrThrow({
      where: { id: order.id, userId },
      include: { items: true },
    });
  });
}
