'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';

interface Message {
  ts: string;
  direction: 'in' | 'out' | 'internal';
  contact?: string;
  text: string;
}

interface Thread {
  contact: string;
  lastTs: string;
  messages: Message[];
}

function formatTs(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('it-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatContact(c: string) {
  if (!c || c === 'unknown') return '—';
  if (c === 'owner') return 'Proprietario';
  if (/^\d{8,}$/.test(c)) return '+' + c;
  return c;
}

export function TabConversazioni({ slug }: { slug: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`/api/agenti-whatsapp/${slug}/conversations?lines=800`)
      .then(r => r.json())
      .then(d => setThreads(d.threads || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [slug]);

  const filtered = threads.filter(t =>
    !filter || t.contact.toLowerCase().includes(filter.toLowerCase()) ||
    t.messages.some(m => m.text.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Cerca contatto o testo…"
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30"
        />
        <button onClick={load} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" title="Aggiorna">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !threads.length && <p className="text-white/40 text-sm">Caricamento…</p>}
      {!loading && !filtered.length && <p className="text-white/40 text-sm">Nessuna conversazione dal log.</p>}

      <div className="space-y-2">
        {filtered.map(t => {
          const isOpen = open === t.contact;
          return (
            <div key={t.contact} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : t.contact)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-white/40 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />}
                  <MessageSquare className="w-4 h-4 text-white/40 shrink-0" />
                  <div className="text-left min-w-0">
                    <div className="text-sm font-medium text-white truncate">{formatContact(t.contact)}</div>
                    <div className="text-xs text-white/40 truncate">
                      {t.messages[t.messages.length - 1]?.text.slice(0, 80) || '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-white/40 font-mono">{t.messages.length}</span>
                  <span className="text-xs text-white/40">{formatTs(t.lastTs)}</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-white/10 p-3 space-y-2 max-h-96 overflow-y-auto bg-black/20">
                  {t.messages.map((m, i) => (
                    <div key={i} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === 'out' ? 'bg-green-600/20 text-green-100' : 'bg-white/10 text-white'
                      }`}>
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        <div className="text-[10px] opacity-50 mt-1">{formatTs(m.ts)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
