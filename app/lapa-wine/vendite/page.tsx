'use client';

import Header from '../_components/Header';
import BottomNav from '../_components/BottomNav';

export default function VenditePage() {
  return (
    <>
      <Header subtitle="Analytics" title="Vendite" back="/lapa-wine" />
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
        <div style={{ fontSize: 13 }}>
          Trend vendite, margini per etichetta, performance per coperto.
        </div>
      </div>
      <BottomNav />
    </>
  );
}
