'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Package, Plus, Minus, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface VehicleProduct {
  product_id: number;
  name: string;
  default_code: string;
  image_url?: string | null;
  uom: string;
  quantity: number;
  category: string;
  lot_id?: number;
  lot_name?: string;
  expiry_date?: string;
}

interface SelectedProduct {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image?: string;
  uom: string;
  quantity: number;
}

interface VehicleProductSelectorProps {
  salesPersonId?: number;
  onConfirm: (products: SelectedProduct[]) => void;
  onClose: () => void;
}

export function VehicleProductSelector({
  salesPersonId,
  onConfirm,
  onClose
}: VehicleProductSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [vehicleProducts, setVehicleProducts] = useState<VehicleProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Map<number, number>>(new Map());
  const [locationName, setLocationName] = useState<string>('');

  useEffect(() => {
    loadVehicleStock();
  }, []);

  const loadVehicleStock = async () => {
    setLoading(true);
    try {
      const url = salesPersonId
        ? `/api/maestro/vehicle-stock?salesperson_id=${salesPersonId}`
        : '/api/maestro/vehicle-stock';

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        const errorMessage = result.error?.message || result.error || 'Errore nel caricamento dello stock';
        toast.error(errorMessage);
        return;
      }

      const data = result.data;
      setVehicleProducts(data.products || []);
      setLocationName(data.location?.name || 'Furgone');

      if (!data.products || data.products.length === 0) {
        toast.error('Nessun prodotto disponibile nel furgone', {
          duration: 4000,
          icon: '📦'
        });
      }
    } catch (error) {
      console.error('Errore caricamento stock furgone:', error);
      toast.error('Errore nel caricamento dello stock del furgone');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProduct = (product: VehicleProduct) => {
    const newSelected = new Map(selectedProducts);

    if (newSelected.has(product.product_id)) {
      // Remove if already selected
      newSelected.delete(product.product_id);
    } else {
      // Add with quantity 1
      newSelected.set(product.product_id, 1);
    }

    setSelectedProducts(newSelected);
  };

  const handleUpdateQuantity = (productId: number, delta: number) => {
    const newSelected = new Map(selectedProducts);
    const currentQty = newSelected.get(productId) || 0;
    const product = vehicleProducts.find(p => p.product_id === productId);

    if (!product) return;

    const newQty = Math.max(1, Math.min(currentQty + delta, product.quantity));

    if (newQty !== currentQty) {
      newSelected.set(productId, newQty);
      setSelectedProducts(newSelected);
    }
  };

  const handleConfirm = () => {
    const productsToReturn: SelectedProduct[] = [];

    selectedProducts.forEach((quantity, productId) => {
      const product = vehicleProducts.find(p => p.product_id === productId);
      if (product) {
        productsToReturn.push({
          id: product.product_id,
          name: product.name,
          code: product.default_code,
          barcode: product.default_code,
          image: product.image_url || undefined,
          uom: product.uom,
          quantity
        });
      }
    });

    if (productsToReturn.length === 0) {
      toast.error('Seleziona almeno un prodotto');
      return;
    }

    onConfirm(productsToReturn);
  };

  const selectedCount = selectedProducts.size;
  const totalSelectedQty = Array.from(selectedProducts.values()).reduce((sum, qty) => sum + qty, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Prodotti dalla tua Macchina</h3>
                <p className="text-sm text-slate-400 mt-0.5">{locationName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="min-w-[48px] min-h-[48px] p-3 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-400">Caricamento prodotti dal furgone...</p>
              </div>
            ) : vehicleProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="w-16 h-16 text-slate-600 mb-4" />
                <h4 className="text-lg font-semibold text-white mb-2">Nessun prodotto disponibile</h4>
                <p className="text-slate-400 text-center max-w-md">
                  Il tuo furgone non contiene prodotti disponibili al momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicleProducts.map((product) => {
                  const isSelected = selectedProducts.has(product.product_id);
                  const selectedQty = selectedProducts.get(product.product_id) || 0;

                  return (
                    <motion.div
                      key={product.product_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`border-2 rounded-xl p-4 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                      }`}
                      onClick={() => handleToggleProduct(product)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Product Image */}
                        <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Package className="w-8 h-8 text-slate-400" />
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white text-sm line-clamp-2">
                            {product.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">
                            {product.default_code}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                              {product.quantity} {product.uom} disponibili
                            </span>
                            {product.lot_name && (
                              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                                Lotto: {product.lot_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Selection Indicator */}
                        <div
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-slate-600 bg-transparent'
                          }`}
                        >
                          {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-slate-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">Quantità:</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQuantity(product.product_id, -1);
                                }}
                                disabled={selectedQty <= 1}
                                className="w-12 h-12 min-w-[48px] min-h-[48px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                              >
                                <Minus className="w-4 h-4 text-white" />
                              </button>

                              <div className="w-16 text-center">
                                <span className="text-lg font-bold text-white">{selectedQty}</span>
                                <span className="text-xs text-slate-400 ml-1">{product.uom}</span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQuantity(product.product_id, 1);
                                }}
                                disabled={selectedQty >= product.quantity}
                                className="w-12 h-12 min-w-[48px] min-h-[48px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                              >
                                <Plus className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700">
            {selectedCount > 0 && (
              <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    <strong className="text-blue-400">{selectedCount}</strong> prodotti selezionati
                  </span>
                  <span className="text-slate-300">
                    Totale: <strong className="text-blue-400">{totalSelectedQty}</strong> pezzi
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 min-h-[48px] bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedCount === 0}
                className="flex-1 px-6 py-3 min-h-[48px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Aggiungi Selezionati ({selectedCount})
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
