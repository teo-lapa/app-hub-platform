import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Time & Attendance | AppHub',
  description: 'Gestione presenze e timbrature dipendenti',
  manifest: '/manifest.json',
  themeColor: '#3B82F6',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function TimeAttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
