'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Phone, Clock, Image as ImageIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import ETABadge from '@/components/portale-clienti/ETABadge';

const DeliveryTracker = dynamic(
  () => import('@/components/portale-clienti/DeliveryTracker'),
  { ssr: false }
);

interface DeliveryDetail {
  id: number;
  name: string;
  scheduled_date: string;
  state: string;
  origin?: string;
  note?: string;
  delivery_status: string;
  estimated_arrival: string;
  customer: {
    id: number;
    name: string;
    street: string;
    city: string;
    zip: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  warehouse: {
    latitude: number;
    longitude: number;
  };
  products: Array<{
    id: number;
    product_id: number;
    product_name: string;
    product_code?: string;
    product_image?: string;
    quantity: number;
    quantity_done: number;
    uom: string;
    state: string;
  }>;
  photos: Array<{
    id: number;
    name: string;
    url: string;
    created_at: string;
  }>;
  total_items: number;
}

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = params.id as string;

  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEta, setCurrentEta] = useState<any>(null);
  const [currentPosition, setCurrentPosition] = useState<any>(null);

  const fetchDeliveryDetail = async () => {
    try {
      const response = await fetch(`/api/portale-clienti/deliveries/${deliveryId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch delivery details');
      }

      const data = await response.json();

      if (data.success) {
        setDelivery(data.delivery);
        setError(null);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error fetching delivery detail:', err);
      setError(err.message || 'Errore durante il caricamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryDetail();
  }, [deliveryId]);

  const handlePositionUpdate = useCallback((position: any, eta: any) => {
    setCurrentPosition(position);
    setCurrentEta(eta);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Caricamento dettagli consegna...</p>
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h3 className="text-red-900 font-semibold mb-2">Errore</h3>
            <p className="text-red-700 mb-4">{error || 'Consegna non trovata'}</p>
            <button
              onClick={() => router.push('/portale-clienti/consegne')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Torna alle consegne
            </button>
          </div>
        </div>
      </div>
    );
  }

  const etaMinutes = currentEta?.minutes || 45;
  const distanceKm = currentPosition?.distance?.remaining_km || 12.5;
  const etaStatus = etaMinutes < 15 ? 'near' : 'on_time';

  return (
    <div className="min-h-screen bg-gray-50">
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => router.push('/portale-clienti/consegne')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Torna alle consegne</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {delivery.name}
            </h1>
            <p className="text-gray-600">
              Consegna per {delivery.customer.name}
            </p>
          </div>
          {currentEta && (
            <ETABadge
              etaMinutes={etaMinutes}
              distanceKm={distanceKm}
              status={etaStatus}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
              <DeliveryTracker
                deliveryId={parseInt(deliveryId)}
                warehouse={delivery.warehouse}
                customer={{
                  latitude: delivery.customer.latitude,
                  longitude: delivery.customer.longitude,
                }}
                autoRefresh={true}
                refreshInterval={30000}
                onPositionUpdate={handlePositionUpdate}
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600" />
                Prodotti ({delivery.products.length})
              </h2>
              <div className="space-y-3">
                {delivery.products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    {product.product_image ? (
                      <img
                        src={product.product_image}
                        alt={product.product_name}
                        className="w-16 h-16 object-cover rounded border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {product.product_name}
                      </h3>
                      {product.product_code && (
                        <p className="text-sm text-gray-500">
                          Codice: {product.product_code}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {product.quantity} {product.uom}
                      </p>
                      {product.quantity_done > 0 && (
                        <p className="text-sm text-green-600">
                          Preparato: {product.quantity_done}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span className="text-gray-700">Totale articoli:</span>
                  <span className="text-gray-900">{delivery.total_items}</span>
                </div>
              </div>
            </div>

            {delivery.photos.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-blue-600" />
                  Foto consegna ({delivery.photos.length})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {delivery.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square rounded-lg overflow-hidden border border-gray-200"
                    >
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-green-600" />
                Indirizzo consegna
              </h2>
              <div className="space-y-2 text-gray-700">
                <p className="font-semibold">{delivery.customer.name}</p>
                <p>{delivery.customer.street}</p>
                <p>
                  {delivery.customer.zip} {delivery.customer.city}
                </p>
                {delivery.customer.phone && (
                  <div className="flex items-center gap-2 pt-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <a
                      href={`tel:${delivery.customer.phone}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {delivery.customer.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                Dettagli consegna
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Data programmata</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(delivery.scheduled_date).toLocaleDateString(
                      'it-IT',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </p>
                </div>
                {delivery.origin && (
                  <div>
                    <p className="text-sm text-gray-500">Ordine originale</p>
                    <p className="font-semibold text-gray-900">
                      {delivery.origin}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Stato</p>
                  <span
                    className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                      delivery.delivery_status === 'in_transit'
                        ? 'bg-blue-100 text-blue-700'
                        : delivery.delivery_status === 'near_destination'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {delivery.delivery_status === 'in_transit'
                      ? 'In transito'
                      : delivery.delivery_status === 'near_destination'
                      ? 'In arrivo'
                      : 'In preparazione'}
                  </span>
                </div>
                {delivery.note && (
                  <div>
                    <p className="text-sm text-gray-500">Note</p>
                    <p className="text-gray-700">{delivery.note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
