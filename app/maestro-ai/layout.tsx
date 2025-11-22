import { QueryProvider } from '@/components/providers/QueryProvider';
import { MaestroFiltersProvider } from '@/contexts/MaestroFiltersContext';
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
      </MaestroFiltersProvider>
    </QueryProvider>
  );
}
