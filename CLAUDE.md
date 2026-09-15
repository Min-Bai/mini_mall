@AGENTS.md

# Mini Mall

微型电商项目，全栈 TypeScript。包含**商城前台**、**后台管理**和**心悦会员折扣体系**三部分。

> 上面的 `@AGENTS.md` 由 `next dev` 自动生成并持续覆盖，其中说明了 Next.js 16 的破坏性变更。
> **不要手动编辑或删除 AGENTS.md 中的自动生成块**，否则会产生无法提交干净的 diff。

## 技术栈

| 依赖 | 版本 | 备注 |
|---|---|---|
| next | 16.3.5 | App Router（唯一路由）、Turbopack 默认 |
| react / react-dom | 19.2.8 | Next 16 强制要求 |
| typescript | 5.x | |
| tailwindcss + @tailwindcss/postcss | 4.x | v4 语法：`@import "tailwindcss"` |
| prisma / @prisma/client | 5.22.0 | v5 线最终版本，**勿升级到 v6+** |
| bcryptjs | 3.0.3 | 密码哈希，自带类型声明 |
| jose | 6.2.12 | JWT 签发/校验 |
| zod | 3.25.76 | Server Action 入参校验 |
| tsx | 4.23.13 | 运行 seed 脚本 |

数据库：**SQLite**（`prisma/dev.db` 单文件，无需额外服务）。

## 常用命令

```bash
npm run dev              # 开发服务器 → http://localhost:3000
npm run build            # 生产构建（Turbopack）
npm run start            # 生产模式启动

npx prisma migrate dev   # 创建并应用迁移
npx prisma generate      # 重新生成 Prisma Client
npx prisma studio        # 数据库可视化 GUI
npx prisma db seed       # 灌入种子数据
npx prisma migrate reset # 重置数据库并重跑 seed
```

## 架构约定

**读写分离的取数方式**（这是本项目的核心模式）：

- **读取数据** → 在 Server Component 中直接调用 Prisma，不要绕 API 路由
- **写入数据** → 使用 Server Actions（`"use server"`），配合 `revalidatePath()` 刷新缓存
- 不使用 `pages/api` 风格的接口层，Next 16 已移除 Pages Router

**目录结构**（`src/` 下）：

```
app/
  page.tsx                  商城首页 = 商品列表（搜索 + 分类筛选）
  products/[id]/            商品详情
  cart/                     购物车（需登录）
  checkout/                 结算下单 + 模拟支付
  orders/                   我的订单
  login/  register/         登录注册
  admin/                    后台管理（需 ADMIN 角色）
    products/  categories/  orders/
lib/
  prisma.ts                 PrismaClient 单例
  auth.ts                   JWT 签发/校验、getSession()
  password.ts               bcrypt 哈希/比对
  member.ts                 心悦等级配置 + 折扣计算  ← 改会员规则只改这里
  money.ts                  分 ↔ 元 换算
proxy.ts                    路由保护（注意：不是 middleware.ts）
```

## 核心约定

### 金额一律用「分」

数据库中所有金额字段都是 **`Int` 类型、单位为分**，禁止使用浮点数存钱。
展示时用 `lib/money.ts` 换算成元。

### 心悦会员等级

配置集中在 `lib/member.ts`，**要调整规则只需改这一个文件**：

| 等级 | 名称 | 累计消费阈值 | 折扣 |
|---|---|---|---|
| 0 | 普通会员 | 0 | 无折扣 |
| 1 | 心悦1级 | ¥8,000 | 9.8折 |
| 2 | 心悦2级 | ¥80,000 | 9.5折 |
| 3 | 心悦3级 | ¥800,000 | 9折 |

规则细节：
- 累计消费 `User.totalSpent` 只统计**已支付**订单的实付金额
- 等级**只升不降**
- 折扣只对升级后的新订单生效：触发升级的那一单仍按升级前的折扣结算

### 鉴权

自定义 JWT，不使用 Auth.js：
- 登录成功后签 JWT 存 **httpOnly cookie**
- `lib/auth.ts` 的 `getSession()` 在服务端读取并解密，返回 `userId` + `role`
- `proxy.ts` 负责页面级跳转保护，**Server Action 内必须再校验一次权限**（防越权）

## 数据模型

```
User      id, email(unique), passwordHash, name, role(USER|ADMIN),
          memberLevel(Int, 默认0), totalSpent(Int 分), createdAt
Category  id, name, slug(unique), createdAt
Product   id, name, slug, description, price(Int 分), imageUrl, stock(Int),
          categoryId→Category, createdAt, updatedAt
CartItem  id, userId→User, productId→Product, quantity,
          @@unique([userId, productId])
Order     id, orderNo(unique), userId→User, originalAmount(Int 分, 折前),
          discount(Int, 默认100), totalAmount(Int 分, 实付),
          status(PENDING_PAYMENT|PAID|SHIPPED|COMPLETED|CANCELLED),
          address, createdAt
OrderItem id, orderId→Order, productId, productName, price, quantity
```

`OrderItem` 在下单时**快照**商品名与价格，避免后续商品改价影响历史订单。

## Next.js 16 注意事项

写代码前先查 `node_modules/next/dist/docs/` 中的对应文档，破坏性变更较多：

- `params` / `searchParams` / `cookies()` / `headers()` 都是 **async，必须 await**
- **App Router 是唯一路由**，Pages Router 已在 16.0 移除
- `middleware.ts` 已废弃 → 改用 **`proxy.ts`**（跑在 Node.js 而非 Edge）
- **Turbopack 是默认打包器**，无需 `--turbo` 参数
- 缓存改为显式 opt-in：`"use cache"` + `cacheLife` / `cacheTag`
- 根 layout 的 `metadata` 导出、`next.config.ts` 均为 TS 格式

## 验证方式

改完功能后按此链路自测：

1. `npm run dev` → 首页能看到商品列表、搜索、分类筛选
2. 注册 → 登录 → 加购 → 购物车 → 下单 → 模拟支付 → 订单列表可见
3. 用 seed 的 admin 账号登录 → 进入 `/admin` 完成商品/分类 CRUD、订单状态流转
4. **权限**：未登录访问 `/cart` 或 `/admin` 应被重定向或拒绝
5. **会员**：新用户支付累计 ≥ ¥8,000 后应升为心悦1级，再下单实付按 9.8 折计算
6. `npm run build` 确认生产构建通过
