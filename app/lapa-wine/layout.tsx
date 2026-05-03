import '../w/wine-tokens.css';
import type { ReactNode } from 'react';

export default function LapaWineLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--wine-paper, #fbf8f1)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'var(--wine-ink, #1c1815)',
        paddingBottom: 72,
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--neutral-0, #fff)' }}>
        {children}
      </div>
    </div>
  );
}
