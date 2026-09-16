import { NextResponse } from "next/server";
import { getCategoriesWithCount } from "@/lib/queries";

// GET /api/categories
export async function GET() {
  const categories = await getCategoriesWithCount();
  return NextResponse.json(categories);
}
