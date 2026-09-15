import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/queries";
import { buildListUrl } from "@/lib/url";
import { formatPrice } from "@/lib/money";
import AddToCartButton from "@/components/AddToCartButton";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* 面包屑 */}
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900">
          首页
        </Link>
        <span className="mx-1">/</span>
        <Link
          href={buildListUrl({ category: product.category.slug })}
          className="hover:text-gray-900"
        >
          {product.category.name}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-3 text-3xl font-semibold text-red-600">
            {formatPrice(product.price)}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            库存：{product.stock > 0 ? `${product.stock} 件` : "已售罄"}
          </p>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-medium text-gray-900">商品描述</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {product.description}
            </p>
          </div>

          <div className="mt-auto pt-6">
            <AddToCartButton
              productId={product.id}
              disabled={product.stock <= 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
