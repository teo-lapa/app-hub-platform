export const metadata = { title: 'Scegli il logo' };

const items = [
  { n: 1, src: '/logos-preview/ai1.png', name: 'Cuore LAPA + onde sonore' },
  { n: 2, src: '/logos-preview/ai2.png', name: 'Cuore LAPA nella sfera blu' },
  { n: 3, src: '/logos-preview/ai3.png', name: 'Cuore LAPA 3D + onda voce' },
  { n: 4, src: '/logos-preview/ai4.png', name: 'Logo LAPA + microfono' },
];

export default function LoghiPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#060b16', color: '#eaf1ff', fontFamily: 'system-ui, sans-serif', padding: '28px 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Scegli il logo (col tuo LAPA)</h1>
      <p style={{ opacity: .7, marginTop: 8, fontSize: 15 }}>Guarda i quattro e di&apos; a Claude il numero che preferisci (1, 2, 3 o 4).</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', marginTop: 24 }}>
        {items.map(it => (
          <div key={it.n} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 24, padding: 20, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#7db4ff' }}>{it.n}) {it.name}</div>
            <img src={it.src} alt={it.name} style={{ width: 240, height: 240, objectFit: 'cover', borderRadius: 32, boxShadow: '0 0 40px rgba(54,150,255,.3)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
