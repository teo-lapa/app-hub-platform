'use client';

/**
 * APP CLIENTI LAPA — Assistente AI del mondo Food
 *
 * Interfaccia stile Claude/ChatGPT brandizzata LAPA con sidebar a sezioni:
 *  - Assistente (chat AI: cronologia, voce, allegati)
 *  - Catalogo / I miei ordini / Le mie fatture (dati reali da Odoo)
 *
 * Cervello chat: /api/lapa-agents/chat (orchestratore + Odoo + memoria KV).
 * Pagine dati: /api/portale-clienti/{products,orders,invoices}.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Paperclip, Mic, Square, Plus, MessageSquare,
  Trash2, Menu, X, ShoppingBag, FileText, ChefHat, Sparkles, Package,
} from 'lucide-react';
import CatalogoView from './_components/CatalogoView';
import OrdiniView from './_components/OrdiniView';
import FattureView from './_components/FattureView';

type View = 'chat' | 'catalogo' | 'ordini' | 'fatture';

// ---------- Tipi chat ----------
interface Attachment { name: string; content: string; mimetype: string; }
interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; attachments?: { name: string }[]; ts: number; }
interface Chat { id: string; title: string; messages: ChatMessage[]; updatedAt: number; }
interface Profile {
  user?: { id?: number; name?: string; email?: string; phone?: string; isContact?: boolean; isCompany?: boolean; parentId?: number | null };
  company?: { id?: number; name?: string } | null;
}

const STORAGE_KEY = 'lapa_app_clienti_chats_v1';
const LOGO = '/logos/logo-default.png';

const NAV: { key: View; icon: any; label: string }[] = [
  { key: 'chat', icon: MessageSquare, label: 'Assistente' },
  { key: 'catalogo', icon: ShoppingBag, label: 'Catalogo' },
  { key: 'ordini', icon: Package, label: 'I miei ordini' },
  { key: 'fatture', icon: FileText, label: 'Le mie fatture' },
];

const QUICK_ACTIONS = [
  { icon: ShoppingBag, label: 'Fai un ordine', prompt: 'Vorrei fare un ordine.' },
  { icon: FileText, label: 'Le mie fatture', prompt: 'Quali fatture ho ancora da pagare?' },
  { icon: ChefHat, label: 'Consigliami una ricetta', prompt: 'Consigliami una ricetta italiana con i prodotti che compro di solito.' },
  { icon: Sparkles, label: 'Novità e offerte', prompt: 'Quali sono le novità e le offerte di questa settimana?' },
];

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export default function AppClientiPage() {
  const [view, setView] = useState<View>('chat');
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find((c) => c.id === activeId);
  const messages = activeChat?.messages ?? [];

  useEffect(() => {
    let initial: Chat[] = [];
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) initial = JSON.parse(raw); } catch { /* ignora */ }
    if (initial.length === 0) initial = [{ id: uid(), title: 'Nuova chat', messages: [], updatedAt: Date.now() }];
    setChats(initial);
    setActiveId(initial[0].id);
    setLoaded(true);
    fetch('/api/user/profile').then((r) => r.json()).then((d) => { if (d?.success) setProfile(d.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch { /* ignora */ }
  }, [chats, loaded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'it-IT';
    rec.onresult = (e: any) => { setInput((prev) => (prev ? prev + ' ' : '') + e.results[0][0].transcript); setIsListening(false); };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const patchChat = useCallback((id: string, fn: (c: Chat) => Chat) => {
    setChats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const newChat = () => {
    setView('chat'); setSidebarOpen(false);
    if (activeChat && activeChat.messages.length === 0) return;
    const c: Chat = { id: uid(), title: 'Nuova chat', messages: [], updatedAt: Date.now() };
    setChats((prev) => [c, ...prev]); setActiveId(c.id);
  };

  const deleteChat = (id: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) { const fresh: Chat = { id: uid(), title: 'Nuova chat', messages: [], updatedAt: Date.now() }; setActiveId(fresh.id); return [fresh]; }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const out: Attachment[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      const b64 = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(((r.result as string) || '').split(',')[1] || '');
        r.readAsDataURL(f);
      });
      out.push({ name: f.name, content: b64, mimetype: f.type || 'application/octet-stream' });
    }
    setAttachments((prev) => [...prev, ...out]);
  };

  const toggleMic = () => {
    const rec = recognitionRef.current; if (!rec) return;
    if (isListening) { rec.stop(); setIsListening(false); }
    else { try { rec.start(); setIsListening(true); } catch { /* già attivo */ } }
  };

  const send = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if ((!text && attachments.length === 0) || isTyping) return;
    setView('chat');
    let chat = activeChat;
    if (!chat) { chat = { id: uid(), title: 'Nuova chat', messages: [], updatedAt: Date.now() }; setChats((p) => [chat as Chat, ...p]); setActiveId(chat.id); }

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, attachments: attachments.map((a) => ({ name: a.name })), ts: Date.now() };
    const sentAttachments = attachments;
    const chatId = chat.id;
    const title = chat.messages.length === 0 && text ? text.slice(0, 42) + (text.length > 42 ? '…' : '') : chat.title;

    patchChat(chatId, (c) => ({ ...c, title, messages: [...c.messages, userMsg], updatedAt: Date.now() }));
    setInput(''); setAttachments([]); setIsTyping(true);

    try {
      const u = profile?.user;
      const customerType: 'b2b' | 'b2c' | 'anonymous' = u?.id ? (u.isContact || u.isCompany ? 'b2b' : 'b2c') : 'anonymous';
      const res = await fetch('/api/lapa-agents/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || '(vedi allegati)', customerType,
          customerId: u?.id, parentId: u?.parentId ?? undefined,
          customerName: u?.name, customerEmail: u?.email,
          sessionId: chatId, language: 'it', channel: 'web',
          attachments: sentAttachments.length ? sentAttachments : undefined,
        }),
      });
      const data = await res.json();
      const reply: string = (data && (data.message || data.response)) || 'Scusa, ho avuto un problema tecnico. Riprova tra un attimo. 🙏';
      patchChat(chatId, (c) => ({ ...c, messages: [...c.messages, { id: uid(), role: 'assistant', content: reply, ts: Date.now() }], updatedAt: Date.now() }));
    } catch {
      patchChat(chatId, (c) => ({ ...c, messages: [...c.messages, { id: uid(), role: 'assistant', content: 'Non riesco a collegarmi in questo momento. Controlla la connessione e riprova. 🔌', ts: Date.now() }], updatedAt: Date.now() }));
    } finally { setIsTyping(false); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const firstName = (profile?.user?.name || '').split(' ')[0] || 'Chef';
  const showWelcome = messages.length === 0;
  const currentLabel = NAV.find((n) => n.key === view)?.label || 'Assistente';

  return (
    <div className="flex h-full text-zinc-800 dark:text-zinc-100">
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ---------------- SIDEBAR ---------------- */}
      <aside
        className={`fixed z-30 h-full w-72 shrink-0 flex-col border-r border-black/5 bg-[#f0eee6] dark:bg-[#1b1b2b] dark:border-white/5
          transition-transform md:static md:z-0 md:flex md:translate-x-0
          ${sidebarOpen ? 'translate-x-0 flex' : '-translate-x-full hidden md:flex'}`}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="LAPA" className="h-9 w-9 rounded-lg object-contain" />
          <div className="leading-tight">
            <div className="font-bold text-[15px]">LAPA</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Assistente Food</div>
          </div>
          <button className="ml-auto md:hidden p-1 text-zinc-500" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <div className="px-3 pt-1 pb-2">
          <button onClick={newChat} className="flex w-full items-center gap-2 rounded-xl bg-[#dc2626] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b91c1c]">
            <Plus className="h-4 w-4" /> Nuova chat
          </button>
        </div>

        {/* Sezioni LAPA */}
        <nav className="px-2 pb-1">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => { setView(n.key); setSidebarOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition
                ${view === n.key ? 'bg-black/5 font-medium dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <n.icon className={`h-4 w-4 ${view === n.key ? 'text-[#dc2626]' : 'text-zinc-400'}`} /> {n.label}
            </button>
          ))}
        </nav>

        {/* Recenti (chat) */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Recenti</div>
          {chats.map((c) => (
            <div
              key={c.id}
              onClick={() => { setActiveId(c.id); setView('chat'); setSidebarOpen(false); }}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition
                ${c.id === activeId && view === 'chat' ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="flex-1 truncate">{c.title || 'Nuova chat'}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }} className="opacity-0 transition group-hover:opacity-100 text-zinc-400 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-black/5 dark:border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dc2626] text-sm font-bold text-white">{(firstName[0] || 'C').toUpperCase()}</div>
            <div className="leading-tight">
              <div className="text-sm font-medium truncate max-w-[150px]">{profile?.user?.name || 'Cliente LAPA'}</div>
              <div className="text-[11px] text-zinc-500 truncate max-w-[150px]">{profile?.company?.name || profile?.user?.email || ''}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN ---------------- */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 px-3 py-2.5 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-zinc-600 dark:text-zinc-300"><Menu className="h-5 w-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="LAPA" className="h-7 w-7 rounded-md object-contain" />
          <span className="font-semibold">{currentLabel}</span>
        </div>

        {view === 'catalogo' ? <CatalogoView />
          : view === 'ordini' ? <OrdiniView />
          : view === 'fatture' ? <FattureView />
          : showWelcome ? (
            /* -------- Schermata iniziale chat -------- */
            <div className="flex flex-1 flex-col items-center justify-center px-4">
              <div className="w-full max-w-2xl text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO} alt="LAPA" className="mx-auto mb-5 h-16 w-16 rounded-2xl object-contain shadow-sm" />
                <h1 className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl">{greeting()}, <span className="text-[#dc2626]">{firstName}</span></h1>
                <p className="mb-8 text-zinc-500 dark:text-zinc-400">Il mondo Food italiano, a portata di chat. Come posso aiutarti?</p>
                <Composer input={input} setInput={setInput} onKeyDown={onKeyDown} attachments={attachments} setAttachments={setAttachments} isTyping={isTyping} isListening={isListening} toggleMic={toggleMic} onFiles={onFiles} fileRef={fileRef} taRef={taRef} send={send} big />
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS.map((q) => (
                    <button key={q.label} onClick={() => send(q.prompt)} className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 transition hover:border-[#dc2626]/40 hover:text-[#dc2626]">
                      <q.icon className="h-4 w-4" /> {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* -------- Conversazione -------- */
            <>
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-4 py-6">
                  {messages.map((m) => (
                    <div key={m.id} className="mb-6">
                      {m.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#dc2626] px-4 py-2.5 text-white">
                            {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                            {m.attachments?.map((a, i) => (
                              <div key={i} className="mt-1 flex items-center gap-1 text-xs text-white/80"><Paperclip className="h-3 w-3" /> {a.name}</div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={LOGO} alt="LAPA" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
                          <div className="max-w-none pt-0.5 text-[15px] leading-relaxed [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-[#dc2626] [&_a]:underline [&_strong]:font-semibold [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-semibold [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] dark:[&_code]:bg-white/10 [&_table]:my-2 [&_table]:w-full [&_th]:border-b [&_th]:border-black/10 [&_th]:py-1 [&_th]:text-left [&_td]:border-b [&_td]:border-black/5 [&_td]:py-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/5 [&_pre]:p-3 dark:[&_pre]:bg-white/5">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="mb-6 flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={LOGO} alt="LAPA" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
                      <div className="flex items-center gap-1 pt-3">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0.15s' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0.3s' }} />
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              </div>
              <div className="border-t border-black/5 dark:border-white/5 px-4 py-3">
                <div className="mx-auto max-w-3xl">
                  <Composer input={input} setInput={setInput} onKeyDown={onKeyDown} attachments={attachments} setAttachments={setAttachments} isTyping={isTyping} isListening={isListening} toggleMic={toggleMic} onFiles={onFiles} fileRef={fileRef} taRef={taRef} send={send} />
                  <p className="mt-2 text-center text-[11px] text-zinc-400">Assistente LAPA: può sbagliare, verifica le informazioni importanti.</p>
                </div>
              </div>
            </>
          )}
      </main>
    </div>
  );
}

// ---------- Composer ----------
function Composer(props: {
  input: string; setInput: (v: string) => void; onKeyDown: (e: React.KeyboardEvent) => void;
  attachments: Attachment[]; setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  isTyping: boolean; isListening: boolean; toggleMic: () => void;
  onFiles: (f: FileList | null) => void; fileRef: React.RefObject<HTMLInputElement>;
  taRef: React.RefObject<HTMLTextAreaElement>; send: (t?: string) => void; big?: boolean;
}) {
  const { input, setInput, onKeyDown, attachments, setAttachments, isTyping, isListening, toggleMic, onFiles, fileRef, taRef, send, big } = props;
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#222236] shadow-sm focus-within:border-[#dc2626]/50">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {attachments.map((a, i) => (
            <span key={i} className="flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/10 px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3" /> {a.name}
              <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1 px-2 py-2">
        <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} title="Allega foto o file" className="rounded-lg p-2 text-zinc-500 transition hover:bg-black/5 dark:hover:bg-white/10"><Paperclip className="h-5 w-5" /></button>
        <button onClick={toggleMic} title="Parla" className={`rounded-lg p-2 transition ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>{isListening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
        <textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} rows={1} placeholder={isListening ? 'Ti sto ascoltando…' : 'Scrivi un messaggio…'} className={`flex-1 resize-none bg-transparent px-2 py-2 outline-none placeholder:text-zinc-400 ${big ? 'text-base' : 'text-[15px]'}`} />
        <button onClick={() => send()} disabled={isTyping || (!input.trim() && attachments.length === 0)} className="rounded-lg bg-[#dc2626] p-2 text-white transition hover:bg-[#b91c1c] disabled:opacity-40"><Send className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
