import { QueryProvider } from '@/components/providers/QueryProvider';
import { MaestroFiltersProvider } from '@/contexts/MaestroFiltersContext';
import { Toaster } from 'react-hot-toast';
import { HomeButton } from '@/components/maestro/HomeButton';
import { ChatWidget } from '@/components/maestro/ChatWidget';

export default function MaestroAILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <MaestroFiltersProvider>
        <div className="safe-area-inset-top safe-area-inset-bottom">
          {children}
        </div>
        <HomeButton />
        <ChatWidget />
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
      </MaestroFiltersProvider>
    </QueryProvider>
  );
}
