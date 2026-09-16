import { prisma } from "./prisma";

/**
 * 单个购物车条目的数量上限。
 * 仅作输入护栏，真正的约束是商品库存（下单时还会再校验一次）。
 */
export const MAX_CART_QUANTITY = 999;

export type CartItemView = {
  id: string;
  quantity: number;
  /** 小计 = 单价 × 数量（单位：分） */
  subtotal: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    imageUrl: string;
    stock: number;
  };
};

export type CartView = {
  items: CartItemView[];
  /** 合计（单位：分） */
  totalAmount: number;
  totalQuantity: number;
};

/** 读取某个用户的购物车，并算好小计与合计（金额均为「分」） */
export async function getCart(userId: string): Promise<CartView> {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          imageUrl: true,
          stock: true,
        },
      },
    },
  });

  const items: CartItemView[] = rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    subtotal: row.product.price * row.quantity,
    product: row.product,
  }));

  return {
    items,
    totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
