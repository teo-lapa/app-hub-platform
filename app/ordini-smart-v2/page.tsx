'use client';

// LAPA Smart Ordering V2 - Real Data Dashboard
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TruckIcon,
  CubeIcon,
  ClockIcon,
  CurrencyEuroIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  StarIcon,
  CalendarIcon,
  BellAlertIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useOrderTimeline } from '@/lib/hooks/useOrderTimeline';
import { useCreateCadence, useUpdateCadence } from '@/lib/hooks/useSupplierCadence';
import { CadenceType } from '@/lib/types/supplier-cadence';

interface Supplier {
  id: number;
  name: string;
  leadTime: number;
  criticalCount: number;
  highCount: number;
  totalProducts: number;
  totalKg: number;
  totalPz: number;
  estimatedValue: number;
  products: Product[];
  // Cadence fields
  cadenceDbId?: string; // Database UUID for updating cadences
  nextOrderDate?: string;
  cadenceDays?: number;
  urgency?: 'today' | 'tomorrow' | 'this_week' | 'future';
  daysUntilOrder?: number;
  hasCadence?: boolean;
  isActive?: boolean; // Fornitore attivo o disattivato
}

interface Product {
  id: number;
  name: string;
  currentStock: number;
  avgDailySales: number;
  daysRemaining: number;
  urgencyLevel: string;
  totalSold3Months: number;
  suggestedQty: number;
  uom: string;
  avgPrice?: number;
  supplier: {
    name: string;
    leadTime: number;
  };
}

export default function SmartOrderingV2() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Map<number, number>>(new Map());
  const [favoriteSuppliers, setFavoriteSuppliers] = useState<Set<number>>(new Set());
  const [productDetailsModal, setProductDetailsModal] = useState<Product | null>(null);
  const [productAnalytics, setProductAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [showTodayAnalysis, setShowTodayAnalysis] = useState(false);
  const [todayAnalysisData, setTodayAnalysisData] = useState<any>(null);
  const [loadingTodayAnalysis, setLoadingTodayAnalysis] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cadence Management
  const [cadenceModal, setCadenceModal] = useState<{ supplier: Supplier | null; isOpen: boolean }>({
    supplier: null,
    isOpen: false
  });
  const [cadenceDays, setCadenceDays] = useState<number>(7);

  // Fetch cadence timeline
  const { data: timelineData, isLoading: timelineLoading, refetch: refetchTimeline } = useOrderTimeline();
  const createCadence = useCreateCadence();
  const updateCadence = useUpdateCadence();

  useEffect(() => {
    loadData();
    // Load favorites from localStorage
    const saved = localStorage.getItem('favoriteSuppliers');
    if (saved) {
      setFavoriteSuppliers(new Set(JSON.parse(saved)));
    }
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetch('/api/smart-ordering-v2/suppliers');
      const data = await response.json();

      if (data.success) {
        // Merge cadence data with suppliers
        const suppliersWithCadence = await enrichSuppliersWithCadence(data.suppliers);
        setSuppliers(suppliersWithCadence);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  }

  // Enrich suppliers with cadence data from timeline
  async function enrichSuppliersWithCadence(suppliers: Supplier[]): Promise<Supplier[]> {
    try {
      // Fetch cadence data
      const cadenceResponse = await fetch('/api/supplier-cadence');
      if (!cadenceResponse.ok) {
        return suppliers; // Return original if cadence fetch fails
      }

      const cadenceData: any = await cadenceResponse.json();
      const cadenceMap = new Map(
        (cadenceData.suppliers || []).map((c: any) => [c.supplier_id, c])
      );

      return suppliers.map(supplier => {
        const cadence: any = cadenceMap.get(supplier.id);
        if (!cadence) return { ...supplier, isActive: true }; // Fornitori senza cadenza = attivi di default

        // Calculate urgency
        let urgency: 'today' | 'tomorrow' | 'this_week' | 'future' = 'future';
        const daysUntil = cadence.days_until_next_order ?? null;
        if (daysUntil === 0) urgency = 'today';
        else if (daysUntil === 1) urgency = 'tomorrow';
        else if (daysUntil !== null && daysUntil <= 7) urgency = 'this_week';

        return {
          ...supplier,
          cadenceDbId: cadence.id, // Store database UUID for updates
          nextOrderDate: cadence.next_order_date || undefined,
          cadenceDays: cadence.cadence_value || undefined,
          urgency,
          daysUntilOrder: daysUntil,
          hasCadence: !!cadence.cadence_value, // TRUE if has cadence_value, regardless of is_active
          isActive: cadence.is_active ?? true // Retrieve active status from database
        };
      });
    } catch (error) {
      console.error('Error enriching suppliers with cadence:', error);
      return suppliers;
    }
  }

  function getUrgencyColor(level: string) {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  }

  function toggleFavorite(supplierId: number, e: React.MouseEvent) {
    e.stopPropagation();
    const newFavorites = new Set(favoriteSuppliers);
    if (newFavorites.has(supplierId)) {
      newFavorites.delete(supplierId);
    } else {
      newFavorites.add(supplierId);
    }
    setFavoriteSuppliers(newFavorites);
    localStorage.setItem('favoriteSuppliers', JSON.stringify(Array.from(newFavorites)));
  }

  function handleQuantityChange(productId: number, qty: number) {
    const newMap = new Map(selectedProducts);
    if (qty > 0) {
      newMap.set(productId, qty);
    } else {
      newMap.delete(productId);
    }
    setSelectedProducts(newMap);
  }

  function toggleProductSelection(product: Product) {
    const newMap = new Map(selectedProducts);
    if (newMap.has(product.id)) {
      newMap.delete(product.id);
    } else {
      newMap.set(product.id, product.suggestedQty);
    }
    setSelectedProducts(newMap);
  }

  function calculateOrderValue() {
    if (!selectedSupplier) return 0;
    let total = 0;
    selectedProducts.forEach((qty, productId) => {
      const product = selectedSupplier.products.find(p => p.id === productId);
      if (product && product.avgPrice) {
        total += qty * product.avgPrice;
      }
    });
    return total;
  }

  function selectAllProducts() {
    if (!selectedSupplier) return;
    const newMap = new Map(selectedProducts);
    const criticalHighProducts = selectedSupplier.products.filter(p =>
      ['CRITICAL', 'HIGH'].includes(p.urgencyLevel)
    );
    criticalHighProducts.forEach(product => {
      newMap.set(product.id, product.suggestedQty);
    });
    setSelectedProducts(newMap);
  }

  function deselectAllProducts() {
    setSelectedProducts(new Map());
  }

  // Sort suppliers: favorites first, then by urgency
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const aFav = favoriteSuppliers.has(a.id) ? 1 : 0;
    const bFav = favoriteSuppliers.has(b.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return b.criticalCount - a.criticalCount;
  });

  async function openProductAnalytics(product: Product, e: React.MouseEvent) {
    e.stopPropagation();
    setProductDetailsModal(product);
    setLoadingAnalytics(true);

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

  async function createOrder() {
    if (!selectedSupplier) return;

    const orderItems = Array.from(selectedProducts.entries()).map(([productId, qty]) => ({
      productId,
      qty
    }));

    try {
      const response = await fetch('/api/smart-ordering-v2/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier.id,
          items: orderItems
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ Ordine creato in Odoo! ID: ${data.orderId}`);
        setSelectedSupplier(null);
        setSelectedProducts(new Map());
        loadData();
      } else {
        alert(`❌ Errore: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Errore creazione ordine`);
    }
  }

  async function analyzeTodaySales(useAI: boolean = true) {
    setLoadingTodayAnalysis(true);
    setShowTodayAnalysis(true);

    try {
      const response = await fetch(`/api/ordini-fornitori/analyze-today?ai=${useAI}`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.error) {
        alert(`❌ Errore: ${data.message}`);
        setShowTodayAnalysis(false);
      } else {
        setTodayAnalysisData(data);
      }
    } catch (error) {
      console.error('Errore analisi vendite oggi:', error);
      alert('❌ Errore durante analisi vendite oggi');
      setShowTodayAnalysis(false);
    } finally {
      setLoadingTodayAnalysis(false);
    }
  }

  // Handle cadence modal
  function openCadenceModal(supplier: Supplier, e: React.MouseEvent) {
    e.stopPropagation();
    setCadenceDays(supplier.cadenceDays || 7);
    setCadenceModal({ supplier, isOpen: true });
  }

  async function saveCadence() {
    if (!cadenceModal.supplier) return;

    try {
      const supplier = cadenceModal.supplier;

      if (supplier.hasCadence && supplier.cadenceDbId) {
        // Update existing cadence using database UUID
        await updateCadence.mutateAsync({
          id: supplier.cadenceDbId,
          data: {
            cadence_value: cadenceDays,
            cadence_type: CadenceType.FIXED_DAYS,
            is_active: true
          }
        });
      } else {
        // Create new cadence using Odoo supplier ID
        await createCadence.mutateAsync({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          cadence_type: CadenceType.FIXED_DAYS,
          cadence_value: cadenceDays,
          average_lead_time_days: supplier.leadTime
        });
      }

      alert(`✅ Cadenza impostata: ordine ogni ${cadenceDays} giorni`);
      setCadenceModal({ supplier: null, isOpen: false });

      // Reload data
      await loadData();
      refetchTimeline();
    } catch (error) {
      console.error('Errore salvataggio cadenza:', error);
      alert('❌ Errore durante il salvataggio');
    }
  }

  // Filter suppliers by search term
  const filteredSuppliers = searchTerm
    ? suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : suppliers;

  // Separate suppliers by urgency (filter out inactive suppliers)
  const urgentSuppliers = filteredSuppliers.filter(s => (s.urgency === 'today' || s.urgency === 'tomorrow') && s.isActive !== false);
  const todaySuppliers = filteredSuppliers.filter(s => s.urgency === 'today' && s.isActive !== false);
  const tomorrowSuppliers = filteredSuppliers.filter(s => s.urgency === 'tomorrow' && s.isActive !== false);
  const regularSuppliers = filteredSuppliers.filter(s => (!s.urgency || s.urgency === 'this_week' || s.urgency === 'future') && s.isActive !== false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">🔄 Caricamento dati reali da Odoo...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            🤖 LAPA Smart Ordering AI
          </h1>
          <p className="text-blue-200">
            Dashboard Intelligente Ordini • {suppliers.length} Fornitori Attivi
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 border border-white/20"
          >
            <span>←</span>
            <span>Home</span>
          </button>
          <button
            onClick={() => router.push('/gestione-cadenze-fornitori')}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all flex items-center gap-2 font-semibold"
            title="Gestisci cadenze di tutti i fornitori"
          >
            <CalendarIcon className="w-5 h-5" />
            <span>Gestione Cadenze</span>
          </button>
          <button
            onClick={() => analyzeTodaySales(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all flex items-center gap-2 font-semibold"
            title="Analizza prodotti venduti oggi con Claude AI"
          >
            <span>🤖</span>
            <span>Analizza Vendite Oggi</span>
          </button>
          <button
            onClick={() => router.push('/ordini-smart-v2/prodotti-critici')}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-all flex items-center gap-2 font-semibold"
          >
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span>Prodotti Critici</span>
          </button>
        </div>
      </motion.div>

      {/* SEARCH BAR */}
      {!selectedSupplier && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Cerca fornitore..."
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            {searchTerm && (
              <div className="mt-2 text-sm text-blue-200">
                Trovati {filteredSuppliers.length} fornitori
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* URGENT ORDERS SECTION - ALWAYS VISIBLE */}
      {!selectedSupplier && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-lg rounded-2xl p-6 border border-red-400/30">
            <div className="flex items-center gap-3 mb-4">
              <BellAlertIcon className="w-8 h-8 text-red-400" />
              <h2 className="text-2xl font-bold text-white">
                ORDINI PROGRAMMATI OGGI
              </h2>
              {urgentSuppliers.length > 0 && (
                <div className="bg-red-500 text-white px-4 py-1 rounded-full font-bold">
                  {urgentSuppliers.length}
                </div>
              )}
            </div>

            {/* Empty State */}
            {urgentSuppliers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-white/60 text-lg mb-2">
                  ✅ Nessun ordine urgente oggi
                </p>
                <p className="text-white/40 text-sm">
                  Tutti i fornitori sono in regola con le cadenze
                </p>
              </div>
            )}

            {/* Today Suppliers */}
            {todaySuppliers.length > 0 && (
              <div className="mb-4">
                <h3 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  DA ORDINARE OGGI ({todaySuppliers.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {todaySuppliers.map(supplier => (
                    <div
                      key={supplier.id}
                      onClick={() => setSelectedSupplier(supplier)}
                      className="bg-red-500/10 hover:bg-red-500/20 backdrop-blur-sm rounded-xl p-4 cursor-pointer transition-all border border-red-400/30 hover:scale-105"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-white font-bold mb-1">{supplier.name}</div>
                          <div className="text-red-300 text-sm">
                            Cadenza: ogni {supplier.cadenceDays} giorni
                          </div>
                        </div>
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          OGGI
                        </div>
                      </div>
                      {supplier.criticalCount > 0 && (
                        <div className="text-red-200 text-xs mt-2">
                          {supplier.criticalCount} prodotti critici
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tomorrow Suppliers */}
            {tomorrowSuppliers.length > 0 && (
              <div>
                <h3 className="text-orange-300 font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                  DA ORDINARE DOMANI ({tomorrowSuppliers.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tomorrowSuppliers.map(supplier => (
                    <div
                      key={supplier.id}
                      onClick={() => setSelectedSupplier(supplier)}
                      className="bg-orange-500/10 hover:bg-orange-500/20 backdrop-blur-sm rounded-xl p-4 cursor-pointer transition-all border border-orange-400/30 hover:scale-105"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-white font-bold mb-1">{supplier.name}</div>
                          <div className="text-orange-300 text-sm">
                            Cadenza: ogni {supplier.cadenceDays} giorni
                          </div>
                        </div>
                        <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          DOMANI
                        </div>
                      </div>
                      {supplier.criticalCount > 0 && (
                        <div className="text-orange-200 text-xs mt-2">
                          {supplier.criticalCount} prodotti critici
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Supplier Cards */}
      {!selectedSupplier && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedSuppliers.map((supplier, index) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedSupplier(supplier)}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 cursor-pointer hover:bg-white/20 transition-all hover:scale-105 border border-white/20"
            >
              {/* Header Fornitore */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <TruckIcon className="w-5 h-5 text-blue-300" />
                    <h3 className="text-lg font-bold text-white line-clamp-2">
                      {supplier.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-200">
                    <ClockIcon className="w-4 h-4" />
                    Lead time: {supplier.leadTime} giorni
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => toggleFavorite(supplier.id, e)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    {favoriteSuppliers.has(supplier.id) ? (
                      <StarIconSolid className="w-6 h-6 text-yellow-400" />
                    ) : (
                      <StarIcon className="w-6 h-6 text-blue-300" />
                    )}
                  </button>
                  <ChevronRightIcon className="w-6 h-6 text-blue-300" />
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {supplier.urgency === 'today' && (
                  <div className="flex items-center gap-1 bg-red-500/30 text-red-200 px-3 py-1 rounded-full text-sm font-bold border border-red-400">
                    <BellAlertIcon className="w-4 h-4" />
                    OGGI
                  </div>
                )}
                {supplier.urgency === 'tomorrow' && (
                  <div className="flex items-center gap-1 bg-orange-500/30 text-orange-200 px-3 py-1 rounded-full text-sm font-bold border border-orange-400">
                    <CalendarIcon className="w-4 h-4" />
                    DOMANI
                  </div>
                )}
                {supplier.criticalCount > 0 && (
                  <div className="flex items-center gap-1 bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm font-semibold">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    {supplier.criticalCount} Critici
                  </div>
                )}
                {supplier.highCount > 0 && (
                  <div className="flex items-center gap-1 bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-sm font-semibold">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    {supplier.highCount} Alti
                  </div>
                )}
                {supplier.criticalCount === 0 && supplier.highCount === 0 && !supplier.urgency && (
                  <div className="flex items-center gap-1 bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-semibold">
                    <CheckCircleIcon className="w-4 h-4" />
                    Tutto OK
                  </div>
                )}
                {/* Cadence Badge - Always Visible */}
                {supplier.hasCadence && supplier.cadenceDays && (
                  <div className="flex items-center gap-1 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-semibold">
                    <CalendarIcon className="w-4 h-4" />
                    Ogni {supplier.cadenceDays} gg
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-blue-300 text-xs mb-1">Prodotti</div>
                  <div className="text-white text-xl font-bold">{supplier.totalProducts}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-blue-300 text-xs mb-1">Valore Stim.</div>
                  <div className="text-white text-xl font-bold">
                    CHF {(supplier.estimatedValue / 1000).toFixed(1)}k
                  </div>
                </div>
              </div>

              {/* Totali */}
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-sm text-blue-200">
                  <span>📦 Totale da ordinare:</span>
                  <span className="font-semibold">
                    {supplier.totalKg > 0 && `${supplier.totalKg.toFixed(0)} KG`}
                    {supplier.totalKg > 0 && supplier.totalPz > 0 && ' + '}
                    {supplier.totalPz > 0 && `${supplier.totalPz} PZ`}
                  </span>
                </div>

                {/* Cadence Info */}
                <button
                  onClick={(e) => openCadenceModal(supplier, e)}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-lg p-2 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-300" />
                    <span className="text-sm text-blue-200">
                      {supplier.hasCadence ? (
                        <>Cadenza: ogni {supplier.cadenceDays} gg</>
                      ) : (
                        <>Imposta cadenza</>
                      )}
                    </span>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-blue-300 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedSupplier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-auto"
          >
            <div className="min-h-screen p-6 flex items-start justify-center">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl max-w-6xl w-full border border-white/20"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">
                        📦 {selectedSupplier.name}
                      </h2>
                      <div className="flex items-center gap-4 text-blue-200">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          Lead time: {selectedSupplier.leadTime} giorni
                        </span>
                        <span>•</span>
                        <span>{selectedSupplier.products.length} prodotti</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedSupplier(null);
                        setSelectedProducts(new Map());
                      }}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="w-8 h-8" />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={selectAllProducts}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all font-semibold"
                    >
                      ✓ Seleziona Tutti
                    </button>
                    <button
                      onClick={deselectAllProducts}
                      className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                    >
                      Deseleziona Tutti
                    </button>
                    <button
                      onClick={() => router.push(`/catalogo-prodotti?supplier_id=${selectedSupplier.id}&supplier_name=${encodeURIComponent(selectedSupplier.name)}`)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all font-semibold"
                    >
                      📦 Aggiungi dal Catalogo
                    </button>
                  </div>
                </div>

                {/* Products List */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-auto">
                  {selectedSupplier.products
                    .filter(p => ['CRITICAL', 'HIGH'].includes(p.urgencyLevel))
                    .sort((a, b) => {
                      const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                      return urgencyOrder[a.urgencyLevel as keyof typeof urgencyOrder] -
                             urgencyOrder[b.urgencyLevel as keyof typeof urgencyOrder];
                    })
                    .map((product) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/5 rounded-xl p-5 hover:bg-white/10 transition-all"
                      >
                        {/* Product Header */}
                        <div className="flex items-start gap-4 mb-4">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleProductSelection(product)}
                            className="w-5 h-5 mt-2 cursor-pointer"
                          />

                          {/* Product Image */}
                          <img
                            src={`https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${product.id}/image_128`}
                            alt={product.name}
                            className="w-16 h-16 rounded-lg object-cover bg-white/10"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/%3E%3C/svg%3E';
                            }}
                          />

                          <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg mb-1 line-clamp-2">
                              {product.name}
                            </h3>
                            <div className="flex flex-wrap gap-3 text-sm text-blue-200">
                              <span>Stock: {product.currentStock.toFixed(1)} {product.uom}</span>
                              <span>•</span>
                              <span>Media vendite: {product.avgDailySales.toFixed(1)}/giorno</span>
                              <span>•</span>
                              <span className="font-semibold text-orange-300">
                                ⏰ {product.daysRemaining.toFixed(1)} giorni rimanenti
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sales Stats */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-blue-300 text-xs mb-1">Venduti 3 mesi</div>
                            <div className="text-white font-bold">{product.totalSold3Months.toFixed(0)}</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-blue-300 text-xs mb-1">Suggerimento AI</div>
                            <div className="text-white font-bold">{product.suggestedQty} {product.uom}</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-blue-300 text-xs mb-1">Prezzo medio</div>
                            <div className="text-white font-bold">CHF {product.avgPrice?.toFixed(2) || '0.00'}</div>
                          </div>
                          <button
                            onClick={(e) => openProductAnalytics(product, e)}
                            className="bg-white/5 rounded-lg p-3 hover:bg-white/10 cursor-pointer transition-all hover:scale-105"
                            title="Clicca per analisi dettagliata"
                          >
                            <div className="text-blue-300 text-xs mb-1">Urgenza</div>
                            <div className={`font-bold text-xs ${
                              product.urgencyLevel === 'CRITICAL' ? 'text-red-400' :
                              product.urgencyLevel === 'HIGH' ? 'text-orange-400' :
                              'text-yellow-400'
                            }`}>
                              {product.urgencyLevel === 'CRITICAL' ? '🔴 CRITICO' :
                               product.urgencyLevel === 'HIGH' ? '🟠 ALTO' : '🟡 MEDIO'}
                            </div>
                          </button>
                        </div>

                        {/* Order Input */}
                        <div className="flex items-center gap-3">
                          <label className="text-blue-200 text-sm font-medium">
                            Quantità da ordinare:
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder={product.suggestedQty.toString()}
                            defaultValue={selectedProducts.get(product.id) || product.suggestedQty}
                            onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                            className="bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none w-32"
                          />
                          <span className="text-blue-200 text-sm">{product.uom}</span>
                        </div>
                      </motion.div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="text-blue-200">
                      <div className="text-sm font-semibold">Prodotti selezionati: {selectedProducts.size}</div>
                      <div className="text-lg font-bold text-white mt-1">
                        💰 Valore Ordine: CHF {calculateOrderValue().toFixed(2)}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setSelectedSupplier(null);
                          setSelectedProducts(new Map());
                        }}
                        className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={createOrder}
                        disabled={selectedProducts.size === 0}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                      >
                        🚀 Crea Ordine in Odoo
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Analytics Modal */}
      <AnimatePresence>
        {productDetailsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] overflow-auto"
            onClick={() => {
              setProductDetailsModal(null);
              setProductAnalytics(null);
            }}
          >
            <div className="min-h-screen p-6 flex items-start justify-center">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl max-w-7xl w-full border border-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <img
                        src={`https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${productDetailsModal.id}/image_256`}
                        alt={productDetailsModal.name}
                        className="w-24 h-24 rounded-xl object-cover bg-white/10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/%3E%3C/svg%3E';
                        }}
                      />
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                          📊 Analisi Dettagliata Prodotto
                        </h2>
                        <p className="text-xl text-blue-200">{productDetailsModal.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setProductDetailsModal(null);
                        setProductAnalytics(null);
                      }}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="w-8 h-8" />
                    </button>
                  </div>
                </div>

                {loadingAnalytics ? (
                  <div className="p-12 text-center">
                    <div className="text-white text-xl">🔄 Caricamento dati analitici...</div>
                  </div>
                ) : productAnalytics ? (
                  <div className="p-6 space-y-6 max-h-[70vh] overflow-auto">
                    {/* Top Stats */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-400/30">
                        <div className="text-blue-300 text-sm mb-1">Stock Corrente</div>
                        <div className="text-white text-2xl font-bold">{productAnalytics.product.currentStock.toFixed(1)}</div>
                        <div className="text-blue-200 text-xs">{productDetailsModal.uom}</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-4 border border-green-400/30">
                        <div className="text-green-300 text-sm mb-1">Vendite 3 Mesi</div>
                        <div className="text-white text-2xl font-bold">{productAnalytics.product.totalSold3Months.toFixed(0)}</div>
                        <div className="text-green-200 text-xs">{productDetailsModal.uom}</div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-400/30">
                        <div className="text-purple-300 text-sm mb-1">Ricavo Totale</div>
                        <div className="text-white text-2xl font-bold">CHF {productAnalytics.product.totalRevenue.toFixed(2)}</div>
                        <div className="text-purple-200 text-xs">ultimi 3 mesi</div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl p-4 border border-orange-400/30">
                        <div className="text-orange-300 text-sm mb-1">Media Giornaliera</div>
                        <div className="text-white text-2xl font-bold">{productAnalytics.product.avgDailySales.toFixed(1)}</div>
                        <div className="text-orange-200 text-xs">{productDetailsModal.uom}/giorno</div>
                      </div>
                    </div>

                    {/* Weekly Sales Chart */}
                    <div className="bg-white/5 rounded-xl p-6">
                      <h3 className="text-white text-xl font-bold mb-4">📈 Trend Vendite Settimanali</h3>
                      <div className="space-y-2">
                        {productAnalytics.weeklyChart.map((week: any, index: number) => {
                          const maxQty = Math.max(...productAnalytics.weeklyChart.map((w: any) => w.qty));
                          const widthPercent = (week.qty / maxQty) * 100;
                          return (
                            <div key={index} className="flex items-center gap-3">
                              <div className="text-blue-300 text-sm w-24">{week.week}</div>
                              <div className="flex-1">
                                <div className="bg-blue-500/20 rounded-full h-8 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full flex items-center justify-end px-3 text-white text-sm font-semibold transition-all"
                                    style={{ width: `${widthPercent}%` }}
                                  >
                                    {week.qty.toFixed(0)} {productDetailsModal.uom}
                                  </div>
                                </div>
                              </div>
                              <div className="text-green-300 text-sm font-semibold w-24 text-right">
                                CHF {week.revenue.toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top Customers - Collapsible */}
                    <div className="bg-white/5 rounded-xl p-6">
                      <button
                        onClick={() => setShowCustomers(!showCustomers)}
                        className="w-full flex items-center justify-between text-white text-xl font-bold mb-4 hover:bg-white/5 p-3 rounded-lg transition-all"
                      >
                        <span>👥 Top 10 Clienti</span>
                        <span className="text-2xl">{showCustomers ? '▼' : '▶'}</span>
                      </button>
                      {showCustomers && (
                        <div className="space-y-3">
                          {productAnalytics.topCustomers.slice(0, 10).map((customer: any, index: number) => (
                            <div key={customer.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-white font-semibold">{customer.name}</div>
                                  <div className="text-blue-300 text-sm">{customer.orders} ordini</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-white font-bold">{customer.qty.toFixed(1)} {productDetailsModal.uom}</div>
                                <div className="text-green-300 text-sm">CHF {customer.revenue.toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stock Locations */}
                    {(productAnalytics.locations.length > 0 || productAnalytics.product.incomingQty > 0) && (
                      <div className="bg-white/5 rounded-xl p-6">
                        <h3 className="text-white text-xl font-bold mb-4">🏢 Giacenza per Ubicazione</h3>
                        <div className="space-y-3">
                          {productAnalytics.locations.map((location: any, index: number) => (
                            <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                              <div className="text-white font-semibold">{location.name}</div>
                              <div className="flex gap-4 text-sm">
                                <div>
                                  <span className="text-blue-300">Totale: </span>
                                  <span className="text-white font-bold">{location.qty.toFixed(1)}</span>
                                </div>
                                <div>
                                  <span className="text-yellow-300">Riservato: </span>
                                  <span className="text-white font-bold">{location.reserved.toFixed(1)}</span>
                                </div>
                                <div>
                                  <span className="text-green-300">Disponibile: </span>
                                  <span className="text-white font-bold">{location.available.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {productAnalytics.product.incomingQty > 0 && (
                            <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-400/30">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-purple-300 font-semibold text-lg">🚚 In Arrivo</div>
                                {productAnalytics.product.incomingOrderName && (
                                  <div className="text-white font-bold bg-purple-600 px-3 py-1 rounded-lg text-sm">
                                    Ordine: {productAnalytics.product.incomingOrderName}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-6 text-sm">
                                <div>
                                  <span className="text-purple-300">Quantità: </span>
                                  <span className="text-white font-bold">{productAnalytics.product.incomingQty.toFixed(1)} {productDetailsModal.uom}</span>
                                </div>
                                {productAnalytics.product.incomingDate && (
                                  <div>
                                    <span className="text-purple-300">📅 Arrivo previsto: </span>
                                    <span className="text-white font-bold">{new Date(productAnalytics.product.incomingDate).toLocaleDateString('it-IT')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suppliers */}
                    {productAnalytics.suppliers.length > 0 && (
                      <div className="bg-white/5 rounded-xl p-6">
                        <h3 className="text-white text-xl font-bold mb-4">🚚 Fornitori</h3>
                        <div className="space-y-3">
                          {productAnalytics.suppliers.map((supplier: any, index: number) => (
                            <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                              <div className="flex items-center gap-3">
                                {supplier.isMain && (
                                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    ⭐ PRINCIPALE
                                  </div>
                                )}
                                <div>
                                  <div className="text-white font-semibold">{supplier.name}</div>
                                  {supplier.orderCount > 0 && (
                                    <div className="text-blue-300 text-xs mt-1">
                                      {supplier.orderCount} ordini • {supplier.totalQty.toFixed(0)} {productDetailsModal.uom} acquistati
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-4 text-sm">
                                <div>
                                  <span className="text-blue-300">Lead Time: </span>
                                  <span className="text-white font-bold">{supplier.leadTime} giorni</span>
                                </div>
                                <div>
                                  <span className="text-orange-300">Min Qty: </span>
                                  <span className="text-white font-bold">{supplier.minQty}</span>
                                </div>
                                <div>
                                  <span className="text-green-300">Prezzo: </span>
                                  <span className="text-white font-bold">CHF {supplier.price.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="text-red-300 text-xl">❌ Errore caricamento dati</div>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today Sales Analysis Modal */}
      <AnimatePresence>
        {showTodayAnalysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] overflow-auto"
            onClick={() => {
              setShowTodayAnalysis(false);
              setTodayAnalysisData(null);
            }}
          >
            <div className="min-h-screen p-6 flex items-start justify-center">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-3xl shadow-2xl max-w-7xl w-full border border-purple-400/30"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">
                        🤖 Analisi Claude AI - Vendite Oggi
                      </h2>
                      <p className="text-purple-200">
                        {todayAnalysisData ? `Confronto Matematica vs AI • ${new Date(todayAnalysisData.date).toLocaleDateString('it-IT')}` : 'Caricamento...'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowTodayAnalysis(false);
                        setTodayAnalysisData(null);
                      }}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="w-8 h-8" />
                    </button>
                  </div>
                </div>

                {loadingTodayAnalysis ? (
                  <div className="p-12 text-center">
                    <div className="text-white text-2xl mb-4">🔄 Analisi in corso...</div>
                    <div className="text-purple-300">Claude sta analizzando le vendite di oggi e confrontandole con le previsioni matematiche...</div>
                  </div>
                ) : todayAnalysisData ? (
                  <div className="p-6 space-y-6 max-h-[75vh] overflow-auto">
                    {/* Top Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/10 rounded-xl p-6 border border-purple-400/30">
                        <div className="text-purple-300 text-sm mb-2">Prodotti Venduti</div>
                        <div className="text-white text-4xl font-bold">{todayAnalysisData.totalProductsSold}</div>
                        <div className="text-purple-200 text-xs mt-1">prodotti unici</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-6 border border-green-400/30">
                        <div className="text-green-300 text-sm mb-2">Revenue Giornaliera</div>
                        <div className="text-white text-4xl font-bold">CHF {todayAnalysisData.totalRevenue.toFixed(2)}</div>
                        <div className="text-green-200 text-xs mt-1">totale vendite</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-6 border border-blue-400/30">
                        <div className="text-blue-300 text-sm mb-2">Tempo Analisi</div>
                        <div className="text-white text-4xl font-bold">{(todayAnalysisData.executionTime / 1000).toFixed(1)}s</div>
                        <div className="text-blue-200 text-xs mt-1">elaborazione</div>
                      </div>
                    </div>

                    {/* AI Insights */}
                    {todayAnalysisData.aiInsights && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Trends */}
                        {todayAnalysisData.aiInsights.trends.length > 0 && (
                          <div className="bg-white/10 rounded-xl p-5 border border-blue-400/30">
                            <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                              📊 Trends AI
                            </h3>
                            <ul className="space-y-2">
                              {todayAnalysisData.aiInsights.trends.map((trend: string, idx: number) => (
                                <li key={idx} className="text-blue-200 text-sm flex items-start gap-2">
                                  <span className="text-blue-400 mt-1">•</span>
                                  <span>{trend}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Alerts */}
                        {todayAnalysisData.aiInsights.alerts.length > 0 && (
                          <div className="bg-white/10 rounded-xl p-5 border border-orange-400/30">
                            <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                              ⚠️ Alerts
                            </h3>
                            <ul className="space-y-2">
                              {todayAnalysisData.aiInsights.alerts.map((alert: string, idx: number) => (
                                <li key={idx} className="text-orange-200 text-sm flex items-start gap-2">
                                  <span className="text-orange-400 mt-1">⚠️</span>
                                  <span>{alert}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommendations */}
                        {todayAnalysisData.aiInsights.recommendations.length > 0 && (
                          <div className="bg-white/10 rounded-xl p-5 border border-green-400/30">
                            <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                              💡 Raccomandazioni
                            </h3>
                            <ul className="space-y-2">
                              {todayAnalysisData.aiInsights.recommendations.map((rec: string, idx: number) => (
                                <li key={idx} className="text-green-200 text-sm flex items-start gap-2">
                                  <span className="text-green-400 mt-1">✓</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Products Table */}
                    <div className="bg-white/5 rounded-xl p-6">
                      <h3 className="text-white text-xl font-bold mb-4">📦 Prodotti Venduti Oggi</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left text-purple-300 text-sm font-semibold p-3">Prodotto</th>
                              <th className="text-right text-purple-300 text-sm font-semibold p-3">Qtà Venduta</th>
                              <th className="text-right text-purple-300 text-sm font-semibold p-3">Valore</th>
                              <th className="text-right text-purple-300 text-sm font-semibold p-3">Stock</th>
                              <th className="text-right text-purple-300 text-sm font-semibold p-3">Media gg</th>
                              <th className="text-right text-purple-300 text-sm font-semibold p-3">vs Media</th>
                              <th className="text-left text-purple-300 text-sm font-semibold p-3">Fornitore</th>
                            </tr>
                          </thead>
                          <tbody>
                            {todayAnalysisData.products.slice(0, 20).map((product: any, idx: number) => (
                              <tr key={product.productId} className="border-b border-white/5 hover:bg-white/5">
                                <td className="text-white text-sm p-3">{product.productName}</td>
                                <td className="text-white text-sm p-3 text-right font-semibold">{product.quantitySold.toFixed(1)}</td>
                                <td className="text-green-300 text-sm p-3 text-right">CHF {product.totalValue.toFixed(2)}</td>
                                <td className="text-blue-300 text-sm p-3 text-right">{product.currentStock.toFixed(1)}</td>
                                <td className="text-purple-200 text-sm p-3 text-right">{product.avgDailySales.toFixed(1)}</td>
                                <td className={`text-sm p-3 text-right font-semibold ${
                                  product.todayVsAverage > 20 ? 'text-green-400' :
                                  product.todayVsAverage < -20 ? 'text-red-400' :
                                  'text-yellow-400'
                                }`}>
                                  {product.todayVsAverage > 0 ? '+' : ''}{product.todayVsAverage.toFixed(0)}%
                                </td>
                                <td className="text-purple-200 text-sm p-3">{product.supplierName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {todayAnalysisData.products.length > 20 && (
                        <div className="text-purple-300 text-sm mt-4 text-center">
                          Mostrando 20 di {todayAnalysisData.products.length} prodotti
                        </div>
                      )}
                    </div>

                    {/* Comparison Note */}
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-6 border border-purple-400/30">
                      <h3 className="text-white font-bold text-lg mb-2">🧠 Matematica vs AI</h3>
                      <p className="text-purple-200 text-sm mb-3">
                        La <strong>formula matematica</strong> è sempre attiva e calcola le quantità suggerite basandosi su:
                        consumo storico, lead time fornitore, e frequenza ordini stimata per raggiungere il valore minimo (CHF 2000).
                      </p>
                      <p className="text-purple-200 text-sm">
                        <strong>Claude AI</strong> analizza le vendite di oggi confrontandole con le medie storiche, identifica pattern anomali,
                        e fornisce raccomandazioni personalizzate. Usa entrambi gli approcci per decisioni ottimali!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="text-red-300 text-xl">❌ Errore caricamento dati</div>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cadence Management Modal */}
      <AnimatePresence>
        {cadenceModal.isOpen && cadenceModal.supplier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-6"
            onClick={() => setCadenceModal({ supplier: null, isOpen: false })}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="w-6 h-6 text-blue-400" />
                      <h2 className="text-2xl font-bold text-white">
                        Gestisci Cadenza
                      </h2>
                    </div>
                    <p className="text-blue-200">{cadenceModal.supplier.name}</p>
                  </div>
                  <button
                    onClick={() => setCadenceModal({ supplier: null, isOpen: false })}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-blue-200 text-sm font-semibold mb-3">
                    Ordina ogni quanti giorni?
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={cadenceDays}
                      onChange={(e) => setCadenceDays(parseInt(e.target.value) || 7)}
                      className="bg-white/10 text-white text-2xl font-bold px-6 py-4 rounded-xl border border-white/20 focus:border-blue-400 focus:outline-none w-32 text-center"
                    />
                    <span className="text-white text-xl">giorni</span>
                  </div>
                  <div className="mt-4 text-sm text-blue-300">
                    Il prossimo ordine sara pianificato automaticamente ogni {cadenceDays} giorni.
                  </div>
                </div>

                {/* Quick presets */}
                <div>
                  <label className="block text-blue-200 text-sm font-semibold mb-2">
                    Preset veloci:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 7, 14, 30].map(days => (
                      <button
                        key={days}
                        onClick={() => setCadenceDays(days)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-all ${
                          cadenceDays === days
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                      >
                        {days}gg
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4">
                  <div className="text-blue-300 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4" />
                      <span>Lead time fornitore: {cadenceModal.supplier.leadTime} giorni</span>
                    </div>
                    <div className="text-xs text-blue-400 mt-2">
                      Riceverai notifiche quando e il momento di ordinare
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10 flex gap-3">
                <button
                  onClick={() => setCadenceModal({ supplier: null, isOpen: false })}
                  className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={saveCadence}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all font-semibold"
                >
                  Salva Cadenza
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
