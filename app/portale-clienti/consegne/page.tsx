'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TruckIcon, MapPinIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface Delivery {
  id: number;
  name: string;
  scheduledDate: string;
  dateDone: string | null;
  state: string;
  stateLabel: string;
  origin: string;
  partnerName: string;
  locationDest: string;
  trackingRef: string | null;
  deliveryMan: string | null;
  itemsCount: number;
}

export default function ConsegnePage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'assigned' | 'done'>('all');

  useEffect(() => {
    fetchDeliveries();
  }, [filter]);

  async function fetchDeliveries() {
    try {
      setLoading(true);
      setError('');

      const url = filter === 'all'
        ? '/api/portale-clienti/deliveries'
        : `/api/portale-clienti/deliveries?state=${filter}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Errore durante il caricamento delle consegne');
      }

      setDeliveries(data.deliveries || []);
    } catch (err: any) {
      console.error('Errore fetch consegne:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getStateColor(state: string) {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      waiting: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      assigned: 'bg-orange-100 text-orange-700',
      done: 'bg-green-100 text-green-700',
      cancel: 'bg-red-100 text-red-700',
    };
    return colors[state] || 'bg-gray-100 text-gray-700';
  }

  function formatDate(dateString: string) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const filteredDeliveries = deliveries;
  const activeCount = deliveries.filter(d => d.state === 'assigned').length;
  const completedCount = deliveries.filter(d => d.state === 'done').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Le Mie Consegne</h1>
          <p className="text-gray-600">Traccia le tue consegne in tempo reale</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TruckIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Totale Consegne</p>
                <p className="text-2xl font-bold text-gray-900">{deliveries.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">In Consegna</p>
                <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Consegnate</p>
                <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tutte
            </button>
            <button
              onClick={() => setFilter('assigned')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'assigned'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In Consegna ({activeCount})
            </button>
            <button
              onClick={() => setFilter('done')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'done'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Consegnate ({completedCount})
            </button>
          </div>
        </div>

        {/* Deliveries List */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Caricamento consegne...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!loading && !error && filteredDeliveries.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <TruckIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nessuna consegna trovata</p>
          </div>
        )}

        {!loading && !error && filteredDeliveries.length > 0 && (
          <div className="space-y-4">
            {filteredDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                onClick={() => router.push(`/portale-clienti/consegne/${delivery.id}`)}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TruckIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{delivery.name}</h3>
                      <p className="text-sm text-gray-600">
                        {delivery.origin ? `Ordine: ${delivery.origin}` : 'Consegna diretta'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStateColor(delivery.state)}`}>
                    {delivery.stateLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      {delivery.dateDone
                        ? `Consegnata: ${formatDate(delivery.dateDone)}`
                        : `Prevista: ${formatDate(delivery.scheduledDate)}`
                      }
                    </span>
                  </div>

                  {delivery.deliveryMan && (
                    <div className="flex items-center gap-2 text-sm">
                      <TruckIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Autista: {delivery.deliveryMan}</span>
                    </div>
                  )}

                  {delivery.locationDest && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPinIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{delivery.locationDest}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">{delivery.itemsCount} prodotti</span>
                  </div>
                </div>

                {delivery.trackingRef && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      Tracking: <span className="font-mono font-medium text-gray-900">{delivery.trackingRef}</span>
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1">
                    Vedi dettagli e mappa →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
