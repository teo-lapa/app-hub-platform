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
  // Non blocchiamo l'orientamento - permette rotazione libera
};

export default function RegistroCassaforteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* CSS per supportare qualsiasi orientamento */}
      <style jsx global>{`
        @media screen and (orientation: portrait) {
          .registro-cassaforte-container {
            /* Stili per portrait */
          }
        }
        @media screen and (orientation: landscape) {
          .registro-cassaforte-container {
            /* Stili per landscape */
          }
        }
      `}</style>
      {children}
    </>
  );
}
