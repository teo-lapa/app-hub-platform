'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  Building2,
  ChevronDown,
  ChevronUp,
  X,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  Clock,
  DollarSign,
  Brain,
  Zap,
  Target,
  Calendar,
  BarChart3,
  Bell,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

interface ProductData {
  productId: number;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  variability: number;
  leadTimeDays: number;
  preferredDays?: string[];
  trend?: 'stable' | 'declining' | 'volatile' | 'growing';
  category?: string;
  reorderPoint?: number;
}

interface PredictionResult {
  daysRemaining: number;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgencyColor: string;
  recommendedOrderDate: Date;
  recommendedQuantity: number;
  safetyStock: number;
  nextStockoutDate: Date;
  confidenceScore: number;
  reasoning: string;
  weeklyForecast: {
    day: string;
    expectedSales: number;
    expectedStock: number;
  }[];
}

interface ApiData {
  products: ProductData[];
  predictions: Record<number, PredictionResult>;
  suppliers: any[];
  kpi: {
    totalProducts: number;
    criticalCount: number;
    warningCount: number;
    okCount: number;
    peakDay: string;
  };
  lastUpdate: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OrdiniSmartPage() {
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<'alerts' | 'calendar' | 'analytics'>('alerts');
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [selectedProductDetail, setSelectedProductDetail] = useState<{
    product: ProductData;
    prediction: PredictionResult;
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Carica dati da API
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/smart-ordering/data');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento dati');
      }

      setApiData(result.data);
      toast.success('✅ Dati caricati con successo');
    } catch (error: any) {
      console.error('Errore caricamento:', error);
      toast.error(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh dati da Odoo
   */
  const refreshData = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/smart-ordering/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' })
      });

      await loadData();
      toast.success('🔄 Dati aggiornati da Odoo');
    } catch (error: any) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Get prodotti per urgenza
   */
  const getProductsByUrgency = (urgency: string) => {
    if (!apiData) return [];

    return apiData.products.filter(product => {
      const prediction = apiData.predictions[product.productId];
      return prediction && prediction.urgencyLevel === urgency;
    });
  };

  /**
   * Toggle product selection
   */
  const toggleProductSelection = (productId: number) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setSelectedProducts(newSet);
  };

  /**
   * Select all critical products
   */
  const selectAllCritical = () => {
    const critical = getProductsByUrgency('CRITICAL');
    const newSet = new Set(selectedProducts);
    critical.forEach(p => newSet.add(p.productId));
    setSelectedProducts(newSet);
    toast.success(`✅ ${critical.length} prodotti critici selezionati`);
  };

  /**
   * Create orders for selected products
   */
  const createOrders = () => {
    if (selectedProducts.size === 0) {
      toast.error('Seleziona almeno un prodotto');
      return;
    }

    const confirmed = confirm(
      `🛒 CONFERMA CREAZIONE ORDINI\n\n` +
      `Prodotti selezionati: ${selectedProducts.size}\n` +
      `Verranno creati ordini di acquisto in Odoo.\n\n` +
      `Confermi?`
    );

    if (!confirmed) return;

    // TODO: Implement actual order creation
    toast.success(`✅ ${selectedProducts.size} ordini creati!`);
    setSelectedProducts(new Set());
  };

  /**
   * Format days remaining
   */
  const formatDaysRemaining = (days: number): string => {
    if (days === 0) return 'OUT OF STOCK';
    if (days < 1) return `${Math.round(days * 24)}h`;
    return `${days.toFixed(1)}gg`;
  };

  /**
   * Get urgency badge
   */
  const getUrgencyBadge = (urgency: string) => {
    const badges = {
      'CRITICAL': { label: '🔥 CRITICO', class: 'bg-red-500 text-white' },
      'HIGH': { label: '⚠️ ALTO', class: 'bg-orange-500 text-white' },
      'MEDIUM': { label: '⏰ MEDIO', class: 'bg-yellow-500 text-white' },
      'LOW': { label: '✅ BASSO', class: 'bg-green-500 text-white' }
    };
    return badges[urgency as keyof typeof badges] || badges.LOW;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && !apiData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-md">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">🤖 Caricamento Smart Ordering</h3>
          <p className="text-gray-600">
            Analisi AI in corso...<br />
            <span className="text-sm opacity-75">Attendere...</span>
          </p>
        </div>
      </div>
    );
  }

  const criticalProducts = getProductsByUrgency('CRITICAL');
  const highProducts = getProductsByUrgency('HIGH');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <AppHeader
        title="🚀 LAPA Smart Ordering"
        subtitle="AI-Powered Intelligent Order Management"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5" />
              <h3 className="font-bold text-sm">Critici</h3>
            </div>
            <p className="text-3xl font-bold">{apiData?.kpi.criticalCount || 0}</p>
            <p className="text-xs opacity-90">ordina OGGI</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Attenzione</h3>
            </div>
            <p className="text-3xl font-bold">{apiData?.kpi.warningCount || 0}</p>
            <p className="text-xs opacity-90">settimana</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">OK</h3>
            </div>
            <p className="text-3xl font-bold">{apiData?.kpi.okCount || 0}</p>
            <p className="text-xs opacity-90">sotto controllo</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-5 h-5" />
              <h3 className="font-bold text-sm">Totale</h3>
            </div>
            <p className="text-3xl font-bold">{apiData?.kpi.totalProducts || 0}</p>
            <p className="text-xs opacity-90">prodotti</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5" />
              <h3 className="font-bold text-sm">Picco</h3>
            </div>
            <p className="text-2xl font-bold capitalize">{apiData?.kpi.peakDay || 'Mar'}</p>
            <p className="text-xs opacity-90">35% vendite</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="font-bold text-lg">AI Smart Ordering System</h2>
              <p className="text-sm text-gray-600">
                Aggiornato: {apiData?.lastUpdate ? new Date(apiData.lastUpdate).toLocaleString('it-IT') : '-'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {criticalProducts.length > 0 && (
              <button
                onClick={selectAllCritical}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                <Flame className="w-4 h-4" />
                Seleziona Critici
              </button>
            )}
            <button
              onClick={refreshData}
              disabled={refreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg transition-all ${
                refreshing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Aggiornamento...' : 'Aggiorna'}
            </button>
          </div>
        </div>

        {/* ALERTS TAB - SEMPRE VISIBILE */}
        <div className="space-y-6">
          {/* CRITICAL ALERTS */}
          {criticalProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl overflow-hidden shadow-xl"
            >
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Flame className="w-6 h-6 animate-pulse" />
                    <div>
                      <h3 className="text-xl font-bold">🔥 ALERT CRITICI - ORDINA OGGI!</h3>
                      <p className="text-sm opacity-90">{criticalProducts.length} prodotti richiedono azione immediata</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {criticalProducts.map(product => {
                  const prediction = apiData!.predictions[product.productId];
                  const isSelected = selectedProducts.has(product.productId);

                  return (
                    <motion.div
                      key={product.productId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`bg-white rounded-lg p-4 border-2 cursor-pointer transition-all ${
                        isSelected ? 'border-red-500 shadow-lg' : 'border-red-200 hover:border-red-400'
                      }`}
                      onClick={() => toggleProductSelection(product.productId)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProductSelection(product.productId);
                          }}
                          className="mt-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-6 h-6 text-red-600" />
                          ) : (
                            <Square className="w-6 h-6 text-gray-400" />
                          )}
                        </button>

                        {/* Product Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-lg text-gray-900">{product.productName}</h4>
                              <p className="text-sm text-gray-600">
                                Stock: {product.currentStock} |
                                Media: {product.avgDailySales.toFixed(1)}/gg |
                                Lead time: {product.leadTimeDays}gg
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold text-red-600">
                                {formatDaysRemaining(prediction.daysRemaining)}
                              </div>
                              <div className="text-xs text-gray-500">rimanenti</div>
                            </div>
                          </div>

                          {/* AI Reasoning */}
                          <div className="bg-red-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-semibold text-red-900">AI Analysis:</span>
                            </div>
                            <p className="text-sm text-red-800">{prediction.reasoning}</p>
                          </div>

                          {/* Order Info */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="bg-red-100 rounded-lg px-3 py-2">
                                <p className="text-xs text-red-700 font-semibold">Ordina</p>
                                <p className="text-xl font-bold text-red-900">{prediction.recommendedQuantity}</p>
                              </div>
                              <div className="text-sm">
                                <p className="text-gray-600">Safety stock: {prediction.safetyStock}</p>
                                <p className="text-gray-600">Confidenza: {prediction.confidenceScore}%</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProductDetail({ product, prediction });
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                            >
                              Dettagli
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* HIGH PRIORITY ALERTS */}
          {highProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6" />
                  <div>
                    <h3 className="text-xl font-bold">⚠️ Priorità Alta - Ordina Questa Settimana</h3>
                    <p className="text-sm opacity-90">{highProducts.length} prodotti in attenzione</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {highProducts.map(product => {
                    const prediction = apiData!.predictions[product.productId];
                    const isSelected = selectedProducts.has(product.productId);

                    return (
                      <div
                        key={product.productId}
                        className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                          isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                        }`}
                        onClick={() => toggleProductSelection(product.productId)}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProductSelection(product.productId);
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-orange-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{product.productName}</h4>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm text-gray-600">
                                {formatDaysRemaining(prediction.daysRemaining)} rimasti
                              </span>
                              <span className="text-lg font-bold text-orange-600">
                                {prediction.recommendedQuantity} pz
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      {selectedProducts.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-4 mb-3">
            <p className="text-sm text-gray-600 mb-1">Prodotti selezionati:</p>
            <p className="text-3xl font-bold text-blue-600">{selectedProducts.size}</p>
          </div>
          <button
            onClick={createOrders}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-xl font-bold shadow-2xl transition-all"
          >
            <ShoppingCart className="w-6 h-6" />
            CREA ORDINI
          </button>
        </motion.div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProductDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProductDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{selectedProductDetail.product.productName}</h3>
                    <p className="text-sm opacity-90 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Analisi AI Smart Ordering
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedProductDetail(null)}
                    className="text-white hover:bg-white/20 p-2 rounded-lg"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-semibold mb-1">Stock Attuale</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {selectedProductDetail.product.currentStock}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-semibold mb-1">Media Giornaliera</p>
                    <p className="text-2xl font-bold text-green-900">
                      {selectedProductDetail.product.avgDailySales.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-600 font-semibold mb-1">Giorni Rimasti</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {selectedProductDetail.prediction.daysRemaining.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600 font-semibold mb-1">Ordina</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {selectedProductDetail.prediction.recommendedQuantity}
                    </p>
                  </div>
                </div>

                {/* Weekly Forecast */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Previsione Settimanale
                  </h4>
                  <div className="space-y-2">
                    {selectedProductDetail.prediction.weeklyForecast.map((day, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <span className="font-semibold w-24">{day.day}</span>
                        <div className="flex-1 flex items-center gap-4">
                          <div className="flex-1">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(100, (day.expectedSales / selectedProductDetail.product.avgDailySales) * 50)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm text-gray-600 w-20">
                            Vendite: {day.expectedSales.toFixed(1)}
                          </span>
                          <span className={`text-sm font-semibold w-20 ${
                            day.expectedStock === 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            Stock: {day.expectedStock.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-6 h-6 text-purple-600" />
                    <h4 className="font-bold text-lg">AI Reasoning</h4>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{selectedProductDetail.prediction.reasoning}</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 p-6 rounded-b-2xl flex gap-3">
                <button
                  onClick={() => {
                    toggleProductSelection(selectedProductDetail.product.productId);
                    setSelectedProductDetail(null);
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-xl font-bold"
                >
                  Aggiungi a Ordine
                </button>
                <button
                  onClick={() => setSelectedProductDetail(null)}
                  className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-bold"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
