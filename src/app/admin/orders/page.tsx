import { redirect } from "next/navigation";
import { getAdminOrderStatusCounts, getAdminOrders } from "@/lib/admin";
import {
  hasOrderFilters,
  orderFilterParams,
  orderWheres,
  parseOrderFilters,
} from "@/lib/admin-filters";
import { formatDateTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";
import {
  ORDER_STATUS,
  ORDER_STATUS_FLOW,
  orderStatusLabel,
  type OrderStatus,
} from "@/lib/order-status";
import { buildQueryUrl, firstParam, type SearchParamsPromise } from "@/lib/url";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import OrderStatusActions from "@/components/admin/OrderStatusActions";
import AdminFilterForm from "@/components/admin/AdminFilterForm";
import AdminFilterPills from "@/components/admin/AdminFilterPills";
import AdminPagination from "@/components/admin/AdminPagination";

const BASE_PATH = "/admin/orders";

/**
 * 流转规则说明由 `ORDER_STATUS_FLOW` **生成**，不是手写的散文。
 *
 * 之前这里是硬编码的「待付款、已支付、已发货都可以取消」，而流转表里
 * `SHIPPED` 只能到 `COMPLETED` —— 文案与它正上方的按钮、以及接口的 409 三方矛盾。
 * 改成生成后，以后动流转表文案自动跟着变，不可能再漂移。
 */
const FLOW_SUMMARY = (Object.keys(ORDER_STATUS_FLOW) as OrderStatus[])
  .filter((from) => ORDER_STATUS_FLOW[from].length > 0)
  .map(
    (from) =>
      `${orderStatusLabel(from)} → ${ORDER_STATUS_FLOW[from]
        .map(orderStatusLabel)
        .join(" / ")}`,
  )
  .join("；");

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const sp = await searchParams;
  const filters = parseOrderFilters(sp);

  // 两个 where 一起算：共用同一份关键词命中的 id（见 lib/search.ts）
  const { searchOnly, list } = await orderWheres(filters);

  const [{ items, total, page, totalPages }, statusCounts] = await Promise.all([
    getAdminOrders({ where: list, page: firstParam(sp.page) }),
    // 状态标签的计数**只按关键词算，不含状态自身** —— 否则选中某个状态后，
    // 其余状态的计数会全变成 0，筛选条就没法用来横向比较了
    getAdminOrderStatusCounts(searchOnly),
  ]);

  // 页码越界（如筛完后停在 ?page=2，或手改 ?page=99）收敛到最后一页
  if (total > 0 && page > totalPages) {
    redirect(
      buildQueryUrl(BASE_PATH, {
        ...orderFilterParams(filters),
        page: totalPages,
      }),
    );
  }

  const clearHref = hasOrderFilters(filters) ? BASE_PATH : null;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
        <p className="text-sm text-gray-500">
          {clearHref ? `匹配 ${total} 笔订单` : `共 ${total} 笔订单`}
        </p>
      </div>

      <AdminFilterForm
        key={`${filters.search}|${filters.status}`}
        action={BASE_PATH}
        resetHref={clearHref}
      >
        <input
          type="search"
          name="search"
          defaultValue={filters.search}
          placeholder="搜索订单号 / 下单人姓名 / 邮箱…"
          className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </AdminFilterForm>

      <AdminFilterPills
        label="状态"
        name="status"
        current={filters.status}
        basePath={BASE_PATH}
        params={orderFilterParams(filters)}
        options={[
          { value: "", label: "全部", count: statusCounts.all },
          // 选项由 ORDER_STATUS 生成，不手写字面量 —— 与接口的守卫同一份来源
          ...(Object.values(ORDER_STATUS) as OrderStatus[]).map((status) => ({
            value: status,
            label: orderStatusLabel(status),
            count: statusCounts.byStatus[status] ?? 0,
          })),
        ]}
      />

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center text-gray-400">
          {/* 空结果有两种含义，文案必须分开 */}
          {clearHref ? (
            <>没有符合条件的订单，请调整筛选条件</>
          ) : (
            "还没有订单"
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">订单号</th>
                <th className="px-4 py-2 font-medium">下单人</th>
                <th className="px-4 py-2 font-medium">商品</th>
                <th className="px-4 py-2 text-right font-medium">实付金额</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">下单时间</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {/* 故意不是链接：买家侧 /orders/[id] 按当前登录用户过滤，
                        管理员点别人的订单必然 404，而后台并没有订单详情页。
                        订单明细本来就已直接列在右边一列，这里给纯文本即可。 */}
                    <span className="text-gray-900">{order.orderNo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{order.user.name}</p>
                    <p className="text-xs text-gray-400">{order.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {/* 后台要能直接看清明细，所以不折叠成「首个等 N 件」 */}
                    <ul className="space-y-0.5">
                      {order.items.map((item) => (
                        <li key={item.id} className="text-xs text-gray-600">
                          {item.productName} ×{item.quantity}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="font-medium text-gray-900">
                      {formatPrice(order.totalAmount)}
                    </span>
                    {order.discount < 100 && (
                      <p className="text-xs text-gray-400 line-through">
                        {formatPrice(order.originalAmount)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusActions orderId={order.id} status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination
        basePath={BASE_PATH}
        params={orderFilterParams(filters)}
        page={page}
        totalPages={totalPages}
        total={total}
        unit="笔"
      />

      <p className="mt-3 text-xs text-gray-400">
        状态流转规则：{FLOW_SUMMARY}。已完成与已取消是终态。
        取消会把库存归还给商品，已支付的订单还会扣减用户的累计消费。
      </p>
    </div>
  );
}
