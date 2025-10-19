import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { PWAInstaller } from '@/components/pwa/PWAInstaller';
import { Toaster } from 'react-hot-toast';
import { OfflineIndicator } from '@/components/maestro/OfflineIndicator';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LAPA App - Fornitore Finest Italian Food',
  description: 'Piattaforma LAPA per grossisti alimentari. Gestisci ordini ristoranti, clienti e dipendenti.',
  keywords: 'LAPA, grossista, fornitore ristoranti, italian food, ordini, clienti, dipendenti, PWA, Maestro AI',
  authors: [{ name: 'LAPA Team' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, user-scalable=yes',
  robots: 'index, follow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LAPA App',
    startupImage: [
      {
        url: '/logos/logo-monday.png',
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
  openGraph: {
    title: 'LAPA App - Fornitore Finest Italian Food',
    description: 'Piattaforma LAPA per grossisti alimentari. Ordini per ristoranti e gestione aziendale.',
    type: 'website',
    locale: 'it_IT',
    siteName: 'LAPA App Platform',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'LAPA App',
    'application-name': 'LAPA App',
    'msapplication-TileColor': '#dc2626',
    'msapplication-config': '/browserconfig.xml',
    'theme-color': '#dc2626',
    'format-detection': 'telephone=no',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <>
            {children}
            <OfflineIndicator />
            <Toaster position="top-right" />
          </>
        </ThemeProvider>
      </body>
    </html>
  );
}