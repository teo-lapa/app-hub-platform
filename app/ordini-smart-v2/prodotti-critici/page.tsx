'use client';

/**
 * PRODOTTI CRITICI - Versione Pratica
 *
 * Mostra prodotti che stanno finendo con:
 * - Chi li compra (top clienti)
 * - Azione diretta: ORDINA SUBITO
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  UserGroupIcon,
  TruckIcon,
  ShoppingCartIcon,
  ClockIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  FunnelIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

interface CriticalProduct {
  id: number;
  name: string;
  currentStock: number;
  avgDailySales: number;
  daysRemaining: number;
  urgencyLevel: 'EMERGENCY' | 'CRITICAL' | 'HIGH' | 'MEDIUM';
  supplierName: string;
  supplierId: number;
  supplierLeadTime: number;
  recommendedOrderQty: number;
  canOrderInTime: boolean;
}

interface ProductAnalytics {
  product: {
    id: number;
    name: string;
    currentStock: number;
    avgDailySales: number;
    incomingQty: number;
    incomingDate: string | null;
    incomingOrderName: string | null;
  };
  topCustomers: Array<{
    id: number;
    name: string;
    qty: number;
    revenue: number;
    orders: number;
  }>;
  suppliers: Array<{
    name: string;
    leadTime: number;
    orderCount: number;
    isMain: boolean;
  }>;
}

export default function ProdottiCriticiPage() {
  const router = useRouter();
  const [products, setProducts] = useState<CriticalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<CriticalProduct | null>(null);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [orderingProduct, setOrderingProduct] = useState<number | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{ productId: number; orderId: number } | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estrai lista fornitori unici
  const suppliers = useMemo(() => {
    const uniqueSuppliers = new Map<number, { id: number; name: string; count: number }>();
    products.forEach(p => {
      if (!uniqueSuppliers.has(p.supplierId)) {
        uniqueSuppliers.set(p.supplierId, {
          id: p.supplierId,
          name: p.supplierName,
          count: 1
        });
      } else {
        uniqueSuppliers.get(p.supplierId)!.count++;
      }
    });
    return Array.from(uniqueSuppliers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Filtra prodotti per fornitore
  const filteredProducts = useMemo(() => {
    if (!selectedSupplier) return products;
    return products.filter(p => p.supplierId === selectedSupplier);
  }, [products, selectedSupplier]);

  const selectedSupplierName = suppliers.find(s => s.id === selectedSupplier)?.name || 'Tutti i fornitori';

  // Chiudi dropdown quando clicchi fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSupplierDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadCriticalProducts();
  }, []);

  async function loadCriticalProducts() {
    setLoading(true);
    try {
      const response = await fetch('/api/smart-ordering-v2/suppliers');
      const data = await response.json();

      if (data.success) {
        const allProducts: CriticalProduct[] = [];

        data.suppliers.forEach((supplier: any) => {
          supplier.products
            .filter((p: any) => ['CRITICAL', 'HIGH', 'EMERGENCY'].includes(p.urgencyLevel))
            .forEach((product: any) => {
              allProducts.push({
                id: product.id,
                name: product.name,
                currentStock: product.currentStock,
                avgDailySales: product.avgDailySales,
                daysRemaining: product.daysRemaining,
                urgencyLevel: product.urgencyLevel,
                supplierName: supplier.name,
                supplierId: supplier.id,
                supplierLeadTime: supplier.leadTime,
                recommendedOrderQty: product.suggestedQty,
                canOrderInTime: product.daysRemaining >= supplier.leadTime
              });
            });
        });

        // Ordina per urgenza: EMERGENCY prima, poi per giorni rimanenti
        allProducts.sort((a, b) => {
          const urgencyOrder = { EMERGENCY: 0, CRITICAL: 1, HIGH: 2, MEDIUM: 3 };
          if (urgencyOrder[a.urgencyLevel] !== urgencyOrder[b.urgencyLevel]) {
            return urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
          }
          return a.daysRemaining - b.daysRemaining;
        });

        setProducts(allProducts);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  }

  async function openProductDetail(product: CriticalProduct) {
    setSelectedProduct(product);
    setLoadingAnalytics(true);
    setProductAnalytics(null);

    try {
      const response = await fetch(`/api/smart-ordering-v2/product-analytics/${product.id}`);
      const data = await response.json();

      if (data.success) {
        setProductAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Errore caricamento analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function orderProduct(product: CriticalProduct) {
    setOrderingProduct(product.id);

    try {
      const response = await fetch('/api/smart-ordering-v2/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: product.supplierId,
          items: [{
            productId: product.id,
            qty: product.recommendedOrderQty
          }]
        })
      });

      const data = await response.json();

      if (data.success) {
        setOrderSuccess({ productId: product.id, orderId: data.orderId });
        // Reset dopo 3 secondi
        setTimeout(() => setOrderSuccess(null), 3000);
      } else {
        alert(`Errore: ${data.error}`);
      }
    } catch (error) {
      console.error('Errore ordine:', error);
      alert('Errore durante la creazione dell\'ordine');
    } finally {
      setOrderingProduct(null);
    }
  }

  const urgencyConfig = {
    EMERGENCY: { bg: 'bg-red-500', text: 'text-white', label: 'FINISCE SUBITO' },
    CRITICAL: { bg: 'bg-orange-500', text: 'text-white', label: 'CRITICO' },
    HIGH: { bg: 'bg-yellow-500', text: 'text-black', label: 'URGENTE' },
    MEDIUM: { bg: 'bg-blue-500', text: 'text-white', label: 'ATTENZIONE' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/ordini-smart-v2')}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <ArrowLeftIcon className="w-6 h-6 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-7 h-7 text-red-400" />
                  Prodotti in Esaurimento
                </h1>
                <p className="text-gray-400 text-sm">Ordina subito per non rimanere senza</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Dropdown Filtro Fornitore */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition text-white"
                >
                  <FunnelIcon className="w-4 h-4" />
                  <span className="max-w-[200px] truncate">{selectedSupplierName}</span>
                  <ChevronDownIcon className={`w-4 h-4 transition-transform ${showSupplierDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showSupplierDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-72 bg-gray-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="max-h-80 overflow-y-auto">
                        {/* Opzione Tutti */}
                        <button
                          onClick={() => {
                            setSelectedSupplier(null);
                            setShowSupplierDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 hover:bg-white/10 transition ${!selectedSupplier ? 'bg-blue-500/20 text-blue-400' : 'text-white'}`}
                        >
                          <span className="font-medium">Tutti i fornitori</span>
                          <span className="text-sm text-gray-400">{products.length} prodotti</span>
                        </button>

                        <div className="border-t border-white/10" />

                        {/* Lista Fornitori */}
                        {suppliers.map((supplier) => (
                          <button
                            key={supplier.id}
                            onClick={() => {
                              setSelectedSupplier(supplier.id);
                              setShowSupplierDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-white/10 transition ${selectedSupplier === supplier.id ? 'bg-blue-500/20 text-blue-400' : 'text-white'}`}
                          >
                            <span className="truncate flex-1 text-left">{supplier.name}</span>
                            <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full text-xs text-gray-300">
                              {supplier.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Badge conteggio */}
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                {filteredProducts.length} prodotti da ordinare
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition cursor-pointer"
                onClick={() => openProductDetail(product)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Urgency Badge + Product Name */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`${urgencyConfig[product.urgencyLevel].bg} ${urgencyConfig[product.urgencyLevel].text} px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap`}>
                        {urgencyConfig[product.urgencyLevel].label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold truncate">{product.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <TruckIcon className="w-4 h-4" />
                            {product.supplierName}
                          </span>
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-4 h-4" />
                            {product.supplierLeadTime}gg consegna
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6">
                      {/* Stock attuale */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{Math.round(product.currentStock)}</div>
                        <div className="text-xs text-gray-400">in stock</div>
                      </div>

                      {/* Giorni rimanenti */}
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${product.daysRemaining < 3 ? 'text-red-400' : product.daysRemaining < 7 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          {product.daysRemaining.toFixed(0)}gg
                        </div>
                        <div className="text-xs text-gray-400">rimanenti</div>
                      </div>

                      {/* Quantità da ordinare */}
                      <div className="text-center bg-blue-500/20 px-4 py-2 rounded-lg">
                        <div className="text-2xl font-bold text-blue-400">{product.recommendedOrderQty}</div>
                        <div className="text-xs text-blue-300">da ordinare</div>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center gap-2">
                        {orderSuccess?.productId === product.id ? (
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg">
                            <CheckCircleIcon className="w-5 h-5" />
                            <span className="font-medium">Ordinato!</span>
                          </div>
                        ) : !product.canOrderInTime ? (
                          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg">
                            <ExclamationCircleIcon className="w-5 h-5" />
                            <span className="font-medium text-sm">Troppo tardi!</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              orderProduct(product);
                            }}
                            disabled={orderingProduct === product.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition font-medium disabled:opacity-50"
                          >
                            {orderingProduct === product.id ? (
                              <>
                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                Ordino...
                              </>
                            ) : (
                              <>
                                <ShoppingCartIcon className="w-5 h-5" />
                                ORDINA
                              </>
                            )}
                          </button>
                        )}

                        <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="text-center py-20">
                <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white">
                  {selectedSupplier ? 'Nessun prodotto critico' : 'Tutto OK!'}
                </h3>
                <p className="text-gray-400">
                  {selectedSupplier
                    ? `${selectedSupplierName} non ha prodotti critici al momento`
                    : 'Non ci sono prodotti critici da ordinare'}
                </p>
                {selectedSupplier && (
                  <button
                    onClick={() => setSelectedSupplier(null)}
                    className="mt-4 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition"
                  >
                    Mostra tutti i fornitori
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`inline-block ${urgencyConfig[selectedProduct.urgencyLevel].bg} ${urgencyConfig[selectedProduct.urgencyLevel].text} px-3 py-1 rounded-lg text-xs font-bold mb-2`}>
                      {urgencyConfig[selectedProduct.urgencyLevel].label}
                    </div>
                    <h2 className="text-xl font-bold text-white">{selectedProduct.name}</h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Fornitore: {selectedProduct.supplierName}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loadingAnalytics ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : productAnalytics ? (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-white">{Math.round(productAnalytics.product.currentStock)}</div>
                        <div className="text-sm text-gray-400">In Stock</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-orange-400">{selectedProduct.daysRemaining.toFixed(0)}</div>
                        <div className="text-sm text-gray-400">Giorni Rimanenti</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-blue-400">{selectedProduct.recommendedOrderQty}</div>
                        <div className="text-sm text-gray-400">Da Ordinare</div>
                      </div>
                    </div>

                    {/* Incoming Stock */}
                    {productAnalytics.product.incomingQty > 0 && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-green-400 mb-1">
                          <TruckIcon className="w-5 h-5" />
                          <span className="font-medium">In Arrivo</span>
                        </div>
                        <div className="text-white">
                          <span className="text-2xl font-bold">{productAnalytics.product.incomingQty}</span>
                          <span className="text-gray-400 ml-2">
                            {productAnalytics.product.incomingDate && `previsto ${new Date(productAnalytics.product.incomingDate).toLocaleDateString('it-IT')}`}
                          </span>
                          {productAnalytics.product.incomingOrderName && (
                            <span className="text-gray-500 ml-2">({productAnalytics.product.incomingOrderName})</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Top Customers - CHI COMPRA */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5 text-blue-400" />
                        Chi Compra Questo Prodotto
                      </h3>
                      {productAnalytics.topCustomers.length > 0 ? (
                        <div className="space-y-2">
                          {productAnalytics.topCustomers.slice(0, 5).map((customer, index) => (
                            <div
                              key={customer.id}
                              className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-orange-600 text-white' : 'bg-gray-700 text-white'}`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-white font-medium">{customer.name}</div>
                                  <div className="text-xs text-gray-400">{customer.orders} ordini</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-white font-semibold">{customer.qty.toFixed(0)} pz</div>
                                <div className="text-xs text-gray-400">CHF {customer.revenue.toFixed(0)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-center py-4">
                          Nessun cliente negli ultimi 3 mesi
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    Errore nel caricamento dei dati
                  </div>
                )}
              </div>

              {/* Modal Footer - Action */}
              <div className="p-6 border-t border-white/10 bg-black/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-400 text-sm">Quantità suggerita</div>
                    <div className="text-2xl font-bold text-white">{selectedProduct.recommendedOrderQty} pezzi</div>
                  </div>
                  {orderSuccess?.productId === selectedProduct.id ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl">
                      <CheckCircleIcon className="w-6 h-6" />
                      <span className="font-semibold">Ordine Creato!</span>
                    </div>
                  ) : !selectedProduct.canOrderInTime ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-red-500/20 text-red-400 rounded-xl">
                      <ExclamationCircleIcon className="w-6 h-6" />
                      <span className="font-semibold">Lead time troppo lungo</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => orderProduct(selectedProduct)}
                      disabled={orderingProduct === selectedProduct.id}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl transition font-semibold disabled:opacity-50"
                    >
                      {orderingProduct === selectedProduct.id ? (
                        <>
                          <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                          Creazione ordine...
                        </>
                      ) : (
                        <>
                          <ShoppingCartIcon className="w-6 h-6" />
                          ORDINA SUBITO
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
