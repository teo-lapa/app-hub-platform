'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Home,
  AlertTriangle,
  Package,
  User,
  Calendar,
  Phone,
  ShoppingCart,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Truck,
  Clock,
  Filter,
  Search,
  CheckCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MissingProduct {
  id: number;
  sale_order_id: [number, string] | false;
  partner_id: [number, string] | false;
  salesperson_id: [number, string] | false;
  product_id: [number, string];
  product_default_code: string | null;
  ordered_qty: number;
  done_qty: number;
  missing_qty: number;
  qty_available: number;
  incoming_qty: number;
  expected_arrival_date: string | null;
  action_taken: string;
}

interface GroupedData {
  id: number | null;
  name: string;
  items: MissingProduct[];
  totalMissing: number;
}

interface ApiResponse {
  success: boolean;
  date: string;
  totals: {
    totalMissing: number;
    totalOrders: number;
    totalCustomers: number;
  };
  groupBy: string;
  data: GroupedData[];
  raw: MissingProduct[];
}

export default function ProdottiMancantiPage() {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [groupBy, setGroupBy] = useState<'salesperson' | 'product' | 'customer'>('salesperson');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<{ [key: string]: string }>({});
  const [actionSuccess, setActionSuccess] = useState<{ [key: string]: string }>({});

  // Carica dati
  useEffect(() => {
    loadMissingProducts();
  }, [selectedDate, groupBy]);

  const loadMissingProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/missing-products?date=${selectedDate}&group_by=${groupBy}`,
        { credentials: 'include' }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setData(result);

      // Espandi tutti i gruppi di default
      const allGroupIds = new Set<string>(result.data.map((g: GroupedData) => g.id?.toString() || 'none'));
      setExpandedGroups(allGroupIds);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleContactCustomer = async (item: MissingProduct) => {
    const key = `contact-${item.id}`;
    setActionLoading(prev => ({ ...prev, [key]: 'loading' }));

    try {
      const response = await fetch('/api/missing-products/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'contact',
          lineId: item.id,
          productId: item.product_id[0],
          partnerId: item.partner_id ? item.partner_id[0] : null,
          orderId: item.sale_order_id ? item.sale_order_id[0] : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActionSuccess(prev => ({ ...prev, [key]: 'Cliente contattato' }));
        setTimeout(() => {
          setActionSuccess(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
          });
        }, 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Errore contatto cliente:', err);
      alert('Errore: ' + err.message);
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  const handleOrderFromSupplier = async (item: MissingProduct) => {
    const key = `order-${item.id}`;
    setActionLoading(prev => ({ ...prev, [key]: 'loading' }));

    try {
      const response = await fetch('/api/missing-products/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'order',
          lineId: item.id,
          productId: item.product_id[0],
          quantity: item.missing_qty,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActionSuccess(prev => ({ ...prev, [key]: 'Ordine creato' }));
        // Apri l'ordine di acquisto in Odoo se disponibile
        if (result.purchaseOrderId) {
          const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
          window.open(`${odooUrl}/web#model=purchase.order&id=${result.purchaseOrderId}&view_type=form`, '_blank');
        }
        setTimeout(() => {
          setActionSuccess(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
          });
        }, 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Errore ordine fornitore:', err);
      alert('Errore: ' + err.message);
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  const handleProposeAlternative = async (item: MissingProduct) => {
    const key = `alt-${item.id}`;
    setActionLoading(prev => ({ ...prev, [key]: 'loading' }));

    try {
      const response = await fetch('/api/missing-products/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'alternative',
          lineId: item.id,
          productId: item.product_id[0],
          partnerId: item.partner_id ? item.partner_id[0] : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Se ci sono alternative, mostra un alert con le opzioni
        if (result.alternatives && result.alternatives.length > 0) {
          const altList = result.alternatives.map((a: any) =>
            `- ${a.name} (${a.qty_available} disponibili)`
          ).join('\n');
          alert(`Prodotti alternativi trovati:\n\n${altList}`);
        } else {
          alert('Nessun prodotto alternativo trovato nella stessa categoria');
        }
        setActionSuccess(prev => ({ ...prev, [key]: 'Alternativa proposta' }));
        setTimeout(() => {
          setActionSuccess(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
          });
        }, 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Errore proposta alternativa:', err);
      alert('Errore: ' + err.message);
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  // Filtra i dati per ricerca
  const filteredData = data?.data.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.product_id[1].toLowerCase().includes(query) ||
        (item.product_default_code?.toLowerCase().includes(query)) ||
        (item.partner_id && item.partner_id[1].toLowerCase().includes(query)) ||
        (item.sale_order_id && item.sale_order_id[1].toLowerCase().includes(query))
      );
    })
  })).filter(group => group.items.length > 0);

  // Formatta data per visualizzazione
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Cambia giorno
  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/il-mio-hub')}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="text-orange-500" size={24} />
                  Prodotti Mancanti
                </h1>
                <p className="text-sm text-gray-400">
                  Consegne del {formatDate(selectedDate)}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Home size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Filtri */}
      <div className="sticky top-[60px] z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Selettore data */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => changeDate(-1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
            >
              ← Ieri
            </button>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
            >
              Domani →
            </button>
          </div>

          {/* Gruppi e ricerca */}
          <div className="flex items-center gap-3">
            {/* Raggruppa per */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="salesperson">Per Venditore</option>
                <option value="customer">Per Cliente</option>
                <option value="product">Per Prodotto</option>
              </select>
            </div>

            {/* Ricerca */}
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cerca prodotto, cliente, ordine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={loadMissingProducts}
              disabled={loading}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Statistiche */}
      {data && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{data.totals.totalMissing}</div>
              <div className="text-xs text-gray-400">Prodotti Mancanti</div>
            </div>
            <div className="bg-orange-900/30 border border-orange-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-orange-400">{data.totals.totalOrders}</div>
              <div className="text-xs text-gray-400">Ordini Interessati</div>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{data.totals.totalCustomers}</div>
              <div className="text-xs text-gray-400">Clienti Interessati</div>
            </div>
          </div>
        </div>
      )}

      {/* Contenuto principale */}
      <main className="max-w-7xl mx-auto px-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-blue-500" />
              <p className="text-gray-400">Caricamento prodotti mancanti...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 text-center">
            <AlertTriangle size={32} className="mx-auto mb-3 text-red-500" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={loadMissingProducts}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
            >
              Riprova
            </button>
          </div>
        ) : filteredData && filteredData.length > 0 ? (
          <div className="space-y-4">
            {filteredData.map((group) => (
              <div
                key={group.id || 'none'}
                className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
              >
                {/* Header gruppo */}
                <button
                  onClick={() => toggleGroup(group.id?.toString() || 'none')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <User size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">{group.name}</h3>
                      <p className="text-sm text-gray-400">
                        {group.items.length} prodotti mancanti
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-red-600/30 text-red-400 rounded-full text-sm font-medium">
                      {group.totalMissing.toFixed(2)} mancanti
                    </span>
                    {expandedGroups.has(group.id?.toString() || 'none') ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </button>

                {/* Items del gruppo */}
                <AnimatePresence>
                  {expandedGroups.has(group.id?.toString() || 'none') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-700"
                    >
                      <div className="divide-y divide-gray-700/50">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 hover:bg-gray-700/30 transition-colors"
                          >
                            <div className="flex items-start gap-4">
                              {/* Immagine prodotto placeholder */}
                              <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package size={24} className="text-gray-500" />
                              </div>

                              {/* Info prodotto */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">
                                  {item.product_id[1]}
                                </h4>
                                {item.product_default_code && (
                                  <p className="text-sm text-gray-400">
                                    Cod: {item.product_default_code}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                  {item.sale_order_id && (
                                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded">
                                      {item.sale_order_id[1]}
                                    </span>
                                  )}
                                  {item.partner_id && groupBy !== 'customer' && (
                                    <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded">
                                      {item.partner_id[1]}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quantità */}
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-bold text-red-400">
                                  {item.missing_qty.toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-400">mancante</div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Giacenza: {item.qty_available.toFixed(2)}
                                </div>
                                {item.expected_arrival_date && (
                                  <div className="mt-1 flex items-center gap-1 text-xs text-green-400">
                                    <Truck size={12} />
                                    {formatDate(item.expected_arrival_date)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Azioni */}
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => handleContactCustomer(item)}
                                disabled={!!actionLoading[`contact-${item.id}`]}
                                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  actionSuccess[`contact-${item.id}`]
                                    ? 'bg-green-600'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                } disabled:opacity-50`}
                              >
                                {actionLoading[`contact-${item.id}`] ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : actionSuccess[`contact-${item.id}`] ? (
                                  <CheckCircle size={14} />
                                ) : (
                                  <Phone size={14} />
                                )}
                                {actionSuccess[`contact-${item.id}`] || 'Contatta'}
                              </button>
                              <button
                                onClick={() => handleProposeAlternative(item)}
                                disabled={!!actionLoading[`alt-${item.id}`]}
                                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  actionSuccess[`alt-${item.id}`]
                                    ? 'bg-green-600'
                                    : 'bg-purple-600 hover:bg-purple-700'
                                } disabled:opacity-50`}
                              >
                                {actionLoading[`alt-${item.id}`] ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : actionSuccess[`alt-${item.id}`] ? (
                                  <CheckCircle size={14} />
                                ) : (
                                  <RefreshCw size={14} />
                                )}
                                {actionSuccess[`alt-${item.id}`] || 'Alternativa'}
                              </button>
                              <button
                                onClick={() => handleOrderFromSupplier(item)}
                                disabled={!!actionLoading[`order-${item.id}`]}
                                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  actionSuccess[`order-${item.id}`]
                                    ? 'bg-green-600'
                                    : 'bg-green-600 hover:bg-green-700'
                                } disabled:opacity-50`}
                              >
                                {actionLoading[`order-${item.id}`] ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : actionSuccess[`order-${item.id}`] ? (
                                  <CheckCircle size={14} />
                                ) : (
                                  <ShoppingCart size={14} />
                                )}
                                {actionSuccess[`order-${item.id}`] || 'Ordina'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={32} className="text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nessun prodotto mancante!</h3>
            <p className="text-gray-400">
              Tutti i prodotti sono disponibili per le consegne del {formatDate(selectedDate)}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
