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

> ⚠️ **`migrate dev` 会清库。** `package.json` 里配了 `prisma.seed`，所以 `migrate dev` 与
> `migrate reset` 都会在迁移后自动跑一遍 seed，而 `prisma/seed.ts` 开头就把**所有表 `deleteMany`** ——
> 在已有数据的开发库上跑 `migrate dev`，订单和账号会一起没。
> 要保留数据就绕开它：`migrate diff` 生成 SQL → 存成
> `prisma/migrations/<时间戳>_<名字>/migration.sql` → `npx prisma migrate deploy` 应用。
> `deploy` 不跑 seed，也是唯一能在非交互 shell 里用的迁移命令（`migrate dev` 遇到警告会弹确认，
> 非交互环境直接报错退出）。迁移后记得 `npx prisma generate`，`deploy` 不会自动重新生成客户端。

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
  cart/                     购物车（需登录；读走 Prisma，增删改走 /api/cart）
  checkout/                 结算下单（收货地址表单等）**待实现**，当前下单入口是 /cart 的「提交订单」
  orders/                   我的订单列表 + 订单详情（需登录）
  login/  register/         登录注册
  admin/                    后台管理（需 ADMIN 角色）
    layout.tsx              后台权限闸门 + 横向导航（新增后台页不可能漏加校验）
    page.tsx                概览（商品/分类/订单计数）
    products/  categories/  orders/
lib/
  prisma.ts                 PrismaClient 单例
  queries.ts                共享查询函数（Server Component 与 API 路由复用，避免逻辑重复）
  auth.ts                   bcrypt 哈希/比对 + JWT 签发校验 + session Cookie
  cart.ts                   购物车读取与小计/合计计算（Server Component 与 API 路由复用）
  orders.ts                 订单建单/查询/支付（建单走事务：建单 + 扣库存 + 清购物车）
  order-status.ts           订单状态文案、配色与**流转表**（**刻意不引 Prisma**，客户端组件也要 import）
  stock.ts                  库存档位（缺货/低库存）阈值、文案与配色（**刻意不引 Prisma**，客户端组件也要 import）
  search.ts                 搜索关键词的 LIKE 转义与各入口的命中 id（**唯一允许 $queryRaw 的地方**）
  admin.ts                  后台鉴权闸门 + 后台列表查询（商品/订单/分类，均分页）+ AdminError
  admin-filters.ts          后台列表筛选参数的解析与归一化（**非法值在此丢弃**，页面拿到的条件必定「显示 = 生效」）
  admin-catalog.ts          后台商品与分类的写入（入参 schema、校验、事务）
  admin-orders.ts           后台订单状态流转（取消时归还库存、回退累计消费）
  datetime.ts               时间格式化
  url.ts                    列表页 URL 构造（搜索/分类/分页参数编码）
  member.ts                 心悦等级配置 + 折扣计算  ← 改会员规则只改这里（待实现）
  money.ts                  分 ↔ 元 换算
proxy.ts                    路由保护（注意：不是 middleware.ts）（待实现）
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
- 登录成功后签 JWT 存 **httpOnly cookie**（`sameSite: lax`；生产环境自动加 `secure`）
- `lib/auth.ts` 的 `getSession()` 在服务端读取并解密，返回 `userId` + `role`
- `getCurrentUser()` 读数据库返回完整用户信息（不含 `passwordHash`）。**权限判定用它，不要用 `getSession().role`** —— Cookie 里的 role 是签发时的快照，用户改角色后会过期
- `proxy.ts` 负责页面级跳转保护，**Server Action 内必须再校验一次权限**（防越权）

认证相关接口（**这是「写入走 Server Action」约定的唯一例外**，因为登录注册需要给未登录用户调用并对接 httpOnly Cookie）：

| 接口 | 说明 |
|---|---|
| `POST /api/auth/register` | 注册，成功即写入会话 |
| `POST /api/auth/login` | 登录，失败统一返回「邮箱或密码错误」不区分原因 |
| `GET /api/auth/me` | 当前用户，未登录 401 |
| `POST /api/auth/logout` | 清除会话 Cookie |

安全约定：密码一律 bcrypt 哈希（cost 10）；登录时邮箱不存在也要执行一次等价 bcrypt 比对，抹平响应时间差异，防用户枚举。

购物车接口（**「写入走 Server Action」的第二处约定例外**：`/cart` 页面的 +/- 与删除都是客户端交互，需要逐次请求并拿到最新购物车，用 Server Action 反而要手动编排刷新）：

| 接口 | 说明 |
|---|---|
| `GET /api/cart` | 当前用户购物车（含小计、合计），未登录 401 |
| `POST /api/cart` | 加入购物车 `{productId, quantity}`，已存在则累加 |
| `PUT /api/cart/[id]` | 修改某项数量 `{quantity}` |
| `DELETE /api/cart/[id]` | 删除某项 |

**越权约定（写任何带 `[id]` 的接口都要遵守）**：`CartItem` 的读写一律**同时按 `userId` 过滤**（`findFirst({where:{id, userId}})` / `deleteMany({where:{id, userId}})`），把别人的条目当作「不存在」返回 404，既不越权也不泄露条目是否存在。**不要**先 `findUnique({where:{id}})` 再比对 userId —— 那样多一次查询且容易漏判。

库存约定：加购与「加量」时校验 `quantity <= product.stock`，**但减量一律放行**（只要求 ≥ 1）。这条不对称是必需的：库存被后台下调后（购物车 5 件、库存降到 2），用户点「−」发出的中间值（4、3）仍然大于库存，若一并拒绝则每次都失败，而失败时前端不刷新，数量永远降不下来 —— 提示用户「请调整数量」而调整路径不可达。加购**不预占库存**，真正的扣减发生在下单。因此购物车里的数量可能在下单前超出最新库存，`/cart` 页面需要显示库存不足提示并禁用「提交订单」。

数量写入约定：加购用 `update: { quantity: { increment: quantity } }`，**不要写回读出来的绝对值** —— 两个标签页同时加购时，各自读到同一份旧值，写绝对值会让后写的那次覆盖前一次（两次点击只加一件）。同理，客户端做 +/- 时 `router.refresh()` 必须包在 `startTransition` 里并用 `isPending` 一起禁用控件：`refresh()` 返回 void，拿不到完成时机，`busy` 一复位就会用陈旧的 `item.quantity` 算出同样的绝对值，连点两次只生效一次。

订单接口：

| 接口 | 说明 |
|---|---|
| `POST /api/orders` | 从购物车创建订单（事务内：建单 → 扣库存 → 清购物车），允许空 body |
| `GET /api/orders` | 我的订单列表 |
| `GET /api/orders/[id]` | 订单详情 |
| `PUT /api/orders/[id]` | 模拟支付（待付款 → 已支付），无 body |

**订单状态**（`Order.status` 是 **`String` 而非 Prisma 枚举**，状态值定义在 `lib/order-status.ts`）：

```
PENDING_PAYMENT（待付款）→ PAID（已支付）→ SHIPPED（已发货）→ COMPLETED（已完成）
        └─────────────┴──────────────┘
                    ↓
              CANCELLED（已取消）
```

- 状态值沿用 schema 既有的 `PENDING_PAYMENT`，**不要写成 `PENDING`**（会与历史数据对不上）
- 因为底层是 String，手工改库或老数据可能出现预期外的值，取文案统一走 `orderStatusLabel()` / `orderStatusClass()` 兜底
- **流转表是 `ORDER_STATUS_FLOW`**（`lib/order-status.ts`），后台按钮与后台接口共用同一份：接口据此校验（不合法 409），页面据此只渲染合法按钮
- 允许的流转：待付款→已支付/已取消，已支付→已发货/已取消，已发货→已完成。**已完成与已取消是终态，禁止回退**
  （不放开回退是必需的：取消时库存已归还，回退就得重新扣减，而那时库存可能已被别人买走，扣不动只能失败）
- **买家侧没有取消订单的接口**（`PUT /api/orders/[id]` 只做支付，且只有待付款能付）；`CANCELLED` 由后台 `PUT /api/admin/orders/[id]` 产生

**下单事务的两条硬约定**（`lib/orders.ts`）：

1. **扣库存必须用条件更新**，不是「先读库存再写」：
   `updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })`，
   `count === 0` 即库存不足并抛错回滚。比较与写入在同一条 SQL 里完成，并发下单不会超卖。
   前面的只读「体检」只为把缺货商品一次性列全，**不承担并发安全**。
2. **清购物车按本次消费的条目 id 删**（`id: { in: [...] }`），不要写 `deleteMany({ where: { userId } })` ——
   事务期间用户若在别的标签页加购，按 userId 清会连带抹掉新加的条目。

其他约定：
- `Order.address` 是 **NOT NULL** 但结算页尚未实现，`POST /api/orders` 的 `address` 可选，缺省填 `DEFAULT_ADDRESS` 占位
- 折扣目前恒为 `lib/orders.ts` 里的 `DEFAULT_DISCOUNT = 100`（不打折）。这个常量是**占位值，不是配置入口** —— 心悦的阈值与折扣率归 `lib/member.ts` 管（见上文「心悦会员等级」），接入时由 `lib/orders.ts` 调用 member.ts 取折扣率来替换它，**不要把等级规则写进 orders.ts**。`originalAmount / discount / totalAmount` 三个字段与前端展示（仅在 `discount < 100` 时渲染优惠行）都已就位
- 支付时在**同一事务内**累计 `User.totalSpent`（心悦等级的计算依据），且状态判断写进 `UPDATE ... WHERE status = 'PENDING_PAYMENT'`，避免并发重复支付把累计金额加两次；但**不重算 `memberLevel`** —— 等级升级属 `lib/member.ts` 的职责，目前尚无写入方，验证方式第 5 条（心悦升级 + 9.8 折）通过的路径尚未打通

### 后台管理

后台页面在 `admin/layout.tsx` 统一鉴权（未登录 → `/login`，非管理员 → 渲染「需要管理员权限」），
新增后台页面因此不可能漏加校验。**但这只挡住页面渲染**，真正的写入口是下面这些接口。

后台接口（**「写入走 Server Action」的第三处约定例外**：后台是表单 + 表格的交互式编辑器，
与购物车同理 —— 需要逐次请求并拿到最新列表，用 Server Action 反而要手动编排刷新）：

| 接口 | 说明 |
|---|---|
| `POST /api/admin/products` | 新增商品 |
| `PUT /api/admin/products/[id]` | 修改商品（表单每次提交全量字段） |
| `DELETE /api/admin/products/[id]` | 删除商品（连带从各用户购物车移除） |
| `POST /api/admin/categories` | 新增分类 |
| `DELETE /api/admin/categories/[id]` | 删除分类（分类下还有商品时 409） |
| `PUT /api/admin/orders/[id]` | 更新订单状态 |

**后台刻意只有写接口，没有 `GET /api/admin/*`**：三个后台页面都是 Server Component，
按「读取数据 → 直连 Prisma」的约定取数（`getAdminProducts()` / `getCategoriesWithCount()` / `getAdminOrders()`），
再配 `router.refresh()` 刷新。加只读接口会得到一份没有调用方的重复取数路径。
接口的职责是「页面挡不住的那个写入口」。

后台约定：

- **每个后台接口的第一件事都是 `const denied = await adminGuard(); if (denied) return denied;`**
  （`lib/admin.ts`）。不能依赖「页面已经挡过了」—— 接口可以被直接请求。
  **不要用 `getSession().role` 判定**，Cookie 里的 role 是签发时的快照，用户被降权后旧 Cookie 会继续生效
- 未登录回 **401**、已登录但非管理员回 **403**：前端据此区分「跳登录页」与「提示无权限」
- 后台接口的业务失败统一抛 `AdminError(message, status)`（`lib/admin.ts`），路由层 catch 后转成对应状态码；
  文案由后端写死中文，前端直接展示，避免两边各写一套说法
- 商品价格入参叫 **`priceYuan`（元）**，由 `lib/admin-catalog.ts` 用 `yuanToCents()` 换算成分落库。
  不叫 `price` 是因为库里和其它接口的 `price` 一律是「分」，同名会让人按分去填。出参仍是 `price`（分）
- 删商品必须**先清购物车再删商品**（同一事务）：`CartItem.productId` 是必填外键，直接删会撞 P2003。
  **历史订单不受影响** —— `OrderItem` 只快照 `productId` / 商品名 / 价格，schema 里没有指向 Product 的外键
- 分类下有商品时**不允许删除**（`Product.categoryId` 是必填外键，连带删除商品会顺带清空购物车），
  改由管理员先处理商品。预检商品数只为把报错说清楚，真正防并发的是那次 `delete` 的 P2003
- **后台改订单状态的副作用**（`lib/admin-orders.ts`，与买家侧 `payOrder()` 共享同一条不变量）：
  转入「已支付」→ `totalSpent +=`；取消一笔**已支付**的单 → `totalSpent -=`；
  取消任意订单 → 逐条 `stock += quantity` 归还库存。两条路径必须一致，
  否则「后台标一次已支付、买家再付一次」会把金额算两遍
- 状态更新把**当前状态写进 `UPDATE ... WHERE status = ?`**，两个管理员同时操作只有一个能成功，
  副作用因此不会被应用两次
- `memberLevel` **不重算**：等级只升不降，取消订单让 `totalSpent` 变小也不回退等级

### 搜索关键词一律走 `lib/search.ts`（不能直接用 Prisma 的 `contains`）

**这是本项目唯一需要 `$queryRaw` 的地方**，原因是 Prisma 在 SQLite 上生成的
`LIKE ?` **不带 `ESCAPE` 子句**（实测参数是 `"%%%"`），于是关键词里的 `%` / `_`
被 SQLite 当成通配符 —— 搜一个 `%` 会命中全表。转义只有在 SQL 里配上 `ESCAPE '\'`
才生效，而 Prisma 没有往 `where` 注入 SQL 片段的口子，所以命中 id 只能自己查。

规则：

- **任何用户输入的搜索词都必须经 `lib/search.ts`**。它导出 `escapeLike()` 与四个
  按入口划分的 id 查询（前台商品 `name/description`、后台商品 `name/slug`、
  后台订单 `orderNo/user.name/user.email`、后台分类 `name/slug`）
- **只查 id，取数仍交给 Prisma 的 `findMany`**：include / orderBy / skip / take / count
  一条都不用重写，raw SQL 里只剩「哪些行命中」，不存在两套取数逻辑漂移。
  命中 id 交给 `where: { id: { in: [...] } }`，**空数组恰好表示「谁都不匹配」**，无需特判
- 反斜杠必须和 `%` / `_` **一起**转义，否则用户输入的 `\%` 里那个 `%` 仍是通配符
- 各页面的 where 构造是 async 的（要先查 id），**同一个页面的多个 where 要一起算**
  （`productWheres` / `orderWheres` 返回一组），否则同一句 id 查询会在一个请求里跑好几遍
- ⚠️ **已知上限**：命中集会被拼进 `id IN (...)`，行数极多时会撞上 SQLite 的绑定变量上限
  （本版本 32766）。演示数据量下远不可及；真到那个量级，要换成「在 SQL 里连分页一起做」
  的 raw 查询，而不是继续用 id 预筛

行为变化（2026-09 修）：修之前 `?search=%` 返回全部商品、`?search=a_c` 能命中 `abc`；
修之后二者都按**字面量**匹配 —— 搜 `%` 只会返回描述里真的写了百分号的商品。
SQLite 的 `LIKE` 对 ASCII 不区分大小写这一既有行为**保持不变**。

### 后台列表的筛选与分页

三个后台列表页（商品/订单/分类）与首页共用同一套**服务端 URL 驱动**的列表模式
（`await searchParams` → `parseXxxFilters()` → 查询返回 `{items,total,page,totalPages}` →
越界 `redirect()` → 原生 form + `<Link>` 分页）。照抄 `src/app/page.tsx`，改列表页前先读它。

- **筛选状态一律放 URL**，不引入客户端状态管理。这样筛选结果可分享、可刷新、可后退
- **页面保持 Server Component**：`searchParams` 在服务端解析，筛选条/分页都是服务端渲染的
  `<Link>`。**不要为了筛选新增 `GET /api/admin/*`** —— 后台刻意只有写接口（见上文）
- **参数校验的唯一入口是 `lib/admin-filters.ts`**：`stock` 走 `isStockFilter`、`status` 走
  `isOrderStatus`、`category` 对照当前分类 slug 集合、`search` 走 `parseSearch`。
  **绝不把任意字符串直接塞进 Prisma 条件**。一条规则管全部：**非法值 → 丢弃该条件**，
  不报错也不静默篡改（因此不存在「输入框显示 A、实际筛的是 B」）。
  关键词还要再经 `lib/search.ts` 转义，见上一节
- **`page` 一律用 `normalizePage()` 归一化**，禁止写 `Number(sp.page) || 1`（挡不住 `NaN`）
- **`buildQueryUrl()`（`lib/url.ts`）是唯一的 URL 拼装入口**，`page <= 1` 不写入
  （`?page=1` 与无参数是同一页，写进 URL 只会制造两份可分享链接）
- **越界收敛依赖 `redirect()`，所以后台列表页不要加 `loading.tsx` / `Suspense`** ——
  在 streaming 上下文里 `redirect` 会退化成 `<meta http-equiv="refresh">`（整页重载）。
  这个约束对整个仓库成立：全仓目前没有 `loading.tsx`
- **`orderBy` 必须带 `{ id: "desc" }` 兜底**：`createdAt` 毫秒相同不是全序，SQLite 不保证
  顺序，翻页会漏行/重复行（已用 15 笔 `createdAt` 完全相同的订单验证过）
- 筛选标签上的**计数**在「当前其他筛选条件」下计算，且各条各算各的：
  分类条只按关键词（选中分类自身不参与，否则其余分类计数全变 0），库存条按关键词+分类，
  订单状态条只按关键词

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
`OrderItem.productId` 只是普通字段，**没有指向 `Product` 的外键** —— 所以商品可以被删除，
历史订单仍能完整展示（这也是后台删除商品不需要保护订单数据的原因）。

`Product.slug` 与 `Category.slug` **都是 `@unique`**（`Product.slug` 的唯一索引由
`20260916120000_product_slug_unique` 迁移补上）。

因此**后台的商品写入必须接住 P2002 并转成 409**（`lib/admin-catalog.ts` 的 `slugConflict()`）：
不接的话重复 slug 会变成 500，而这本该是一条「换个 slug 再提交」的普通表单错误。
`updateProduct` 的表单每次提交全量字段，slug 不变时是「写回自己」—— Prisma 允许，不会误报冲突。

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
3. 用 seed 的 admin 账号登录（`admin@example.com` / `admin123`）→ 首页出现「后台管理」入口 →
   进入 `/admin` 完成商品/分类 CRUD、订单状态流转
4. **权限**：未登录访问 `/cart` 或 `/admin` 应被重定向到 `/login`；
   普通用户访问 `/admin/*` 页面看到「需要管理员权限」，直接请求 `/api/admin/*` 得到 **403**（未登录是 401）
5. **取消订单的联动**：后台把一笔已支付订单取消后，商品库存应回到下单前的值，
   下单用户的 `totalSpent` 应扣回该单实付金额，且这笔单不能再改回已支付（终态）
6. **会员**：新用户支付累计 ≥ ¥8,000 后应升为心悦1级，再下单实付按 9.8 折计算
7. **后台列表的筛选与分页**（三个页面各走一遍）：
   - 筛选生效 + 组合筛选 + 翻页保留筛选 + 「清除筛选」回干净 URL
   - 手改地址栏灌非法值：`?page=abc` / `-1` / `1e308` → 第 1 页；`?stock=xxx` / `?status=HACK` /
     `?category=<不存在的 slug>` → 该条件被忽略、其余照常生效
   - 越界收敛：`?page=99` → 307 回最后一页，且**筛选条件不丢**
   - 计数：筛选标签上的数字随其他条件变化，且与列表行数一致
8. **搜索关键词按字面量匹配**（前台首页 + 三个后台列表各验一次）：
   搜 `%` 只应返回名称/描述里**真的含百分号**的商品（本项目 seed 里有 3 件写着「100% 纯棉」），
   **不是全部**；搜 `_` 应得 0 件（`a_c` 不该命中 `abc`）；
   常规词（`iphone` / `纯棉` / 订单号 / 买家邮箱）结果与「拿全表在 JS 里 `includes`」的对照一致；
   `'`、`'; DROP TABLE Product; --` 等注入串只应返回 0 件、不报错、表还在
9. `npm run build` 确认生产构建通过

> ⚠️ 造列表测试数据**绝不能用 `npx prisma db seed` 或 `migrate dev`**（见上方常用命令的 ⚠️，会清库）。
> 用独立脚本按精确标识造/删，跑完把库恢复原状。让 `createdAt` 大量相同才能验出
> `{id:"desc"}` 兜底是否生效。删订单前**必须先删 `OrderItem`**（`orderId` 是必填外键，否则 P2003）。
