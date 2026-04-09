'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

export function TabLog({ slug }: { slug: string }) {
  const [log, setLog] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'error' | 'outbox'>('all');
  const logRef = useRef<HTMLPreElement>(null);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agenti-whatsapp/${slug}/log?lines=100`);
      const data = await res.json();
      setLog(data.log || 'Nessun log');
    } catch {
      setLog('Errore nel caricamento');
    }
    setLoading(false);
  };

  useEffect(() => { fetchLog(); }, [slug]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const filteredLog = filter === 'all' ? log :
    log.split('\n').filter(line => {
      if (filter === 'error') return /error|Error|ERR|fail/i.test(line);
      if (filter === 'outbox') return /outbox|send|reply|→/i.test(line);
      return true;
    }).join('\n');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all', 'error', 'outbox'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'Tutti' : f === 'error' ? 'Errori' : 'Outbox'}
            </button>
          ))}
        </div>
        <button onClick={fetchLog} disabled={loading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <pre
        ref={logRef}
        className="bg-black/40 rounded-lg p-4 h-[500px] overflow-y-auto text-xs text-green-400/80 font-mono whitespace-pre-wrap"
      >
        {loading ? 'Caricamento...' : (filteredLog || 'Nessun risultato per il filtro selezionato')}
      </pre>
    </div>
  );
}
