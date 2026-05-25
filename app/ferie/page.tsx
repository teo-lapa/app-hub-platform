'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/authStore';

type LeaveType = { id: number; name: string };
type MyLeave = {
  id: number;
  type_id: number;
  type_name: string;
  date_from: string;
  date_to: string;
  days: number;
  state: string;
  state_label: string;
  note: string;
};
type CalLeave = {
  id: number;
  employee_id: number;
  employee_name: string;
  type_name: string;
  date_from: string;
  date_to: string;
  state: string;
};

const STATE_COLOR: Record<string, string> = {
  confirm: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  validate1: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  validate: 'bg-green-500/20 text-green-300 border-green-500/40',
  refuse: 'bg-red-500/20 text-red-300 border-red-500/40',
  draft: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
};

const ADMIN_EMAILS = ['paul@lapa.ch', 'laura@lapa.ch'];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatIT(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // 0 = lunedì
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date | null; iso: string | null }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    cells.push({ date: dt, iso: toISO(dt) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
  return cells;
}

export default function FeriePage() {
  const { user, isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();
  const router = useRouter();

  const [employee, setEmployee] = useState<{ id: number; name: string } | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [myLeaves, setMyLeaves] = useState<MyLeave[]>([]);
  const [calLeaves, setCalLeaves] = useState<CalLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMonth, setViewMonth] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  const [sel, setSel] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [typeId, setTypeId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth');
  }, [authLoading, isAuthenticated, router]);

  const isAdmin = !!user && (user.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase()));

  const loadMine = async () => {
    try {
      const res = await fetch('/api/ferie/me', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setEmployee(data.employee);
      setTypes(data.types);
      setMyLeaves(data.leaves);
      if (data.types?.length && !typeId) setTypeId(data.types[0].id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const loadCalendar = async (year: number, month: number) => {
    const from = toISO(new Date(year, month, 1));
    const to = toISO(new Date(year, month + 1, 0));
    try {
      const res = await fetch(`/api/ferie/calendario?from=${from}&to=${to}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setCalLeaves(data.leaves);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadMine(), loadCalendar(viewMonth.year, viewMonth.month)]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadCalendar(viewMonth.year, viewMonth.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth.year, viewMonth.month]);

  const cells = useMemo(() => buildMonthGrid(viewMonth.year, viewMonth.month), [viewMonth]);

  const dayInfo = useMemo(() => {
    const map = new Map<string, CalLeave[]>();
    for (const l of calLeaves) {
      if (!l.date_from || !l.date_to) continue;
      const start = new Date(l.date_from);
      const end = new Date(l.date_to);
      const cur = new Date(start);
      while (cur <= end) {
        const k = toISO(cur);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(l);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [calLeaves]);

  const onDayClick = (iso: string | null) => {
    if (!iso) return;
    if (!sel.from || (sel.from && sel.to)) {
      setSel({ from: iso, to: null });
    } else {
      if (iso < sel.from) setSel({ from: iso, to: sel.from });
      else setSel({ from: sel.from, to: iso });
    }
  };

  const isInSelection = (iso: string | null) => {
    if (!iso || !sel.from) return false;
    if (!sel.to) return iso === sel.from;
    return iso >= sel.from && iso <= sel.to;
  };

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const conflictPreview = useMemo(() => {
    if (!sel.from) return [] as CalLeave[];
    const to = sel.to || sel.from;
    return calLeaves.filter(l => l.date_from && l.date_to && !(l.date_to < sel.from! || l.date_from > to) && l.employee_id !== employee?.id);
  }, [sel, calLeaves, employee]);

  const submit = async () => {
    if (!sel.from || !typeId) {
      toast.error('Seleziona almeno un giorno e il tipo di ferie');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/ferie/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_id: typeId,
          date_from: sel.from,
          date_to: sel.to || sel.from,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore invio');
      toast.success('Richiesta inviata!');
      setSel({ from: null, to: null });
      setNote('');
      await Promise.all([loadMine(), loadCalendar(viewMonth.year, viewMonth.month)]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const annulla = async (id: number) => {
    if (!confirm('Annullare questa richiesta?')) return;
    try {
      const res = await fetch('/api/ferie/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      toast.success('Richiesta annullata');
      await Promise.all([loadMine(), loadCalendar(viewMonth.year, viewMonth.month)]);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Caricamento…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-lg bg-slate-900/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">← Home</button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold">🏖️ Ferie</h1>
            <p className="text-xs text-white/60">{employee?.name || 'Dipendente'}</p>
          </div>
          {isAdmin && (
            <button onClick={() => router.push('/ferie/admin')} className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-sm font-semibold">
              Approvazioni →
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Calendario */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewMonth(v => ({ year: v.month === 0 ? v.year - 1 : v.year, month: (v.month + 11) % 12 }))} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">←</button>
            <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
            <button onClick={() => setViewMonth(v => ({ year: v.month === 11 ? v.year + 1 : v.year, month: (v.month + 1) % 12 }))} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">→</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-white/60 mb-1">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              const isToday = c.iso === toISO(new Date());
              const inSel = isInSelection(c.iso);
              const leavesOn = c.iso ? dayInfo.get(c.iso) || [] : [];
              const mine = leavesOn.find(l => l.employee_id === employee?.id);
              return (
                <button
                  key={i}
                  onClick={() => onDayClick(c.iso)}
                  disabled={!c.iso}
                  className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center relative transition
                    ${!c.iso ? 'opacity-0 cursor-default' : 'hover:bg-white/10'}
                    ${inSel ? 'bg-blue-600/60 ring-2 ring-blue-400' : 'bg-white/5'}
                    ${isToday ? 'ring-1 ring-white/40' : ''}
                  `}
                >
                  {c.date && (
                    <>
                      <span className="font-medium">{c.date.getDate()}</span>
                      {leavesOn.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {leavesOn.slice(0, 3).map((l, idx) => (
                            <span key={idx} className={`w-1.5 h-1.5 rounded-full
                              ${l.state === 'validate' ? 'bg-green-400' : l.state === 'refuse' ? 'bg-red-400' : 'bg-yellow-400'}
                              ${l.employee_id === employee?.id ? 'ring-1 ring-white' : ''}
                            `} />
                          ))}
                        </div>
                      )}
                      {mine && <div className="absolute inset-0 rounded-lg border-2 border-green-400/60 pointer-events-none"></div>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> In attesa</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400"></span> Approvata</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span> Rifiutata</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-400/60"></span> Tu</span>
          </div>
        </section>

        {/* Form richiesta */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h2 className="text-lg font-semibold mb-3">Nuova richiesta</h2>
          {!sel.from ? (
            <p className="text-sm text-white/60">Clicca un giorno sul calendario per iniziare. Clicca un secondo giorno per selezionare un periodo.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-400/40">
                  Dal <b>{formatIT(sel.from)}</b> al <b>{formatIT(sel.to || sel.from)}</b>
                </span>
                <button onClick={() => setSel({ from: null, to: null })} className="text-xs text-white/60 hover:text-white">azzera</button>
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1">Tipo</label>
                <select
                  value={typeId ?? ''}
                  onChange={e => setTypeId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2"
                >
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1">Nota (opzionale)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  placeholder="Es. matrimonio, viaggio, motivi personali…"
                />
              </div>
              {conflictPreview.length > 0 && (
                <div className="text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-yellow-200">
                  ⚠️ In quei giorni sono già richieste/approvate ferie di: {Array.from(new Set(conflictPreview.map(c => c.employee_name))).join(', ')}
                </div>
              )}
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 font-semibold disabled:opacity-50"
              >
                {submitting ? 'Invio…' : '📨 Invia richiesta'}
              </button>
            </div>
          )}
        </section>

        {/* Mie richieste */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h2 className="text-lg font-semibold mb-3">Le mie richieste</h2>
          {myLeaves.length === 0 ? (
            <p className="text-sm text-white/60">Nessuna richiesta negli ultimi 12 mesi.</p>
          ) : (
            <div className="space-y-2">
              {myLeaves.map(l => (
                <div key={l.id} className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold">{l.type_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATE_COLOR[l.state] || ''}`}>{l.state_label}</span>
                    </div>
                    <div className="text-sm text-white/80">
                      {formatIT(l.date_from)} → {formatIT(l.date_to)} <span className="text-white/50">({l.days} gg)</span>
                    </div>
                    {l.note && <div className="text-xs text-white/50 mt-1 line-clamp-2">{l.note}</div>}
                  </div>
                  {['draft', 'confirm', 'validate1'].includes(l.state) && (
                    <button onClick={() => annulla(l.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300">Annulla</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
