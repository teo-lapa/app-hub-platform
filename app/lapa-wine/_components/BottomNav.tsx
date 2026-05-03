'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wine, TrendingUp, BookOpen, Package } from 'lucide-react';

const items = [
  { href: '/lapa-wine', label: 'Home', icon: Home },
  { href: '/lapa-wine/cantina', label: 'Cantina', icon: Wine },
  { href: '/lapa-wine/vendite', label: 'Vendite', icon: TrendingUp },
  { href: '/lapa-wine/carta', label: 'Carta', icon: BookOpen },
  { href: '/lapa-wine/ordini', label: 'Ordini', icon: Package },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        background: '#fff',
        borderTop: '1px solid var(--border, #e5e2dd)',
        paddingBottom: 12,
        paddingTop: 6,
        zIndex: 50,
      }}
    >
      {items.map((it) => {
        const active = it.href === '/lapa-wine' ? pathname === it.href : pathname.startsWith(it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '6px 0',
              textDecoration: 'none',
              color: active ? 'var(--lapa-red-700, #951616)' : 'var(--fg-3, #6b5f52)',
            }}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
