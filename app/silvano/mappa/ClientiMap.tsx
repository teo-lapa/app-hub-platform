'use client';
import { useCallback, useMemo, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { fmtCHF } from '../_components/ui';

export interface ClienteMappa {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  totalInvoiced: number;
}

const containerStyle = { width: '100%', height: '70vh' };

export default function ClientiMap({ clienti }: { clienti: ClienteMappa[] }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });
  const [active, setActive] = useState<ClienteMappa | null>(null);

  const center = useMemo(() => {
    if (!clienti.length) return { lat: 46.8, lng: 8.2 };
    const lat = clienti.reduce((s, c) => s + c.lat, 0) / clienti.length;
    const lng = clienti.reduce((s, c) => s + c.lng, 0) / clienti.length;
    return { lat, lng };
  }, [clienti]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      if (clienti.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        clienti.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
        map.fitBounds(bounds, 60);
      }
    },
    [clienti]
  );

  if (loadError) return <div className="p-6 text-sm text-red-400">Errore caricamento mappa Google</div>;
  if (!isLoaded) return <div className="p-6 text-sm text-slate-400">Carico la mappa…</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={9}
      onLoad={onLoad}
      options={{ streetViewControl: false, mapTypeControl: true, fullscreenControl: true }}
    >
      {clienti.map((c) => (
        <Marker
          key={c.id}
          position={{ lat: c.lat, lng: c.lng }}
          title={c.name}
          onClick={() => setActive(c)}
        />
      ))}

      {active && (
        <InfoWindow position={{ lat: active.lat, lng: active.lng }} onCloseClick={() => setActive(null)}>
          <div style={{ minWidth: 180, color: '#0f172a' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{active.name}</div>
            {active.address && (
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{active.address}</div>
            )}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#047857', marginTop: 4 }}>
              {fmtCHF(active.totalInvoiced)}
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${active.lat},${active.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: 8,
                background: '#10b981',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: 13,
                padding: '6px 12px',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              🧭 Naviga
            </a>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
