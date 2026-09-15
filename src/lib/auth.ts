import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "mini_mall_session";
/** 会话有效期 7 天（秒） */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
/** bcrypt 代价因子 */
const BCRYPT_ROUNDS = 10;

/** 对外返回的用户字段白名单 —— passwordHash 绝不能出现在任何响应里 */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  memberLevel: true,
  totalSpent: true,
  createdAt: true,
} as const;

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("缺少环境变量 JWT_SECRET，请在 .env 中配置");
  }
  return new TextEncoder().encode(secret);
}

/** 哈希密码。bcrypt 自带随机 salt，同一密码每次结果都不同 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** 校验明文密码是否匹配哈希 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 恒定开销的假比对：登录时若邮箱不存在，也执行一次等价的 bcrypt 计算，
 * 让「用户不存在」与「密码错误」的响应耗时一致，避免通过时间差枚举用户。
 */
let dummyHash: string | null = null;
export async function burnPasswordTime(password: string): Promise<void> {
  dummyHash ??= await bcrypt.hash("timing-equalizer", BCRYPT_ROUNDS);
  await bcrypt.compare(password, dummyHash);
}

/** 签发 JWT 并写入 httpOnly Cookie */
export async function setSession(userId: string, role: string): Promise<void> {
  const token = await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true, // 禁止 JS 读取，防 XSS 窃取
    sameSite: "lax", // 防 CSRF，同时保留普通外链跳转的可用性
    secure: process.env.NODE_ENV === "production", // 生产环境仅走 HTTPS
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export type Session = {
  userId: string;
  role: string;
};

/**
 * 从 Cookie 读取并解密会话。签名无效 / 已过期 / 被篡改一律返回 null。
 *
 * 注意：role 来自签发时的快照，可能与数据库当前值不一致（如后台改了角色）。
 * 涉及权限判定时请用 getCurrentUser()，它读的是数据库的最新值。
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const { userId, role } = payload;
    if (typeof userId !== "string" || typeof role !== "string") return null;
    return { userId, role };
  } catch {
    return null;
  }
}

/** 获取当前登录用户的完整信息（以数据库为准），未登录或用户已被删除返回 null */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: publicUserSelect,
  });
}

/** 清除会话 Cookie（退出登录） */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
