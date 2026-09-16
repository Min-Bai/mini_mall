import { AdminError } from "./admin";
import { prisma } from "./prisma";
import {
  ORDER_STATUS,
  canTransition,
  orderStatusLabel,
  type OrderStatus,
} from "./order-status";

/**
 * 后台改订单状态。与买家侧的 `payOrder()`（lib/orders.ts）共享同一条不变量：
 *
 *   - **库存**在下单那一刻扣减，所以除「已取消」外的任何状态都对应着已扣的库存，
 *     转入「已取消」时逐条归还
 *   - **`User.totalSpent`** 只统计已支付订单的实付金额：转入「已支付」时 +，
 *     把一笔已支付的单取消时 −（两条路径必须一致，否则后台标一次已支付、
 *     买家再付一次，金额就被算了两遍）
 *   - **`memberLevel` 不重算**：等级只升不降，取消订单虽然让 `totalSpent` 变小，
 *     已升的等级也不回退（见 CLAUDE.md「心悦会员等级」）
 *
 * 状态流转限制在 `ORDER_STATUS_FLOW`（lib/order-status.ts）里，这里只做执行。
 */
export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        userId: true,
        totalAmount: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order) {
      throw new AdminError("订单不存在", 404);
    }

    if (order.status === nextStatus) {
      throw new AdminError(
        `订单已经是「${orderStatusLabel(nextStatus)}」状态`,
        409,
      );
    }
    if (!canTransition(order.status, nextStatus)) {
      throw new AdminError(
        `不能把订单从「${orderStatusLabel(order.status)}」改为「${orderStatusLabel(nextStatus)}」`,
        409,
      );
    }

    // 当前状态写进 WHERE，而不是「先查再写」：两个管理员同时操作时只有一个人能改成功，
    // 下面那些副作用（归还库存、累计消费）也就不会被应用两次
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: nextStatus },
    });
    if (count === 0) {
      throw new AdminError("订单状态已被其他操作变更，请刷新后重试", 409);
    }

    if (nextStatus === ORDER_STATUS.CANCELLED) {
      for (const item of order.items) {
        // 用 updateMany 而不是 update：商品可能已被后台删除，
        // 此时没有可归还的行，update 会抛 P2025 让整笔取消失败
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    if (nextStatus === ORDER_STATUS.PAID) {
      await tx.user.update({
        where: { id: order.userId },
        data: { totalSpent: { increment: order.totalAmount } },
      });
    } else if (
      order.status === ORDER_STATUS.PAID &&
      nextStatus === ORDER_STATUS.CANCELLED
    ) {
      await tx.user.update({
        where: { id: order.userId },
        data: { totalSpent: { decrement: order.totalAmount } },
      });
    }

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
  });
}
