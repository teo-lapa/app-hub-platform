export const metadata = { title: 'Scegli il logo' };

const items = [
  { n: 1, src: '/logos-preview/concept-orb.png', name: 'Globo + onde sonore' },
  { n: 2, src: '/logos-preview/concept-mic.png', name: 'Microfono' },
  { n: 3, src: '/logos-preview/concept-letter.png', name: 'Lettera S' },
];

export default function LoghiPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#060b16', color: '#eaf1ff', fontFamily: 'system-ui, sans-serif', padding: '28px 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Scegli il logo di Stella</h1>
      <p style={{ opacity: .7, marginTop: 8, fontSize: 15 }}>Guarda i tre qui sotto e di' a Claude il numero che preferisci (1, 2 o 3).</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', marginTop: 24 }}>
        {items.map(it => (
          <div key={it.n} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 24, padding: 20, width: '100%', maxWidth: 320 }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#7db4ff' }}>{it.n}) {it.name}</div>
            <img src={it.src} alt={it.name} style={{ width: 220, height: 220, borderRadius: 28, boxShadow: '0 0 40px rgba(54,150,255,.3)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
