'use client';

import { useEffect, useMemo, useState, useCallback, type DragEvent } from 'react';

type Col = 'mihai' | 'centro' | 'silvano';
type Cliente = {
  id: number;
  name: string;
  city: string;
  cantone: string;
  isCompany: boolean;
  venditore: string;
  venditoreId: number | null;
  fatturato: number;
  ordini: number;
  serie: number[];
  col: Col;
  origCol: Col;
};

const COLS: { key: Col; titolo: string; sotto: string; accent: string }[] = [
  { key: 'mihai', titolo: 'Mihai', sotto: 'Clienti di Mihai', accent: 'border-blue-500/60 bg-blue-500/5' },
  { key: 'centro', titolo: 'Resto / Azienda', sotto: '→ Paul (Laura resta)', accent: 'border-slate-500/50 bg-slate-500/5' },
  { key: 'silvano', titolo: 'Silvano', sotto: 'Nuovo venditore', accent: 'border-emerald-500/60 bg-emerald-500/5' },
];

const fmtCHF = (n: number) =>
  'CHF ' + (n || 0).toLocaleString('it-CH', { maximumFractionDigits: 0 });

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const meseLabel = (key: string) => MESI[parseInt(key.slice(5, 7), 10) - 1] || key;

type Trend = { dir: 'up' | 'down' | 'flat'; pct: number };
function calcTrend(serie: number[]): Trend {
  const n = serie.length;
  if (n < 2) return { dir: 'flat', pct: 0 };
  const mx = (n - 1) / 2;
  const my = serie.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (serie[i] - my); den += (i - mx) ** 2; }
  const slope = den ? num / den : 0;
  const half = Math.floor(n / 2);
  const a = serie.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(1, half);
  const b = serie.slice(half).reduce((s, v) => s + v, 0) / Math.max(1, n - half);
  const base = (a + b) / 2 || 1;
  const pct = Math.round(((b - a) / base) * 100);
  const dir: Trend['dir'] = slope > 0 && pct > 10 ? 'up' : slope < 0 && pct < -10 ? 'down' : 'flat';
  return { dir, pct };
}
const trendColor = (d: Trend['dir']) => d === 'up' ? '#34d399' : d === 'down' ? '#f87171' : '#94a3b8';
const trendIcon = (d: Trend['dir']) => d === 'up' ? '📈' : d === 'down' ? '📉' : '➖';
const trendLabel = (d: Trend['dir']) => d === 'up' ? 'In salita' : d === 'down' ? 'In discesa' : 'Stabile';

function Sparkline({ serie, color }: { serie: number[]; color: string }) {
  const w = 84, h = 26, pad = 2;
  if (serie.length < 2) return null;
  const max = Math.max(...serie);
  const min = Math.min(...serie);
  const range = max - min || 1;
  const pts = serie.map((v, i) => {
    const x = pad + (i * (w - 2 * pad)) / (serie.length - 1);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-base font-bold" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function DettaglioModal({ c, onClose }: { c: Cliente; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/portafogli/dettaglio?id=${c.id}`)
      .then(r => r.json())
      .then(j => { if (!alive) return; if (j.success) setD(j); else setErr(j.error || 'Errore'); })
      .catch(e => alive && setErr(e.message));
    return () => { alive = false; };
  }, [c.id]);

  const valori: number[] = d?.serie?.valori || [];
  const months: string[] = d?.serie?.months || [];
  const recente = calcTrend(valori.slice(-6));
  const colR = trendColor(recente.dir);
  const max = Math.max(...valori, 1);
  const yoy = d?.yoy?.pct;
  const info = d?.info;
  const anni = info?.primoOrdine
    ? ((Date.now() - new Date(info.primoOrdine).getTime()) / (365.25 * 86400000)).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-3xl my-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xl font-bold">{c.name}</div>
            <div className="text-xs text-slate-400">
              {[c.city, c.cantone].filter(Boolean).join(' · ') || '—'} · venditore: {c.venditore || 'nessuno'} · {c.isCompany ? 'azienda' : 'privato'}
            </div>
            {info?.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {info.tags.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px]">{t}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {err && <div className="text-red-400 text-sm">⚠️ {err}</div>}
        {!d && !err && <div className="text-slate-400 text-sm py-10 text-center">Caricamento analisi…</div>}

        {d && (
          <>
            {/* Trend badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ background: colR + '22', color: colR }}>
                {trendIcon(recente.dir)} {trendLabel(recente.dir)} {recente.pct > 0 ? `+${recente.pct}%` : `${recente.pct}%`} <span className="opacity-70">(ultimi 6 mesi)</span>
              </span>
              {yoy !== null && yoy !== undefined && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ background: (yoy >= 0 ? '#34d399' : '#f87171') + '22', color: yoy >= 0 ? '#34d399' : '#f87171' }}>
                  {yoy >= 0 ? '▲' : '▼'} {yoy > 0 ? `+${yoy}%` : `${yoy}%`} vs anno scorso
                </span>
              )}
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <KPI label="Fatturato anno in corso" value={fmtCHF(d.yoy.ytdCur)} sub={`anno scorso: ${fmtCHF(d.yoy.ytdPrev)}`} />
              <KPI label="Totale storico" value={fmtCHF(info.fatturatoTotale)} sub={`${info.ordiniTotali} ordini in totale`} />
              <KPI label="Ordine medio" value={fmtCHF(info.ticketMedio)} sub={info.freqGiorni ? `ordina ogni ~${info.freqGiorni} gg` : undefined} />
              <KPI label="Ultimo ordine"
                value={info.giorniDaUltimo != null ? `${info.giorniDaUltimo} gg fa` : '—'}
                sub={info.ultimoOrdine || undefined}
                color={info.giorniDaUltimo != null && info.giorniDaUltimo > 30 ? '#f87171' : undefined} />
              <KPI label="Cliente da" value={anni ? `${anni} anni` : '—'} sub={info.primoOrdine || undefined} />
              <KPI label="Saldo / scaduto"
                value={info.totalDue > 0 ? fmtCHF(info.totalDue) : 'in regola'}
                sub={info.totalDue > 0 ? 'da incassare' : undefined}
                color={info.totalDue > 0 ? '#f87171' : '#34d399'} />
            </div>

            {/* Grafico 18 mesi */}
            <div className="text-xs text-slate-400 mb-1">Andamento mensile (ultimi 18 mesi)</div>
            <div className="flex items-end gap-1 h-36 mb-1">
              {valori.map((v, i) => {
                const isYearStart = months[i]?.slice(5) === '01';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div className="w-full rounded-t" title={`${meseLabel(months[i])} ${months[i]?.slice(0, 4)}: ${fmtCHF(v)}`}
                      style={{ height: `${(v / max) * 100}%`, background: isYearStart ? '#64748b' : colR, minHeight: v > 0 ? 2 : 0 }} />
                    <div className="text-[9px] text-slate-500 mt-1">{meseLabel(months[i])}</div>
                    <div className="text-[9px] text-slate-600">{isYearStart ? months[i].slice(0, 4) : ''}</div>
                  </div>
                );
              })}
            </div>

            {/* Top prodotti */}
            <div className="text-xs text-slate-400 mt-4 mb-2">Cosa compra (ultimi 12 mesi)</div>
            <div className="space-y-1">
              {d.topProdotti.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm bg-slate-800/40 rounded px-2 py-1">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-slate-300 font-medium">{fmtCHF(p.subtotal)}</span>
                </div>
              ))}
              {d.topProdotti.length === 0 && <div className="text-xs text-slate-500">nessun prodotto nel periodo</div>}
            </div>

            <div className="text-[11px] text-slate-500 mt-3">Dati aggregati sull&apos;azienda (ordini dei contatti figli inclusi). L&apos;ultimo mese può essere parziale.</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PortafogliPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<Cliente | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/portafogli');
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Errore caricamento');
      setClienti(d.clienti.map((c: any) => ({ ...c, origCol: c.col })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clienti;
    return clienti.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.city.toLowerCase().includes(s) ||
      c.cantone.toLowerCase().includes(s)
    );
  }, [clienti, q]);

  const byCol = (col: Col) => filtered.filter(c => c.col === col);

  const move = (ids: number[], target: Col) => {
    setClienti(prev => prev.map(c => ids.includes(c.id) ? { ...c, col: target } : c));
    setSel(new Set());
    setMsg('');
  };

  const toggleSel = (id: number) => {
    setSel(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Drag & drop nativo
  const onDragStart = (e: DragEvent, id: number) => {
    const ids = sel.has(id) ? Array.from(sel) : [id];
    e.dataTransfer.setData('text/plain', JSON.stringify(ids));
  };
  const onDrop = (e: DragEvent, target: Col) => {
    e.preventDefault();
    try {
      const ids = JSON.parse(e.dataTransfer.getData('text/plain'));
      move(ids, target);
    } catch {}
  };

  const changes = useMemo(
    () => clienti.filter(c => c.col !== c.origCol),
    [clienti]
  );

  const salva = async () => {
    if (!changes.length) return;
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch('/api/portafogli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: changes.map(c => ({ id: c.id, target: c.col, cur: c.venditoreId })),
        }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Errore salvataggio');
      setClienti(prev => prev.map(c => ({ ...c, origCol: c.col })));
      setMsg(`✅ Salvato su Odoo: ${d.scritti} clienti aggiornati`);
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const totCol = (col: Col) => {
    const list = byCol(col);
    return { n: list.length, sum: list.reduce((a, c) => a + c.fatturato, 0) };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-bold">Smista clienti per venditore</h1>
            <p className="text-sm text-slate-400">
              Trascina o seleziona e sposta. {clienti.length} clienti (con ordini dal 1° gennaio, niente e-commerce).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cerca nome / città / cantone…"
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm w-56"
            />
            <button
              onClick={salva}
              disabled={saving || !changes.length}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {saving ? 'Salvataggio…' : `Salva su Odoo${changes.length ? ` (${changes.length})` : ''}`}
            </button>
          </div>
        </div>
        {msg && <div className="mt-2 text-sm">{msg}</div>}
        {error && <div className="mt-2 text-sm text-red-400">⚠️ {error}</div>}

        {/* Toolbar selezione multipla */}
        {sel.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            <span className="font-semibold">{sel.size} selezionati →</span>
            <button onClick={() => move(Array.from(sel), 'mihai')} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500">Mihai</button>
            <button onClick={() => move(Array.from(sel), 'centro')} className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500">Resto</button>
            <button onClick={() => move(Array.from(sel), 'silvano')} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500">Silvano</button>
            <button onClick={() => setSel(new Set())} className="px-2 py-1 rounded text-slate-300 hover:text-white">annulla</button>
          </div>
        )}
      </div>

      {/* Colonne */}
      {loading ? (
        <div className="text-center text-slate-400 py-20">Caricamento clienti…</div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLS.map(col => {
            const t = totCol(col.key);
            return (
              <div
                key={col.key}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onDrop(e, col.key)}
                className={`rounded-xl border ${col.accent} p-3 min-h-[60vh]`}
              >
                <div className="flex items-baseline justify-between mb-2 sticky top-0">
                  <div>
                    <div className="font-bold">{col.titolo}</div>
                    <div className="text-xs text-slate-400">{col.sotto}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{t.n}</div>
                    <div className="text-xs text-slate-400">{fmtCHF(t.sum)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {byCol(col.key).map(c => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={e => onDragStart(e, c.id)}
                      className={`rounded-lg border p-2 cursor-grab active:cursor-grabbing select-none ${
                        sel.has(c.id) ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={sel.has(c.id)}
                          onChange={() => toggleSel(c.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{c.name}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {[c.city, c.cantone].filter(Boolean).join(' · ') || '—'}
                            {!c.isCompany && ' · privato'}
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            {fmtCHF(c.fatturato)} · {c.ordini} ord.
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {c.venditore || 'nessun venditore'}
                          </div>
                        </div>
                        {(() => {
                          const tr = calcTrend(c.serie);
                          return (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setDetail(c); }}
                              title="Vedi andamento"
                              className="shrink-0 flex flex-col items-end gap-0.5 hover:opacity-80"
                            >
                              <Sparkline serie={c.serie} color={trendColor(tr.dir)} />
                              <span className="text-[10px]" style={{ color: trendColor(tr.dir) }}>
                                {trendIcon(tr.dir)} {tr.pct > 0 ? `+${tr.pct}%` : `${tr.pct}%`}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                  {byCol(col.key).length === 0 && (
                    <div className="text-center text-xs text-slate-500 py-8 border border-dashed border-slate-700 rounded-lg">
                      Trascina qui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && <DettaglioModal c={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
