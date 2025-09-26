import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { PWAInstaller } from '@/components/pwa/PWAInstaller';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LAPA App - Fornitore Finest Italian Food',
  description: 'Piattaforma LAPA per grossisti alimentari. Gestisci ordini ristoranti, clienti e dipendenti.',
  keywords: 'LAPA, grossista, fornitore ristoranti, italian food, ordini, clienti, dipendenti, PWA',
  authors: [{ name: 'LAPA Team' }],
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  robots: 'index, follow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LAPA App',
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
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'LAPA App',
    'application-name': 'LAPA App',
    'msapplication-TileColor': '#dc2626',
    'msapplication-config': '/browserconfig.xml',
    'theme-color': '#dc2626',
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
          <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5Q0EzQUYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMSIvPjxjaXJjbGUgY3g9IjQ1IiBjeT0iNDUiIHI9IjEiLz48Y2lyY2xlIGN4PSI0NSIgY3k9IjE1IiByPSIxIi8+PGNpcmNsZSBjeD0iMTUiIGN5PSI0NSIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
            {children}
            <PWAInstaller />
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                color: 'inherit',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}