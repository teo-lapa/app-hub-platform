'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { fmtCHF } from '../_components/ui';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: (markerIcon2x as { src: string }).src,
  iconUrl: (markerIcon as { src: string }).src,
  shadowUrl: (markerShadow as { src: string }).src,
});

export interface ClienteMappa {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  totalInvoiced: number;
}

export default function ClientiMap({ clienti }: { clienti: ClienteMappa[] }) {
  return (
    <MapContainer center={[46.8, 8.2]} zoom={8} className="h-[70vh] w-full rounded-2xl">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {clienti.map((c) => (
        <Marker key={c.id} position={[c.lat, c.lng]}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{c.name}</div>
              {c.address && <div className="text-slate-600">{c.address}</div>}
              <div className="mt-1 font-medium text-emerald-700">{fmtCHF(c.totalInvoiced)}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
