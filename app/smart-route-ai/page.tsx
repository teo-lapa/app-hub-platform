'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Navigation, MapPin, Clock, TrendingDown, Zap, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface Delivery {
  id: number;
  name: string;
  customer: string;
  address: string;
  lat: number;
  lng: number;
  priority: number;
  estimatedTime: number;
}

interface OptimizedRoute {
  deliveries: Delivery[];
  totalDistance: number;
  totalTime: number;
  savings: {
    distance: number;
    time: number;
  };
}

export default function SmartRouteAIPage() {
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carica le consegne del giorno
  async function loadDeliveries() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/smart-route-ai/deliveries');
      if (!response.ok) throw new Error('Errore caricamento consegne');
      const data = await response.json();
      setDeliveries(data.deliveries || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Ottimizza il percorso con AI
  async function optimizeRoute() {
    if (deliveries.length === 0) {
      setError('Nessuna consegna da ottimizzare');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/smart-route-ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveries })
      });
      if (!response.ok) throw new Error('Errore ottimizzazione percorso');
      const data = await response.json();
      setOptimizedRoute(data.route);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-red-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Navigation className="h-8 w-8" />
                  Smart Route AI
                </h1>
                <p className="text-pink-100 text-sm mt-1">
                  Ottimizzazione percorsi intelligente
                </p>
              </div>
            </div>
            <button
              onClick={loadDeliveries}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Ricarica
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <strong>Errore:</strong> {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-pink-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Consegne Oggi</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{deliveries.length}</p>
              </div>
              <MapPin className="h-12 w-12 text-pink-500 opacity-20" />
            </div>
          </div>

          {optimizedRoute && (
            <>
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-rose-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Distanza Totale</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {optimizedRoute.totalDistance.toFixed(1)} km
                    </p>
                  </div>
                  <TrendingDown className="h-12 w-12 text-rose-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Tempo Stimato</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {Math.round(optimizedRoute.totalTime)} min
                    </p>
                  </div>
                  <Clock className="h-12 w-12 text-red-500 opacity-20" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mb-8">
          <button
            onClick={optimizeRoute}
            disabled={loading || deliveries.length === 0}
            className="w-full md:w-auto bg-gradient-to-r from-pink-600 to-rose-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <Zap className="h-6 w-6" />
            {loading ? 'Ottimizzazione in corso...' : 'Ottimizza Percorso con AI'}
          </button>
        </div>

        {/* Results */}
        {optimizedRoute && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Navigation className="h-6 w-6 text-pink-600" />
              Percorso Ottimizzato
            </h2>

            {/* Savings */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-800 mb-2">💰 Risparmio Stimato:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Distanza risparmiata:</span>
                  <span className="font-bold text-green-900 ml-2">
                    {optimizedRoute.savings.distance.toFixed(1)} km
                  </span>
                </div>
                <div>
                  <span className="text-green-700">Tempo risparmiato:</span>
                  <span className="font-bold text-green-900 ml-2">
                    {Math.round(optimizedRoute.savings.time)} min
                  </span>
                </div>
              </div>
            </div>

            {/* Route Steps */}
            <div className="space-y-3">
              {optimizedRoute.deliveries.map((delivery, index) => (
                <div
                  key={delivery.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{delivery.customer}</h4>
                    <p className="text-sm text-gray-600">{delivery.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Tempo stimato</p>
                    <p className="font-semibold text-gray-900">{delivery.estimatedTime} min</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deliveries List */}
        {!optimizedRoute && deliveries.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Consegne da Ottimizzare
            </h2>
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <MapPin className="h-5 w-5 text-pink-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{delivery.customer}</h4>
                    <p className="text-sm text-gray-600">{delivery.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && deliveries.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Navigation className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nessuna consegna disponibile
            </h3>
            <p className="text-gray-600">
              Non ci sono consegne da ottimizzare per oggi.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
