import { NextResponse } from "next/server";
import { AdminError, adminGuard } from "@/lib/admin";
import { deleteCategory } from "@/lib/admin-catalog";

// DELETE /api/admin/categories/:id —— 删除分类（分类下还有商品时拒绝）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;

  try {
    await deleteCategory(id);
    return NextResponse.json({ ok: true });
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
