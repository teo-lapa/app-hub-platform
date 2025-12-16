import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spese Dipendenti | AppHub',
  description: 'Registra spese con foto scontrino - AI automatica',
  manifest: '/manifest.json',
  themeColor: '#3B82F6',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function SpeseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
