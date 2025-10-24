'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { OrderTimeline } from '@/components/portale-clienti/OrderTimeline';
import { OrderProductsTable } from '@/components/portale-clienti/OrderProductsTable';

interface OrderDetail {
  id: number;
  name: string;
  clientReference: string | null;
  dateOrder: string;
  dateCreated: string;
  dateUpdated: string;
  commitmentDate: string | null;
  state: string;
  stateLabel: string;
  invoiceStatus: string;
  deliveryStatus: string;
  amountTotal: number;
  amountUntaxed: number;
  amountTax: number;
  customer: string;
  customerId: number | null;
  shippingAddress: string | null;
  salesperson: string;
  note: string | null;
  products: any[];
  invoices: any[];
  deliveries: any[];
  timeline: any[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/portale-clienti/orders/${orderId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Errore nel caricamento ordine');
        }

        setOrder(data.order);
      } catch (err: any) {
        console.error('Errore fetch ordine:', err);
        setError(err.message || 'Errore nel caricamento ordine');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [orderId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
    });
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">{error || 'Ordine non trovato'}</p>
            <Link
              href="/portale-clienti/ordini"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Torna agli ordini
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center text-sm text-gray-600">
          <Link href="/portale-clienti/ordini" className="hover:text-blue-600">
            I Miei Ordini
          </Link>
          <svg
            className="w-4 h-4 mx-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-gray-900 font-medium">{order.name}</span>
        </nav>

        {/* Header ordine */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Ordine {order.name}
              </h1>
              {order.clientReference && (
                <p className="text-sm text-gray-600">
                  Riferimento cliente: <span className="font-medium">{order.clientReference}</span>
                </p>
              )}
            </div>

            <span
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStateBadgeColor(
                order.state
              )}`}
            >
              {order.stateLabel}
            </span>
          </div>

          {/* Info riepilogo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Data Ordine</p>
              <p className="text-base font-medium text-gray-900">
                {formatDate(order.dateOrder)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Totale</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(order.amountTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Venditore</p>
              <p className="text-base font-medium text-gray-900">
                {order.salesperson}
              </p>
            </div>

            {order.commitmentDate && (
              <div>
                <p className="text-sm text-gray-600">Consegna Prevista</p>
                <p className="text-base font-medium text-orange-600">
                  {formatDate(order.commitmentDate)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Griglia principale */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonna sinistra - Dettagli */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prodotti */}
            <OrderProductsTable
              products={order.products}
              amountUntaxed={order.amountUntaxed}
              amountTax={order.amountTax}
              amountTotal={order.amountTotal}
            />

            {/* Note */}
            {order.note && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Note Ordine</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{order.note}</p>
              </div>
            )}
          </div>

          {/* Colonna destra - Timeline e info aggiuntive */}
          <div className="space-y-6">
            {/* Timeline */}
            <OrderTimeline events={order.timeline} />

            {/* Fatture */}
            {order.invoices && order.invoices.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Fatture</h3>
                <div className="space-y-3">
                  {order.invoices.map((invoice: any) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {invoice.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(invoice.date)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {invoice.paymentStateLabel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(invoice.amount)}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            invoice.state === 'posted'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {invoice.stateLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Consegne */}
            {order.deliveries && order.deliveries.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Consegne</h3>
                <div className="space-y-3">
                  {order.deliveries.map((delivery: any) => (
                    <div
                      key={delivery.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">
                          {delivery.name}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            delivery.state === 'done'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {delivery.stateLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Destinazione: {delivery.destination}
                      </p>
                      {delivery.trackingRef && (
                        <p className="text-xs text-blue-600 mt-1">
                          Tracking: {delivery.trackingRef}
                        </p>
                      )}
                      {delivery.doneDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Completata: {formatDate(delivery.doneDate)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info indirizzo spedizione */}
            {order.shippingAddress && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Indirizzo Spedizione
                </h3>
                <p className="text-sm text-gray-700">{order.shippingAddress}</p>
              </div>
            )}
          </div>
        </div>

        {/* Azioni */}
        <div className="mt-6 flex gap-3">
          <Link
            href="/portale-clienti/ordini"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
          >
            Torna agli ordini
          </Link>
          <button
            onClick={() => {
              alert('Funzione stampa in sviluppo');
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Stampa Ordine
          </button>
          <button
            onClick={() => {
              alert('Funzione riordina in sviluppo');
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
          >
            Riordina
          </button>
        </div>
      </div>
    </div>
  );
}
