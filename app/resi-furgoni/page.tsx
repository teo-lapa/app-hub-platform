'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Truck, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { getPickingClient } from '@/lib/odoo/pickingClient';
import toast from 'react-hot-toast';

interface VanLocation {
  id: number;
  name: string;
  complete_name: string;
  productCount: number;
  products: VanProduct[];
}

interface OrderInfo {
  quantity: number;
  orderName: string;
  customerName: string;
  deliveryDate: string;
}

interface VanProduct {
  productId: number;
  productName: string;
  productCode: string;
  productBarcode: string;
  quantity: number;
  uom: string;
  image: string | null;
  lotName?: string;
  expiryDate?: string;
  pickingName?: string;
  customerName?: string;
  driverName?: string;
  orders?: OrderInfo[];
}

interface ReturnItem {
  productId: number;
  productName: string;
  quantityToReturn: number;
  originalQuantity: number;
  bufferZone: 'secco' | 'secco_sopra' | 'frigo' | 'pingu';
  lotName?: string;
  pickingName?: string;
  customerName?: string;
  driverName?: string;
}

const BUFFER_ZONES = [
  { id: 'secco', name: 'Secco', icon: '📦', color: '#f59e0b' },
  { id: 'secco_sopra', name: 'Secco Sopra', icon: '📦', color: '#f97316' },
  { id: 'frigo', name: 'Frigo', icon: '❄️', color: '#06b6d4' },
  { id: 'pingu', name: 'Pingu', icon: '🐧', color: '#8b5cf6' }
];

export default function ResiFurgoniPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Stati principali
  const [currentVan, setCurrentVan] = useState<VanLocation | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  // Liste dati
  const [vans, setVans] = useState<VanLocation[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [showVanSelector, setShowVanSelector] = useState(true);
  const [showProductList, setShowProductList] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  const pickingClient = getPickingClient();

  // Carica furgoni all'avvio
  useEffect(() => {
    loadVans();
  }, []);

  async function loadVans() {
    setIsLoading(true);
    try {
      // Cerca ubicazioni furgoni (WH/Stock/FURGONI/*)
      const response = await fetch('/api/inventory/search-furgoni-locations');

      if (!response.ok) {
        throw new Error('Errore caricamento ubicazioni furgoni');
      }

      const data = await response.json();

      if (!data.success || !data.locations) {
        throw new Error(data.error || 'Nessuna ubicazione furgone trovata');
      }

      console.log('✅ [FRONTEND] Furgoni caricati:', data.locations.length);
      console.log('🔍 [FRONTEND] Primo prodotto dati completi:', data.locations[0]?.products[0]);

      setVans(data.locations);
    } catch (error: any) {
      console.error('❌ Errore caricamento furgoni:', error);
      toast.error('Errore caricamento furgoni');
    } finally {
      setIsLoading(false);
    }
  }

  function selectVan(van: VanLocation) {
    setCurrentVan(van);
    setShowVanSelector(false);

    // Inizializza returnItems con tutti i prodotti
    const items: ReturnItem[] = van.products.map(product => ({
      productId: product.productId,
      productName: product.productName,
      quantityToReturn: product.quantity,
      originalQuantity: product.quantity,
      bufferZone: determineBufferZone(product.productName),
      lotName: product.lotName,
      pickingName: product.pickingName,
      customerName: product.customerName,
      driverName: product.driverName
    }));

    setReturnItems(items);
    setShowProductList(true);
  }

  function determineBufferZone(productName: string): 'secco' | 'secco_sopra' | 'frigo' | 'pingu' {
    const name = productName.toLowerCase();

    if (name.includes('frigo') || name.includes('fresc') || name.includes('latte') || name.includes('yogurt')) {
      return 'frigo';
    } else if (name.includes('pingu') || name.includes('surgelat') || name.includes('gelat')) {
      return 'pingu';
    } else {
      return 'secco';
    }
  }

  function updateReturnQuantity(productId: number, newQuantity: number) {
    setReturnItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, quantityToReturn: Math.max(0, Math.min(newQuantity, item.originalQuantity)) }
        : item
    ));
  }

  function updateBufferZone(productId: number, newZone: 'secco' | 'secco_sopra' | 'frigo' | 'pingu') {
    setReturnItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, bufferZone: newZone }
        : item
    ));
  }

  function toggleProductExpand(productId: number) {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  }

  async function confirmReturns() {
    if (!currentVan) return;

    // Filtra solo prodotti con quantità > 0
    const itemsToReturn = returnItems.filter(item => item.quantityToReturn > 0);

    if (itemsToReturn.length === 0) {
      toast.error('Nessun prodotto da rendere');
      return;
    }

    setIsLoading(true);
    try {
      // Chiamata API per creare i resi
      const response = await fetch('/api/inventory/create-van-returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vanLocationId: currentVan.id,
          vanLocationName: currentVan.name,
          returns: itemsToReturn
        })
      });

      if (!response.ok) {
        throw new Error('Errore creazione resi');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore creazione resi');
      }

      toast.success(`✓ ${itemsToReturn.length} resi creati con successo!`);
      setShowConfirmation(true);
      setShowProductList(false);

    } catch (error: any) {
      console.error('❌ Errore conferma resi:', error);
      toast.error('Errore creazione resi');
    } finally {
      setIsLoading(false);
    }
  }

  function resetSelection() {
    setCurrentVan(null);
    setReturnItems([]);
    setShowVanSelector(true);
    setShowProductList(false);
    setShowConfirmation(false);
    setExpandedProducts(new Set());
    loadVans();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="🔄 Resi Furgoni"
        showBackButton={!showVanSelector}
        onBack={() => {
          if (showConfirmation) {
            resetSelection();
          } else if (showProductList) {
            setShowProductList(false);
            setShowVanSelector(true);
            setCurrentVan(null);
          }
        }}
      />

      <div className="max-w-6xl mx-auto p-4">
        {/* Info Bar */}
        {currentVan && !showConfirmation && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Furgone</span>
                <span className="font-semibold text-gray-900">{currentVan.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Prodotti</span>
                <span className="font-semibold text-blue-600">{currentVan.productCount}</span>
              </div>
            </div>
            <button
              onClick={resetSelection}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        )}

        {/* Selezione Furgone */}
        <AnimatePresence>
          {showVanSelector && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Seleziona Furgone</h2>
                <button
                  onClick={loadVans}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Aggiorna
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
                  <p className="mt-4 text-gray-600">Caricamento furgoni...</p>
                </div>
              ) : vans.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
                  <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nessun furgone con merce disponibile</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {vans.map(van => (
                    <motion.button
                      key={van.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => selectVan(van)}
                      className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-500"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Truck className="w-8 h-8 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">{van.name}</h3>
                            <p className="text-sm text-gray-600">{van.complete_name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                            {van.productCount} prodotti
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista Prodotti da Rendere */}
        <AnimatePresence>
          {showProductList && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Prodotti da Rendere</h2>
                <div className="text-sm text-gray-600">
                  {returnItems.filter(i => i.quantityToReturn > 0).length} / {returnItems.length} prodotti selezionati
                </div>
              </div>

              <div className="space-y-3">
                {returnItems.map(item => {
                  const isExpanded = expandedProducts.has(item.productId);
                  const product = currentVan?.products.find(p => p.productId === item.productId);

                  return (
                    <div key={item.productId} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      {/* Header Prodotto */}
                      <div className="p-4">
                        <div className="flex items-center gap-4 mb-3">
                          {/* Immagine prodotto */}
                          {product?.image ? (
                            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={product.image}
                                alt={item.productName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Package className="w-8 h-8 text-blue-600" />
                            </div>
                          )}

                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{item.productName}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <span>Disponibile: <strong>{item.originalQuantity}</strong></span>
                              <span>Da rendere: <strong className="text-blue-600">{item.quantityToReturn}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Controlli */}
                        <div className="space-y-2">
                          {/* Quantità */}
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700 min-w-[100px]">Quantità:</label>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateReturnQuantity(item.productId, item.quantityToReturn - 1)}
                                className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300 transition-colors font-bold"
                                disabled={item.quantityToReturn <= 0}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.quantityToReturn}
                                onChange={(e) => updateReturnQuantity(item.productId, parseFloat(e.target.value) || 0)}
                                className="w-20 px-3 py-1 border border-gray-300 rounded text-center"
                                min={0}
                                max={item.originalQuantity}
                              />
                              <button
                                onClick={() => updateReturnQuantity(item.productId, item.quantityToReturn + 1)}
                                className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300 transition-colors font-bold"
                                disabled={item.quantityToReturn >= item.originalQuantity}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Zona Buffer */}
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700 min-w-[100px]">Zona Buffer:</label>
                            <div className="flex gap-2 flex-wrap">
                              {BUFFER_ZONES.map(zone => (
                                <button
                                  key={zone.id}
                                  onClick={() => updateBufferZone(item.productId, zone.id as any)}
                                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
                                    item.bufferZone === zone.id
                                      ? 'text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                  style={item.bufferZone === zone.id ? { backgroundColor: zone.color } : {}}
                                >
                                  {zone.icon} {zone.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Dettagli espandibili */}
                        <button
                          onClick={() => toggleProductExpand(item.productId)}
                          className="mt-3 w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                        >
                          {isExpanded ? (
                            <>Chiudi dettagli <ChevronUp className="w-4 h-4" /></>
                          ) : (
                            <>Mostra dettagli <ChevronDown className="w-4 h-4" /></>
                          )}
                        </button>
                      </div>

                      {/* Dettagli Espansi */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-gray-200 bg-gray-50 p-4 space-y-3"
                          >
                            {(() => {
                              console.log(`🔍 [FRONTEND RENDER] Prodotto ${item.productName}:`, {
                                hasProduct: !!product,
                                hasOrders: !!product?.orders,
                                ordersLength: product?.orders?.length || 0,
                                orders: product?.orders
                              });
                              return null;
                            })()}

                            {item.lotName && (
                              <div className="text-sm">
                                <span className="text-gray-600">Lotto:</span>
                                <span className="ml-2 font-semibold text-gray-900">{item.lotName}</span>
                              </div>
                            )}

                            {/* ORDINI COLLEGATI */}
                            {product?.orders && product.orders.length > 0 && (
                              <div className="mt-3">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">📋 Ordini Collegati:</h4>
                                <div className="space-y-2">
                                  {product.orders.map((order, idx) => (
                                    <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <div className="text-sm font-semibold text-blue-600">{order.orderName}</div>
                                          <div className="text-xs text-gray-600 mt-1">{order.customerName}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-bold text-gray-900">{order.quantity} {product.uom}</div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('it-IT') : 'N/A'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Pulsante Conferma */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={confirmReturns}
                disabled={isLoading || returnItems.filter(i => i.quantityToReturn > 0).length === 0}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Creazione resi...
                  </span>
                ) : (
                  `Conferma ${returnItems.filter(i => i.quantityToReturn > 0).length} Resi`
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conferma Completamento */}
        <AnimatePresence>
          {showConfirmation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-12"
            >
              <div className="bg-green-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Resi Completati!</h2>
              <p className="text-gray-600 mb-6">
                I prodotti sono stati resi nelle ubicazioni buffer
              </p>
              <button
                onClick={resetSelection}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Nuovo Reso
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MobileHomeButton />
    </div>
  );
}
