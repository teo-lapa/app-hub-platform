'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import {
  TruckIcon,
  MapPinIcon,
  ClockIcon,
  ArrowLeftIcon,
  UserIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface Product {
  id: number;
  productName: string;
  quantityOrdered: number;
  quantityDone: number;
  uom: string;
  state: string;
}

interface GPSPosition {
  lat: number;
  lng: number;
  timestamp: string;
}

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
  // deliveryMan: string | null; // REMOVED: campo custom
  note: string;
  products: Product[];
  gpsPosition: GPSPosition | null;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: 41.9028,
  lng: 12.4964, // Roma
};

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = params.id as string;

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const fetchDeliveryDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/portale-clienti/deliveries/${deliveryId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Errore durante il caricamento della consegna');
      }

      setDelivery(data.delivery);

      // Imposta centro mappa su posizione GPS se disponibile
      if (data.delivery.gpsPosition) {
        setMapCenter({
          lat: data.delivery.gpsPosition.lat,
          lng: data.delivery.gpsPosition.lng,
        });
      }
    } catch (err: any) {
      console.error('Errore fetch delivery:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    fetchDeliveryDetail();
  }, [fetchDeliveryDetail]);

  // Auto-refresh GPS position every 30 seconds if delivery is in progress
  useEffect(() => {
    if (!delivery || delivery.state !== 'assigned') return;

      const interval = setInterval(() => {
        fetchDeliveryDetail();
      }, 30000); // 30 secondi

      return () => clearInterval(interval);
  }, [delivery, fetchDeliveryDetail]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Caricamento consegna...</p>
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
          <p className="text-red-600 mb-4">{error || 'Consegna non trovata'}</p>
          <button
            onClick={() => router.push('/portale-clienti/consegne')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Torna alle consegne
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back Button */}
        <button
          onClick={() => router.push('/portale-clienti/consegne')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>Torna alle consegne</span>
        </button>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{delivery.name}</h1>
              <p className="text-gray-600">
                {delivery.origin ? `Ordine: ${delivery.origin}` : 'Consegna diretta'}
              </p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStateColor(delivery.state)}`}>
              {delivery.stateLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <ClockIcon className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">
                  {delivery.dateDone ? 'Consegnata il' : 'Prevista per'}
                </p>
                <p className="font-medium text-gray-900">
                  {formatDate(delivery.dateDone || delivery.scheduledDate)}
                </p>
              </div>
            </div>

            {delivery.trackingRef && (
              <div className="flex items-center gap-3">
                <TruckIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Tracking</p>
                  <p className="font-medium text-gray-900 font-mono text-sm">{delivery.trackingRef}</p>
                </div>
              </div>
            )}

            {delivery.locationDest && (
              <div className="flex items-center gap-3">
                <MapPinIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Destinazione</p>
                  <p className="font-medium text-gray-900">{delivery.locationDest}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Google Maps Tracking */}
        {delivery.state === 'assigned' && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPinIcon className="w-5 h-5" />
              Tracciamento in Tempo Reale
            </h2>

            {GOOGLE_MAPS_API_KEY ? (
              <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={14}
                  options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                  }}
                >
                  {delivery.gpsPosition && (
                    <Marker
                      position={{
                        lat: delivery.gpsPosition.lat,
                        lng: delivery.gpsPosition.lng,
                      }}
                      icon={{
                        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iIzM1ODRGRiIvPgogIDxwYXRoIGQ9Ik0yMCAxMEMxNi42ODYzIDEwIDEzLjk5OTkgMTIuNjg2MyAxMy45OTk5IDE2QzEzLjk5OTkgMjAgMjAgMjggMjAgMjhDMjAgMjggMjYgMjAgMjYgMTZDMjYgMTIuNjg2MyAyMy4zMTM3IDEwIDIwIDEwWk0yMCAxOEMxOC44OTU0IDE4IDE3Ljk5OTkgMTcuMTA0NSAxNy45OTk5IDE2QzE3Ljk5OTkgMTQuODk1NCAxOC44OTU0IDE0IDIwIDE0QzIxLjEwNDYgMTQgMjIgMTQuODk1NCAyMiAxNkMyMiAxNy4xMDQ1IDIxLjEwNDYgMTggMjAgMThaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
                        scaledSize: new google.maps.Size(40, 40),
                      }}
                    />
                  )}
                </GoogleMap>
              </LoadScript>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <MapPinIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Google Maps non configurato</p>
                <p className="text-sm text-gray-500 mt-2">
                  Configurare NEXT_PUBLIC_GOOGLE_MAPS_API_KEY per abilitare il tracking
                </p>
              </div>
            )}

            {delivery.gpsPosition && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  📍 Ultima posizione aggiornata: {formatDate(delivery.gpsPosition.timestamp)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  L'autista si trova vicino alla tua destinazione
                </p>
              </div>
            )}

            {!delivery.gpsPosition && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Posizione GPS non disponibile
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Il tracciamento verrà attivato quando l'autista avvia la consegna
                </p>
              </div>
            )}
          </div>
        )}

        {/* Products List */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CubeIcon className="w-5 h-5" />
            Prodotti ({delivery.products.length})
          </h2>

          {delivery.products.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nessun prodotto nella consegna</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Prodotto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantità Ordinata
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantità Consegnata
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Stato
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {delivery.products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{product.productName}</p>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">
                        {product.quantityOrdered} {product.uom}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">
                        {product.quantityDone} {product.uom}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {product.state === 'done' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            Consegnato
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            In attesa
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes */}
        {delivery.note && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Note</h3>
            <p className="text-gray-600">{delivery.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
