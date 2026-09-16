import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import CartItemRow from "@/components/CartItemRow";
import CheckoutButton from "@/components/CheckoutButton";

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const cart = await getCart(user.id);

  // 加购时不预占库存，商品可能在加购后被他人买走或后台下调库存
  const hasStockIssue = cart.items.some(
    (item) => item.quantity > item.product.stock,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">购物车</h1>

      {cart.items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-400">购物车还是空的</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cart.items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>

          {hasStockIssue && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              部分商品库存不足，请用 +/− 调整数量或移除该商品后再提交订单。
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">
              共 <span className="font-semibold text-gray-900">{cart.totalQuantity}</span> 件商品
            </p>

            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                合计：
                <span className="text-2xl font-bold text-red-600">
                  {formatPrice(cart.totalAmount)}
                </span>
              </p>
              <CheckoutButton disabled={hasStockIssue} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
