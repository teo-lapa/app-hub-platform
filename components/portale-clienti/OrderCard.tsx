'use client';

import React from 'react';
import Link from 'next/link';

interface OrderCardProps {
  order: {
    id: number;
    name: string;
    date: string;
    total: number;
    state: string;
    stateLabel: string;
    productsCount: number;
    commitmentDate?: string | null;
  };
}

export function OrderCard({ order }: OrderCardProps) {
  // Formatta la data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Colore badge stato
  const getStateBadgeColor = (state: string) => {
    switch (state) {
      case 'sale':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'cancel':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Info principale */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
            <Link
              href={`/portale-clienti/ordini/${order.id}`}
              className="text-base sm:text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate"
            >
              {order.name}
            </Link>
            <span
              className={`px-2 py-0.5 sm:px-2.5 rounded-full text-xs font-medium ${getStateBadgeColor(
                order.state
              )} w-fit`}
            >
              {order.stateLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="truncate">{formatDate(order.date)}</span>
            </div>

            <div className="flex items-center gap-1">
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <span>{order.productsCount} prod.</span>
            </div>

            {order.commitmentDate && (
              <div className="flex items-center gap-1 text-orange-600 w-full sm:w-auto">
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
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
                <span className="text-xs truncate">
                  <span className="hidden sm:inline">Consegna: </span>
                  {formatDate(order.commitmentDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Totale e azioni */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-3 sm:ml-4">
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {order.total.toLocaleString('it-IT', {
              style: 'currency',
              currency: 'EUR',
            })}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/portale-clienti/ordini/${order.id}`}
              className="px-2 py-1.5 sm:px-3 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              Dettagli
            </Link>
            <button
              onClick={() => {
                // TODO: Implementare copia in carrello
                alert('Funzione riordina in sviluppo');
              }}
              className="px-2 py-1.5 sm:px-3 text-xs sm:text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">Riordina</span>
              <span className="sm:hidden">Riord.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
