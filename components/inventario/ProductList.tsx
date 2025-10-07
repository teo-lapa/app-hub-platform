'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, AlertTriangle, Check } from 'lucide-react';

interface ProductItem {
  id: number;
  quant_id?: number; // ID univoco del quant (prodotto+ubicazione+lotto)
  name: string;
  code?: string;
  image?: string;
  stockQuantity: number;
  countedQuantity: number;
  difference?: number;
  uom?: string; // Unità di misura
  lot?: {
    id: number;
    name: string;
    expiration_date?: string;
  };
  write_date?: string; // Data ultima modifica
  inventory_date?: string; // Data inventario
  isSelected?: boolean;
}

interface ProductListProps {
  products: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
  onUpdateQuantity: (productId: number, quantity: number) => void;
}

export function ProductList({ products, onSelectProduct, onUpdateQuantity }: ProductListProps) {
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
            key={product.quant_id || `${product.id}-${product.lot?.id || 'no-lot'}`}
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

                  {/* Info lotto e scadenza */}
                  {product.lot && (
                    <div className="mt-1 flex flex-wrap gap-2 items-center">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                        Lotto: {product.lot.name}
                      </span>
                      {product.lot.expiration_date && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                          Scad: {new Date(product.lot.expiration_date).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Data ultima modifica/conteggio */}
                  {(product.inventory_date || product.write_date) && (
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">
                        Ultimo conteggio: {new Date(product.inventory_date || product.write_date || '').toLocaleString('it-IT')}
                      </span>
                    </div>
                  )}

                  {/* Quantità - Solo visualizzazione */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Stock:</span>
                      <span className="font-bold">{product.stockQuantity} {product.uom || 'PZ'}</span>
                    </div>

                    {product.countedQuantity !== product.stockQuantity && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Contato:</span>
                        <span className="font-bold text-blue-400">{product.countedQuantity} {product.uom || 'PZ'}</span>
                      </div>
                    )}
                  </div>

                  {/* Indicatore differenza */}
                  {product.difference !== undefined && product.difference !== 0 && (
                    <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg ${getDifferenceBg(product.difference)}`}>
                      {product.difference > 0 ? (
                        <span className={`text-sm font-semibold ${getDifferenceColor(product.difference)}`}>
                          +{product.difference} {product.uom || 'PZ'}
                        </span>
                      ) : (
                        <span className={`text-sm font-semibold ${getDifferenceColor(product.difference)}`}>
                          {product.difference} {product.uom || 'PZ'}
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