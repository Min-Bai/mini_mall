import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, burnPasswordTime, setSession } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string({ required_error: "请输入邮箱" }).trim().toLowerCase(),
  password: z.string({ required_error: "请输入密码" }),
});

/** 登录失败的统一话术：不区分「用户不存在」与「密码错误」，防止撞库枚举账号 */
const GENERIC_ERROR = "邮箱或密码错误";

// POST /api/auth/login
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // 邮箱不存在也走一次等开销的 bcrypt，抹平响应时间差异
    await burnPasswordTime(password);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await setSession(user.id, user.role);

  // 剔除 passwordHash 后再返回
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}
