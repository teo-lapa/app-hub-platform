'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { Spinner, Empty } from '../_components/ui';
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
    <>
      {/* Mappa a tutto schermo, da bordo a bordo, sotto la barra Area Venditore */}
      <div className="fixed inset-x-0 bottom-0 top-[60px] z-10 bg-slate-950">
        {loading ? (
          <div className="flex h-full items-center justify-center"><Spinner label="Carico la mappa…" /></div>
        ) : !validi.length ? (
          <div className="flex h-full items-center justify-center"><Empty>Nessun cliente geolocalizzato</Empty></div>
        ) : (
          <ClientiMap clienti={validi} />
        )}
      </div>

      {/* Badge conteggio, galleggiante sopra la mappa */}
      <div className="fixed left-3 top-[4.5rem] z-20 sm:left-5">
        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur">
          <MapPin size={16} className="text-emerald-300" />
          <span className="text-sm font-semibold text-white">{validi.length} clienti sulla mappa</span>
        </div>
      </div>
    </>
  );
}
