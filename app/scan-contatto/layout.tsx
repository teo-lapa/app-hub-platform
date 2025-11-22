import type { Metadata } from 'next';
import { QueryProvider } from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'Scan Contatto | AppHub Platform',
  description: 'Scansiona biglietti visita e crea contatti in Odoo automaticamente',
  openGraph: {
    title: 'Scan Contatto | AppHub Platform',
    description: 'Scansiona biglietti visita e crea contatti in Odoo automaticamente',
    type: 'website',
  },
};

export default function ScanContattoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="safe-area-inset-top safe-area-inset-bottom">
        {children}
      </div>
    </QueryProvider>
  );
}
