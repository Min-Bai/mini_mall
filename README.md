# Mini Mall

微型电商项目，全栈 TypeScript。包含**商城前台**、**后台管理**与**心悦会员折扣体系**三部分。

## 功能

### 商城前台

- **首页**：商品列表，支持关键词搜索、分类筛选、分页
- **商品详情**：图片、价格、库存、描述
- **账号**：注册 / 登录 / 退出，JWT 存 httpOnly Cookie
- **购物车**：加购、改数量、删除；按库存校验，超库存时禁用下单
- **下单**：从购物车创建订单，事务内完成「建单 → 扣库存 → 清购物车」
- **我的订单**：列表、详情、模拟支付

### 后台管理（需 `ADMIN` 角色）

- 商品 / 分类 / 订单的增删改查
- 三个列表页均支持关键词筛选、分页，具体维度：商品（分类 + 库存档位）、订单（状态）、分类（关键词）
- 订单状态流转：待付款 → 已支付 → 已发货 → 已完成，中途可取消

### 心悦会员体系（部分实现）

| 部分 | 状态 |
|---|---|
| 累计消费 `User.totalSpent` —— 支付时累计，取消已支付订单时回退 | ✅ 已实现 |
| 等级升级与折扣 —— 累计 ≥ ¥8,000 升心悦1级、下单享 9.8 折等 | ❌ **未实现** |

折扣规则表（普通会员 / 心悦1-3级，¥8,000 / ¥80,000 / ¥800,000 三档）设计上集中在 `lib/member.ts`，但**该文件尚未创建**；目前下单折扣恒为 `lib/orders.ts` 里的 `DEFAULT_DISCOUNT = 100`，即不打折。`Order` 表的 `originalAmount` / `discount` / `totalAmount` 三个字段与前端优惠行展示都已就位，接入时只需替换折扣来源。

## 技术栈

| 依赖 | 版本 | 说明 |
|---|---|---|
| next | 16.3.5 | App Router（唯一路由）、Turbopack 默认 |
| react / react-dom | 19.2.8 | Next 16 强制要求 |
| typescript | 5.x | |
| tailwindcss | 4.x | v4 语法：`@import "tailwindcss"` |
| prisma / @prisma/client | 5.22.0 | v5 线最终版本 |
| bcryptjs | 3.0.3 | 密码哈希（cost 10） |
| jose | 6.2.12 | JWT 签发与校验 |
| zod | 3.25.76 | 接口入参校验 |

数据库为 **SQLite**（`prisma/dev.db` 单文件），无需额外服务。

## 快速开始

**环境要求**：Node.js >= 20.9（Next.js 16 的要求）

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量：复制 .env.example 为 .env
#    并把 JWT_SECRET 换成随机字符串，例如：
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. 建表（应用 prisma/migrations/ 下的迁移）
npx prisma migrate deploy

# 4. 灌入种子数据
npm run db:seed

# 5. 启动
npm run dev
```

打开 <http://localhost:3000>。

> ⚠️ **不要用 `npx prisma migrate dev`。** `package.json` 里配了 `prisma.seed`，而 `prisma/seed.ts` 开头会把所有表 `deleteMany` —— 在已有数据的库上跑它，订单和账号会一起没。日常用上面的 `migrate deploy` + `db:seed` 组合。

### 种子数据

- 5 个分类、16 个商品
- 管理员账号：`admin@example.com` / `admin123`

> ⚠️ 这是**开发用的固定凭据**，仅存在于 `prisma/seed.ts`。部署到任何公开环境前必须改掉。

## 目录结构

```
src/
  app/
    page.tsx              商城首页（商品列表 + 搜索 + 分类筛选 + 分页）
    products/[id]/        商品详情
    cart/                 购物车（需登录）
    orders/               我的订单（需登录）
    login/  register/     登录注册
    admin/                后台管理（需 ADMIN 角色）
      layout.tsx          后台权限闸门 + 横向导航
      products/  categories/  orders/
    api/                  接口层（见下方「读写分离」）
  lib/
    prisma.ts             PrismaClient 单例
    auth.ts               bcrypt 哈希比对 + JWT 签发校验 + session Cookie
    queries.ts            共享查询函数（Server Component 与接口复用）
    cart.ts               购物车读取与小计/合计
    orders.ts             订单建单 / 查询 / 支付（事务：建单 + 扣库存 + 清购物车）
    order-status.ts       订单状态文案、配色与流转表
    stock.ts              库存档位（缺货 / 低库存）阈值
    search.ts             搜索关键词的 LIKE 转义（唯一使用 $queryRaw 的地方）
    admin.ts              后台鉴权闸门 + 后台列表查询
    admin-filters.ts      后台筛选参数解析（非法值在此丢弃）
    admin-catalog.ts      后台商品与分类写入
    admin-orders.ts       后台订单状态流转
    money.ts              分 ↔ 元 换算
    member.ts             心悦等级与折扣规则（**尚未创建**）
prisma/
  schema.prisma           数据模型
  migrations/             迁移
  seed.ts                 种子数据
```

## 核心约定

### 读写分离的取数方式

- **读取** → 在 Server Component 中直接调用 Prisma，不绕接口
- **写入** → Server Action 或 Route Handler（`src/app/api/`）
- 不使用 Pages Router（Next 16 已移除）

三处例外走接口而非 Server Action，因为都需要逐次请求并拿到最新数据：认证（要给未登录用户调用并对接 httpOnly Cookie）、购物车、后台管理。

### 金额一律用「分」

数据库中所有金额字段都是 **`Int` 类型、单位为分**，不使用浮点数。展示时经 `lib/money.ts` 换算。后台接口的价格入参叫 `priceYuan`（元），由 `yuanToCents()` 换算后落库 —— 不叫 `price` 是为了避免与「分」混淆。

### 权限判定读数据库，不读 Cookie

`lib/auth.ts` 的 `getSession()` 只解密 Cookie，返回签发时的 `role` 快照；`getCurrentUser()` 才读数据库。**授权一律用后者** —— 用户被降权后，旧 Cookie 里的 `role` 仍然有效。

后台接口的第一件事固定是 `adminGuard()`（未登录 401、非管理员 403）。不能依赖「页面已经挡过了」，接口可以被直接请求。

### 搜索关键词必须走 `lib/search.ts`

Prisma 在 SQLite 上生成的 `LIKE ?` **不带 `ESCAPE` 子句**，于是关键词里的 `%` / `_` 会被当成通配符 —— 搜一个 `%` 会命中全表。转义只有在 SQL 里配上 `ESCAPE '\'` 才生效，而 Prisma 没有往 `where` 注入 SQL 片段的口子，所以命中 id 只能自己查。

这是本项目**唯一使用 `$queryRaw` 的地方**。它只查 id，取数仍交给 `findMany`，因此 include / orderBy / 分页 / count 都不需要重写。

### 下单事务的两条硬约定

1. **扣库存用条件更新**，不是「先读再写」：
   `updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })`
   比较与写入在同一条 SQL 里完成，并发下单不会超卖。
2. **清购物车按本次消费的条目 id 删**，不按 `userId` 清 —— 事务期间用户若在别的标签页加购，按 userId 会连带抹掉新加的条目。

### 订单状态

`Order.status` 是 **`String` 而非 Prisma 枚举**，取值定义在 `lib/order-status.ts`：

```
PENDING_PAYMENT（待付款）→ PAID（已支付）→ SHIPPED（已发货）→ COMPLETED（已完成）
        └─────────────┴──────────────┘
                    ↓
              CANCELLED（已取消）
```

流转表 `ORDER_STATUS_FLOW` 被后台接口（据此校验，不合法返回 409）与页面（据此只渲染合法按钮）共用。**已完成与已取消是终态，禁止回退** —— 取消时库存已归还，回退就得重新扣减，而那时库存可能已被别人买走。

`OrderItem` 在下单时**快照**商品名与价格，且**没有指向 `Product` 的外键**，因此商品可以被删除而历史订单仍能完整展示。

## 待实现

| 项 | 说明 |
|---|---|
| `lib/member.ts` | 心悦等级与折扣规则。目前 `totalSpent` 已累计，但等级不重算、折扣恒为不打折 |
| `src/app/checkout/` | 结算页（收货地址表单）。当前下单入口是 `/cart` 的「提交订单」，`Order.address` 由 `DEFAULT_ADDRESS` 占位 |
| `proxy.ts` | 路由级跳转保护（注意 Next 16 里叫 `proxy.ts`，不是 `middleware.ts`） |
