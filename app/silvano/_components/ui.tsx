'use client';
import React from 'react';

export const fmtCHF = (n: number) =>
  'CHF ' + (Number(n) || 0).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number) =>
  (Number(n) || 0).toLocaleString('it-CH', { maximumFractionDigits: 2 });

export const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('it-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-500/20 text-slate-200',
    green: 'bg-emerald-500/20 text-emerald-300',
    amber: 'bg-amber-500/20 text-amber-300',
    red: 'bg-red-500/20 text-red-300',
    blue: 'bg-blue-500/20 text-blue-300',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[color] || map.slate}`}>{children}</span>;
}

export function Spinner({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-300">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-16 text-center text-slate-400">{children}</div>;
}
