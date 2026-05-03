'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import { ChevronRight, Sparkles, Truck, MapPin, Calendar } from 'lucide-react';

// TODO Prisma: caricare ristorante per slug + sales_orders + suggerimenti AI
type Detail = {
  slug: string;
  id: string;
  name: string;
  address: string;
  ownerName: string;
  ownerRole: string;
  customerSince: string;
  responsabile: { name: string; initials: string };
  sales: { month: string; revenue: number }[];
  labels: {
    name: string;
    maker: string;
    sold: number;
    stock: number;
    sellThrough: number;
  }[];
  contoVendita: { spent: number; cap: number; reset: string; quarterAvg: number };
  aiSuggestion: { product: string; rationale: string };
  crossSell: { headline: string; probability: 'alta' | 'media' | 'bassa'; nextAction: string };
};

const DETAILS: Record<string, Detail> = {
  'trattoria-da-mario': {
    slug: 'trattoria-da-mario',
    id: 'ZH-014',
    name: 'Trattoria da Mario',
    address: 'Bahnhofstrasse 47, 8001 Zürich',
    ownerName: 'Mario Bianchi',
    ownerRole: 'Proprietario',
    customerSince: '02.2024',
    responsabile: { name: 'Mihai Popescu', initials: 'MP' },
    sales: [
      { month: 'Dic', revenue: 2420 },
      { month: 'Gen', revenue: 2190 },
      { month: 'Feb', revenue: 2940 },
      { month: 'Mar', revenue: 2710 },
      { month: 'Apr', revenue: 3230 },
      { month: 'Mag', revenue: 3690 },
    ],
    labels: [
      { name: 'Romeo · Mura Mura', maker: 'Romeo', sold: 42, stock: 4, sellThrough: 88 },
      { name: "L'Anima Amarone", maker: 'Vergani', sold: 28, stock: 2, sellThrough: 72 },
      { name: "L'Anima Bianco", maker: 'Vergani', sold: 36, stock: 12, sellThrough: 64 },
      { name: 'Prosecco Brut', maker: 'Vergani', sold: 52, stock: 16, sellThrough: 76 },
      { name: 'Gavi del Comune', maker: 'La Scolca', sold: 18, stock: 9, sellThrough: 41 },
      { name: 'Berta Bric del Gaian', maker: 'Berta', sold: 8, stock: 3, sellThrough: 28 },
    ],
    contoVendita: { spent: 2847, cap: 5000, reset: '30.06.2026', quarterAvg: 4200 },
    aiSuggestion: {
      product: "L'Anima Rosé",
      rationale:
        "Target estivo, margine 38%. Tre ristoranti simili (zona ZH, scontrino medio CHF 65) lo hanno introdotto a maggio con sell-through 78% nel primo mese.",
    },
    crossSell: {
      headline: 'Compra vino da 4 mesi, mai food.',
      probability: 'alta',
      nextAction: 'visita Mihai 12.05',
    },
  },
};

function fallbackDetail(slug: string): Detail {
  // TODO Prisma: rimpiazzare con fetch reale
  return { ...DETAILS['trattoria-da-mario'], slug, name: slug.replace(/-/g, ' ') };
}

const fmtCHF = (n: number) => `CHF ${n.toLocaleString('de-CH').replace(/,/g, "'")}`;

export default function RestaurantDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const d = DETAILS[slug] ?? fallbackDetail(slug);
  const totalSales = d.sales.reduce((a, b) => a + b.revenue, 0);
  const contoPct = Math.round((d.contoVendita.spent / d.contoVendita.cap) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 52px)' }}>
      {/* Breadcrumb topbar */}
      <div
        style={{
          height: 44,
          padding: '0 22px',
          borderBottom: '1px solid var(--neutral-100)',
          background: 'var(--neutral-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--neutral-500)',
          }}
        >
          <Link
            href="/lapa-wine-flotta"
            style={{ color: 'var(--neutral-500)', textDecoration: 'none' }}
          >
            Flotta
          </Link>
          <ChevronRight size={12} />
          <span style={{ color: 'var(--neutral-900)', fontWeight: 500 }}>{d.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              height: 28,
              padding: '0 12px',
              background: 'transparent',
              border: '1px solid var(--neutral-200)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--neutral-700)',
            }}
          >
            Esporta
          </button>
          <button
            style={{
              height: 28,
              padding: '0 12px',
              background: 'var(--lapa-red-600)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Pianifica visita
          </button>
        </div>
      </div>

      {/* Header card */}
      <div
        style={{
          padding: '20px 22px 16px',
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-100)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--neutral-500)',
            }}
          >
            Cliente · {d.id}
          </div>
          <div
            style={{
              fontSize: 28,
              fontStyle: 'italic',
              color: 'var(--neutral-900)',
              marginTop: 4,
              fontWeight: 400,
              fontFamily: 'Fraunces, serif',
              textTransform: 'capitalize',
            }}
          >
            {d.name}
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 16,
              fontSize: 12,
              color: 'var(--neutral-700)',
              alignItems: 'center',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> {d.address}
            </span>
            <span style={{ color: 'var(--neutral-300)' }}>·</span>
            <span>
              {d.ownerName} · {d.ownerRole}
            </span>
            <span style={{ color: 'var(--neutral-300)' }}>·</span>
            <span>Cliente da {d.customerSince}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--neutral-500)',
            }}
          >
            Responsabile LAPA
          </div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--lapa-red-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--lapa-red-700)',
              }}
            >
              {d.responsabile.initials}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-900)' }}>
              {d.responsabile.name}
            </div>
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div
        style={{
          flex: 1,
          padding: '16px 22px',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 16,
          overflow: 'auto',
        }}
      >
        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sales chart */}
          <div
            style={{
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--neutral-500)',
                  }}
                >
                  Vendite vino · 6 mesi
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--neutral-900)',
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtCHF(totalSales)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--success-700)' }}>
                +14% vs sem. precedente
              </div>
            </div>
            <div style={{ marginTop: 16, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.sales} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--neutral-100)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--neutral-400)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--neutral-50)' }}
                    contentStyle={{
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-200)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [fmtCHF(v), 'Vendite']}
                  />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                    {d.sales.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          i === d.sales.length - 1
                            ? 'var(--lapa-red-600)'
                            : 'var(--lapa-red-300)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sell-through */}
          <div
            style={{
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--neutral-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-900)' }}>
                Etichette · sell-through
              </div>
              <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>
                Ultime 4 settimane
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {d.labels.map((r, i) => (
                  <tr
                    key={r.name}
                    style={{
                      borderBottom:
                        i < d.labels.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                    }}
                  >
                    <td style={{ padding: '10px 18px' }}>
                      <div style={{ color: 'var(--neutral-900)', fontWeight: 500 }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                        {r.maker}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'var(--text-mono, ui-monospace, monospace)',
                        color: 'var(--neutral-700)',
                      }}
                    >
                      {r.sold} btl
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'var(--text-mono, ui-monospace, monospace)',
                        color: 'var(--neutral-500)',
                      }}
                    >
                      stock {r.stock}
                    </td>
                    <td style={{ padding: '10px 18px', width: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 4,
                            background: 'var(--neutral-100)',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${r.sellThrough}%`,
                              height: '100%',
                              background:
                                r.sellThrough > 60
                                  ? 'var(--success-500)'
                                  : r.sellThrough > 35
                                    ? 'var(--warning-500)'
                                    : 'var(--danger-500)',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--neutral-900)',
                            width: 32,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {r.sellThrough}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AI suggestion */}
          <div
            style={{
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderLeft: '3px solid var(--lapa-red-600)',
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} color="var(--lapa-red-700)" />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--lapa-red-700)',
                }}
              >
                Stella · suggerimenti
              </span>
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: 'Fraunces, serif',
                fontSize: 18,
                fontStyle: 'italic',
                lineHeight: 1.4,
                color: 'var(--neutral-900)',
                fontWeight: 400,
              }}
            >
              Da proporre:{' '}
              <strong style={{ fontWeight: 500 }}>{d.aiSuggestion.product}</strong>.
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: 'var(--neutral-700)',
                lineHeight: 1.55,
              }}
            >
              {d.aiSuggestion.rationale}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button
                style={{
                  height: 30,
                  padding: '0 14px',
                  background: 'var(--lapa-red-600)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Aggiungi a pitch
              </button>
              <button
                style={{
                  height: 30,
                  padding: '0 14px',
                  background: 'transparent',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 6,
                  color: 'var(--neutral-700)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Scarta
              </button>
            </div>
          </div>

          {/* Cross-sell */}
          <div
            style={{
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--neutral-500)',
              }}
            >
              Cross-sell · Food
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: 'Fraunces, serif',
                fontSize: 16,
                fontStyle: 'italic',
                lineHeight: 1.4,
                color: 'var(--neutral-900)',
              }}
            >
              {d.crossSell.headline}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: 'var(--neutral-700)',
                lineHeight: 1.55,
              }}
            >
              Probabilità di conversione:{' '}
              <span
                style={{
                  color:
                    d.crossSell.probability === 'alta'
                      ? 'var(--success-700)'
                      : d.crossSell.probability === 'media'
                        ? 'var(--warning-700)'
                        : 'var(--neutral-500)',
                  fontWeight: 600,
                }}
              >
                {d.crossSell.probability}
              </span>
              . Catalogo affine: salumi DOP Piemonte, formaggi Valle d'Aosta.
            </div>
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'var(--neutral-25)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Truck size={14} color="var(--neutral-500)" />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--neutral-700)' }}>
                Prossima azione:{' '}
                <strong style={{ color: 'var(--neutral-900)' }}>{d.crossSell.nextAction}</strong>
              </div>
              <ChevronRight size={14} color="var(--neutral-400)" />
            </div>
          </div>

          {/* Conto vendita Vergani */}
          <div
            style={{
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--neutral-500)',
              }}
            >
              Conto vendita Vergani
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--neutral-900)',
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtCHF(d.contoVendita.spent)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>
                / {fmtCHF(d.contoVendita.cap).replace('CHF ', '')}
              </span>
            </div>
            <div
              style={{
                marginTop: 8,
                height: 6,
                background: 'var(--neutral-100)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${contoPct}%`,
                  height: '100%',
                  background: 'var(--lapa-red-700)',
                }}
              />
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: 'var(--neutral-500)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} /> Reset {d.contoVendita.reset}
              </span>
              <span>Storico: media {fmtCHF(d.contoVendita.quarterAvg)} / quarter</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
