'use client';

interface OdooOrderLinkProps {
  orderId: number;
  orderName: string;
}

export default function OdooOrderLink({ orderId, orderName }: OdooOrderLinkProps) {
  const odooUrl = `https://erp.smartcash.cloud/web#id=${orderId}&model=sale.order&view_type=form`;

  return (
    <div className="mt-4 animate-pulse-slow">
      <a
        href={odooUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        style={{
          fontSize: '16px',
          lineHeight: '1.5',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ animation: 'bounce-subtle 1s ease-in-out infinite' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        <div className="flex flex-col items-start">
          <span className="text-sm opacity-90">Apri in Odoo</span>
          <span className="text-lg font-extrabold">{orderName}</span>
        </div>
        <svg
          className="w-5 h-5 opacity-75"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(236, 72, 153, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(168, 85, 247, 0.6), 0 0 60px rgba(236, 72, 153, 0.4);
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}
