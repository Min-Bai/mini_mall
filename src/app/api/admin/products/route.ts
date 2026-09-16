import { NextResponse } from "next/server";
import { AdminError, adminGuard } from "@/lib/admin";
import { createProduct, productInputSchema } from "@/lib/admin-catalog";

// POST /api/admin/products —— 新增商品
export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

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
    const product = await createProduct(parsed.data);
    return NextResponse.json({ product }, { status: 201 });
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
