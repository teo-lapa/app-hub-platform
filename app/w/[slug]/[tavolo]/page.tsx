import Link from 'next/link';
import { getTenant } from '../../_data';

type Params = { slug: string; tavolo: string };

export default function SplashPage({ params }: { params: Params }) {
  const tenant = getTenant(params.slug);
  const chatHref = `/w/${params.slug}/${params.tavolo}/chat`;
  const ink = '#1c1815';
  const sub = '#6b5f52';

  return (
    <main
      className="wine-surface"
      style={{
        background: tenant.cream,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* QR context strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px 0',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 9.5,
            letterSpacing: '0.22em',
            color: '#9a8c78',
            textTransform: 'uppercase',
          }}
        >
          via QR · tavolo {params.tavolo}
        </span>
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 500,
            color: sub,
          }}
        >
          IT
        </span>
      </div>

      {/* Identity + greeting */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 36px 16px',
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            border: `1px solid ${ink}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Fraunces, serif',
            fontStyle: tenant.monoStyle,
            fontSize: 32,
            color: ink,
            fontWeight: 300,
          }}
        >
          {tenant.monogram}
        </div>

        <h1
          style={{
            marginTop: 22,
            font: 'var(--text-display-serif)',
            fontSize: 32,
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            color: ink,
            fontStyle: 'italic',
            fontWeight: 300,
          }}
        >
          {tenant.name}
        </h1>

        <div
          style={{
            marginTop: 12,
            fontFamily: 'Inter, sans-serif',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: sub,
          }}
        >
          Carta vini digitale · Powered by LAPA
        </div>

        <p
          style={{
            marginTop: 30,
            fontFamily: 'Fraunces, serif',
            fontSize: 18,
            fontStyle: 'italic',
            color: ink,
            fontWeight: 300,
            lineHeight: 1.3,
            whiteSpace: 'pre-line',
          }}
        >
          {`Buonasera, sono il sommelier\ndigitale di ${tenant.short}.`}
        </p>
      </div>

      {/* CTA buttons */}
      <div
        style={{
          flexShrink: 0,
          padding: '0 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <Link
          href={chatHref}
          style={{
            height: 52,
            background: 'transparent',
            border: `1px solid ${ink}`,
            color: ink,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12.5,
            fontWeight: 500,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Continua come ospite
        </Link>

        {/* TODO: collegare Google OAuth */}
        <Link
          href={chatHref}
          style={{
            background: 'transparent',
            border: `1px solid ${ink}`,
            color: ink,
            cursor: 'pointer',
            padding: '11px 16px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textDecoration: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
            />
            <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" />
            <path
              fill="#EA4335"
              d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z"
            />
          </svg>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12.5,
                fontWeight: 500,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: ink,
              }}
            >
              Accedi con Google
            </div>
            <div
              style={{
                marginTop: 2,
                fontFamily: 'Fraunces, serif',
                fontSize: 11,
                fontStyle: 'italic',
                color: sub,
                fontWeight: 300,
              }}
            >
              Ricordiamo cosa ti piace per la prossima volta
            </div>
          </div>
        </Link>

        <div
          style={{
            marginTop: 6,
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
            fontSize: 10,
            color: sub,
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          Salviamo solo nome ed email. Niente di più.
        </div>
      </div>
    </main>
  );
}
