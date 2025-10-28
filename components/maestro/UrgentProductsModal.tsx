'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Calendar, Package, MapPin, AlertTriangle, Trash2 } from 'lucide-react';
import type { UrgentProduct } from '@/lib/types/expiry';
import toast from 'react-hot-toast';

interface UrgentProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UrgentProductsModal({ isOpen, onClose }: UrgentProductsModalProps) {
  const [products, setProducts] = useState<UrgentProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<UrgentProduct | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUrgentProducts();
    }
  }, [isOpen]);

  const loadUrgentProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/urgent-products', {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setProducts(data.products || []);
      } else {
        toast.error(data.error || 'Errore caricamento prodotti urgenti');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/urgent-products?id=${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('✅ Prodotto rimosso dalla lista urgenti');
        setProducts(prev => prev.filter(p => p.id !== productId));
        setSelectedProduct(null);
      } else {
        toast.error(data.error || 'Errore rimozione prodotto');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
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
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Bell className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Prodotti Urgenti</h2>
                  <p className="text-sm text-slate-400">
                    {products.length} prodott{products.length === 1 ? 'o' : 'i'} da vendere rapidamente
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Caricamento prodotti urgenti...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  ✅
                </div>
                <h3 className="text-xl font-bold mb-2">Tutto OK!</h3>
                <p className="text-slate-400">
                  Nessun prodotto urgente da vendere al momento
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-4 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {/* Immagine */}
                    <div className="w-full aspect-square rounded-lg overflow-hidden mb-3">
                      {product.image ? (
                        <img
                          src={`data:image/png;base64,${product.image}`}
                          alt={product.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-4xl">
                          📦
                        </div>
                      )}
                    </div>

                    {/* Badge urgenza */}
                    <div className={`text-xs font-bold mb-2 px-2 py-1 rounded-full text-center
                      ${product.urgencyLevel === 'expired'
                        ? 'bg-red-500/20 text-red-400 border border-red-500'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500'}`}>
                      {product.urgencyLevel === 'expired'
                        ? `🔴 SCADUTO ${Math.abs(product.daysUntilExpiry)}gg fa`
                        : `⏰ Scade tra ${product.daysUntilExpiry}gg`}
                    </div>

                    {/* Nome */}
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2">
                      {product.productName}
                    </h3>

                    {/* Quantità */}
                    <div className="flex items-center gap-1 text-xs text-green-400 mb-1">
                      <Package className="w-3 h-3" />
                      <span>{product.quantity} {product.uom}</span>
                    </div>

                    {/* Ubicazione */}
                    <div className="flex items-center gap-1 text-xs text-slate-400 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{product.locationName}</span>
                    </div>

                    {/* Nota preview */}
                    {product.note && (
                      <div className="mt-2 p-2 glass-strong rounded text-xs text-slate-300 line-clamp-2">
                        💬 {product.note}
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
                className="absolute top-4 right-4 w-8 h-8 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
              >
                ✕
              </button>

              {/* Immagine */}
              <div className="w-40 h-40 mx-auto mb-4 rounded-xl overflow-hidden">
                {selectedProduct.image ? (
                  <img
                    src={`data:image/png;base64,${selectedProduct.image}`}
                    alt={selectedProduct.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-6xl">
                    📦
                  </div>
                )}
              </div>

              {/* Nome e codice */}
              <h2 className="text-2xl font-bold text-center mb-1">{selectedProduct.productName}</h2>
              {selectedProduct.productCode && (
                <p className="text-slate-400 text-center mb-6">COD: {selectedProduct.productCode}</p>
              )}

              {/* Badge urgenza */}
              <div className={`px-4 py-3 rounded-lg text-center font-bold text-lg mb-6
                ${selectedProduct.urgencyLevel === 'expired'
                  ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                  : 'bg-orange-500/20 text-orange-400 border-2 border-orange-500'}`}>
                {selectedProduct.urgencyLevel === 'expired'
                  ? `🔴 SCADUTO ${Math.abs(selectedProduct.daysUntilExpiry)} giorni fa`
                  : `⏰ Scade tra ${selectedProduct.daysUntilExpiry} giorni`}
              </div>

              {/* Dettagli */}
              <div className="glass p-4 rounded-lg space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-400">Scadenza:</span>
                  <span className="font-semibold">{formatDate(selectedProduct.expirationDate)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-green-400" />
                  <span className="text-slate-400">Quantità:</span>
                  <span className="font-semibold text-green-400">
                    {selectedProduct.quantity} {selectedProduct.uom}
                  </span>
                </div>

                {selectedProduct.lotName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-orange-400" />
                    <span className="text-slate-400">Lotto:</span>
                    <span className="font-semibold text-orange-400">{selectedProduct.lotName}</span>
                  </div>
                )}

                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-blue-400 mt-0.5" />
                  <div>
                    <span className="text-slate-400">Ubicazione:</span>
                    <p className="font-semibold">{selectedProduct.locationName}</p>
                  </div>
                </div>
              </div>

              {/* Nota Operatore */}
              {selectedProduct.note && (
                <div className="glass p-4 rounded-lg mb-6">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-orange-400 mb-1">Nota dall'Operatore</h3>
                      <p className="text-sm text-slate-300">{selectedProduct.note}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Da: {selectedProduct.addedBy} • {formatDate(selectedProduct.addedAt)} alle {formatTime(selectedProduct.addedAt)}
                  </div>
                </div>
              )}

              {/* Azioni */}
              <div className="space-y-3">
                <button
                  onClick={() => handleRemoveProduct(selectedProduct.id)}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-red-500/20 transition-all
                           flex items-center justify-center gap-2 group"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="font-semibold">Rimuovi dalla Lista</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
