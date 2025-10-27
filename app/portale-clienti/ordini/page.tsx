'use client';

import React, { useState, useEffect } from 'react';
import { OrderCard } from '@/components/portale-clienti/OrderCard';

interface Order {
  id: number;
  name: string;
  date: string;
  total: number;
  totalUntaxed: number;
  tax: number;
  state: string;
  stateLabel: string;
  productsCount: number;
  invoiceStatus: string;
  deliveryStatus: string;
  salesperson: string;
  commitmentDate: string | null;
  hasNotes: boolean;
}

type PeriodFilter = 'month' | 'quarter' | 'year' | 'custom';

export default function OrdiniPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtri
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('quarter');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Calcola le date in base al periodo selezionato
  const getDateRange = (): { from: string; to: string } => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (periodFilter === 'month') {
      // Questo mese
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        from: firstDay.toISOString().split('T')[0],
        to: lastDay.toISOString().split('T')[0],
      };
    } else if (periodFilter === 'quarter') {
      // Ultimi 3 mesi
      const threeMonthsAgo = new Date(year, month - 3, 1);
      return {
        from: threeMonthsAgo.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };
    } else if (periodFilter === 'year') {
      // Quest'anno
      const firstDay = new Date(year, 0, 1);
      return {
        from: firstDay.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };
    } else {
      // Custom
      return {
        from: customFrom,
        to: customTo,
      };
    }
  };

  // Fetch ordini da API
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { from, to } = getDateRange();

      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (stateFilter) params.append('state', stateFilter);

      const response = await fetch(`/api/portale-clienti/orders?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel caricamento ordini');
      }

      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Errore fetch ordini:', err);
      setError(err.message || 'Errore nel caricamento ordini');
    } finally {
      setLoading(false);
    }
  };

  // Carica ordini all'avvio e quando cambiano i filtri
  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter, stateFilter]);

  // Handler per filtro custom
  const handleCustomDateApply = () => {
    if (customFrom && customTo) {
      fetchOrders();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">I Miei Ordini</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Visualizza e gestisci la cronologia dei tuoi ordini
          </p>
        </div>

        {/* Filtri */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Filtri</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Periodo */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Periodo
              </label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">Questo mese</option>
                <option value="quarter">Ultimi 3 mesi</option>
                <option value="year">Quest&apos;anno</option>
                <option value="custom">Personalizzato</option>
              </select>
            </div>

            {/* Stato */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Stato Ordine
              </label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tutti</option>
                <option value="draft">Preventivi (Bozza)</option>
                <option value="sent">Preventivi (Inviati)</option>
                <option value="sale">Confermati</option>
                <option value="done">Completati</option>
              </select>
            </div>

            {/* Azioni */}
            <div className="flex items-end">
              <button
                onClick={fetchOrders}
                className="w-full px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Aggiorna
              </button>
            </div>
          </div>

          {/* Date custom */}
          {periodFilter === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Data Inizio
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Data Fine
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleCustomDateApply}
                  disabled={!customFrom || !customTo}
                  className="w-full px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Applica Date
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista ordini */}
        {loading ? (
          <div className="flex justify-center items-center py-8 sm:py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 text-center">
            <p className="text-sm sm:text-base text-red-600 font-medium">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-3 sm:mt-4 px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 sm:p-12 text-center">
            <svg
              className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-base sm:text-lg font-medium text-gray-900">
              Nessun ordine trovato
            </h3>
            <p className="mt-1 text-sm sm:text-base text-gray-500">
              Prova a modificare i filtri di ricerca
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-600">
                Trovati <span className="font-semibold">{orders.length}</span> ordini
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
