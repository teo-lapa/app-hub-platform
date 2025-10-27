'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface Invoice {
  id: number;
  name: string;
  invoiceDate: string;
  invoiceDateDue: string | null;
  amountTotal: number;
  amountUntaxed: number;
  amountTax: number;
  amountResidual: number;
  state: string;
  paymentState: string;
  paymentStateLabel: string;
  isOverdue: boolean;
  linesCount: number;
  paymentTerm: string;
  currency: string;
}

type PeriodFilter = 'month' | 'quarter' | 'year' | 'custom';
type StateFilter = 'all' | 'not_paid' | 'paid' | 'overdue';

export default function FatturePage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtri
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('quarter');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Calcola le date in base al periodo selezionato
  const getDateRange = (): { from: string; to: string } => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (periodFilter === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        from: firstDay.toISOString().split('T')[0],
        to: lastDay.toISOString().split('T')[0],
      };
    } else if (periodFilter === 'quarter') {
      const threeMonthsAgo = new Date(year, month - 3, 1);
      return {
        from: threeMonthsAgo.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };
    } else if (periodFilter === 'year') {
      const firstDay = new Date(year, 0, 1);
      return {
        from: firstDay.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };
    } else {
      return {
        from: customFrom,
        to: customTo,
      };
    }
  };

  // Fetch fatture da API
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { from, to } = getDateRange();

      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (stateFilter !== 'all') params.append('state', stateFilter);

      const response = await fetch(`/api/portale-clienti/invoices?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel caricamento fatture');
      }

      setInvoices(data.invoices || []);
    } catch (err: any) {
      console.error('Errore fetch fatture:', err);
      setError(err.message || 'Errore nel caricamento fatture');
    } finally {
      setLoading(false);
    }
  };

  // Carica fatture all'avvio e quando cambiano i filtri
  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter, stateFilter]);

  // Handler per filtro custom
  const handleCustomDateApply = () => {
    if (customFrom && customTo) {
      fetchInvoices();
    }
  };

  // Formatta data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Formatta importo
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Colori badge stato pagamento
  const getPaymentStateColor = (invoice: Invoice) => {
    if (invoice.isOverdue) {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    switch (invoice.paymentState) {
      case 'paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'not_paid':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'partial':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'in_payment':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Icona stato pagamento
  const getPaymentStateIcon = (invoice: Invoice) => {
    if (invoice.isOverdue) {
      return <ExclamationCircleIcon className="w-4 h-4" />;
    }

    switch (invoice.paymentState) {
      case 'paid':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'not_paid':
      case 'partial':
      case 'in_payment':
        return <ClockIcon className="w-4 h-4" />;
      default:
        return <DocumentTextIcon className="w-4 h-4" />;
    }
  };

  // Stats
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amountTotal, 0);
  const paidInvoices = invoices.filter(inv => inv.paymentState === 'paid').length;
  const openInvoices = invoices.filter(inv => inv.paymentState !== 'paid').length;
  const overdueInvoices = invoices.filter(inv => inv.isOverdue).length;

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Le Mie Fatture</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Visualizza e gestisci le tue fatture
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Totale</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{totalInvoices}</p>
              </div>
              <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Aperte</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">{openInvoices}</p>
              </div>
              <ClockIcon className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Pagate</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{paidInvoices}</p>
              </div>
              <CheckCircleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Scadute</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">{overdueInvoices}</p>
              </div>
              <ExclamationCircleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Filtri */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FunnelIcon className="w-5 h-5" />
              Filtri
            </h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden text-sm text-blue-600 font-medium"
            >
              {showFilters ? 'Nascondi' : 'Mostra'}
            </button>
          </div>

          <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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

              {/* Stato Pagamento */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Stato
                </label>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value as StateFilter)}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tutte</option>
                  <option value="not_paid">Aperte</option>
                  <option value="paid">Pagate</option>
                  <option value="overdue">Scadute</option>
                </select>
              </div>

              {/* Azioni */}
              <div className="flex items-end sm:col-span-2 md:col-span-2">
                <button
                  onClick={fetchInvoices}
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
        </div>

        {/* Lista fatture */}
        {loading ? (
          <div className="flex justify-center items-center py-8 sm:py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 text-center">
            <p className="text-sm sm:text-base text-red-600 font-medium">{error}</p>
            <button
              onClick={fetchInvoices}
              className="mt-3 sm:mt-4 px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 sm:p-12 text-center">
            <DocumentTextIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
            <h3 className="mt-2 text-base sm:text-lg font-medium text-gray-900">
              Nessuna fattura trovata
            </h3>
            <p className="mt-1 text-sm sm:text-base text-gray-500">
              Prova a modificare i filtri di ricerca
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-600">
                Trovate <span className="font-semibold">{invoices.length}</span> fatture
                {totalAmount > 0 && (
                  <span className="ml-2">
                    · Totale: <span className="font-semibold">{formatAmount(totalAmount)}</span>
                  </span>
                )}
              </p>
            </div>

            {/* Tabella Desktop */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numero
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Emissione
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scadenza
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/portale-clienti/fatture/${invoice.id}`)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{invoice.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(invoice.invoiceDateDue)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {formatAmount(invoice.amountTotal)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getPaymentStateColor(invoice)}`}>
                          {getPaymentStateIcon(invoice)}
                          {invoice.paymentStateLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/portale-clienti/fatture/${invoice.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1 mx-auto"
                        >
                          Dettaglio
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards Mobile */}
            <div className="md:hidden space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => router.push(`/portale-clienti/fatture/${invoice.id}`)}
                  className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">{invoice.name}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getPaymentStateColor(invoice)}`}>
                      {getPaymentStateIcon(invoice)}
                      {invoice.paymentStateLabel}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Emissione:</span>
                      <span className="font-medium text-gray-900">{formatDate(invoice.invoiceDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Scadenza:</span>
                      <span className="font-medium text-gray-900">{formatDate(invoice.invoiceDateDue)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-100">
                      <span className="text-gray-600">Importo:</span>
                      <span className="font-bold text-gray-900">{formatAmount(invoice.amountTotal)}</span>
                    </div>
                  </div>

                  <button className="mt-3 w-full text-center text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Vedi Dettaglio →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
