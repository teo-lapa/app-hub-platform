'use client';

import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface Delivery {
  id: number;
  name: string;
  customer: string;
  lat: number;
  lng: number;
  address: string;
  driverId: number;
  driverName: string;
  vehicle: string;
  giro: string;
  cantone: string;
  weight: number;
  time: string;
  saleName: string;
}

interface Props {
  deliveries: Delivery[];
  colorByDriver: Record<number, string>;
}

function numberedIcon(color: string, n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;"><span style="transform:rotate(45deg)">${n}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

export default function MapView({ deliveries, colorByDriver }: Props) {
  // Centro: media delle coordinate, fallback Zurigo
  const center: [number, number] = deliveries.length
    ? [
        deliveries.reduce((s, d) => s + d.lat, 0) / deliveries.length,
        deliveries.reduce((s, d) => s + d.lng, 0) / deliveries.length,
      ]
    : [47.3769, 8.5417];

  // Raggruppa per autista per disegnare i tragitti
  const byDriver = new Map<number, Delivery[]>();
  deliveries.forEach((d) => {
    if (!byDriver.has(d.driverId)) byDriver.set(d.driverId, []);
    byDriver.get(d.driverId)!.push(d);
  });

  const fmtTime = (t: string) => {
    const d = new Date(t.replace(' ', 'T') + 'Z');
    return d.toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {Array.from(byDriver.entries()).map(([driverId, stops]) => {
        const color = colorByDriver[driverId] || '#3b82f6';
        const path = stops.map((s) => [s.lat, s.lng] as [number, number]);
        return (
          <div key={driverId}>
            {path.length > 1 && (
              <Polyline positions={path} pathOptions={{ color, weight: 3, opacity: 0.7 }} />
            )}
            {stops.map((d, i) => (
              <Marker key={d.id} position={[d.lat, d.lng]} icon={numberedIcon(color, i + 1)}>
                <Popup>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong>#{i + 1} · {fmtTime(d.time)}</strong><br />
                    <strong>{d.customer}</strong><br />
                    {d.address && <span>{d.address}<br /></span>}
                    👤 {d.driverName}<br />
                    {d.giro && <span>🛣️ {d.giro}<br /></span>}
                    {d.vehicle && <span>🚚 {d.vehicle}<br /></span>}
                    {d.weight > 0 && <span>⚖️ {d.weight.toFixed(2)} kg<br /></span>}
                    {d.saleName && <span>📄 {d.saleName} · </span>}{d.name}
                  </div>
                </Popup>
              </Marker>
            ))}
          </div>
        );
      })}
    </MapContainer>
  );
}
