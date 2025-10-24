/**
 * INVOICE STATS COMPONENT
 *
 * Displays key invoice metrics with visual indicators
 * - Total amount due (unpaid)
 * - Total overdue amount (with alert styling)
 * - Number of overdue invoices
 * - Paid vs unpaid counts
 */

'use client';

import React from 'react';
import type { InvoiceStats } from '@/types/invoice';

interface InvoiceStatsProps {
  stats: InvoiceStats;
  loading?: boolean;
}

export function InvoiceStats({ stats, loading }: InvoiceStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Amount Due */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Totale Dovuto</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(stats.totalAmount)}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {stats.unpaidCount} fatture da pagare
        </p>
      </div>

      {/* Overdue Amount - Alert Style */}
      <div
        className={`bg-white rounded-lg shadow p-6 border-l-4 ${
          stats.overdueCount > 0 ? 'border-red-500' : 'border-green-500'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Scadute</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                stats.overdueCount > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {formatCurrency(stats.totalOverdue)}
            </p>
          </div>
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              stats.overdueCount > 0 ? 'bg-red-100' : 'bg-green-100'
            }`}
          >
            {stats.overdueCount > 0 ? (
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>
        </div>
        <p
          className={`text-xs mt-2 ${
            stats.overdueCount > 0 ? 'text-red-500 font-medium' : 'text-green-500'
          }`}
        >
          {stats.overdueCount > 0
            ? `${stats.overdueCount} fatture scadute`
            : 'Nessuna fattura scaduta'}
        </p>
      </div>

      {/* Paid Invoices Count */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Fatture Pagate</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.paidCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Completamente saldate</p>
      </div>

      {/* Unpaid Invoices Count */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Da Pagare</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.unpaidCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">In attesa di pagamento</p>
      </div>
    </div>
  );
}
