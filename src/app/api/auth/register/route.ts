import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSession, publicUserSelect } from "@/lib/auth";

const registerSchema = z.object({
  email: z
    .string({ required_error: "请输入邮箱" })
    .trim()
    .toLowerCase()
    .email("邮箱格式不正确"),
  password: z
    .string({ required_error: "请输入密码" })
    .min(6, "密码至少 6 位")
    .max(72, "密码最长 72 位"), // bcrypt 只取前 72 字节，超出部分会被静默截断
  name: z
    .string({ required_error: "请输入昵称" })
    .trim()
    .min(1, "请输入昵称")
    .max(50, "昵称最长 50 个字符"),
});

// POST /api/auth/register
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;

  // 先查一次给出友好提示；真正的唯一性保证靠下面的 P2002 兜底（并发下预检不可靠）
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
  }

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), name },
      select: publicUserSelect,
    });

    await setSession(user.id, user.role);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
    }
    throw err;
  }
}
