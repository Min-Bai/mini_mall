"use client";

import { useState } from "react";

export default function AddToCartButton({
  productId,
  disabled = false,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-lg bg-gray-300 px-6 py-3 text-white"
      >
        已售罄
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        data-product-id={productId}
        onClick={() => setMessage("购物车功能将在后续步骤实现")}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
      >
        加入购物车
      </button>
      {message && <p className="mt-2 text-sm text-gray-500">{message}</p>}
    </div>
  );
}
