'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, Package, MapPin, Trash2, Percent, ShoppingCart } from 'lucide-react';
import type { OfferProduct } from '@/lib/types/expiry';
import toast from 'react-hot-toast';

interface OfferProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Props per catalogo venditori
  customerId?: number | null;
  customerName?: string;
  onProductAdd?: (product: OfferProduct, quantity: number) => void;
  showRemoveButton?: boolean; // default true per magazzino, false per venditori
}

export function OfferProductsModal({
  isOpen,
  onClose,
  customerId = null,
  customerName = '',
  onProductAdd,
  showRemoveButton = true
}: OfferProductsModalProps) {
  const [products, setProducts] = useState<OfferProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OfferProduct | null>(null);
  const [quantityInput, setQuantityInput] = useState<number>(1);

  useEffect(() => {
    if (isOpen) {
      loadOfferProducts();
    }
  }, [isOpen]);

  // Reset quantità quando cambia prodotto selezionato
  useEffect(() => {
    if (selectedProduct) {
      setQuantityInput(1);
    }
  }, [selectedProduct]);

  const loadOfferProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/offer-products', {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setProducts(data.products || []);
      } else {
        toast.error(data.error || 'Errore caricamento prodotti in offerta');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/offer-products?id=${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('✅ Prodotto rimosso dalle offerte');
        setProducts(prev => prev.filter(p => p.id !== productId));
        setSelectedProduct(null);
      } else {
        toast.error(data.error || 'Errore rimozione prodotto');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  const handleAddToOrder = () => {
    if (!selectedProduct) return;

    if (!customerId) {
      toast.error('⚠️ Seleziona prima un cliente');
      return;
    }

    const maxQty = (selectedProduct as any).availableQuantity !== undefined
      ? (selectedProduct as any).availableQuantity
      : selectedProduct.quantity;

    if (quantityInput <= 0 || quantityInput > maxQty) {
      toast.error(`⚠️ Quantità non valida (max disponibile: ${maxQty})`);
      return;
    }

    // Chiama callback per aggiungere al carrello
    if (onProductAdd) {
      onProductAdd(selectedProduct, quantityInput);
      toast.success(`✅ ${quantityInput} ${selectedProduct.uom} aggiunti all'ordine`);
      setSelectedProduct(null);
    }
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (isoDate: string) => {
    return new Date(isoDate).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-strong rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Prodotti in Offerta</h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    {products.length} prodott{products.length === 1 ? 'o' : 'i'} con prezzi speciali
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="min-w-[48px] min-h-[48px] p-3 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Caricamento offerte...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  🏷️
                </div>
                <h3 className="text-xl font-bold mb-2">Nessuna Offerta</h3>
                <p className="text-slate-400">
                  Non ci sono prodotti in offerta al momento
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-2 sm:p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {/* Immagine */}
                    <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-white p-2">
                      {product.image ? (
                        <img
                          src={`data:image/png;base64,${product.image}`}
                          alt={product.productName}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-2xl sm:text-3xl">
                          📦
                        </div>
                      )}
                    </div>

                    {/* Badge offerta */}
                    {product.discountPercentage && product.discountPercentage > 0 ? (
                      <div className="text-[10px] sm:text-xs font-bold mb-1 px-1.5 py-0.5 rounded text-center bg-blue-500/20 text-blue-400 border border-blue-500">
                        -{product.discountPercentage}% 🏷️
                      </div>
                    ) : (
                      <div className="text-[10px] sm:text-xs font-bold mb-1 px-1.5 py-0.5 rounded text-center bg-green-500/20 text-green-400 border border-green-500">
                        OFFERTA 🏷️
                      </div>
                    )}

                    {/* Nome */}
                    <h3 className="font-semibold text-xs sm:text-sm line-clamp-2 mb-1">
                      {product.productName}
                    </h3>

                    {/* Prezzo offerta */}
                    {product.offerPrice && product.offerPrice > 0 && (
                      <div className="text-sm font-bold text-green-400 mb-0.5">
                        CHF {product.offerPrice.toFixed(2)}
                      </div>
                    )}

                    {/* Quantità */}
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400 mb-0.5">
                      <Package className="w-3 h-3" />
                      <span>
                        {(product as any).availableQuantity !== undefined ? (
                          <>
                            {(product as any).availableQuantity} {product.uom}
                            {(product as any).reservedQuantity > 0 && (
                              <span className="text-orange-400 ml-1">
                                ({(product as any).reservedQuantity} prenotati)
                              </span>
                            )}
                          </>
                        ) : (
                          `${product.quantity} ${product.uom}`
                        )}
                      </span>
                    </div>

                    {/* Ubicazione */}
                    {product.locationName && (
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{product.locationName}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Modal Dettaglio Prodotto */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 min-w-[48px] min-h-[48px] p-3 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
              >
                ✕
              </button>

              {/* Immagine */}
              <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 rounded-xl overflow-hidden bg-white p-2">
                {selectedProduct.image ? (
                  <img
                    src={`data:image/png;base64,${selectedProduct.image}`}
                    alt={selectedProduct.productName}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-6xl">
                    📦
                  </div>
                )}
              </div>

              {/* Nome e codice */}
              <h2 className="text-lg sm:text-xl font-bold text-center mb-1 line-clamp-2">{selectedProduct.productName}</h2>
              {selectedProduct.productCode && (
                <p className="text-xs text-slate-400 text-center mb-3">COD: {selectedProduct.productCode}</p>
              )}

              {/* Badge offerta */}
              <div className="px-3 py-2 rounded-lg text-center font-bold text-sm sm:text-base mb-4 bg-blue-500/20 text-blue-400 border-2 border-blue-500">
                🏷️ OFFERTA SPECIALE
              </div>

              {/* Dettagli */}
              <div className="glass p-3 rounded-lg space-y-2 mb-4">
                {selectedProduct.offerPrice && selectedProduct.offerPrice > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="w-4 h-4 text-green-400" />
                    <span className="text-slate-400">Prezzo Offerta:</span>
                    <span className="font-bold text-green-400 text-lg">CHF {selectedProduct.offerPrice.toFixed(2)}</span>
                  </div>
                )}

                {selectedProduct.discountPercentage && selectedProduct.discountPercentage > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Percent className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400">Sconto:</span>
                    <span className="font-bold text-blue-400">{selectedProduct.discountPercentage}%</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-green-400" />
                  <span className="text-slate-400">Quantità:</span>
                  <span className="font-semibold text-green-400">
                    {(selectedProduct as any).availableQuantity !== undefined ? (
                      <>
                        {(selectedProduct as any).availableQuantity} {selectedProduct.uom} disponibili
                        {(selectedProduct as any).reservedQuantity > 0 && (
                          <span className="text-orange-400 text-xs ml-2">
                            ({(selectedProduct as any).reservedQuantity} già prenotati in altri ordini)
                          </span>
                        )}
                      </>
                    ) : (
                      `${selectedProduct.quantity} ${selectedProduct.uom}`
                    )}
                  </span>
                </div>

                {selectedProduct.lotName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-orange-400" />
                    <span className="text-slate-400">Lotto:</span>
                    <span className="font-semibold text-orange-400">{selectedProduct.lotName}</span>
                  </div>
                )}

                {selectedProduct.locationName && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div>
                      <span className="text-slate-400">Ubicazione:</span>
                      <p className="font-semibold">{selectedProduct.locationName}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Descrizione Offerta */}
              {selectedProduct.note && (
                <div className="glass p-3 rounded-lg mb-4">
                  <div className="flex items-start gap-2">
                    <Tag className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-400 mb-1">Descrizione Offerta</h3>
                      <p className="text-sm text-slate-300">{selectedProduct.note}</p>
                      {selectedProduct.estimatedValue && selectedProduct.estimatedValue > 0 && (
                        <div className="text-xs text-slate-500 mt-2">
                          Valore stimato: CHF {selectedProduct.estimatedValue.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Da: {selectedProduct.addedBy?.split('@')[0] || selectedProduct.addedBy} • {formatDate(selectedProduct.addedAt)} alle {formatTime(selectedProduct.addedAt)}
                  </div>
                </div>
              )}

              {/* Input Quantità (solo per catalogo venditori) */}
              {onProductAdd && (
                <div className="glass p-4 rounded-lg mb-4">
                  <label className="block text-sm font-semibold mb-2">Quantità</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantityInput(prev => Math.max(1, prev - 1))}
                      className="w-12 h-12 glass-strong rounded-lg font-bold text-xl hover:bg-white/5"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={(selectedProduct as any).availableQuantity !== undefined ? (selectedProduct as any).availableQuantity : selectedProduct.quantity}
                      value={quantityInput}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        const maxQty = (selectedProduct as any).availableQuantity !== undefined ? (selectedProduct as any).availableQuantity : selectedProduct.quantity;
                        setQuantityInput(Math.min(maxQty, Math.max(1, val)));
                      }}
                      className="flex-1 glass-strong p-3 rounded-lg text-center font-bold text-xl"
                    />
                    <button
                      onClick={() => {
                        const maxQty = (selectedProduct as any).availableQuantity !== undefined ? (selectedProduct as any).availableQuantity : selectedProduct.quantity;
                        setQuantityInput(prev => Math.min(maxQty, prev + 1));
                      }}
                      className="w-12 h-12 glass-strong rounded-lg font-bold text-xl hover:bg-white/5"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-2">
                    {(selectedProduct as any).availableQuantity !== undefined ? (
                      <>
                        Disponibili: {(selectedProduct as any).availableQuantity} {selectedProduct.uom}
                        {(selectedProduct as any).reservedQuantity > 0 && (
                          <span className="text-orange-400">
                            {' '}({(selectedProduct as any).reservedQuantity} prenotati)
                          </span>
                        )}
                      </>
                    ) : (
                      `Disponibili: ${selectedProduct.quantity} ${selectedProduct.uom}`
                    )}
                  </p>
                </div>
              )}

              {/* Azioni */}
              <div className="space-y-3">
                {/* Pulsante Aggiungi all'Ordine (solo per catalogo venditori) */}
                {onProductAdd && (
                  <button
                    onClick={handleAddToOrder}
                    disabled={!customerId}
                    className="w-full glass-strong p-4 min-h-[56px] rounded-lg bg-gradient-to-r from-green-600 to-emerald-600
                             hover:from-green-700 hover:to-emerald-700 disabled:from-slate-600 disabled:to-slate-600
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all
                             flex items-center justify-center gap-2 group"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-semibold">
                      {customerId ? 'Aggiungi all\'Ordine' : 'Seleziona Cliente'}
                    </span>
                  </button>
                )}

                {/* Pulsante Rimuovi (solo per magazzino) */}
                {showRemoveButton && (
                  <button
                    onClick={() => handleRemoveProduct(selectedProduct.id)}
                    className="w-full glass-strong p-4 min-h-[56px] rounded-lg hover:bg-red-500/20 transition-all
                             flex items-center justify-center gap-2 group"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                    <span className="font-semibold">Rimuovi dall'Offerta</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
