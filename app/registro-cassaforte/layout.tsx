import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Registro Cassaforte | LAPA Hub',
  description: 'Registro versamenti in cassaforte',
};

// Permetti la rotazione dello schermo per questa pagina (tablet capovolto)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RegistroCassaforteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
