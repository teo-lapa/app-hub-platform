import type { ReactNode } from 'react';
import '../../wine-tokens.css';

export default function WineLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--wine-cream)',
        color: 'var(--wine-ink)',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  );
}
