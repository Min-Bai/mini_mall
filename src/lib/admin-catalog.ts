import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AdminError } from "./admin";
import { prisma } from "./prisma";
import { yuanToCents } from "./money";

/**
 * 商品入参校验。放在 lib 而不是 route.ts —— 路由文件只能导出 HTTP 方法处理器，
 * 多导出一个 schema 会让 Next 报错，而 POST 与 PUT 需要共用同一份规则。
 *
 * 价格用 `priceYuan`（元）而不是 `price`：库里和其它接口的 `price` 一律是「分」，
 * 表单里再叫 price 会让人按分去填（填 899 想表达 8.99 元，实际存成 8.99 元）。
 * 用名字把单位钉死，由这里统一换算成分。
 */
export const productInputSchema = z.object(
  {
    name: z
      .string({ required_error: "请填写商品名称" })
      .trim()
      .min(1, "请填写商品名称")
      .max(100, "商品名称过长"),
    slug: z
      .string({ required_error: "请填写 slug" })
      .trim()
      .min(1, "请填写 slug")
      .max(100, "slug 过长")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "slug 只能用小写字母、数字和连字符，如 iphone-15-pro",
      ),
    description: z
      .string({ required_error: "请填写商品描述" })
      .trim()
      .min(1, "请填写商品描述")
      .max(2000, "商品描述过长"),
    priceYuan: z.coerce
      .number({
        required_error: "请填写价格",
        invalid_type_error: "价格必须是数字",
      })
      .min(0.01, "价格至少 0.01 元")
      .max(1_000_000, "价格不能超过 1000000 元"),
    imageUrl: z
      .string({ required_error: "请填写图片地址" })
      .trim()
      .min(1, "请填写图片地址")
      .max(500, "图片地址过长"),
    stock: z.coerce
      .number({ required_error: "请填写库存", invalid_type_error: "库存必须是数字" })
      .int("库存必须是整数")
      .min(0, "库存不能为负数")
      .max(1_000_000, "库存过大"),
    categoryId: z
      .string({ required_error: "请选择分类" })
      .trim()
      .min(1, "请选择分类"),
  },
  // 字段齐全但整个 body 不是对象（如数组、字符串）时，别漏出 zod 的英文原文
  { invalid_type_error: "请求体必须是对象" },
);

export type ProductInput = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z.object(
  {
    name: z
      .string({ required_error: "请填写分类名称" })
      .trim()
      .min(1, "请填写分类名称")
      .max(50, "分类名称过长"),
    slug: z
      .string({ required_error: "请填写 slug" })
      .trim()
      .min(1, "请填写 slug")
      .max(50, "slug 过长")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "slug 只能用小写字母、数字和连字符，如 digital",
      ),
  },
  { invalid_type_error: "请求体必须是对象" },
);

export type CategoryInput = z.infer<typeof categoryInputSchema>;

/** 分类是商品的必填外键：不存在的话 Prisma 会抛 P2003，先查一次换成人话 */
async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new AdminError("所选分类不存在，请刷新后重试", 400);
  }
}

/** 取 Prisma 已知错误码；不是已知错误（含业务错误本身）返回 null */
function prismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : null;
}

/** 唯一约束冲突的文案。`Product.slug` 与 `Category.slug` 在 schema 里都是 @unique */
function slugConflict(slug: string): AdminError {
  return new AdminError(`slug「${slug}」已被占用`, 409);
}

export async function createProduct(input: ProductInput) {
  await assertCategoryExists(input.categoryId);

  const { priceYuan, ...rest } = input;
  try {
    return await prisma.product.create({
      data: { ...rest, price: yuanToCents(priceYuan) },
    });
  } catch (error) {
    // Product.slug 是 @unique。不接住的话重复 slug 会变成 500，
    // 而这本该是一条「换个 slug 再提交」的普通表单错误
    if (prismaErrorCode(error) === "P2002") {
      throw slugConflict(input.slug);
    }
    throw error;
  }
}

export async function updateProduct(id: string, input: ProductInput) {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AdminError("商品不存在", 404);
  }

  await assertCategoryExists(input.categoryId);

  const { priceYuan, ...rest } = input;
  try {
    return await prisma.product.update({
      where: { id },
      data: { ...rest, price: yuanToCents(priceYuan) },
    });
  } catch (error) {
    const code = prismaErrorCode(error);
    // 表单每次都提交全量字段，slug 不变时是「写回自己」—— Prisma 允许，
    // 只有真的撞上别人的 slug 才会走到这里
    if (code === "P2002") {
      throw slugConflict(input.slug);
    }
    // 上面那次读之后、这次写之前，商品被另一个管理员删掉了
    if (code === "P2025") {
      throw new AdminError("商品不存在", 404);
    }
    throw error;
  }
}

/**
 * 删除商品：同一事务内先清掉所有用户购物车里的该商品，再删商品。
 *
 * `CartItem.productId` 是必填外键，直接删商品会撞外键约束（P2003）；
 * 而购物车条目本身没有保留价值（它只是一份待结算的引用），所以顺带清掉，
 * 而不是把删除操作挡回去。
 *
 * 历史订单不受影响：`OrderItem` 只快照了 productId / 商品名 / 价格，
 * schema 里没有指向 Product 的外键 —— 这正是下单时快照的目的。
 */
export async function deleteProduct(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new AdminError("商品不存在", 404);
    }

    const { count: removedFromCarts } = await tx.cartItem.deleteMany({
      where: { productId: id },
    });
    await tx.product.delete({ where: { id } });

    return { removedFromCarts };
  });
}

export async function createCategory(input: CategoryInput) {
  try {
    return await prisma.category.create({ data: input });
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      throw slugConflict(input.slug);
    }
    throw error;
  }
}

/**
 * 删除分类。分类下有商品时不允许删 —— `Product.categoryId` 是必填外键，
 * 连带删除商品太危险（会顺带清空购物车），改分类则应由管理员显式决定。
 *
 * 先查一次商品数只为把报错说清楚（「还有 3 件商品」比「操作失败」有用）；
 * 真正防并发的是那次 delete 的 P2003 —— 查完到删之间可能刚好有人新建了商品。
 */
export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });
  if (!category) {
    throw new AdminError("分类不存在", 404);
  }
  if (category._count.products > 0) {
    throw new AdminError(
      `「${category.name}」下还有 ${category._count.products} 件商品，请先删除商品或把它们改到其他分类`,
      409,
    );
  }

  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    const code = prismaErrorCode(error);
    if (code === "P2003") {
      throw new AdminError("该分类下仍有商品，请先处理这些商品", 409);
    }
    if (code === "P2025") {
      throw new AdminError("分类不存在", 404);
    }
    throw error;
  }
}
