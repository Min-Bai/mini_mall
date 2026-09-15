import Link from "next/link";
import { formatPrice } from "@/lib/money";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    stock: number;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-medium text-gray-900">
          {product.name}
        </h3>
        <p className="mt-1 text-lg font-semibold text-red-600">
          {formatPrice(product.price)}
        </p>
        {product.stock > 0 ? (
          <p className="mt-1 text-xs text-gray-500">库存 {product.stock}</p>
        ) : (
          <p className="mt-1 text-xs text-red-500">已售罄</p>
        )}
      </div>
    </Link>
  );
}
