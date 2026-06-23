import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Romeo Live',
  manifest: '/romeo-live.webmanifest',
  appleWebApp: { capable: true, title: 'Romeo Live', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/romeo-192.png' },
};

export const viewport: Viewport = { themeColor: '#0b2a26' };

export default function RomeoLiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
