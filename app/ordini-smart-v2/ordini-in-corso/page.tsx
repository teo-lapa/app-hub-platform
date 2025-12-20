'use client';

/**
 * ORDINI IN CORSO
 *
 * Mostra ordini di acquisto in stato:
 * - Preventivo Inviato
 * - Confermato (ma non ancora arrivato)
 *
 * Per ogni ordine: analisi quantità e prodotti mancanti
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
  XMarkIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

interface PendingOrder {
  id: number;
  name: string;
  supplier: {
    id: number;
    name: string;
  };
  dateOrder: string;
  datePlanned: string | null;
  state: string;
  stateLabel: string;
  currency: string;
  amountTotal: number;
  products: Array<{
    id: number;
    name: string;
    qtyOrdered: number;
    qtyReceived: number;
    qtyPending: number;
    priceUnit: number;
    uom: string;
  }>;
  summary: {
    totalProducts: number;
    totalOrdered: number;
    totalReceived: number;
    pendingQty: number;
    percentReceived: number;
  };
}

interface OrderAnalysis {
  order: {
    id: number;
    name: string;
    supplier: { id: number; name: string };
    dateOrder: string;
    amountTotal: number;
    currency: string;
  };
  analysis: {
    products: Array<{
      id: number;
      name: string;
      qtyOrdered: number;
      qtyPending: number;
      currentStock: number;
      avgDailySales: number;
      daysOfCoverage: number;
      suggestedQty: number;
      evaluation: 'OK' | 'TROPPO_POCO' | 'TROPPO' | 'SCONOSCIUTO';
      evaluationNote: string;
      uom: string;
    }>;
    missingProducts: Array<{
      id: number;
      name: string;
      currentStock: number;
      avgDailySales: number;
      daysRemaining: number;
      suggestedQty: number;
      uom: string;
    }>;
    summary: {
      totalProducts: number;
      ok: number;
      tooLittle: number;
      tooMuch: number;
      missingCount: number;
    };
  };
}

export default function OrdiniInCorsoPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [orderAnalysis, setOrderAnalysis] = useState<OrderAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    loadPendingOrders();
  }, []);

  async function loadPendingOrders() {
    setLoading(true);
    try {
      const response = await fetch('/api/smart-ordering-v2/pending-orders');
      const data = await response.json();

      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  }

  async function openOrderAnalysis(order: PendingOrder) {
    setSelectedOrder(order);
    setLoadingAnalysis(true);
    setOrderAnalysis(null);

    try {
      const response = await fetch(`/api/smart-ordering-v2/analyze-order/${order.id}`);
      const data = await response.json();

      if (data.success) {
        setOrderAnalysis(data);
      }
    } catch (error) {
      console.error('Errore caricamento analisi:', error);
    } finally {
      setLoadingAnalysis(false);
    }
  }

  const stateColors: Record<string, { bg: string; text: string }> = {
    'sent': { bg: 'bg-blue-500', text: 'text-white' },
    'purchase': { bg: 'bg-green-500', text: 'text-white' },
    'draft': { bg: 'bg-gray-500', text: 'text-white' }
  };

  const evaluationConfig = {
    'OK': { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircleIcon },
    'TROPPO_POCO': { bg: 'bg-red-500/20', text: 'text-red-400', icon: ExclamationTriangleIcon },
    'TROPPO': { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: ExclamationTriangleIcon },
    'SCONOSCIUTO': { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: ClockIcon }
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
                  <ClipboardDocumentListIcon className="w-7 h-7 text-blue-400" />
                  Ordini in Corso
                </h1>
                <p className="text-gray-400 text-sm">Analizza e verifica gli ordini inviati ai fornitori</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                {orders.length} ordini in corso
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
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition cursor-pointer"
                onClick={() => openOrderAnalysis(order)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`${stateColors[order.state]?.bg || 'bg-gray-500'} ${stateColors[order.state]?.text || 'text-white'} px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap`}>
                        {order.stateLabel}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">{order.name}</h3>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-300">{order.supplier.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-4 h-4" />
                            {new Date(order.dateOrder).toLocaleDateString('it-IT')}
                          </span>
                          <span className="flex items-center gap-1">
                            <CurrencyDollarIcon className="w-4 h-4" />
                            {order.currency} {order.amountTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{order.summary.totalProducts}</div>
                        <div className="text-xs text-gray-400">prodotti</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{Math.round(order.summary.pendingQty)}</div>
                        <div className="text-xs text-gray-400">da ricevere</div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Ricevuto</span>
                          <span>{order.summary.percentReceived}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${order.summary.percentReceived}%` }}
                          />
                        </div>
                      </div>

                      <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {orders.length === 0 && (
              <div className="text-center py-20">
                <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white">Nessun ordine in corso</h3>
                <p className="text-gray-400">Tutti gli ordini sono stati ricevuti</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Analysis Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`inline-block ${stateColors[selectedOrder.state]?.bg || 'bg-gray-500'} ${stateColors[selectedOrder.state]?.text || 'text-white'} px-3 py-1 rounded-lg text-xs font-bold mb-2`}>
                      {selectedOrder.stateLabel}
                    </div>
                    <h2 className="text-xl font-bold text-white">{selectedOrder.name}</h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Fornitore: {selectedOrder.supplier.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loadingAnalysis ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : orderAnalysis ? (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{orderAnalysis.analysis.summary.ok}</div>
                        <div className="text-sm text-green-300">OK</div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-red-400">{orderAnalysis.analysis.summary.tooLittle}</div>
                        <div className="text-sm text-red-300">Troppo Poco</div>
                      </div>
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-orange-400">{orderAnalysis.analysis.summary.tooMuch}</div>
                        <div className="text-sm text-orange-300">Troppo</div>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-blue-400">{orderAnalysis.analysis.summary.missingCount}</div>
                        <div className="text-sm text-blue-300">Da Aggiungere</div>
                      </div>
                    </div>

                    {/* Products Analysis */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Prodotti nell'Ordine</h3>
                      <div className="space-y-2">
                        {orderAnalysis.analysis.products.map((product) => {
                          const config = evaluationConfig[product.evaluation];
                          const Icon = config.icon;
                          return (
                            <div
                              key={product.id}
                              className={`flex items-center justify-between ${config.bg} rounded-lg p-3`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <Icon className={`w-5 h-5 ${config.text}`} />
                                <div>
                                  <div className="text-white font-medium">{product.name}</div>
                                  <div className="text-xs text-gray-400">{product.evaluationNote}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="text-center">
                                  <div className="text-white font-medium">{product.qtyOrdered} {product.uom}</div>
                                  <div className="text-gray-400 text-xs">ordinato</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-white font-medium">{Math.round(product.currentStock)}</div>
                                  <div className="text-gray-400 text-xs">in stock</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-white font-medium">{product.daysOfCoverage}gg</div>
                                  <div className="text-gray-400 text-xs">copertura</div>
                                </div>
                                {product.evaluation === 'TROPPO_POCO' && product.suggestedQty > product.qtyOrdered && (
                                  <div className="text-center bg-red-500/30 px-2 py-1 rounded">
                                    <div className="text-red-300 font-medium">+{product.suggestedQty - product.qtyOrdered}</div>
                                    <div className="text-red-400 text-xs">suggerito</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Missing Products */}
                    {orderAnalysis.analysis.missingProducts.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                          <PlusCircleIcon className="w-5 h-5 text-blue-400" />
                          Prodotti da Aggiungere
                        </h3>
                        <div className="space-y-2">
                          {orderAnalysis.analysis.missingProducts.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg p-3"
                            >
                              <div className="flex items-center gap-3">
                                <ExclamationTriangleIcon className="w-5 h-5 text-blue-400" />
                                <div>
                                  <div className="text-white font-medium">{product.name}</div>
                                  <div className="text-xs text-blue-300">
                                    Solo {product.daysRemaining} giorni rimanenti
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="text-center">
                                  <div className="text-white font-medium">{product.currentStock}</div>
                                  <div className="text-gray-400 text-xs">in stock</div>
                                </div>
                                <div className="text-center bg-blue-500/30 px-3 py-1 rounded">
                                  <div className="text-blue-300 font-bold">{product.suggestedQty} {product.uom}</div>
                                  <div className="text-blue-400 text-xs">da ordinare</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    Errore nel caricamento dell'analisi
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/10 bg-black/20">
                <div className="flex items-center justify-between">
                  <div className="text-gray-400">
                    <span className="text-white font-medium">{selectedOrder.currency} {selectedOrder.amountTotal.toFixed(2)}</span> totale ordine
                  </div>
                  <button
                    onClick={() => window.open(`https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#id=${selectedOrder.id}&model=purchase.order&view_type=form`, '_blank')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
                  >
                    Apri in Odoo
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
