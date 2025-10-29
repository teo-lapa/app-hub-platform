'use client';

import { useState } from 'react';
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

  // Estrai prima categoria (FRIGO, SECCO, etc.) dal path completo
  const getCategoryBadge = () => {
    if (!product.category) return null;
    const categoryName = product.category.name.split('/')[0].trim();
    return categoryName;
  };

  return (
    <article className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 overflow-hidden hover:border-emerald-500/50 transition-all duration-300 group">
      {/* Immagine prodotto */}
      <div className="aspect-square bg-slate-700/30 relative overflow-hidden">
        {product.image !== '/placeholder-product.png' ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-slate-500" />
          </div>
        )}

        {/* Badge categoria madre (prima categoria) - STILE CATALOGO LAPA */}
        {getCategoryBadge() && (
          <div className="absolute top-1.5 left-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/90 text-white">
              {getCategoryBadge()}
            </span>
          </div>
        )}

        {/* Badge disponibilità piccolo - STILE CATALOGO LAPA */}
        <div className="absolute top-1.5 right-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
            product.available
              ? 'bg-green-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}>
            {product.available ? '✓' : '✗'}
          </span>
        </div>

        {/* Badge prezzo speciale se presente */}
        {product.hasCustomPrice && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-blue-500/90 text-white">
              <Tag className="h-2.5 w-2.5" />
              Offerta
            </span>
          </div>
        )}
      </div>

      {/* Contenuto card */}
      <div className="p-2">
        <h3 className="text-xs font-semibold text-white mb-1 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">
          {product.name}
        </h3>

        {/* Codice prodotto */}
        {product.code && (
          <div className="text-slate-400 text-[10px] mb-1 truncate">
            {product.code}
          </div>
        )}

        {/* Footer card */}
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-600/50">
          {/* Prezzo in CHF */}
          <div>
            <span className="text-sm font-bold text-emerald-400">
              {formatPrice(product.price)}
            </span>
            {product.hasCustomPrice && product.originalPrice > product.price && (
              <span className="text-[9px] text-slate-500 line-through ml-1">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>

          {/* Quantità disponibile */}
          <div className="text-right">
            <div className={`text-[11px] font-semibold ${
              product.available ? 'text-green-400' : 'text-red-400'
            }`}>
              {product.quantity}
            </div>
          </div>
        </div>

        {/* Sezione Add to Cart - MANTIENE FUNZIONALITÀ E-COMMERCE */}
        {product.available ? (
          <div className="mt-2 pt-2 border-t border-slate-600/50 space-y-2">
            {/* Quantity Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                aria-label="Diminuisci quantita"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 text-center bg-slate-700 text-white text-sm py-2 min-h-[44px] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                min="1"
                max={product.quantity}
              />
              <button
                onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                className="px-3 py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                aria-label="Aumenta quantita"
              >
                +
              </button>
              <span className="text-xs text-slate-400 ml-1">
                {product.unit}
              </span>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Aggiungi al carrello"
            >
              <ShoppingCart className="h-4 w-4" />
              {isAdding ? 'Aggiunta...' : 'Aggiungi al Carrello'}
            </button>
          </div>
        ) : (
          <div className="mt-2 pt-2 border-t border-slate-600/50">
            <button
              disabled
              className="w-full flex items-center justify-center gap-1 bg-slate-700/50 text-slate-400 px-2 py-1.5 rounded text-xs cursor-not-allowed"
            >
              <AlertCircle className="h-3 w-3" />
              Non disponibile
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
