import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Stella',
  manifest: '/stella.webmanifest',
  appleWebApp: { capable: true, title: 'Stella', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/stella-192.png' },
};

export const viewport: Viewport = { themeColor: '#0b1e3a' };

export default function StellaVoceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
