import '../w/wine-tokens.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'LAPA WINE — Flotta',
  description: 'Backoffice operativo LAPA × Vergani',
};

export default function LapaWineFlottaLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--neutral-25)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'var(--neutral-900)',
      }}
    >
      <header
        style={{
          height: 52,
          padding: '0 22px',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'var(--neutral-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: 'var(--lapa-red-600)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Link
              href="/lapa-wine-flotta"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--neutral-900)',
                textDecoration: 'none',
                letterSpacing: '-0.01em',
              }}
            >
              LAPA Hub
            </Link>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--lapa-red-700)',
              }}
            >
              Wine
            </span>
            <span
              style={{
                marginLeft: 8,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                background: 'var(--lapa-red-600)',
                color: '#fff',
                padding: '3px 6px',
                borderRadius: 2,
              }}
            >
              BETA
            </span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>
          Backoffice operativo · LAPA × Vergani
        </div>
      </header>
      {children}
    </div>
  );
}
