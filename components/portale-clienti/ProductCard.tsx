'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ShoppingCart, Package, AlertCircle, Tag } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  code: string | null;
  price: number;
  originalPrice: number;
  hasCustomPrice: boolean;
  quantity: number;
  available: boolean;
  image: string;
  category: { id: number; name: string } | null;
  unit: string;
  description: string | null;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: number, quantity: number) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await onAddToCart(product.id, quantity);
      setQuantity(1); // Reset quantity after adding
    } finally {
      setIsAdding(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(price);
  };

  return (
    <article className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden transition-all hover:border-gray-300 hover:shadow-lg">
      {/* Image Section */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.hasCustomPrice && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded">
              <Tag className="h-3 w-3" />
              Prezzo speciale
            </span>
          )}
          {!product.available && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded">
              <AlertCircle className="h-3 w-3" />
              Esaurito
            </span>
          )}
        </div>

        {/* Stock Status Badge */}
        {product.available && (
          <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-medium text-gray-700">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3" />
              {product.quantity} {product.unit}
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex flex-col gap-3">
        {/* Category */}
        {product.category && (
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            {product.category.name}
          </span>
        )}

        {/* Product Name */}
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors min-h-[3rem]">
          {product.name}
        </h3>

        {/* Product Code */}
        {product.code && (
          <p className="text-sm text-gray-500">
            Cod. {product.code}
          </p>
        )}

        {/* Price Section */}
        <div className="flex items-baseline gap-2 mt-auto">
          <span className="text-2xl font-bold text-gray-900">
            {formatPrice(product.price)}
          </span>
          {product.hasCustomPrice && product.originalPrice > product.price && (
            <span className="text-sm text-gray-500 line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
          <span className="text-sm text-gray-500 ml-auto">
            / {product.unit}
          </span>
        </div>

        {/* Discount Percentage */}
        {product.hasCustomPrice && product.originalPrice > product.price && (
          <div className="text-xs text-green-600 font-medium">
            Risparmio: {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
          </div>
        )}

        {/* Add to Cart Section */}
        {product.available ? (
          <div className="flex items-center gap-2 mt-2 pt-3 border-t border-gray-100">
            {/* Quantity Selector */}
            <div className="flex items-center border border-gray-300 rounded">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 hover:bg-gray-100 transition-colors"
                aria-label="Diminuisci quantita"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 text-center border-x border-gray-300 py-2 focus:outline-none"
                min="1"
                max={product.quantity}
              />
              <button
                onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                className="px-3 py-2 hover:bg-gray-100 transition-colors"
                aria-label="Aumenta quantita"
              >
                +
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Aggiungi al carrello"
            >
              <ShoppingCart className="h-4 w-4" />
              {isAdding ? 'Aggiunta...' : 'Aggiungi'}
            </button>
          </div>
        ) : (
          <div className="mt-2 pt-3 border-t border-gray-100">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 bg-gray-300 text-gray-600 px-4 py-2 rounded cursor-not-allowed"
            >
              <AlertCircle className="h-4 w-4" />
              Non disponibile
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
