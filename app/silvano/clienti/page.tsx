'use client';
import { useEffect, useState, useCallback } from 'react';
import { Search, X, User, Mail, Phone, MapPin, FileText, Wallet, Receipt, Contact, Lock } from 'lucide-react';
import { Card, Badge, Spinner, Empty, fmtCHF, fmtDate } from '../_components/ui';

interface ClienteRow {
  id: number; name: string; email?: string; phone?: string;
  street?: string; city?: string; zip?: string; lat?: number; lng?: number;
  totalInvoiced: number; credit: number;
}
interface Anagrafica {
  id: number; name: string; email?: string; phone?: string; vat?: string;
  address?: string; note?: string; pricelist?: string; paymentTerm?: string;
  salesperson?: string; totalInvoiced: number; credit: number;
}
interface Contatto { id: number; name: string; type: string; address?: string; phone?: string; email?: string }
interface Fattura { id: number; name: string; date?: string; dueDate?: string; total: number; residual: number; paymentState: string }
interface Scheda { cliente: Anagrafica; contatti: Contatto[]; fatture: Fattura[] }

const typeLabel = (t: string) =>
  ({ delivery: 'Consegna', invoice: 'Fattura', contact: 'Contatto', other: 'Altro' } as Record<string, string>)[t] || 'Altro';

function PaymentBadge({ state }: { state: string }) {
  if (state === 'paid') return <Badge color="green">Pagata</Badge>;
  if (state === 'not_paid') return <Badge color="red">Da pagare</Badge>;
  if (state === 'partial') return <Badge color="amber">Parziale</Badge>;
  return <Badge color="slate">{state || '—'}</Badge>;
}

export default function ClientiPage() {
  const [q, setQ] = useState('');
  const [clienti, setClienti] = useState<ClienteRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selId, setSelId] = useState<number | null>(null);
  const [scheda, setScheda] = useState<Scheda | null>(null);
  const [loadingScheda, setLoadingScheda] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoadingList(true);
      const r = await fetch(`/api/silvano/clienti?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (d.success) setClienti(d.clienti);
      setLoadingList(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const openCliente = useCallback(async (id: number) => {
    setSelId(id); setScheda(null); setLoadingScheda(true);
    const r = await fetch(`/api/silvano/cliente/${id}`);
    const d = await r.json();
    if (d.success) setScheda({ cliente: d.cliente, contatti: d.contatti || [], fatture: d.fatture || [] });
    setLoadingScheda(false);
  }, []);

  const close = () => { setSelId(null); setScheda(null); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* ===== Lista ===== */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente…"
            className="w-full rounded-xl border border-white/10 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400" />
        </div>

        {loadingList ? <Spinner /> : !clienti.length ? <Empty>Nessun cliente</Empty> : (
          <div className="space-y-2">
            {clienti.map((c) => (
              <button key={c.id} onClick={() => openCliente(c.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  selId === c.id ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{c.name}</div>
                  {c.city && <div className="text-xs text-slate-500">{c.city}</div>}
                </div>
                <div className="shrink-0 text-sm font-semibold text-emerald-300">{fmtCHF(c.totalInvoiced)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Scheda (desktop) ===== */}
      <div className="hidden lg:block">
        {!selId ? (
          <Card className="p-8"><Empty>Seleziona un cliente per vedere la scheda</Empty></Card>
        ) : loadingScheda || !scheda ? (
          <Card className="p-8"><Spinner /></Card>
        ) : (
          <SchedaCliente scheda={scheda} />
        )}
      </div>

      {/* ===== Scheda (mobile overlay) ===== */}
      {selId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 lg:hidden" onClick={close}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button onClick={close} className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:text-white"><X size={18} /></button>
            </div>
            {loadingScheda || !scheda ? <Card className="p-8"><Spinner /></Card> : <SchedaCliente scheda={scheda} />}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 text-slate-500">{icon}</span>
      <span className="text-slate-400">{label}</span>
      <span className="ml-auto text-right font-medium text-white">{value}</span>
    </div>
  );
}

function SchedaCliente({ scheda }: { scheda: Scheda }) {
  const { cliente: c, contatti, fatture } = scheda;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400">
        <Lock size={13} /> Scheda in sola lettura — le modifiche passano dall'assistente
      </div>

      {/* Anagrafica */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-white">
          <User size={18} /> <span className="text-lg font-semibold">{c.name}</span>
        </div>
        <div className="space-y-2">
          <Row icon={<FileText size={15} />} label="P.IVA" value={c.vat} />
          <Row icon={<MapPin size={15} />} label="Indirizzo" value={c.address} />
          <Row icon={<Mail size={15} />} label="Email" value={c.email} />
          <Row icon={<Phone size={15} />} label="Telefono" value={c.phone} />
          <Row icon={<Receipt size={15} />} label="Listino" value={c.pricelist} />
          <Row icon={<Receipt size={15} />} label="Termini" value={c.paymentTerm} />
          <Row icon={<User size={15} />} label="Venditore" value={c.salesperson} />
          {c.note && <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">{c.note}</div>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-xs text-slate-400">Fatturato</div>
            <div className="font-semibold text-emerald-300">{fmtCHF(c.totalInvoiced)}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400"><Wallet size={13} /> Credito aperto</div>
            <div className={`font-semibold ${c.credit > 0 ? 'text-amber-300' : 'text-white'}`}>{fmtCHF(c.credit)}</div>
          </div>
        </div>
      </Card>

      {/* Contatti */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-white">
          <Contact size={18} /> <span className="font-semibold">Contatti e indirizzi di consegna</span>
        </div>
        {!contatti.length ? <Empty>Nessun contatto</Empty> : (
          <div className="space-y-2">
            {contatti.map((ct) => (
              <div key={ct.id} className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-white">{ct.name}</div>
                  <Badge color="blue">{typeLabel(ct.type)}</Badge>
                </div>
                {ct.address && <div className="mt-1 text-xs text-slate-400">{ct.address}</div>}
                {ct.phone && <div className="text-xs text-slate-500">{ct.phone}</div>}
                {ct.email && <div className="text-xs text-slate-500">{ct.email}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Fatture */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-white">
          <Receipt size={18} /> <span className="font-semibold">Fatture</span>
        </div>
        {!fatture.length ? <Empty>Nessuna fattura</Empty> : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-medium">Numero</th>
                  <th className="py-2 pr-2 font-medium">Data</th>
                  <th className="py-2 pr-2 text-right font-medium">Totale</th>
                  <th className="py-2 pr-2 text-right font-medium">Residuo</th>
                  <th className="py-2 font-medium">Stato</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fatture.map((f) => (
                  <tr key={f.id} className="border-t border-white/5">
                    <td className="py-2 pr-2 text-white">{f.name}</td>
                    <td className="py-2 pr-2 text-slate-400">{fmtDate(f.date)}</td>
                    <td className="py-2 pr-2 text-right text-white">{fmtCHF(f.total)}</td>
                    <td className="py-2 pr-2 text-right text-amber-300">{fmtCHF(f.residual)}</td>
                    <td className="py-2"><PaymentBadge state={f.paymentState} /></td>
                    <td className="py-2 pl-2 text-right">
                      <a href={`/api/silvano/fattura/${f.id}/pdf`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30">
                        <FileText size={13} /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
