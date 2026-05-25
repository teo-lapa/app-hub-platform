'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/authStore';

type Leave = {
  id: number;
  employee_id: number;
  employee_name: string;
  type_id: number;
  type_name: string;
  date_from: string;
  date_to: string;
  days: number;
  state: string;
  state_label: string;
  note: string;
  created: string;
};

const ADMIN_EMAILS = ['paul@lapa.ch', 'laura@lapa.ch'];

const STATE_COLOR: Record<string, string> = {
  confirm: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  validate1: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  validate: 'bg-green-500/20 text-green-300 border-green-500/40',
  refuse: 'bg-red-500/20 text-red-300 border-red-500/40',
  draft: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
};

function formatIT(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function FerieAdminPage() {
  const { user, isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();
  const router = useRouter();

  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  const [editing, setEditing] = useState<Leave | null>(null);
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    const email = (user?.email || '').toLowerCase();
    const isAdmin = user?.role === 'admin' || ADMIN_EMAILS.includes(email);
    if (!isAdmin) {
      toast.error('Accesso riservato a Paul e Laura');
      router.push('/ferie');
    }
  }, [authLoading, isAuthenticated, user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ferie/admin?filter=${tab}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setLeaves(data.leaves);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAuthenticated]);

  const approve = async (id: number) => {
    setActionId(id);
    try {
      const res = await fetch('/api/ferie/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      toast.success('Approvata');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionId(null);
    }
  };

  const refuse = async (id: number) => {
    const reason = prompt('Motivo del rifiuto (opzionale):') || '';
    setActionId(id);
    try {
      const res = await fetch('/api/ferie/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'refuse', refuse_reason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      toast.success('Rifiutata');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionId(null);
    }
  };

  const openEdit = (l: Leave) => {
    setEditing(l);
    setEditFrom(l.date_from);
    setEditTo(l.date_to);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editFrom || !editTo || editTo < editFrom) {
      toast.error('Date non valide');
      return;
    }
    setActionId(editing.id);
    try {
      const res = await fetch('/api/ferie/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, action: 'modify', date_from: editFrom, date_to: editTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      toast.success('Date aggiornate');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionId(null);
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, Leave[]>();
    for (const l of leaves) {
      const k = l.employee_name;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [leaves]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Caricamento…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pb-24">
      <div className="sticky top-0 z-10 backdrop-blur-lg bg-slate-900/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/ferie')} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">← Indietro</button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold">✅ Approvazioni Ferie</h1>
            <p className="text-xs text-white/60">Paul &amp; Laura</p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2">
          <button onClick={() => setTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'pending' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}>
            Da approvare ({leaves.filter(l => ['confirm', 'validate1'].includes(l.state)).length})
          </button>
          <button onClick={() => setTab('all')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'all' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}>
            Tutte (ultimi 6 mesi)
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {leaves.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/60">
            {tab === 'pending' ? '🎉 Nessuna richiesta in attesa' : 'Nessuna richiesta'}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([emp, items]) => (
              <div key={emp}>
                <h3 className="text-lg font-semibold mb-2 text-white/90">{emp}</h3>
                <div className="space-y-2">
                  {items.map(l => (
                    <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-semibold">{l.type_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATE_COLOR[l.state] || ''}`}>{l.state_label}</span>
                        <span className="text-sm text-white/70 ml-auto">{formatIT(l.date_from)} → {formatIT(l.date_to)} <span className="text-white/50">({l.days} gg)</span></span>
                      </div>
                      {l.note && <div className="text-xs text-white/60 mb-2">"{l.note}"</div>}
                      {['confirm', 'validate1'].includes(l.state) && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => approve(l.id)}
                            disabled={actionId === l.id}
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                          >
                            ✓ Approva
                          </button>
                          <button
                            onClick={() => refuse(l.id)}
                            disabled={actionId === l.id}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                          >
                            ✗ Rifiuta
                          </button>
                          <button
                            onClick={() => openEdit(l)}
                            disabled={actionId === l.id}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium disabled:opacity-50"
                          >
                            ✏️ Modifica date
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-800 border border-white/10 rounded-2xl p-5 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-1">Modifica date</h3>
            <p className="text-xs text-white/60 mb-4">{editing.employee_name} · {editing.type_name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60 block mb-1">Da</label>
                <input type="date" value={editFrom} onChange={e => setEditFrom(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1">A</label>
                <input type="date" value={editTo} onChange={e => setEditTo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">Annulla</button>
              <button onClick={saveEdit} disabled={actionId === editing.id} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold">Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
