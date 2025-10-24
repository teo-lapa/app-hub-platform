'use client';

import { CustomerLayout } from '@/components/portale-clienti/CustomerLayout';
import { Toaster } from 'react-hot-toast';

export default function PortaleClientiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CustomerLayout>
      {children}
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
    </CustomerLayout>
  );
}
