'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, CheckCircle, Clock, RefreshCw, Search } from 'lucide-react';

interface Order {
  id: number;
  name: string;
  partner_name: string;
  partner_id: number | null;
  date: string;
  state: string;
  total: number;
  delivery_date: string | null;
  salesperson: string;
}

interface Stats {
  total_orders: number;
  draft_orders: number;
  confirmed_orders: number;
  total_amount: number;
}

type Period = 'week' | 'month' | '3months';

export default function OrdiniPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch orders based on selected period
  const fetchOrders = async (period: Period) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/catalogo-venditori/orders?period=${period}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel caricamento ordini');
      }

      setOrders(data.orders || []);
      setStats(data.stats || null);
      console.log(`✅ Loaded ${data.orders?.length || 0} orders for period: ${period}`);
    } catch (err) {
      console.error('❌ Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  // Load orders on mount and when period changes
  useEffect(() => {
    fetchOrders(selectedPeriod);
  }, [selectedPeriod]);

  // Get state label and color
  const getStateInfo = (state: string) => {
    switch (state) {
      case 'draft':
        return { label: 'Preventivo (Bozza)', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'sent':
        return { label: 'Preventivo Inviato', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'sale':
        return { label: 'Ordine Confermato', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'done':
        return { label: 'Completato', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'cancel':
        return { label: 'Annullato', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      default:
        return { label: state, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Navigate to order review page
  const handleOrderClick = (orderId: number) => {
    router.push(`/catalogo-venditori/review-prices/${orderId}`);
  };

  // Filter orders based on search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();

    // Search in order number (e.g., "S34804")
    if (order.name.toLowerCase().includes(query)) return true;

    // Search in customer name (e.g., "Imperial Food AG")
    if (order.partner_name.toLowerCase().includes(query)) return true;

    return false;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/catalogo-venditori')}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-slate-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-7 h-7 text-blue-400" />
                  Ordini e Preventivi
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Visualizza e gestisci tutti gli ordini
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchOrders(selectedPeriod)}
              disabled={loading}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              title="Aggiorna"
            >
              <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Period Filter Buttons */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Filtra per Periodo
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedPeriod('week')}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                selectedPeriod === 'week'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              Ultima Settimana
            </button>
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                selectedPeriod === 'month'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              Ultimo Mese
            </button>
            <button
              onClick={() => setSelectedPeriod('3months')}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                selectedPeriod === '3months'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              Ultimi 3 Mesi
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per numero ordine (es. S34804) o nome cliente (es. Imperial Food)..."
              className="w-full pl-12 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              style={{
                fontSize: '16px',
                lineHeight: '1.5',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded transition-colors"
                title="Cancella ricerca"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-slate-400 mt-2">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'risultato trovato' : 'risultati trovati'}
            </p>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Totale Ordini</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.total_orders}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Preventivi</p>
                  <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.draft_orders}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Confermati</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{stats.confirmed_orders}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Totale</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    CHF {stats.total_amount.toFixed(2)}
                  </p>
                </div>
                <div className="text-3xl">💰</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Caricamento ordini...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-500 font-semibold">❌ {error}</p>
          </div>
        )}

        {/* Orders List */}
        {!loading && !error && filteredOrders.length === 0 && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {searchQuery ? 'Nessun risultato' : 'Nessun ordine trovato'}
            </h3>
            <p className="text-slate-400">
              {searchQuery
                ? `Nessun ordine corrisponde alla ricerca "${searchQuery}"`
                : 'Non ci sono ordini per il periodo selezionato.'}
            </p>
          </div>
        )}

        {!loading && !error && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const stateInfo = getStateInfo(order.state);
              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderClick(order.id)}
                  className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 p-4 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                          {order.name}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${stateInfo.color}`}>
                          {stateInfo.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="font-semibold text-slate-300">Cliente:</span>
                          <span>{order.partner_name}</span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(order.date)}</span>
                        </div>

                        {order.delivery_date && (
                          <div className="flex items-center gap-2 text-blue-400">
                            <span className="font-semibold">Consegna:</span>
                            <span>{formatDate(order.delivery_date)}</span>
                          </div>
                        )}
                      </div>

                      {/* Salesperson - small and discrete */}
                      <div className="mt-2 text-xs text-slate-500">
                        Inserito da: {order.salesperson}
                      </div>
                    </div>

                    {/* Order Total */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-slate-400 mb-1">Totale</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        CHF {order.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
