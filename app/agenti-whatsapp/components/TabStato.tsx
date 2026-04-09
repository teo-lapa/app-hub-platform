'use client';

import { useState, useEffect } from 'react';
import { AgentStatusBadge } from './AgentStatusBadge';

interface StatusData {
  online: boolean;
  sshReachable: boolean;
  processRunning: boolean;
  lastLog: string | null;
  pid: string | null;
}

export function TabStato({ slug }: { slug: string }) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/agenti-whatsapp/${slug}/status`);
        if (res.ok) setStatus(await res.json());
      } catch { /* */ }
      setLoading(false);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading) return <p className="text-white/40">Caricamento stato...</p>;
  if (!status) return <p className="text-red-400">Errore nel caricamento dello stato</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatusItem label="SSH Raggiungibile" ok={status.sshReachable} />
        <StatusItem label="Processo Bot Attivo" ok={status.processRunning} />
        <StatusItem label="Stato Generale" custom={<AgentStatusBadge online={status.online} sshReachable={status.sshReachable} />} />
        {status.pid && <StatusItem label="PID" text={status.pid} />}
      </div>
      {status.lastLog && (
        <div className="mt-4">
          <p className="text-xs text-white/40 mb-1">Ultimo log:</p>
          <p className="text-sm text-white/70 bg-white/5 rounded-lg p-3 font-mono break-all">{status.lastLog}</p>
        </div>
      )}
    </div>
  );
}

function StatusItem({ label, ok, text, custom }: { label: string; ok?: boolean; text?: string; custom?: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-lg p-4">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      {custom ?? (
        text ? <p className="text-sm text-white font-mono">{text}</p> :
        ok !== undefined ? (
          <span className={`text-sm font-medium ${ok ? 'text-green-400' : 'text-red-400'}`}>
            {ok ? '✓ OK' : '✗ Non disponibile'}
          </span>
        ) : null
      )}
    </div>
  );
}
