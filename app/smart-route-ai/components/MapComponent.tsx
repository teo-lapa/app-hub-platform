'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-polylinedecorator';
import '../leaflet-extensions';

// Config deposito LAPA
const DEPOT = {
  lat: 47.5168872,
  lng: 8.5971149,
  name: "LAPA - Industriestrasse 18, 8424 Embrach"
};

// Colori per i percorsi
const ROUTE_COLORS = [
  '#4f46e5', // indigo
  '#7c3aed', // violet
  '#db2777', // pink
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#ea580c', // orange
  '#8b5cf6', // purple
];

interface Picking {
  id: number;
  name: string;
  partnerId: number;
  partnerName: string;
  address: string;
  lat: number;
  lng: number;
  weight: number;
  scheduledDate: string;
  state: string;
}

interface Vehicle {
  id: number;
  name: string;
  plate: string;
  driver: string;
  capacity: number;
  selected: boolean;
}

interface Route {
  vehicle: Vehicle;
  pickings: Picking[];
  totalWeight: number;
  totalDistance: number;
  geoName?: string;
}

interface MapComponentProps {
  pickings: Picking[];
  routes: Route[];
  vehicles: Vehicle[];
}

export default function MapComponent({ pickings, routes, vehicles }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const depotMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(mapContainerRef.current).setView([DEPOT.lat, DEPOT.lng], 11);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add depot marker
    const depotIcon = L.divIcon({
      className: 'depot-marker',
      html: `
        <div style="
          background: #ef4444;
          color: white;
          padding: 8px;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          font-size: 24px;
          border: 3px solid white;
        ">🏭</div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
    });

    const depotMarker = L.marker([DEPOT.lat, DEPOT.lng], { icon: depotIcon })
      .addTo(map)
      .bindPopup(`<b style="font-size: 14px;">${DEPOT.name}</b><br><span style="font-size: 12px; color: #666;">Punto di partenza</span>`);

    depotMarkerRef.current = depotMarker;
    mapRef.current = map;

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update pickings markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (pickings.length === 0) return;

    // Add new markers
    pickings.forEach((picking, index) => {
      // Find if this picking is in a route
      let routeIndex = -1;
      let routeColor = '#4f46e5'; // default indigo

      routes.forEach((route, rIdx) => {
        if (route.pickings.some(p => p.id === picking.id)) {
          routeIndex = rIdx;
          routeColor = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
        }
      });

      const markerIcon = L.divIcon({
        className: 'picking-marker',
        html: `
          <div style="
            background: ${routeColor};
            color: white;
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            border: 2px solid white;
            min-width: 30px;
            text-align: center;
          ">${routes.length > 0 ? '●' : index + 1}</div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([picking.lat, picking.lng], { icon: markerIcon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="min-width: 200px; font-family: sans-serif;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: ${routeColor};">
              ${picking.name}
            </div>
            <div style="font-size: 13px; margin-bottom: 4px;">
              <strong>Cliente:</strong> ${picking.partnerName}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              📍 ${picking.address}
            </div>
            <div style="font-size: 12px; margin-bottom: 4px;">
              <strong>Peso:</strong> ${picking.weight} kg
            </div>
            <div style="font-size: 12px; color: #666;">
              <strong>Data:</strong> ${new Date(picking.scheduledDate).toLocaleDateString('it-IT')}
            </div>
            ${routeIndex >= 0 ? `
              <div style="
                margin-top: 8px;
                padding: 6px;
                background: ${routeColor};
                color: white;
                border-radius: 4px;
                text-align: center;
                font-size: 12px;
                font-weight: bold;
              ">
                ${routes[routeIndex].geoName || `Percorso ${routeIndex + 1}`}
              </div>
            ` : ''}
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (pickings.length > 0 && depotMarkerRef.current) {
      const bounds = L.latLngBounds([
        [DEPOT.lat, DEPOT.lng],
        ...pickings.map(p => [p.lat, p.lng] as [number, number])
      ]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pickings, routes]);

  // Update route polylines
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing route layers
    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];

    if (routes.length === 0) return;

    // Draw routes
    routes.forEach((route, routeIndex) => {
      const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];

      // Create route coordinates: depot -> pickings -> depot
      const routeCoords: [number, number][] = [
        [DEPOT.lat, DEPOT.lng],
        ...route.pickings.map(p => [p.lat, p.lng] as [number, number]),
        [DEPOT.lat, DEPOT.lng]
      ];

      // Create polyline with arrows
      const polyline = L.polyline(routeCoords, {
        color: color,
        weight: 4,
        opacity: 0.7,
        smoothFactor: 1,
      }).addTo(mapRef.current!);

      // Add decorators for direction arrows
      const decorator = L.polylineDecorator(polyline, {
        patterns: [
          {
            offset: '5%',
            repeat: 100,
            symbol: L.Symbol.arrowHead({
              pixelSize: 12,
              polygon: false,
              pathOptions: {
                stroke: true,
                weight: 3,
                color: color,
                opacity: 0.8
              }
            })
          }
        ]
      } as any).addTo(mapRef.current!);

      // Bind popup to polyline with route info
      polyline.bindPopup(`
        <div style="font-family: sans-serif; min-width: 220px;">
          <div style="
            font-weight: bold;
            font-size: 15px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 2px solid ${color};
            color: ${color};
          ">
            ${route.geoName || `Percorso ${routeIndex + 1}`}
          </div>
          <div style="margin-bottom: 6px;">
            <strong>Veicolo:</strong> ${route.vehicle.name}
          </div>
          <div style="margin-bottom: 6px;">
            <strong>Autista:</strong> ${route.vehicle.driver}
          </div>
          <div style="margin-bottom: 6px;">
            <strong>Consegne:</strong> ${route.pickings.length}
          </div>
          <div style="margin-bottom: 6px;">
            <strong>Peso totale:</strong> ${route.totalWeight} kg
          </div>
          <div style="margin-bottom: 6px;">
            <strong>Distanza:</strong> ${route.totalDistance.toFixed(1)} km
          </div>
          <div style="
            margin-top: 8px;
            padding: 6px;
            background: #f3f4f6;
            border-radius: 4px;
            font-size: 11px;
            color: #6b7280;
          ">
            Tempo stimato: ${Math.round(route.totalDistance / 35 * 60)} min
          </div>
        </div>
      `);

      routeLayersRef.current.push(polyline);
      routeLayersRef.current.push(decorator as any);
    });
  }, [routes]);

  return (
    <>
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      />

      {/* Map Legend */}
      {routes.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'white',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxHeight: '400px',
          overflowY: 'auto',
          minWidth: '250px'
        }}>
          <div style={{
            fontWeight: 'bold',
            marginBottom: '12px',
            fontSize: '14px',
            color: '#1f2937',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '8px'
          }}>
            📊 Legenda Percorsi
          </div>
          {routes.map((route, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '10px',
                padding: '8px',
                background: '#f9fafb',
                borderRadius: '6px',
                border: `2px solid ${ROUTE_COLORS[index % ROUTE_COLORS.length]}20`
              }}
            >
              <div style={{
                width: '4px',
                height: '30px',
                background: ROUTE_COLORS[index % ROUTE_COLORS.length],
                borderRadius: '2px'
              }}></div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                  marginBottom: '2px'
                }}>
                  {route.geoName || `Percorso ${index + 1}`}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#6b7280'
                }}>
                  {route.pickings.length} consegne • {route.totalWeight} kg
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <div style={{ marginBottom: '4px' }}>
          <strong style={{ color: '#1f2937' }}>🏭 Deposito:</strong> LAPA Embrach
        </div>
        <div>
          <strong style={{ color: '#1f2937' }}>📍 Consegne:</strong> {pickings.length}
          {routes.length > 0 && (
            <span style={{ marginLeft: '12px' }}>
              <strong style={{ color: '#1f2937' }}>🚚 Percorsi:</strong> {routes.length}
            </span>
          )}
        </div>
      </div>

      {/* Custom CSS for Leaflet adjustments */}
      <style jsx global>{`
        .leaflet-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .leaflet-popup-content {
          margin: 12px;
          line-height: 1.5;
        }

        .leaflet-popup-tip {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .depot-marker, .picking-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </>
  );
}
