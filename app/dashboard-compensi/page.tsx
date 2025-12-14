'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';

interface ClientInfo {
  id: number;
  name: string;
  first_order_date: string;
  age_months: number;
  revenue_current_month: number;
}

interface SalespersonData {
  id: number;
  name: string;
  email: string;
  revenue_current_month: number;
  revenue_paid: number;
  payment_percentage: number;
  threshold: number;
  threshold_met: boolean;
  bonus: number;
  bonus_theoretical: number;
  bonus_real: number;
  total_clients: number;
  qualified_clients: {
    count: number;
    revenue: number;
    percentage: string;
    list: ClientInfo[];
  };
  too_new_clients: {
    count: number;
    revenue: number;
    percentage: string;
    list: ClientInfo[];
  };
  too_old_clients: {
    count: number;
    revenue: number;
    percentage: string;
    list: ClientInfo[];
  };
}

interface DashboardData {
  period: {
    start: string;
    end: string;
    label: string;
    generated_at: string;
  };
  salespeople: SalespersonData[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function DashboardCompensi() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSalesperson, setSelectedSalesperson] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showAllClients, setShowAllClients] = useState<Record<string, boolean>>({}); // Traccia quali sezioni mostrano tutti i clienti
  const [monthsBack, setMonthsBack] = useState(0); // 0 = mese corrente, 1 = -1 mese, 2 = -2 mesi

  useEffect(() => {
    loadData();
  }, [monthsBack]); // Ricarica quando cambia monthsBack

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/compensi-venditori?monthsBack=${monthsBack}`);

      if (!response.ok) {
        throw new Error('Errore durante il caricamento dei dati');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Errore sconosciuto');
      console.error('Errore caricamento dati:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleShowAll = (key: string) => {
    setShowAllClients((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const displayedSalespeople = selectedSalesperson
    ? data?.salespeople.filter((s) => s.id === selectedSalesperson) || []
    : data?.salespeople || [];

  if (loading) {
    return (
      <div className="min-h-screen-dynamic bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Caricamento dati in corso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen-dynamic bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Errore</h2>
          <p className="text-slate-700 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-dynamic bg-slate-50 pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  Dashboard Compensi Venditori
                </h1>
                {data && (
                  <p className="text-sm text-slate-600 mt-1">
                    Periodo: {data.period.label} ({data.period.start} → {data.period.end}) {monthsBack === 0 && '• LIVE'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Pulsanti navigazione mese */}
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setMonthsBack(0)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    monthsBack === 0
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mese Corrente
                </button>
                <button
                  onClick={() => setMonthsBack(1)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    monthsBack === 1
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  -1 Mese
                </button>
                <button
                  onClick={() => setMonthsBack(2)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    monthsBack === 2
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  -2 Mesi
                </button>
              </div>
              <button
                onClick={loadData}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Aggiorna
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtro Venditori */}
      {data && data.salespeople.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Filtra per venditore</label>
            <select
              value={selectedSalesperson || ''}
              onChange={(e) => setSelectedSalesperson(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full md:w-auto px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutti i venditori</option>
              {data.salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Salespeople Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {displayedSalespeople.map((person) => (
          <div key={person.id} className="bg-white rounded-lg shadow-lg border border-slate-200 p-6">
            {/* Header Card */}
            <div className="pb-6 border-b-2 border-slate-100">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{person.name}</h2>
                  <p className="text-sm text-slate-600">{person.email}</p>
                </div>
                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-500 mb-1">Fatturato Emesso</p>
                    <p
                      className={`text-3xl font-bold ${person.threshold_met ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(person.revenue_current_month)}
                    </p>
                    <span
                      className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${person.threshold_met ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                    >
                      {person.threshold_met ? '✅ Sopra soglia' : '❌ Sotto soglia'} ({formatCurrency(person.threshold)})
                    </span>
                  </div>
                  <div className="text-right border-l-2 border-slate-200 pl-6">
                    <p className="text-xs uppercase text-slate-500 mb-1">Fatturato Pagato</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatCurrency(person.revenue_paid)}
                    </p>
                    <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {person.payment_percentage.toFixed(1)}% Incassato
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar Incassi */}
              <div className="bg-slate-100 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Performance Incassi</span>
                  <span className="text-sm font-bold text-slate-900">{person.payment_percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      person.payment_percentage >= 80
                        ? 'bg-green-500'
                        : person.payment_percentage >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(person.payment_percentage, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Bonus Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                  <p className="text-xs uppercase text-slate-500 mb-1">Bonus Teorico (100% pagato)</p>
                  <p className="text-2xl font-bold text-slate-600">
                    {formatCurrency(person.bonus_theoretical)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
                  <p className="text-xs uppercase text-blue-700 mb-1">💰 Bonus Reale ({person.payment_percentage.toFixed(0)}% pagato)</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(person.bonus_real)}
                  </p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${person.bonus_real > 0 ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
                    {person.bonus_real > 0 ? '🎉 Bonus Attivo' : '⏸️ Nessun Bonus'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs uppercase text-slate-500 mb-1">Clienti Totali</p>
                <p className="text-2xl font-bold text-slate-900">{person.total_clients}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-xs uppercase text-green-700 mb-1">Qualificati (3-11m)</p>
                <p className="text-2xl font-bold text-green-900">{person.qualified_clients.count}</p>
                <p className="text-xs text-green-600 mt-1">
                  {formatCurrency(person.qualified_clients.revenue)} • {person.qualified_clients.percentage}%
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-xs uppercase text-yellow-700 mb-1">Troppo Nuovi (&lt;3m)</p>
                <p className="text-2xl font-bold text-yellow-900">{person.too_new_clients.count}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {formatCurrency(person.too_new_clients.revenue)} • {person.too_new_clients.percentage}%
                </p>
              </div>
              <div className="bg-slate-100 p-4 rounded-lg border border-slate-300">
                <p className="text-xs uppercase text-slate-600 mb-1">Troppo Vecchi (≥12m)</p>
                <p className="text-2xl font-bold text-slate-700">{person.too_old_clients.count}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatCurrency(person.too_old_clients.revenue)} • {person.too_old_clients.percentage}%
                </p>
              </div>
            </div>

            {/* Clienti Qualificati */}
            <ClientsSection
              title="✅ Clienti Qualificati (Contribuiscono al Bonus)"
              clients={
                showAllClients[`qualified-${person.id}`]
                  ? person.qualified_clients.list
                  : person.qualified_clients.list.slice(0, 10)
              }
              count={person.qualified_clients.count}
              bgColor="bg-green-50"
              borderColor="border-green-200"
              expanded={expandedSections[`qualified-${person.id}`]}
              onToggle={() => toggleSection(`qualified-${person.id}`)}
              showMore={person.qualified_clients.count > 10}
              totalCount={person.qualified_clients.count}
              showingAll={showAllClients[`qualified-${person.id}`] || false}
              onToggleShowAll={() => toggleShowAll(`qualified-${person.id}`)}
            />

            {/* Clienti Troppo Nuovi */}
            <ClientsSection
              title="⏳ Clienti Troppo Nuovi (Non Contribuiscono)"
              clients={
                showAllClients[`new-${person.id}`]
                  ? person.too_new_clients.list
                  : person.too_new_clients.list.slice(0, 10)
              }
              count={person.too_new_clients.count}
              bgColor="bg-yellow-50"
              borderColor="border-yellow-200"
              expanded={expandedSections[`new-${person.id}`]}
              onToggle={() => toggleSection(`new-${person.id}`)}
              showMore={person.too_new_clients.count > 10}
              totalCount={person.too_new_clients.count}
              showingAll={showAllClients[`new-${person.id}`] || false}
              onToggleShowAll={() => toggleShowAll(`new-${person.id}`)}
            />

            {/* Clienti Troppo Vecchi */}
            <ClientsSection
              title="📦 Clienti Troppo Vecchi (Non Contribuiscono)"
              clients={
                showAllClients[`old-${person.id}`]
                  ? person.too_old_clients.list
                  : person.too_old_clients.list.slice(0, 10)
              }
              count={person.too_old_clients.count}
              bgColor="bg-slate-50"
              borderColor="border-slate-200"
              expanded={expandedSections[`old-${person.id}`]}
              onToggle={() => toggleSection(`old-${person.id}`)}
              showMore={person.too_old_clients.count > 10}
              totalCount={person.too_old_clients.count}
              showingAll={showAllClients[`old-${person.id}`] || false}
              onToggleShowAll={() => toggleShowAll(`old-${person.id}`)}
            />
          </div>
        ))}
      </div>

      <MobileNavigation />
    </div>
  );
}

interface ClientsSectionProps {
  title: string;
  clients: ClientInfo[];
  count: number;
  bgColor: string;
  borderColor: string;
  expanded: boolean;
  onToggle: () => void;
  showMore?: boolean;
  totalCount?: number;
  showingAll?: boolean;
  onToggleShowAll?: () => void;
}

function ClientsSection({
  title,
  clients,
  count,
  bgColor,
  borderColor,
  expanded,
  onToggle,
  showMore = false,
  totalCount,
  showingAll = false,
  onToggleShowAll,
}: ClientsSectionProps) {
  return (
    <div className={`mt-6 ${bgColor} rounded-lg border ${borderColor} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-opacity-80 transition"
      >
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          {title}
          <span className="px-2 py-1 bg-white rounded-full text-xs font-medium">{count} clienti</span>
        </h3>
        <svg
          className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {clients.length === 0 ? (
            <p className="text-center text-slate-500 italic py-8">Nessun cliente in questa categoria</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 text-xs uppercase text-slate-600 font-semibold">Cliente</th>
                      <th className="text-left py-3 px-2 text-xs uppercase text-slate-600 font-semibold">
                        Primo Ordine
                      </th>
                      <th className="text-left py-3 px-2 text-xs uppercase text-slate-600 font-semibold">Anzianità</th>
                      <th className="text-right py-3 px-2 text-xs uppercase text-slate-600 font-semibold">
                        Fatturato Mese
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-b border-slate-100 hover:bg-white transition">
                        <td className="py-3 px-2 font-medium text-slate-900">{client.name}</td>
                        <td className="py-3 px-2 text-sm text-slate-600">{formatDate(client.first_order_date)}</td>
                        <td className="py-3 px-2">
                          <span className="inline-block px-2 py-1 bg-slate-200 rounded-full text-xs font-medium text-slate-700">
                            {client.age_months} mesi
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-slate-900">
                          {formatCurrency(client.revenue_current_month)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showMore && totalCount && onToggleShowAll && (
                <div className="mt-4 text-center">
                  <button
                    onClick={onToggleShowAll}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition font-medium text-slate-700"
                  >
                    {showingAll ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Mostra meno
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Mostra tutti ({totalCount} clienti)
                      </>
                    )}
                  </button>
                  {!showingAll && (
                    <p className="text-sm text-slate-500 mt-2">
                      Nascosti {totalCount - clients.length} clienti
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
