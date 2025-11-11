'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  Tag,
  Calendar,
  Package,
  MapPin,
  Trash2,
  Edit,
  Eye,
  Search,
  Filter,
  User,
  Clock
} from 'lucide-react';
import type { UrgentProduct, OfferProduct } from '@/lib/types/expiry';
import toast from 'react-hot-toast';

interface ProductManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'urgent' | 'offers' | 'all';

export function ProductManagementModal({ isOpen, onClose }: ProductManagementModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [urgentProducts, setUrgentProducts] = useState<UrgentProduct[]>([]);
  const [offerProducts, setOfferProducts] = useState<OfferProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<UrgentProduct | OfferProduct | null>(null);
  const [productType, setProductType] = useState<'urgent' | 'offer' | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAllProducts();
    }
  }, [isOpen]);

  const loadAllProducts = async () => {
    setLoading(true);
    try {
      const [urgentRes, offerRes] = await Promise.all([
        fetch('/api/urgent-products', { credentials: 'include' }),
        fetch('/api/offer-products', { credentials: 'include' })
      ]);

      const urgentData = await urgentRes.json();
      const offerData = await offerRes.json();

      if (urgentData.success) {
        setUrgentProducts(urgentData.products || []);
      }
      if (offerData.success) {
        setOfferProducts(offerData.products || []);
      }
    } catch (error: any) {
      toast.error('Errore caricamento prodotti: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUrgent = async (productId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto urgente?')) return;

    try {
      const response = await fetch(`/api/urgent-products?id=${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Prodotto urgente eliminato');
        setUrgentProducts(prev => prev.filter(p => p.id !== productId));
        setSelectedProduct(null);
      } else {
        toast.error(data.error || 'Errore eliminazione');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  const handleDeleteOffer = async (productId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto in offerta?')) return;

    try {
      const response = await fetch(`/api/offer-products?id=${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Prodotto offerta eliminato');
        setOfferProducts(prev => prev.filter(p => p.id !== productId));
        setSelectedProduct(null);
      } else {
        toast.error(data.error || 'Errore eliminazione');
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

  const formatDateTime = (isoDate: string) => {
    return `${formatDate(isoDate)} ${formatTime(isoDate)}`;
  };

  // Filtra prodotti in base al tab e alla ricerca
  const getFilteredProducts = () => {
    let products: Array<UrgentProduct | OfferProduct & { type: 'urgent' | 'offer' }> = [];

    if (activeTab === 'urgent' || activeTab === 'all') {
      products.push(...urgentProducts.map(p => ({ ...p, type: 'urgent' as const })));
    }
    if (activeTab === 'offers' || activeTab === 'all') {
      products.push(...offerProducts.map(p => ({ ...p, type: 'offer' as const })));
    }

    // Applica filtro ricerca
    if (searchQuery && searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      products = products.filter(p =>
        p.productName.toLowerCase().includes(query) ||
        p.productCode?.toLowerCase().includes(query) ||
        p.productBarcode?.toLowerCase().includes(query) ||
        ('lotName' in p && p.lotName?.toLowerCase().includes(query))
      );
    }

    return products;
  };

  const filteredProducts = getFilteredProducts();
  const totalCount = urgentProducts.length + offerProducts.length;

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
          className="glass-strong rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Gestione Urgenti/Offerte</h2>
                  <p className="text-sm text-slate-400">
                    {totalCount} prodotti totali
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

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                    : 'glass-strong text-slate-300 hover:bg-white/5'
                }`}
              >
                Tutti ({totalCount})
              </button>
              <button
                onClick={() => setActiveTab('urgent')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'urgent'
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                    : 'glass-strong text-slate-300 hover:bg-white/5'
                }`}
              >
                <Bell className="w-4 h-4 inline mr-1" />
                Urgenti ({urgentProducts.length})
              </button>
              <button
                onClick={() => setActiveTab('offers')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'offers'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
                    : 'glass-strong text-slate-300 hover:bg-white/5'
                }`}
              >
                <Tag className="w-4 h-4 inline mr-1" />
                Offerte ({offerProducts.length})
              </button>
            </div>

            {/* Barra ricerca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per nome, codice, barcode, lotto..."
                className="w-full pl-10 pr-10 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 min-w-[36px] min-h-[36px] p-2 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Caricamento prodotti...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">Nessun prodotto trovato</h3>
                <p className="text-slate-400">
                  {searchQuery ? 'Prova a modificare i criteri di ricerca' : 'Non ci sono prodotti in questa categoria'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const isUrgent = 'type' in product && product.type === 'urgent';
                  const isOffer = 'type' in product && product.type === 'offer';

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass p-4 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedProduct(product);
                        setProductType(isUrgent ? 'urgent' : 'offer');
                      }}
                    >
                      <div className="flex gap-4">
                        {/* Immagine */}
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-white p-1 flex-shrink-0">
                          {product.image ? (
                            <img
                              src={`data:image/png;base64,${product.image}`}
                              alt={product.productName}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-2xl">
                              📦
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg line-clamp-1">{product.productName}</h3>
                              {product.productCode && (
                                <p className="text-xs text-slate-400">COD: {product.productCode}</p>
                              )}
                            </div>

                            {/* Badge tipo */}
                            <div className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                              isUrgent
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500'
                            }`}>
                              {isUrgent ? (
                                <>
                                  <Bell className="w-3 h-3 inline mr-1" />
                                  URGENTE
                                </>
                              ) : (
                                <>
                                  <Tag className="w-3 h-3 inline mr-1" />
                                  OFFERTA
                                </>
                              )}
                            </div>
                          </div>

                          {/* Dettagli in griglia */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {/* Quantità */}
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4 text-green-400 flex-shrink-0" />
                              <span className="text-slate-400 text-xs">Qty:</span>
                              <span className="font-semibold text-green-400">{product.quantity} {product.uom}</span>
                            </div>

                            {/* Scadenza (solo urgenti) */}
                            {isUrgent && 'daysUntilExpiry' in product && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span className="text-slate-400 text-xs">Scade:</span>
                                <span className={`font-semibold ${
                                  (product.daysUntilExpiry as number) < 0 ? 'text-red-400' : 'text-orange-400'
                                }`}>
                                  {(product.daysUntilExpiry as number) < 0
                                    ? `${Math.abs(product.daysUntilExpiry as number)}gg fa`
                                    : `${product.daysUntilExpiry}gg`
                                  }
                                </span>
                              </div>
                            )}

                            {/* Prezzo offerta */}
                            {isOffer && 'offerPrice' in product && product.offerPrice && (
                              <div className="flex items-center gap-1">
                                <Tag className="w-4 h-4 text-green-400 flex-shrink-0" />
                                <span className="text-slate-400 text-xs">Prezzo:</span>
                                <span className="font-semibold text-green-400">CHF {product.offerPrice.toFixed(2)}</span>
                              </div>
                            )}

                            {/* Ubicazione */}
                            {product.locationName && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <span className="text-slate-400 text-xs truncate">{product.locationName}</span>
                              </div>
                            )}

                            {/* Operatore */}
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4 text-purple-400 flex-shrink-0" />
                              <span className="text-slate-400 text-xs">Da:</span>
                              <span className="font-semibold text-purple-400 text-xs truncate">
                                {product.addedBy?.split('@')[0] || 'N/A'}
                              </span>
                            </div>

                            {/* Data aggiunta */}
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-xs text-slate-400">{formatDateTime(product.addedAt)}</span>
                            </div>
                          </div>

                          {/* Nota preview */}
                          {product.note && (
                            <div className="mt-2 text-xs text-slate-300 line-clamp-1">
                              <span className="text-slate-500">Nota:</span> {product.note}
                            </div>
                          )}
                        </div>

                        {/* Azioni rapide */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(product);
                              setProductType(isUrgent ? 'urgent' : 'offer');
                            }}
                            className="min-w-[40px] min-h-[40px] p-2 glass-strong rounded-lg hover:bg-blue-500/20 transition-all"
                            title="Dettagli"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isUrgent) {
                                handleDeleteUrgent(product.id);
                              } else {
                                handleDeleteOffer(product.id);
                              }
                            }}
                            className="min-w-[40px] min-h-[40px] p-2 glass-strong rounded-lg hover:bg-red-500/20 transition-all"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Modal Dettaglio Prodotto */}
      <AnimatePresence>
        {selectedProduct && productType && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelectedProduct(null);
              setProductType(null);
            }}
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
                onClick={() => {
                  setSelectedProduct(null);
                  setProductType(null);
                }}
                className="absolute top-4 right-4 min-w-[48px] min-h-[48px] p-3 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Immagine */}
              <div className="w-32 h-32 mx-auto mb-4 rounded-xl overflow-hidden bg-white p-2">
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
              <h2 className="text-xl font-bold text-center mb-1">{selectedProduct.productName}</h2>
              {selectedProduct.productCode && (
                <p className="text-slate-400 text-center mb-1">COD: {selectedProduct.productCode}</p>
              )}
              {selectedProduct.productBarcode && (
                <p className="text-xs text-slate-500 text-center mb-4">Barcode: {selectedProduct.productBarcode}</p>
              )}

              {/* Badge tipo */}
              <div className={`px-4 py-2 rounded-lg text-center font-bold mb-4 ${
                productType === 'urgent'
                  ? 'bg-orange-500/20 text-orange-400 border-2 border-orange-500'
                  : 'bg-blue-500/20 text-blue-400 border-2 border-blue-500'
              }`}>
                {productType === 'urgent' ? (
                  <>
                    <Bell className="w-5 h-5 inline mr-2" />
                    PRODOTTO URGENTE
                  </>
                ) : (
                  <>
                    <Tag className="w-5 h-5 inline mr-2" />
                    PRODOTTO IN OFFERTA
                  </>
                )}
              </div>

              {/* Dettagli */}
              <div className="glass p-4 rounded-lg space-y-3 mb-4">
                {/* Scadenza (solo urgenti) */}
                {productType === 'urgent' && 'expirationDate' in selectedProduct && (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-400">Data Scadenza:</span>
                      <span className="font-semibold">{formatDate(selectedProduct.expirationDate)}</span>
                    </div>
                    {'daysUntilExpiry' in selectedProduct && (
                      <div className={`px-3 py-2 rounded-lg text-center font-bold ${
                        selectedProduct.daysUntilExpiry < 0
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {selectedProduct.daysUntilExpiry < 0
                          ? `SCADUTO ${Math.abs(selectedProduct.daysUntilExpiry)} giorni fa`
                          : `Scade tra ${selectedProduct.daysUntilExpiry} giorni`
                        }
                      </div>
                    )}
                  </>
                )}

                {/* Lotto */}
                {'lotName' in selectedProduct && selectedProduct.lotName && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-400" />
                    <span className="text-slate-400">Lotto:</span>
                    <span className="font-semibold text-orange-400">{selectedProduct.lotName}</span>
                  </div>
                )}

                {/* Quantità */}
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-400" />
                  <span className="text-slate-400">Quantità:</span>
                  <span className="font-semibold text-green-400">
                    {selectedProduct.quantity} {selectedProduct.uom}
                  </span>
                </div>

                {/* Prezzo suggerito/offerta */}
                {productType === 'urgent' && 'suggestedPrice' in selectedProduct && selectedProduct.suggestedPrice && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-green-400" />
                    <span className="text-slate-400">Prezzo Suggerito:</span>
                    <span className="font-bold text-green-400 text-lg">CHF {selectedProduct.suggestedPrice.toFixed(2)}</span>
                  </div>
                )}
                {productType === 'offer' && 'offerPrice' in selectedProduct && selectedProduct.offerPrice && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-green-400" />
                    <span className="text-slate-400">Prezzo Offerta:</span>
                    <span className="font-bold text-green-400 text-lg">CHF {selectedProduct.offerPrice.toFixed(2)}</span>
                  </div>
                )}
                {productType === 'offer' && 'discountPercentage' in selectedProduct && selectedProduct.discountPercentage && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400">Sconto:</span>
                    <span className="font-bold text-blue-400">{selectedProduct.discountPercentage}%</span>
                  </div>
                )}

                {/* Valore stimato */}
                {selectedProduct.estimatedValue && selectedProduct.estimatedValue > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-yellow-400" />
                    <span className="text-slate-400">Valore Stimato:</span>
                    <span className="font-semibold text-yellow-400">CHF {selectedProduct.estimatedValue.toFixed(2)}</span>
                  </div>
                )}

                {/* Ubicazione */}
                {selectedProduct.locationName && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400">Ubicazione:</span>
                    <span className="font-semibold">{selectedProduct.locationName}</span>
                  </div>
                )}
              </div>

              {/* Nota */}
              {selectedProduct.note && (
                <div className="glass p-4 rounded-lg mb-4">
                  <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
                    productType === 'urgent' ? 'text-orange-400' : 'text-blue-400'
                  }`}>
                    {productType === 'urgent' ? (
                      <>
                        <Bell className="w-5 h-5" />
                        Nota Operatore
                      </>
                    ) : (
                      <>
                        <Tag className="w-5 h-5" />
                        Descrizione Offerta
                      </>
                    )}
                  </h3>
                  <p className="text-slate-300">{selectedProduct.note}</p>
                </div>
              )}

              {/* Info aggiunta */}
              <div className="glass p-3 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-400">Aggiunto da:</span>
                  <span className="font-semibold text-purple-400">
                    {selectedProduct.addedBy?.split('@')[0] || selectedProduct.addedBy}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400">Data e ora:</span>
                  <span className="font-semibold">{formatDateTime(selectedProduct.addedAt)}</span>
                </div>
              </div>

              {/* Azioni */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (productType === 'urgent') {
                      handleDeleteUrgent(selectedProduct.id);
                    } else {
                      handleDeleteOffer(selectedProduct.id);
                    }
                  }}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="font-semibold">Elimina dal Database</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
