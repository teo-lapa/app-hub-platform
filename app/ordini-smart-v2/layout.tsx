import { QueryProvider } from '@/components/providers/QueryProvider';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OrdiniSmartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QueryProvider>{children}</QueryProvider>;
}
