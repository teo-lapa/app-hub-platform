'use client';

import { useEffect, useState } from 'react';
import { Package, Truck, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import DeliveryCard from '@/components/portale-clienti/DeliveryCard';

interface Delivery {
  id: number;
  name: string;
  scheduled_date: string;
  state: string;
  partner_name: string;
  partner_city?: string;
  move_lines: Array<{
    product_id: [number, string];
    product_qty: number;
  }>;
  delivery_status?: string;
  estimated_arrival?: string;
}

export default function ConsegnePage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'delivered'>('active');
  const [refreshing, setRefreshing] = useState(false);

  const customerId = '123';

  const fetchDeliveries = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(
        `/api/portale-clienti/deliveries?state=${filter}&customerId=${customerId}`
      );

      if (!response.ok) throw new Error('Failed to fetch deliveries');

      const data = await response.json();

      if (data.success) {
        setDeliveries(data.deliveries || []);
        setError(null);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error fetching deliveries:', err);
      setError(err.message || 'Errore durante il caricamento');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [filter]);

  useEffect(() => {
    if (filter !== 'active') return;
    const interval = setInterval(() => {
      fetchDeliveries();
    }, 60000);
    return () => clearInterval(interval);
  }, [filter]);

  const stats = {
    total: deliveries.length,
    in_transit: deliveries.filter((d) => d.delivery_status === 'in_transit').length,
    near: deliveries.filter((d) => d.delivery_status === 'near_destination').length,
    preparing: deliveries.filter((d) => d.delivery_status === 'preparing').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Tracking Consegne
          </h1>
          <p className="text-gray-600">
            Monitora in tempo reale lo stato delle tue consegne
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Truck className="w-4 h-4 inline mr-2" />
                Attive ({stats.in_transit + stats.preparing})
              </button>
              <button
                onClick={() => setFilter('delivered')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'delivered'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Consegnate
              </button>
            </div>

            <button
              onClick={fetchDeliveries}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>
          </div>
        </div>

        {filter === 'active' && stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">In transito</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.in_transit}</p>
                </div>
                <Truck className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">In arrivo</p>
                  <p className="text-2xl font-bold text-green-900">{stats.near}</p>
                </div>
                <Package className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-medium">In preparazione</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.preparing}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Caricamento consegne...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-900 font-semibold mb-1">Errore caricamento</h3>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={fetchDeliveries}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Riprova
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && deliveries.length === 0 && (
          <div className="bg-white rounded-lg border-2 border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nessuna consegna {filter === 'active' ? 'attiva' : 'recente'}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'active'
                ? 'Non ci sono consegne in corso al momento'
                : 'Non ci sono consegne completate negli ultimi 7 giorni'}
            </p>
            {filter === 'delivered' && (
              <button
                onClick={() => setFilter('active')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Vedi consegne attive
              </button>
            )}
          </div>
        )}

        {!loading && !error && deliveries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
