'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Card, Spinner, Empty } from '../_components/ui';
import type { ClienteMappa } from './ClientiMap';

const ClientiMap = dynamic(() => import('./ClientiMap'), {
  ssr: false,
  loading: () => <Spinner label="Carico la mappa…" />,
});

export default function MappaPage() {
  const [clienti, setClienti] = useState<ClienteMappa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/silvano/mappa');
        const d = await r.json();
        if (d.success) setClienti(d.clienti as ClienteMappa[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const validi = useMemo(
    () =>
      clienti.filter(
        (c) => typeof c.lat === 'number' && typeof c.lng === 'number' && c.lat !== 0 && c.lng !== 0
      ),
    [clienti]
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <MapPin size={20} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Mappa clienti</div>
            <div className="text-lg font-semibold text-white">{validi.length} clienti sulla mappa</div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : !validi.length ? (
        <Empty>Nessun cliente geolocalizzato</Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <ClientiMap clienti={validi} />
        </Card>
      )}
    </div>
  );
}
