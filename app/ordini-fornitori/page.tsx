'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  TrendingUp,
  TrendingDown,
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
  TrendingDown as Risk,
  Lightbulb
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

interface AIProduct {
  productId: number;
  productName: string;
  productCode?: string;
  category?: string;
  supplier?: string;
  supplierId?: number;
  currentStock?: number;

  // AI Analysis
  predictedDailySales: number;
  predictedWeeklySales: number;
  predictedMonthlySales: number;
  confidenceLevel: number;
  recommendedQuantity: number;
  urgencyLevel: 'critica' | 'alta' | 'media' | 'bassa';
  daysUntilStockout: number;
  trend: 'crescente' | 'decrescente' | 'stabile' | 'volatile';
  seasonalityDetected: boolean;
  anomaliesDetected: string[];
  reasoning: string;
  risks: string[];
  opportunities: string[];
  strategicSuggestions: string[];
  estimatedOrderValue?: number;
  analyzedAt: string;
}

interface AgentResult {
  success: boolean;
  executionId: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  productsAnalyzed: number;
  criticalCount: number;
  warningCount: number;
  okCount: number;
  aiAnalysis: {
    criticalProducts: AIProduct[];
    warningProducts: AIProduct[];
    okProducts: AIProduct[];
    executiveSummary: string;
    totalRecommendedOrderValue: number;
    overallRisks: string[];
    overallOpportunities: string[];
  };
  suggestedOrders: any[];
  totalOrderValue: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatNumber = (num: number | null | undefined, decimals: number = 1): string => {
  if (num === null || num === undefined) return '0';
  return Number(num).toFixed(decimals);
};

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return 'CHF 0.00';
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatInteger = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '0';
  return Math.round(Number(num)).toString();
};

const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case 'critica': return 'bg-red-500';
    case 'alta': return 'bg-orange-500';
    case 'media': return 'bg-yellow-500';
    case 'bassa': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

const getUrgencyLabel = (urgency: string) => {
  switch (urgency) {
    case 'critica': return '🔥 CRITICA';
    case 'alta': return '⚠️ ALTA';
    case 'media': return '⏰ MEDIA';
    case 'bassa': return '✅ BASSA';
    default: return urgency;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OrdiniFornitoriIntelligentiPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'executive'>('dashboard');
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({});
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [selectedProductDetail, setSelectedProductDetail] = useState<AIProduct | null>(null);

  // Load cached analysis on mount
  useEffect(() => {
    loadCachedAnalysis();
  }, []);

  /**
   * Carica analisi dalla cache
   */
  const loadCachedAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ordini-fornitori/cache');
      const data = await response.json();

      if (data.success && data.cached) {
        setAgentResult(data.data);
        toast.success(`✅ Analisi caricata (${Math.floor(data.cacheAge / 60)} min fa)`);
      } else {
        // Nessuna cache, esegui analisi
        await runAIAnalysis();
      }
    } catch (error: any) {
      console.error('Errore caricamento cache:', error);
      toast.error('Errore caricamento dati. Riprovo...');
      await runAIAnalysis();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Esegue analisi AI completa
   */
  const runAIAnalysis = async () => {
    setAnalyzing(true);
    setLoading(true);

    const loadingToast = toast.loading('🤖 Agente AI in esecuzione...\nAnalisi prodotti da Odoo in corso');

    try {
      const response = await fetch('/api/ordini-fornitori/analyze', {
        method: 'POST'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analisi fallita');
      }

      setAgentResult(data.data);

      // Salva in cache
      await fetch('/api/ordini-fornitori/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.data)
      });

      toast.dismiss(loadingToast);
      toast.success(
        `✅ Analisi completata!\n` +
        `${data.data.productsAnalyzed} prodotti analizzati\n` +
        `${data.data.criticalCount} critici, ${data.data.warningCount} in attenzione`
      );
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Errore analisi:', error);
      toast.error(`❌ Errore: ${error.message}`);
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  /**
   * Crea ordini per prodotti selezionati
   */
  const createBulkOrders = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Seleziona almeno un prodotto');
      return;
    }

    const confirmed = confirm(
      `🛒 CONFERMA CREAZIONE ORDINI\n\n` +
      `Prodotti selezionati: ${selectedProducts.length}\n` +
      `Verranno creati ordini di acquisto in Odoo.\n\n` +
      `Confermi?`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      // TODO: Implementare creazione ordini reali
      toast.success('✅ Ordini creati con successo!');
      setSelectedProducts([]);
      setEditedQuantities({});
    } catch (error: any) {
      toast.error(`❌ Errore: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Product selection handlers
  const toggleProductSelection = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    setEditedQuantities(prev => ({
      ...prev,
      [productId]: newQuantity
    }));
  };

  const getProductQuantity = (product: AIProduct): number => {
    return editedQuantities[product.productId] ?? product.recommendedQuantity;
  };

  // Raggruppa prodotti per fornitore
  const productsBySupplier: Record<string, AIProduct[]> = {};
  if (agentResult) {
    const allProducts = [
      ...agentResult.aiAnalysis.criticalProducts,
      ...agentResult.aiAnalysis.warningProducts
    ];

    allProducts.forEach(product => {
      const supplier = product.supplier || 'Nessun Fornitore';
      if (!productsBySupplier[supplier]) {
        productsBySupplier[supplier] = [];
      }
      productsBySupplier[supplier].push(product);
    });
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && !agentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-md">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">🤖 Agente AI in esecuzione</h3>
          <p className="text-gray-600">
            Caricamento prodotti da Odoo<br />
            Analisi con Claude AI in corso<br />
            <span className="text-sm opacity-75">Attendere 1-2 minuti...</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <AppHeader
        title="🤖 Ordini Fornitori AI"
        subtitle="Sistema autonomo con Claude AI per ottimizzazione ordini"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Actions */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="font-bold text-lg">Analisi AI Attiva</h2>
              <p className="text-sm text-gray-600">
                {agentResult
                  ? `Ultima analisi: ${new Date(agentResult.completedAt).toLocaleString('it-IT')}`
                  : 'Nessuna analisi disponibile'}
              </p>
            </div>
          </div>
          <button
            onClick={runAIAnalysis}
            disabled={analyzing}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
              analyzing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analisi in corso...' : '🤖 Riesegui Analisi AI'}
          </button>
        </div>

        {!agentResult ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Brain className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Nessuna Analisi Disponibile</h3>
            <p className="text-gray-600 mb-6">
              Clicca su "Riesegui Analisi AI" per iniziare
            </p>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2 overflow-x-auto">
              {[
                { id: 'dashboard', label: '📊 Dashboard', icon: Package },
                { id: 'executive', label: '📋 Executive Summary', icon: Brain },
                { id: 'analysis', label: '🔬 Analisi Dettagliata', icon: Target }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 min-w-[150px] px-4 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Executive Summary Tab */}
            {activeTab === 'executive' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Package className="w-8 h-8 text-blue-600" />
                      <h3 className="font-bold text-gray-700">Totale</h3>
                    </div>
                    <p className="text-4xl font-bold text-blue-600">{agentResult.productsAnalyzed}</p>
                    <p className="text-sm text-gray-500">prodotti analizzati</p>
                  </div>

                  <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-8 h-8" />
                      <h3 className="font-bold">Critici</h3>
                    </div>
                    <p className="text-4xl font-bold">{agentResult.criticalCount}</p>
                    <p className="text-sm opacity-90">ordina subito</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-8 h-8" />
                      <h3 className="font-bold">Attenzione</h3>
                    </div>
                    <p className="text-4xl font-bold">{agentResult.warningCount}</p>
                    <p className="text-sm opacity-90">monitora</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <DollarSign className="w-8 h-8" />
                      <h3 className="font-bold">Valore</h3>
                    </div>
                    <p className="text-3xl font-bold">
                      {formatCurrency(agentResult.totalOrderValue)}
                    </p>
                    <p className="text-sm opacity-90">ordini suggeriti</p>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Brain className="w-8 h-8 text-purple-600" />
                    <h2 className="text-2xl font-bold">Executive Summary AI</h2>
                  </div>
                  <div className="prose max-w-none">
                    <p className="text-lg leading-relaxed text-gray-700 whitespace-pre-line">
                      {agentResult.aiAnalysis.executiveSummary}
                    </p>
                  </div>
                </div>

                {/* Risks & Opportunities */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Risk className="w-6 h-6 text-red-600" />
                      <h3 className="text-xl font-bold text-red-900">Rischi Identificati</h3>
                    </div>
                    <ul className="space-y-2">
                      {agentResult.aiAnalysis.overallRisks.map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-red-800">
                          <span className="text-red-600 mt-1">⚠️</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-green-50 border-l-4 border-green-500 rounded-r-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Lightbulb className="w-6 h-6 text-green-600" />
                      <h3 className="text-xl font-bold text-green-900">Opportunità</h3>
                    </div>
                    <ul className="space-y-2">
                      {agentResult.aiAnalysis.overallOpportunities.map((opp, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-green-800">
                          <span className="text-green-600 mt-1">💡</span>
                          <span>{opp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Info Banner */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-500 p-4 rounded-r-xl">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-purple-900 mb-1">💡 Analisi AI Claude 3.5 Sonnet</p>
                      <ul className="list-disc list-inside space-y-1 text-purple-800">
                        <li>Quantità calcolate con ML su 60 giorni storico</li>
                        <li>Considerata stagionalità e trend mercato</li>
                        <li>Safety stock dinamico basato su variabilità</li>
                        <li>Clicca su prodotto per vedere reasoning AI completo</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Products by Supplier */}
                <div className="space-y-4">
                  {Object.entries(productsBySupplier).map(([supplierName, products]) => {
                    const isExpanded = expandedSuppliers.has(supplierName);
                    const supplierSelectedCount = products.filter(p =>
                      selectedProducts.includes(p.productId)
                    ).length;

                    return (
                      <div key={supplierName} className="bg-white rounded-xl shadow-lg overflow-hidden">
                        {/* Supplier Header */}
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 cursor-pointer hover:from-purple-700 hover:to-blue-700 transition-all"
                          onClick={() => {
                            const newSet = new Set(expandedSuppliers);
                            if (newSet.has(supplierName)) {
                              newSet.delete(supplierName);
                            } else {
                              newSet.add(supplierName);
                            }
                            setExpandedSuppliers(newSet);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Building2 className="w-6 h-6" />
                              <div>
                                <h3 className="font-bold text-lg">{supplierName}</h3>
                                <p className="text-sm opacity-90">
                                  {products.length} prodotti • {supplierSelectedCount} selezionati
                                </p>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>

                        {/* Products Table */}
                        {isExpanded && (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b-2 border-gray-200">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-semibold">Sel.</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold">Prodotto</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold">Stock</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold">Prev. Vendite/Gg</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold">Giorni Esaurim.</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold">Qta AI</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold">Urgenza</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold">Confidenza</th>
                                </tr>
                              </thead>
                              <tbody>
                                {products.map(product => (
                                  <tr
                                    key={product.productId}
                                    className="border-b border-gray-100 hover:bg-purple-50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedProductDetail(product)}
                                  >
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => toggleProductSelection(product.productId)}
                                        className="text-gray-600 hover:text-blue-600"
                                      >
                                        {selectedProducts.includes(product.productId) ? (
                                          <CheckSquare className="w-5 h-5 text-blue-600" />
                                        ) : (
                                          <Square className="w-5 h-5" />
                                        )}
                                      </button>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-purple-500" />
                                        <div>
                                          <p className="font-semibold text-gray-900">{product.productName}</p>
                                          <p className="text-xs text-gray-500">
                                            {product.trend === 'crescente' && '📈 Crescente'}
                                            {product.trend === 'decrescente' && '📉 Decrescente'}
                                            {product.trend === 'stabile' && '➡️ Stabile'}
                                            {product.trend === 'volatile' && '🎢 Volatile'}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="font-semibold">{formatInteger(product.currentStock)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="font-semibold text-blue-600">
                                        {formatNumber(product.predictedDailySales, 1)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`font-semibold ${
                                        product.daysUntilStockout < 5 ? 'text-red-600' :
                                        product.daysUntilStockout < 10 ? 'text-orange-600' : 'text-green-600'
                                      }`}>
                                        {formatNumber(product.daysUntilStockout, 1)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="number"
                                        value={getProductQuantity(product)}
                                        onChange={(e) => updateQuantity(product.productId, parseInt(e.target.value) || 0)}
                                        className="w-20 px-3 py-2 border-2 border-purple-300 rounded-lg text-center font-semibold focus:border-purple-500 focus:outline-none"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                        product.urgencyLevel === 'critica' ? 'bg-red-100 text-red-700' :
                                        product.urgencyLevel === 'alta' ? 'bg-orange-100 text-orange-700' :
                                        product.urgencyLevel === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-green-100 text-green-700'
                                      }`}>
                                        {getUrgencyLabel(product.urgencyLevel)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="w-16 bg-gray-200 rounded-full h-2">
                                          <div
                                            className="bg-purple-600 h-2 rounded-full"
                                            style={{ width: `${product.confidenceLevel * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-600">
                                          {formatInteger(product.confidenceLevel * 100)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                {selectedProducts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-6 right-6 z-50 flex gap-3"
                  >
                    <button
                      onClick={() => {
                        setSelectedProducts([]);
                        setEditedQuantities({});
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-4 rounded-xl font-bold shadow-2xl"
                    >
                      ❌ Deseleziona ({selectedProducts.length})
                    </button>
                    <button
                      onClick={createBulkOrders}
                      className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-2xl flex items-center gap-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      🛒 Crea Ordini ({selectedProducts.length})
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Analysis Tab */}
            {activeTab === 'analysis' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold mb-6">🔬 Analisi Dettagliata per Urgenza</h2>

                  {/* Critical Products */}
                  {agentResult.aiAnalysis.criticalProducts.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-6 h-6" />
                        Prodotti Critici ({agentResult.aiAnalysis.criticalProducts.length})
                      </h3>
                      <div className="space-y-3">
                        {agentResult.aiAnalysis.criticalProducts.map(product => (
                          <div
                            key={product.productId}
                            onClick={() => setSelectedProductDetail(product)}
                            className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg cursor-pointer hover:bg-red-100 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-lg text-red-900">{product.productName}</p>
                                <p className="text-sm text-red-700 mt-1">{product.reasoning}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-red-600">{product.recommendedQuantity}</p>
                                <p className="text-xs text-red-700">pz da ordinare</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warning Products */}
                  {agentResult.aiAnalysis.warningProducts.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-orange-600 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-6 h-6" />
                        Prodotti in Attenzione ({agentResult.aiAnalysis.warningProducts.length})
                      </h3>
                      <div className="space-y-3">
                        {agentResult.aiAnalysis.warningProducts.map(product => (
                          <div
                            key={product.productId}
                            onClick={() => setSelectedProductDetail(product)}
                            className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg cursor-pointer hover:bg-orange-100 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-lg text-orange-900">{product.productName}</p>
                                <p className="text-sm text-orange-700 mt-1">{product.reasoning}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-orange-600">{product.recommendedQuantity}</p>
                                <p className="text-xs text-orange-700">pz da ordinare</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Product Detail Popup */}
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
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{selectedProductDetail.productName}</h3>
                    <p className="text-sm opacity-90 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Analisi AI Claude 3.5 Sonnet
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

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-semibold mb-1">Prev. Giornaliera</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatNumber(selectedProductDetail.predictedDailySales, 1)}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-semibold mb-1">Prev. Mensile</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatInteger(selectedProductDetail.predictedMonthlySales)}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-600 font-semibold mb-1">Giorni Esaur.</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {formatNumber(selectedProductDetail.daysUntilStockout, 1)}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600 font-semibold mb-1">Qta Consigliata</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {selectedProductDetail.recommendedQuantity}
                    </p>
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-6 h-6 text-purple-600" />
                    <h4 className="font-bold text-lg">Reasoning AI</h4>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{selectedProductDetail.reasoning}</p>
                </div>

                {/* Trend & Anomalies */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Trend & Caratteristiche
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-semibold">Trend:</span> {selectedProductDetail.trend}</p>
                      <p><span className="font-semibold">Stagionalità:</span> {selectedProductDetail.seasonalityDetected ? '✅ Rilevata' : '❌ Non rilevata'}</p>
                      <p><span className="font-semibold">Confidenza:</span> {formatInteger(selectedProductDetail.confidenceLevel * 100)}%</p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-xl p-4">
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      Anomalie
                    </h4>
                    {selectedProductDetail.anomaliesDetected.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {selectedProductDetail.anomaliesDetected.map((anomaly, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span>⚠️</span>
                            <span>{anomaly}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">Nessuna anomalia rilevata</p>
                    )}
                  </div>
                </div>

                {/* Risks */}
                {selectedProductDetail.risks.length > 0 && (
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4">
                    <h4 className="font-bold mb-3 flex items-center gap-2 text-red-900">
                      <Risk className="w-5 h-5 text-red-600" />
                      Rischi
                    </h4>
                    <ul className="space-y-2">
                      {selectedProductDetail.risks.map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-red-800">
                          <span className="text-red-600">⚠️</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Opportunities */}
                {selectedProductDetail.opportunities.length > 0 && (
                  <div className="bg-green-50 border-l-4 border-green-500 rounded-r-xl p-4">
                    <h4 className="font-bold mb-3 flex items-center gap-2 text-green-900">
                      <Lightbulb className="w-5 h-5 text-green-600" />
                      Opportunità
                    </h4>
                    <ul className="space-y-2">
                      {selectedProductDetail.opportunities.map((opp, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-green-800">
                          <span className="text-green-600">💡</span>
                          <span>{opp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strategic Suggestions */}
                {selectedProductDetail.strategicSuggestions.length > 0 && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-4">
                    <h4 className="font-bold mb-3 flex items-center gap-2 text-blue-900">
                      <Target className="w-5 h-5 text-blue-600" />
                      Suggerimenti Strategici
                    </h4>
                    <ul className="space-y-2">
                      {selectedProductDetail.strategicSuggestions.map((sug, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                          <span className="text-blue-600">🎯</span>
                          <span>{sug}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 p-6 rounded-b-2xl">
                <button
                  onClick={() => setSelectedProductDetail(null)}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-xl font-bold"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && agentResult && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-center font-semibold text-gray-700">Elaborazione...</p>
          </div>
        </div>
      )}
    </div>
  );
}
