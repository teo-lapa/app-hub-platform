/**
 * INVOICES PAGE - PORTALE CLIENTI
 *
 * Complete invoice management system:
 * - Display all customer invoices from Odoo
 * - Filter by date range and status
 * - Show KPI cards (total due, overdue amount, counts)
 * - Download PDF invoices
 * - Pay online (future feature)
 *
 * Data: 100% real from Odoo account.move
 */

'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceStats } from '@/components/portale-clienti/InvoiceStats';
import { InvoiceCard } from '@/components/portale-clienti/InvoiceCard';
import type { Invoice, InvoiceStats as IInvoiceStats } from '@/types/invoice';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<IInvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [paymentStateFilter, setPaymentStateFilter] = useState('all');

  // Fetch invoices
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (stateFilter !== 'all') params.set('state', stateFilter);
      if (paymentStateFilter !== 'all') params.set('paymentState', paymentStateFilter);

      const response = await fetch(`/api/portale-clienti/invoices?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();

      setInvoices(data.invoices);
      setStats(data.stats);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  };

  // Load invoices on mount and when filters change
  useEffect(() => {
    fetchInvoices();
  }, [dateFrom, dateTo, stateFilter, paymentStateFilter]);

  // Set default date range (last 12 months)
  useEffect(() => {
    const today = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(today.getMonth() - 12);

    setDateFrom(twelveMonthsAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Le Mie Fatture</h1>
          <p className="text-gray-600 mt-2">
            Visualizza, filtra e scarica le tue fatture
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtri</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Da
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data A
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* State Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stato
              </label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutti</option>
                <option value="draft">Bozza</option>
                <option value="posted">Registrata</option>
                <option value="cancel">Annullata</option>
              </select>
            </div>

            {/* Payment State Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pagamento
              </label>
              <select
                value={paymentStateFilter}
                onChange={(e) => setPaymentStateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tutti</option>
                <option value="not_paid">Da Pagare</option>
                <option value="in_payment">In Pagamento</option>
                <option value="paid">Pagata</option>
                <option value="partial">Parziale</option>
              </select>
            </div>
          </div>

          {/* Reset Filters Button */}
          <div className="mt-4">
            <button
              onClick={() => {
                setStateFilter('all');
                setPaymentStateFilter('all');
                const today = new Date();
                const twelveMonthsAgo = new Date();
                twelveMonthsAgo.setMonth(today.getMonth() - 12);
                setDateFrom(twelveMonthsAgo.toISOString().split('T')[0]);
                setDateTo(today.toISOString().split('T')[0]);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Resetta Filtri
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && <InvoiceStats stats={stats} loading={loading} />}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={fetchInvoices}
              className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="ml-3 text-gray-600">Caricamento fatture...</p>
          </div>
        )}

        {/* Invoices List */}
        {!loading && !error && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Fatture ({invoices.length})
              </h2>
              {invoices.length > 0 && (
                <p className="text-sm text-gray-600">
                  Ultimi {Math.ceil(
                    (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) /
                      (1000 * 60 * 60 * 24 * 30)
                  )}{' '}
                  mesi
                </p>
              )}
            </div>

            {invoices.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
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
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Nessuna fattura trovata
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Non ci sono fatture per i filtri selezionati.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {invoices.map((invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
