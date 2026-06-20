import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Assistente LAPA — La tua AI del mondo Food',
  description: 'Parla con l\'assistente AI di LAPA: ordini, fatture, ricette e novità. Il mondo Food italiano in tasca.',
};

export default function AppClientiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#f7f6f3] dark:bg-[#15151f]">
      {children}
    </div>
  );
}
