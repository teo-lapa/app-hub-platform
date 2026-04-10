'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, Clock, XCircle, Package } from 'lucide-react';

interface Followup {
  id: number;
  type: string;
  status: string;
  client_name: string;
  client_phone: string;
  odoo_partner_id: number;
  odoo_partner_name: string;
  body: string;
  delivery_date: string;
  created_at: string;
  resolved_at: string | null;
}

export function TabFollowup({ slug }: { slug: string }) {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'aperto' | 'in_corso' | 'risolto' | 'all'>('aperto');

  const fetchFollowups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agenti-whatsapp/${slug}/followups`);
      const data = await res.json();
      setFollowups(data.followups || []);
    } catch {
      setFollowups([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFollowups(); }, [slug]);

  const filtered = filter === 'all' ? followups : followups.filter(f => f.status === filter);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'aperto': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'in_corso': return <Package className="w-4 h-4 text-blue-400" />;
      case 'risolto': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'ignorato': return <XCircle className="w-4 h-4 text-white/30" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'aperto': return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'in_corso': return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'risolto': return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'ignorato': return 'bg-white/5 text-white/30 border-white/10';
      default: return 'bg-white/5 text-white/40';
    }
  };

  const counts = {
    aperto: followups.filter(f => f.status === 'aperto').length,
    in_corso: followups.filter(f => f.status === 'in_corso').length,
    risolto: followups.filter(f => f.status === 'risolto').length,
    all: followups.length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['aperto', 'in_corso', 'risolto', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === f ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/5'
              }`}
            >
              {f === 'aperto' ? 'Aperti' : f === 'in_corso' ? 'In corso' : f === 'risolto' ? 'Risolti' : 'Tutti'}
              {counts[f] > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  f === 'aperto' ? 'bg-yellow-400/20 text-yellow-400' :
                  f === 'in_corso' ? 'bg-blue-400/20 text-blue-400' :
                  'bg-white/10 text-white/60'
                }`}>{counts[f]}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={fetchFollowups} disabled={loading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm py-8 text-center">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/40 text-sm py-8 text-center">Nessun follow-up{filter !== 'all' ? ` ${filter === 'aperto' ? 'aperto' : filter === 'in_corso' ? 'in corso' : 'risolto'}` : ''}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <div key={f.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {statusIcon(f.status)}
                  <span className="text-white font-medium text-sm">#{f.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusColor(f.status)}`}>
                    {f.status.toUpperCase()}
                  </span>
                  <span className="text-white/30 text-xs">{f.type}</span>
                </div>
                <span className="text-white/30 text-xs">{f.created_at}</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-white text-sm font-medium">{f.client_name}</span>
                <span className="text-white/40 text-xs">{f.client_phone}</span>
                {f.odoo_partner_name && <span className="text-green-400/60 text-xs">Odoo: {f.odoo_partner_name}</span>}
                {f.delivery_date && <span className="text-yellow-400/80 text-xs">Consegna: {f.delivery_date}</span>}
              </div>
              <pre className="text-white/70 text-xs font-mono whitespace-pre-wrap bg-black/30 rounded p-2 max-h-[120px] overflow-y-auto">
                {f.body}
              </pre>
              {f.resolved_at && (
                <div className="mt-2 text-white/30 text-xs">Risolto: {f.resolved_at}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
