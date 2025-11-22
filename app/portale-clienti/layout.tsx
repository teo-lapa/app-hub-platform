'use client';

import { CustomerLayout } from '@/components/portale-clienti/CustomerLayout';

export default function PortaleClientiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CustomerLayout>
      {children}
    </CustomerLayout>
  );
}
