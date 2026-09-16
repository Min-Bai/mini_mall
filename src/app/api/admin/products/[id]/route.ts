import { NextResponse } from "next/server";
import { AdminError, adminGuard } from "@/lib/admin";
import {
  deleteProduct,
  productInputSchema,
  updateProduct,
} from "@/lib/admin-catalog";

// PUT /api/admin/products/:id —— 修改商品（表单每次都提交全量字段）
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

  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 },
    );
  }

  try {
    const product = await updateProduct(id, parsed.data);
    return NextResponse.json({ product });
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

// DELETE /api/admin/products/:id —— 删除商品（连带从各用户购物车移除）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;

  try {
    return NextResponse.json(await deleteProduct(id));
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
