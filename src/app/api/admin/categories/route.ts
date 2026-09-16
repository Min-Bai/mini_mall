import { NextResponse } from "next/server";
import { AdminError, adminGuard } from "@/lib/admin";
import { categoryInputSchema, createCategory } from "@/lib/admin-catalog";

// POST /api/admin/categories —— 新增分类
export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = categoryInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 },
    );
  }

  try {
    const category = await createCategory(parsed.data);
    return NextResponse.json({ category }, { status: 201 });
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
