'use client';

import Link from 'next/link';
import Header from '../_components/Header';
import BottomNav from '../_components/BottomNav';

export default function CartaPage() {
  return (
    <>
      <Header subtitle="Wine list" title="Carta" back="/lapa-wine" />
      <div
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          color: 'var(--fg-3, #6b5f52)',
        }}
      >
        <div
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 22,
            fontStyle: 'italic',
            color: 'var(--fg-1, #1c1815)',
            marginBottom: 8,
          }}
        >
          Coming soon
        </div>
        <div style={{ fontSize: 13, marginBottom: 24 }}>
          Carta dei vini con prezzi al pubblico, abbinamenti, descrizioni.
        </div>
        <Link
          href="/lapa-wine/carica-menu"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: 'var(--lapa-red-700, #951616)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Carica menu ristorante
        </Link>
      </div>
      <BottomNav />
    </>
  );
}
