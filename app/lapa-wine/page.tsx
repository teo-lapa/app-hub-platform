'use client';

// TODO: collegare a Prisma client-lapa-wine (restaurant, sales, inventory, vergani consignment)
import { ChevronRight, Bell, CloudRain } from 'lucide-react';
import Header from './_components/Header';
import BottomNav from './_components/BottomNav';

const MOCK = {
  restaurant: { name: 'Trattoria da Mario', owner: 'Mario' },
  tonight: {
    coperti: 42,
    viniAperti: 7,
    bottiglie: 18,
    weather: '14° pioggia',
    top: [
      { name: 'Romeo', maker: 'Mura Mura', qty: 4 },
      { name: "L'Anima Bianco", maker: 'Vergani', qty: 3 },
      { name: "L'Anima Rosé", maker: 'Vergani', qty: 2 },
    ],
  },
  inventoryAlert: { count: 3, label: 'etichette sotto soglia', sub: 'Riordino consigliato — consegna domani 11:00' },
  vergani: { saldo: 2847, limit: 5000, percent: 57 },
};

const todayLabel = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

export default function LapaWineHomePage() {
  const m = MOCK;
  return (
    <>
      <Header subtitle={todayLabel} title={m.restaurant.name} />

      <div style={{ padding: '12px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Saluto */}
        <div
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 22,
            fontStyle: 'italic',
            lineHeight: 1.25,
            padding: '4px 4px 6px',
          }}
        >
          Buongiorno {m.restaurant.owner}.
          <br />
          <span style={{ color: 'var(--fg-3, #6b5f52)' }}>Stasera {m.tonight.coperti} coperti.</span>
        </div>

        {/* Card Stasera */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={eyebrow}>Stasera</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fg-3, #6b5f52)' }}>
              <CloudRain size={13} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{m.tonight.weather}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            {[
              { v: m.tonight.coperti, l: 'Coperti' },
              { v: m.tonight.viniAperti, l: 'Vini aperti' },
              { v: m.tonight.bottiglie, l: 'Bottiglie' },
            ].map((s) => (
              <div key={s.l}>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3, #6b5f52)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle, #ece8e1)', margin: '12px 0' }} />

          <div style={{ ...eyebrow, marginBottom: 8 }}>Top vendite oggi</div>
          {m.tonight.top.map((w) => (
            <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 }}>
              <BottleThumb tone="red" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3, #6b5f52)' }}>{w.maker}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2, #4a4038)' }}>{w.qty} btl</div>
            </div>
          ))}
        </section>

        {/* Inventory alert */}
        <section
          style={{
            ...cardStyle,
            borderLeft: '3px solid #f79009',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#fdf6e3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bell size={16} color="#92590f" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {m.inventoryAlert.count} {m.inventoryAlert.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3, #6b5f52)', marginTop: 2 }}>{m.inventoryAlert.sub}</div>
          </div>
          <ChevronRight size={16} color="var(--fg-3, #6b5f52)" />
        </section>

        {/* Conto vendita Vergani */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={eyebrow}>Conto vendita</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>Vergani · 1892</div>
            </div>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#027a48',
                background: '#ecfdf3',
                padding: '4px 8px',
                borderRadius: 2,
              }}
            >
              {m.vergani.percent}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
              CHF {m.vergani.saldo.toLocaleString('de-CH')}
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg-3, #6b5f52)' }}>
              / {m.vergani.limit.toLocaleString('de-CH')}
            </span>
          </div>

          <div style={{ marginTop: 10, height: 6, background: '#e9ecef', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${m.vergani.percent}%`, height: '100%', background: 'var(--lapa-red-700, #951616)' }} />
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: 'var(--fg-3, #6b5f52)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Pagamento alla vendita</span>
            <span>Reset 30 giugno</span>
          </div>
        </section>
      </div>

      <BottomNav />
    </>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border, #e5e2dd)',
  borderRadius: 10,
  padding: '14px 16px',
};

const eyebrow: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--fg-3, #6b5f52)',
  fontWeight: 600,
};

function BottleThumb({ tone }: { tone: 'red' | 'white' | 'rose' }) {
  const bg = tone === 'red' ? '#efe6d6' : tone === 'white' ? '#f0ead8' : '#f3e0d8';
  return (
    <div
      style={{
        width: 28,
        height: 36,
        background: bg,
        borderRadius: 3,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 3,
          transform: 'translateX(-50%)',
          width: 6,
          height: 10,
          background: '#1c1815',
        }}
      />
    </div>
  );
}
