'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export function TabMemoria({ slug }: { slug: string }) {
  const [memory, setMemory] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchMemory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agenti-whatsapp/${slug}/memory`);
      const data = await res.json();
      setMemory(data.memory || 'Nessuna memoria trovata');
    } catch {
      setMemory('Errore nel caricamento');
    }
    setLoading(false);
  };

  useEffect(() => { fetchMemory(); }, [slug]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">MEMORY.md</h3>
        <button onClick={fetchMemory} disabled={loading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="bg-white/5 rounded-lg p-4 max-h-[500px] overflow-y-auto">
        <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono">{loading ? 'Caricamento...' : memory}</pre>
      </div>
    </div>
  );
}
