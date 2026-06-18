import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Romeo',
  manifest: '/romeo.webmanifest',
  appleWebApp: { capable: true, title: 'Romeo', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/romeo-192.png' },
};

export const viewport: Viewport = { themeColor: '#0c3330' };

export default function RomeoVoceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
