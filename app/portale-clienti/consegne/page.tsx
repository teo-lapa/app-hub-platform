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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">

        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Le Mie Consegne</h1>
          <p className="text-sm sm:text-base text-gray-600">Traccia le tue consegne in tempo reale</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TruckIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Totale Consegne</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{deliveries.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ClockIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">In Consegna</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{activeCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Consegnate</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{completedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tutte
            </button>
            <button
              onClick={() => setFilter('assigned')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
                filter === 'assigned'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">In Consegna ({activeCount})</span>
              <span className="sm:hidden">In corso ({activeCount})</span>
            </button>
            <button
              onClick={() => setFilter('done')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
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
          <div className="text-center py-8 sm:py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-blue-600"></div>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Caricamento consegne...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-sm sm:text-base text-red-800">{error}</p>
          </div>
        )}

        {!loading && !error && filteredDeliveries.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 sm:p-12 text-center border border-gray-200">
            <TruckIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-600">Nessuna consegna trovata</p>
          </div>
        )}

        {!loading && !error && filteredDeliveries.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {filteredDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                onClick={() => router.push(`/portale-clienti/consegne/${delivery.id}`)}
                className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-2">
                  <div className="flex items-start gap-2 sm:gap-3 md:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TruckIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{delivery.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        {delivery.origin ? `Ordine: ${delivery.origin}` : 'Consegna diretta'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-medium ${getStateColor(delivery.state)} w-fit flex-shrink-0`}>
                    {delivery.stateLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 truncate">
                      {delivery.dateDone
                        ? `${formatDate(delivery.dateDone)}`
                        : `${formatDate(delivery.scheduledDate)}`
                      }
                    </span>
                  </div>

                  {delivery.deliveryMan && (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                      <TruckIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 truncate">
                        <span className="hidden sm:inline">Autista: </span>{delivery.deliveryMan}
                      </span>
                    </div>
                  )}

                  {delivery.locationDest && (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm col-span-1 sm:col-span-2 md:col-span-1">
                      <MapPinIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 truncate">{delivery.locationDest}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <span className="text-gray-600">{delivery.itemsCount} prodotti</span>
                  </div>
                </div>

                {delivery.trackingRef && (
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      Tracking: <span className="font-mono font-medium text-gray-900">{delivery.trackingRef}</span>
                    </p>
                  </div>
                )}

                <div className="mt-3 sm:mt-4">
                  <button className="text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm flex items-center gap-1">
                    <span className="hidden sm:inline">Vedi dettagli e mappa →</span>
                    <span className="sm:hidden">Dettagli →</span>
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
