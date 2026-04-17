'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, MessageSquare, Mic, Image as ImageIcon, FileText, Video } from 'lucide-react';

interface Message {
  id: number;
  chat_id: string;
  from_id: string;
  from_me: number;
  author: string;
  body: string;
  type: string;
  timestamp: string;
  media_path: string | null;
  chat_name: string;
  msg_count?: number;
}

function formatTs(ts: string) {
  // tunnel returns "YYYY-MM-DD HH:mm:ss" (UTC-naive typically)
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return ts;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString('it-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatContact(m: Message) {
  if (m.chat_name) return m.chat_name;
  if (m.chat_id === 'status@broadcast') return 'Status broadcast';
  const phone = m.chat_id.replace(/@.*/, '');
  if (/^\d{8,}$/.test(phone)) return '+' + phone;
  return m.chat_id;
}

function typeIcon(type: string) {
  if (type === 'ptt' || type === 'audio') return <Mic className="w-3.5 h-3.5 shrink-0" />;
  if (type === 'image') return <ImageIcon className="w-3.5 h-3.5 shrink-0" />;
  if (type === 'video') return <Video className="w-3.5 h-3.5 shrink-0" />;
  if (type === 'document') return <FileText className="w-3.5 h-3.5 shrink-0" />;
  return <MessageSquare className="w-3.5 h-3.5 shrink-0" />;
}

function messagePreview(m: Message) {
  if (m.body && m.body.length > 0) return m.body.slice(0, 100);
  if (m.type === 'ptt' || m.type === 'audio') return '🎤 Audio';
  if (m.type === 'image') return '📷 Immagine';
  if (m.type === 'video') return '🎥 Video';
  if (m.type === 'document') return '📄 Documento';
  if (m.type === 'sticker') return '🎭 Sticker';
  if (m.type === 'location') return '📍 Posizione';
  return `[${m.type || 'media'}]`;
}

export function TabConversazioni({ slug }: { slug: string }) {
  const [chats, setChats] = useState<Message[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const loadChats = () => {
    setLoading(true);
    fetch(`/api/agenti-whatsapp/${slug}/messages?limit=50`)
      .then(r => r.json())
      .then(d => setChats(d.messages || []))
      .catch(() => setChats([]))
      .finally(() => setLoading(false));
  };

  const loadChatDetail = (chatId: string) => {
    setLoadingChat(chatId);
    fetch(`/api/agenti-whatsapp/${slug}/messages?chat=${encodeURIComponent(chatId)}&limit=100`)
      .then(r => r.json())
      .then(d => setChatMessages(prev => ({ ...prev, [chatId]: (d.messages || []).reverse() })))
      .catch(() => {})
      .finally(() => setLoadingChat(null));
  };

  const toggleChat = (chatId: string) => {
    if (open === chatId) { setOpen(null); return; }
    setOpen(chatId);
    if (!chatMessages[chatId]) loadChatDetail(chatId);
  };

  useEffect(() => { loadChats(); const i = setInterval(loadChats, 30000); return () => clearInterval(i); }, [slug]);

  const filtered = chats.filter(c => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return formatContact(c).toLowerCase().includes(f) || (c.body || '').toLowerCase().includes(f);
  });

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
        <button onClick={loadChats} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" title="Aggiorna">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !chats.length && <p className="text-white/40 text-sm">Caricamento…</p>}
      {!loading && !filtered.length && <p className="text-white/40 text-sm">Nessuna conversazione trovata.</p>}

      <div className="space-y-2">
        {filtered.map(c => {
          const isOpen = open === c.chat_id;
          const msgs = chatMessages[c.chat_id];
          return (
            <div key={c.chat_id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              <button
                onClick={() => toggleChat(c.chat_id)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-white/40 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />}
                  <div className="text-white/40">{typeIcon(c.type)}</div>
                  <div className="text-left min-w-0">
                    <div className="text-sm font-medium text-white truncate">{formatContact(c)}</div>
                    <div className="text-xs text-white/40 truncate">
                      {c.from_me ? '→ ' : ''}{messagePreview(c)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {c.msg_count && <span className="text-[10px] text-white/40 font-mono">{c.msg_count}</span>}
                  <span className="text-xs text-white/40">{formatTs(c.timestamp)}</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-white/10 p-3 space-y-2 max-h-[500px] overflow-y-auto bg-black/20">
                  {loadingChat === c.chat_id && <p className="text-white/40 text-xs text-center py-2">Caricamento messaggi…</p>}
                  {msgs && msgs.length === 0 && <p className="text-white/40 text-xs text-center py-2">Nessun messaggio.</p>}
                  {msgs && msgs.map(m => (
                    <div key={m.id} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.from_me ? 'bg-green-600/20 text-green-100 border border-green-500/20' : 'bg-white/10 text-white'
                      }`}>
                        <div className="flex items-center gap-1.5 text-[10px] opacity-60 mb-1">
                          {typeIcon(m.type)}
                          <span>{m.type}</span>
                          {m.media_path && <span>· 📎</span>}
                        </div>
                        <div className="whitespace-pre-wrap break-words">
                          {m.body || <span className="italic opacity-50">[nessun testo — {m.type}]</span>}
                        </div>
                        <div className="text-[10px] opacity-50 mt-1">{formatTs(m.timestamp)}</div>
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
