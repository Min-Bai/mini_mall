import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  { name: "数码电子", slug: "digital" },
  { name: "服饰鞋包", slug: "clothing" },
  { name: "食品生鲜", slug: "food" },
  { name: "家居生活", slug: "home" },
  { name: "图书文娱", slug: "books" },
];

// 金额单位为「分」
const products = [
  // 数码电子
  { name: "iPhone 15 Pro 256GB", slug: "iphone-15-pro", price: 899900, stock: 50, category: "digital", description: "钛金属边框，A17 Pro 芯片，4800 万像素主摄，支持 USB-C 接口。" },
  { name: "小米14 手机 12GB+256GB", slug: "xiaomi-14", price: 399900, stock: 80, category: "digital", description: "骁龙8 Gen3，徕卡光学镜头，1.5K 高刷屏，67W 快充。" },
  { name: "AirPods Pro 2", slug: "airpods-pro-2", price: 189900, stock: 120, category: "digital", description: "主动降噪，自适应通透模式，空间音频，续航 30 小时。" },
  { name: "机械键盘 87键 茶轴", slug: "mechanical-keyboard", price: 39900, stock: 200, category: "digital", description: "PBT 键帽，RGB 背光，热插拔轴体，全键无冲。" },
  // 服饰鞋包
  { name: "纯棉白色T恤", slug: "cotton-tshirt", price: 9900, stock: 500, category: "clothing", description: "100% 纯棉，宽松版型，透气舒适，多色可选。" },
  { name: "直筒牛仔裤 深蓝色", slug: "jeans", price: 19900, stock: 300, category: "clothing", description: "经典直筒版型，弹力面料，耐磨耐穿。" },
  { name: "轻便跑步鞋", slug: "running-shoes", price: 29900, stock: 150, category: "clothing", description: "透气网面，缓震中底，适合日常跑步与通勤。" },
  { name: "加厚羽绒服 中长款", slug: "down-jacket", price: 69900, stock: 80, category: "clothing", description: "90% 白鸭绒，防风面料，保暖锁温。" },
  // 食品生鲜
  { name: "云南小粒咖啡豆 500g", slug: "coffee-beans", price: 6800, stock: 300, category: "food", description: "现烘焙精品咖啡豆，中深烘焙，坚果巧克力风味。" },
  { name: "每日坚果大礼包 30包", slug: "nuts-gift", price: 12800, stock: 260, category: "food", description: "混合坚果，独立小包装，每日一包营养均衡。" },
  { name: "明前龙井绿茶 250g", slug: "longjing-tea", price: 15800, stock: 100, category: "food", description: "杭州原产地，明前采摘，豆香浓郁，回甘悠长。" },
  // 家居生活
  { name: "智能护眼台灯", slug: "desk-lamp", price: 12900, stock: 180, category: "home", description: "无频闪，无极调光，多色温，适合阅读办公。" },
  { name: "纯棉四件套 1.8m", slug: "bedding-set", price: 29900, stock: 90, category: "home", description: "100% 新疆长绒棉，亲肤透气，简约素色。" },
  { name: "不锈钢保温杯 500ml", slug: "thermos", price: 8900, stock: 400, category: "home", description: "316 不锈钢内胆，保温保冷 12 小时，便携密封。" },
  // 图书文娱
  { name: "《三体》全集 纪念版", slug: "three-body", price: 9900, stock: 120, category: "books", description: "刘慈欣科幻巨著，雨果奖获奖作品，三部曲合集。" },
  { name: "《算法导论》第三版", slug: "clrs", price: 12900, stock: 60, category: "books", description: "计算机算法经典教材，系统讲解算法设计与分析。" },
];

async function main() {
  // 按依赖顺序清空（保证 seed 可重复执行）
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // 分类
  const categoryMap: Record<string, string> = {};
  for (const c of categories) {
    const created = await prisma.category.create({ data: c });
    categoryMap[c.slug] = created.id;
  }

  // 商品
  for (const p of products) {
    const { category, ...rest } = p;
    await prisma.product.create({
      data: {
        ...rest,
        imageUrl: `https://picsum.photos/seed/${rest.slug}/600/600`,
        categoryId: categoryMap[category],
      },
    });
  }

  // 管理员账号（admin@example.com / admin123）
  await prisma.user.create({
    data: {
      email: "admin@example.com",
      passwordHash: hashSync("admin123", 10),
      name: "管理员",
      role: "ADMIN",
    },
  });

  console.log(`✓ 种子数据完成：${categories.length} 个分类，${products.length} 个商品，1 个管理员`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
