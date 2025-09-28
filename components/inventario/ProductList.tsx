'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, AlertTriangle, Check, X, Calculator } from 'lucide-react';

interface ProductItem {
  id: number;
  name: string;
  code?: string;
  image?: string;
  stockQuantity: number;
  countedQuantity: number;
  difference?: number;
  lot?: {
    id: number;
    name: string;
    expiration_date?: string;
  };
  isSelected?: boolean;
}

interface ProductListProps {
  products: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onOpenCalculator?: (productId: number, currentQuantity: number) => void;
}

export function ProductList({ products, onSelectProduct, onUpdateQuantity, onOpenCalculator }: ProductListProps) {
  const [localProducts, setLocalProducts] = useState<ProductItem[]>(products);

  useEffect(() => {
    setLocalProducts(products.map(p => ({
      ...p,
      difference: p.countedQuantity - p.stockQuantity
    })));
  }, [products]);

  const getDifferenceColor = (diff: number) => {
    if (diff === 0) return 'text-green-500';
    if (Math.abs(diff) <= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getDifferenceBg = (diff: number) => {
    if (diff === 0) return 'bg-green-500/10';
    if (Math.abs(diff) <= 5) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  const handleQuantityChange = (productId: number, value: string) => {
    const quantity = parseFloat(value) || 0;
    setLocalProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, countedQuantity: quantity, difference: quantity - p.stockQuantity }
        : p
    ));
    onUpdateQuantity(productId, quantity);
  };

  if (localProducts.length === 0) {
    return (
      <div className="glass-weak rounded-xl p-8 text-center">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Ubicazione Vuota</h3>
        <p className="text-gray-400">
          Nessun prodotto in questa ubicazione
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {localProducts.map((product) => (
          <motion.div
            key={product.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`glass rounded-xl p-4 ${
              product.isSelected ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div onClick={() => onSelectProduct(product)} className="cursor-pointer">
              <div className="flex items-start gap-4">
                {/* Immagine prodotto */}
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}

                {/* Info prodotto */}
                <div className="flex-1">
                  <h3 className="font-semibold">{product.name}</h3>
                  {product.code && (
                    <p className="text-sm text-gray-400">Codice: {product.code}</p>
                  )}

                  {product.lot && (
                    <div className="mt-1">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                        Lotto: {product.lot.name}
                      </span>
                      {product.lot.expiration_date && (
                        <span className="text-xs text-gray-400 ml-2">
                          Scad: {new Date(product.lot.expiration_date).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quantità */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Stock:</span>
                      <span className="font-bold">{product.stockQuantity} PZ</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Contato:</span>
                      <input
                        type="text"
                        value={product.countedQuantity}
                        readOnly
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenCalculator) {
                            onOpenCalculator(product.id, product.countedQuantity);
                          }
                        }}
                        className="w-20 glass px-2 py-1 rounded text-center font-bold cursor-pointer hover:bg-white/10"
                        placeholder="0"
                      />
                      {onOpenCalculator && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCalculator(product.id, product.countedQuantity);
                          }}
                          className="glass p-2 rounded-lg hover:bg-white/10"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Indicatore differenza */}
                  {product.difference !== undefined && product.difference !== 0 && (
                    <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg ${getDifferenceBg(product.difference)}`}>
                      {product.difference > 0 ? (
                        <span className={`text-sm font-semibold ${getDifferenceColor(product.difference)}`}>
                          +{product.difference} PZ
                        </span>
                      ) : (
                        <span className={`text-sm font-semibold ${getDifferenceColor(product.difference)}`}>
                          {product.difference} PZ
                        </span>
                      )}
                      {Math.abs(product.difference) > 10 && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Stato conferma */}
                <div className="flex flex-col gap-2">
                  {product.difference === 0 && (
                    <div className="glass-success p-2 rounded-lg">
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Riepilogo */}
      <div className="glass-strong rounded-xl p-4 mt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Totale prodotti:</span>
          <span className="font-bold text-lg">{localProducts.length}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-gray-400">Differenze trovate:</span>
          <span className={`font-bold ${
            localProducts.filter(p => p.difference !== 0).length > 0
              ? 'text-yellow-500'
              : 'text-green-500'
          }`}>
            {localProducts.filter(p => p.difference !== 0).length}
          </span>
        </div>
      </div>
    </div>
  );
}