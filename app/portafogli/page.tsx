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
  fatturato: number;
  ordini: number;
  col: Col;
  origCol: Col;
};

const COLS: { key: Col; titolo: string; sotto: string; accent: string }[] = [
  { key: 'mihai', titolo: 'Mihai', sotto: 'Clienti di Mihai', accent: 'border-blue-500/60 bg-blue-500/5' },
  { key: 'centro', titolo: 'Resto / Azienda', sotto: 'Tutto il resto', accent: 'border-slate-500/50 bg-slate-500/5' },
  { key: 'silvano', titolo: 'Silvano', sotto: 'Nuovo venditore', accent: 'border-emerald-500/60 bg-emerald-500/5' },
];

const fmtCHF = (n: number) =>
  'CHF ' + (n || 0).toLocaleString('it-CH', { maximumFractionDigits: 0 });

export default function PortafogliPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());

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
          changes: changes.map(c => ({ id: c.id, target: c.col })),
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
    </div>
  );
}
