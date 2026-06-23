import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Stella Live',
  manifest: '/stella-live.webmanifest',
  appleWebApp: { capable: true, title: 'Stella Live', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/stella-192.png' },
};

export const viewport: Viewport = { themeColor: '#0b1e3a' };

export default function StellaLiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
