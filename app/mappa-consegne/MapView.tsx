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
  status: 'done' | 'todo';
  saleName: string;
  feedback: { type: string; text: string; date: string }[];
}

export interface Depot {
  lat: number;
  lng: number;
  name: string;
  address: string;
}

interface Props {
  deliveries: Delivery[];
  colorByDriver: Record<number, string>;
  depot: Depot | null;
}

function numberedIcon(color: string, n: number, alert: boolean, last: boolean) {
  const alertBadge = alert
    ? `<div style="position:absolute;top:-8px;right:-8px;background:#dc2626;color:#fff;width:18px;height:18px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;line-height:1;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,.4);">!</div>`
    : '';
  const lastBadge = last
    ? `<div style="position:absolute;top:-10px;left:-10px;font-size:16px;transform:rotate(45deg);text-shadow:0 0 2px #fff,0 0 2px #fff;">🏁</div>`
    : '';
  const ring = last ? 'border:3px solid #111;' : 'border:2px solid #fff;';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;background:${color};color:#fff;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);${ring}box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;"><span style="transform:rotate(45deg)">${n}</span>${alertBadge}${lastBadge}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

// Consegna ancora da fare: marker vuoto (bordo colorato, sfondo bianco) con clessidra
function todoIcon(color: string, n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;background:#fff;color:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px dashed ${color};box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;"><span style="transform:rotate(45deg)">${n}</span><div style="position:absolute;top:-9px;left:-9px;font-size:13px;transform:rotate(45deg);text-shadow:0 0 2px #fff,0 0 2px #fff;">⏳</div></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

function depotIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#111;color:#fff;width:32px;height:32px;border-radius:8px;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:18px;">🏠</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// Freccia direzione a metà segmento, ruotata verso la prossima tappa
function bearing(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a[0]), φ2 = toRad(b[0]), Δλ = toRad(b[1] - a[1]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function arrowIcon(color: string, deg: number) {
  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${deg - 90}deg);color:${color};font-size:20px;line-height:1;text-shadow:0 0 2px #fff,0 0 2px #fff;">➤</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export default function MapView({ deliveries, colorByDriver, depot }: Props) {
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
      {depot && (
        <Marker position={[depot.lat, depot.lng]} icon={depotIcon()}>
          <Popup>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <strong>🏠 {depot.name}</strong><br />
              {depot.address}<br />
              <em>Partenza di tutti i giri</em>
            </div>
          </Popup>
        </Marker>
      )}
      {Array.from(byDriver.entries()).map(([driverId, stops]) => {
        const color = colorByDriver[driverId] || '#3b82f6';
        const done = stops.filter((s) => s.status === 'done');
        const todo = stops.filter((s) => s.status === 'todo');
        const depotPt: [number, number][] = depot ? [[depot.lat, depot.lng]] : [];
        // Linea continua: deposito → consegne fatte
        const donePath: [number, number][] = [...depotPt, ...done.map((s) => [s.lat, s.lng] as [number, number])];
        // Linea tratteggiata: ultima fatta (o deposito) → consegne da fare
        const todoStart: [number, number][] = done.length
          ? [[done[done.length - 1].lat, done[done.length - 1].lng]]
          : depotPt;
        const todoPath: [number, number][] = [...todoStart, ...todo.map((s) => [s.lat, s.lng] as [number, number])];
        const lastDoneIdx = done.length - 1;
        return (
          <div key={driverId}>
            {donePath.length > 1 && (
              <Polyline positions={donePath} pathOptions={{ color, weight: 3, opacity: 0.7 }} />
            )}
            {todoPath.length > 1 && (
              <Polyline positions={todoPath} pathOptions={{ color, weight: 3, opacity: 0.6, dashArray: '8 8' }} />
            )}
            {/* Frecce di direzione a metà di ogni segmento (continua + tratteggiata) */}
            {[donePath, todoPath].flatMap((pth, pi) =>
              pth.slice(0, -1).map((p, i) => {
                const next = pth[i + 1];
                const mid: [number, number] = [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2];
                return (
                  <Marker
                    key={`arr-${driverId}-${pi}-${i}`}
                    position={mid}
                    icon={arrowIcon(color, bearing(p, next))}
                    interactive={false}
                  />
                );
              })
            )}
            {stops.map((d, i) => {
              const isDone = d.status === 'done';
              const seq = i + 1;
              const isLastDone = isDone && i === lastDoneIdx;
              return (
                <Marker
                  key={d.id}
                  position={[d.lat, d.lng]}
                  icon={isDone ? numberedIcon(color, seq, d.feedback.length > 0, isLastDone) : todoIcon(color, seq)}
                >
                  <Popup>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      {isDone ? (
                        <>
                          <strong>#{seq} · {fmtTime(d.time)}</strong>
                          {isLastDone && <span> · 🏁 <strong>Ultima</strong></span>}<br />
                        </>
                      ) : (
                        <><strong style={{ color }}>⏳ Da consegnare</strong> · previsto {fmtTime(d.time)}<br /></>
                      )}
                      <strong>{d.customer}</strong><br />
                      {d.address && <span>{d.address}<br /></span>}
                      👤 {d.driverName}<br />
                      {d.giro && <span>🛣️ {d.giro}<br /></span>}
                      {d.vehicle && <span>🚚 {d.vehicle}<br /></span>}
                      {d.weight > 0 && <span>⚖️ {d.weight.toFixed(2)} kg<br /></span>}
                      {d.saleName && <span>📄 {d.saleName} · </span>}{d.name}
                      {d.feedback.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
                          {d.feedback.map((f, fi) => (
                            <div key={fi} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 8px', marginTop: fi ? 6 : 0 }}>
                              <strong style={{ color: '#dc2626' }}>⚠️ {f.type}</strong><br />
                              <span style={{ color: '#7f1d1d' }}>{f.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </div>
        );
      })}
    </MapContainer>
  );
}
