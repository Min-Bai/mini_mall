import { NextRequest, NextResponse } from "next/server";
import { getProducts, normalizePage } from "@/lib/queries";

// GET /api/products?search=&category=&page=
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const data = await getProducts({
    search: searchParams.get("search") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    // ?page=abc / ?page=1.5 / ?page=-3 全部归一化为 1，不把非法值透传给 Prisma
    page: normalizePage(searchParams.get("page")),
  });
  return NextResponse.json(data);
}
