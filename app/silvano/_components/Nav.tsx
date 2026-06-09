'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Users, ClipboardList, BarChart3, Map, Home } from 'lucide-react';

const LINKS = [
  { href: '/silvano', label: 'Catalogo', icon: ShoppingCart, exact: true },
  { href: '/silvano/clienti', label: 'Clienti', icon: Users },
  { href: '/silvano/ordini', label: 'Ordini', icon: ClipboardList },
  { href: '/silvano/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/silvano/mappa', label: 'Mappa', icon: Map },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/silvano" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🧀</span>
          <div className="leading-tight">
            <div className="font-bold text-white">Area Venditore</div>
            <div className="text-[11px] text-emerald-300">LAPA · Silvano Barbera</div>
          </div>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.exact ? path === l.href : path.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <Home size={16} />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
