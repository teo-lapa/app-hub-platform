'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Truck, Loader2 } from 'lucide-react';

interface Position {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
}

interface DeliveryTrackerProps {
  deliveryId: number;
  warehouse: Position;
  customer: Position;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onPositionUpdate?: (position: Position, eta: any) => void;
}

export default function DeliveryTracker({
  deliveryId,
  warehouse,
  customer,
  autoRefresh = true,
  refreshInterval = 30000,
  onPositionUpdate,
}: DeliveryTrackerProps) {
  const [vehiclePosition, setVehiclePosition] = useState<Position | null>(null);
  const [eta, setEta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPosition = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        warehouseLat: warehouse.latitude.toString(),
        warehouseLng: warehouse.longitude.toString(),
        customerLat: customer.latitude.toString(),
        customerLng: customer.longitude.toString(),
      });

      const response = await fetch(
        `/api/portale-clienti/deliveries/${deliveryId}/gps-position?${params}`
      );

      if (!response.ok) throw new Error('Failed to fetch GPS position');

      const data = await response.json();

      if (data.success) {
        setVehiclePosition(data.position);
        setEta(data.eta);
        if (onPositionUpdate) onPositionUpdate(data.position, data.eta);

        if (vehicleMarkerRef.current && mapInstanceRef.current) {
          vehicleMarkerRef.current.setLatLng([
            data.position.latitude,
            data.position.longitude,
          ]);
          mapInstanceRef.current.panTo([
            data.position.latitude,
            data.position.longitude,
          ]);
        }
      }
    } catch (error) {
      console.error('Error fetching GPS position:', error);
    }
  }, [deliveryId, warehouse, customer, onPositionUpdate]);

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).L) {
      setMapError('Caricamento mappa...');
      const timer = setTimeout(() => {
        if (!(window as any).L) setMapError('Mappa non disponibile. Ricarica la pagina.');
      }, 2000);
      return () => clearTimeout(timer);
    }

    const L = (window as any).L;
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      const centerLat = (warehouse.latitude + customer.latitude) / 2;
      const centerLng = (warehouse.longitude + customer.longitude) / 2;
      const map = L.map(mapRef.current).setView([centerLat, centerLng], 8);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      const warehouseIcon = L.divIcon({
        html: '<div class="flex items-center justify-center w-10 h-10 bg-purple-600 rounded-full border-4 border-white shadow-lg"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg></div>',
        className: 'custom-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([warehouse.latitude, warehouse.longitude], { icon: warehouseIcon })
        .addTo(map)
        .bindPopup('<strong>Magazzino LAPA</strong><br>Punto di partenza');

      const customerIcon = L.divIcon({
        html: '<div class="flex items-center justify-center w-10 h-10 bg-green-600 rounded-full border-4 border-white shadow-lg"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>',
        className: 'custom-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      L.marker([customer.latitude, customer.longitude], { icon: customerIcon })
        .addTo(map)
        .bindPopup('<strong>Destinazione</strong><br>Il tuo indirizzo');

      const vehicleIcon = L.divIcon({
        html: '<div class="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full border-4 border-white shadow-xl animate-pulse"><svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>',
        className: 'custom-marker-vehicle',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const vehicleMarker = L.marker([warehouse.latitude, warehouse.longitude], {
        icon: vehicleIcon,
      }).addTo(map);

      vehicleMarkerRef.current = vehicleMarker;
      mapInstanceRef.current = map;

      const bounds = L.latLngBounds([
        [warehouse.latitude, warehouse.longitude],
        [customer.latitude, customer.longitude],
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });

      setLoading(false);
      setMapError(null);
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('Errore caricamento mappa');
      setLoading(false);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        vehicleMarkerRef.current = null;
      }
    };
  }, [warehouse, customer]);

  useEffect(() => {
    fetchPosition();
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchPosition, refreshInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPosition, autoRefresh, refreshInterval]);

  useEffect(() => {
    if (!mapInstanceRef.current || !vehiclePosition) return;

    const L = (window as any).L;

    if ((mapInstanceRef.current as any)._routeLine) {
      (mapInstanceRef.current as any)._routeLine.remove();
    }

    const routeLine = L.polyline(
      [
        [warehouse.latitude, warehouse.longitude],
        [vehiclePosition.latitude, vehiclePosition.longitude],
      ],
      { color: '#3b82f6', weight: 4, opacity: 0.7, dashArray: '10, 10' }
    ).addTo(mapInstanceRef.current);

    (mapInstanceRef.current as any)._routeLine = routeLine;

    const remainingLine = L.polyline(
      [
        [vehiclePosition.latitude, vehiclePosition.longitude],
        [customer.latitude, customer.longitude],
      ],
      { color: '#94a3b8', weight: 2, opacity: 0.5, dashArray: '5, 10' }
    ).addTo(mapInstanceRef.current);

    (mapInstanceRef.current as any)._remainingLine = remainingLine;

    return () => {
      if ((mapInstanceRef.current as any)._routeLine) {
        (mapInstanceRef.current as any)._routeLine.remove();
      }
      if ((mapInstanceRef.current as any)._remainingLine) {
        (mapInstanceRef.current as any)._remainingLine.remove();
      }
    };
  }, [vehiclePosition, warehouse, customer]);

  if (mapError) {
    return (
      <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden border-2 border-gray-200">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 bg-purple-600 rounded-full border-2 border-white" />
          <span className="text-gray-700">Magazzino</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white" />
          <span className="text-gray-700">Furgone</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 bg-green-600 rounded-full border-2 border-white" />
          <span className="text-gray-700">Destinazione</span>
        </div>
      </div>
      {vehiclePosition && vehiclePosition.speed && (
        <div className="absolute top-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-3 z-[1000]">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            <div className="text-sm">
              <div className="font-semibold">{vehiclePosition.speed} km/h</div>
              <div className="text-xs opacity-90">Velocita attuale</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
