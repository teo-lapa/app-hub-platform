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
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        {/* Info principale */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href={`/portale-clienti/ordini/${order.id}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {order.name}
            </Link>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateBadgeColor(
                order.state
              )}`}
            >
              {order.stateLabel}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
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
              <span>{formatDate(order.date)}</span>
            </div>

            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
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
              <span>{order.productsCount} prodotti</span>
            </div>

            {order.commitmentDate && (
              <div className="flex items-center gap-1 text-orange-600">
                <svg
                  className="w-4 h-4"
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
                <span className="text-xs">
                  Consegna prevista: {formatDate(order.commitmentDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Totale e azioni */}
        <div className="text-right ml-4">
          <div className="text-2xl font-bold text-gray-900 mb-2">
            {order.total.toLocaleString('it-IT', {
              style: 'currency',
              currency: 'EUR',
            })}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/portale-clienti/ordini/${order.id}`}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              Dettagli
            </Link>
            <button
              onClick={() => {
                // TODO: Implementare copia in carrello
                alert('Funzione riordina in sviluppo');
              }}
              className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
            >
              Riordina
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
