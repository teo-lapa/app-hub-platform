import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Avatar Video Generator - LAPA App',
  description: 'Crea video personalizzati con avatar AI. Carica una foto, personalizza look e genera video professionali con script personalizzati.',
  keywords: 'avatar, video generator, AI, personalizzazione, LAPA, video marketing',
  openGraph: {
    title: 'Avatar Video Generator - LAPA App',
    description: 'Crea video personalizzati con avatar AI',
    type: 'website',
  },
};

export default function AvatarGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
