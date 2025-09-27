'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, ArrowRight, Calculator, X } from 'lucide-react';
import { getInventoryClient } from '@/lib/odoo/inventoryClient';

interface BufferProduct {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
  image_128?: string;
  bufferQuantity: number;
  lots: Array<{
    id: number;
    name: string;
    quantity: number;
  }>;
}

interface BufferTransferProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: {
    id: number;
    name: string;
  } | null;
  onTransferComplete: () => void;
}

export function BufferTransfer({ isOpen, onClose, currentLocation, onTransferComplete }: BufferTransferProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BufferProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BufferProduct | null>(null);
  const [transferQuantity, setTransferQuantity] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const inventoryClient = getInventoryClient();

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const searchProducts = async () => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const results = await inventoryClient.searchBufferProducts(searchQuery);
      setSearchResults(results);
    } catch (error: any) {
      showNotification('Errore ricerca: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectProduct = (product: BufferProduct) => {
    setSelectedProduct(product);
    setTransferQuantity('');
    setLotNumber('');
    setExpiryDate('');
  };

  const executeTransfer = async () => {
    if (!selectedProduct || !currentLocation) return;

    const quantity = parseFloat(transferQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      showNotification('Inserisci una quantità valida', 'error');
      return;
    }

    if (quantity > selectedProduct.bufferQuantity) {
      showNotification(`Quantità massima disponibile: ${selectedProduct.bufferQuantity}`, 'error');
      return;
    }

    try {
      setLoading(true);

      const success = await inventoryClient.transferFromBuffer(
        selectedProduct.id,
        currentLocation.id,
        quantity,
        lotNumber || undefined,
        expiryDate || undefined
      );

      if (success) {
        showNotification('✅ Trasferimento completato!', 'success');
        setSelectedProduct(null);
        setSearchQuery('');
        setSearchResults([]);
        onTransferComplete();

        // Chiudi modal dopo 2 secondi
        setTimeout(onClose, 2000);
      }
    } catch (error: any) {
      showNotification('Errore trasferimento: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length >= 3) {
      const timeoutId = setTimeout(searchProducts, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="glass-strong rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ArrowRight className="w-6 h-6 text-blue-400" />
              Transfer dal Buffer
            </h2>
            <p className="text-muted-foreground text-sm">
              {currentLocation ? `Destinazione: ${currentLocation.name}` : 'Seleziona ubicazione di destinazione'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mx-6 mt-4 p-3 rounded-lg ${
                notification.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                notification.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {notification.message}
            </motion.div>
          )}
        </AnimatePresence>

        {!currentLocation ? (
          <div className="p-6 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessuna ubicazione selezionata</h3>
            <p className="text-muted-foreground">
              Seleziona prima un'ubicazione di destinazione per il trasferimento
            </p>
          </div>
        ) : selectedProduct ? (
          /* Transfer Form */
          <div className="p-6 space-y-6">
            {/* Selected Product */}
            <div className="glass rounded-lg p-4 border-l-4 border-blue-500">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                  {selectedProduct.image_128 ? (
                    <img
                      src={`data:image/png;base64,${selectedProduct.image_128}`}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{selectedProduct.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedProduct.default_code || selectedProduct.barcode}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Disponibile nel buffer: </span>
                    <span className="text-blue-400 font-semibold">{selectedProduct.bufferQuantity}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Transfer Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Quantità da trasferire *
                </label>
                <input
                  type="number"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  min="0"
                  max={selectedProduct.bufferQuantity}
                  step="0.01"
                  placeholder="Inserisci quantità"
                  className="w-full glass px-4 py-3 rounded-xl border-2 border-blue-500/50 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Lotto/Serie (opzionale)
                </label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="Numero lotto"
                  className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Data scadenza (opzionale)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={executeTransfer}
                disabled={loading || !transferQuantity}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Trasferimento...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Trasferisci
                  </>
                )}
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                disabled={loading}
                className="glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        ) : (
          /* Product Search */
          <div className="flex-1 flex flex-col">
            {/* Search Input */}
            <div className="p-6 border-b border-white/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca prodotto nel buffer (min 3 caratteri)..."
                  className="w-full glass pl-10 pr-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">Ricerca in corso...</p>
                </div>
              ) : searchQuery.length < 3 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Inserisci almeno 3 caratteri per iniziare la ricerca
                  </p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nessun prodotto trovato nel buffer con: "{searchQuery}"
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => selectProduct(product)}
                      className="glass rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                          {product.image_128 ? (
                            <img
                              src={`data:image/png;base64,${product.image_128}`}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{product.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {product.default_code || product.barcode}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-green-400">
                              Buffer: {product.bufferQuantity}
                            </span>
                            {product.lots.length > 0 && (
                              <span className="text-xs text-blue-400">
                                {product.lots.length} lotti
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}