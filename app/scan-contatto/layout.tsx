import type { Metadata } from 'next';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from 'react-hot-toast';

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
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryProvider>
  );
}
