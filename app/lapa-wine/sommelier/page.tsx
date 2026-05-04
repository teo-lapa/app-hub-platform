'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import Header from '../_components/Header';
import BottomNav from '../_components/BottomNav';

// Per ora MVP: il ristoratore Mario corrisponde allo slug demo "trattoria-da-mario".
// Quando il login multi-tenant sarà attivo, prenderemo lo slug dalla sessione.
const DEMO_SLUG = 'trattoria-da-mario';

type PersonalityId = 'classico' | 'amico' | 'essenziale';

interface Preset {
  id: PersonalityId;
  label: string;
  shortDesc: string;
  exampleReply: string;
}

export default function SommelierSettingsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [current, setCurrent] = useState<PersonalityId | null>(null);
  const [saving, setSaving] = useState<PersonalityId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wine/sommelier-personality?slug=${encodeURIComponent(DEMO_SLUG)}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = (await res.json()) as { current: PersonalityId; presets: Preset[] };
        if (cancelled) return;
        setPresets(data.presets);
        setCurrent(data.current);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Errore');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = async (id: PersonalityId) => {
    if (saving) return;
    setSaving(id);
    setError(null);
    try {
      const res = await fetch('/api/wine/sommelier-personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: DEMO_SLUG, personality: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'HTTP ' + res.status);
      }
      setCurrent(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio');
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <Header subtitle="Personalità del sommelier" title="Sommelier" />

      <div style={{ padding: '14px 14px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 15, fontStyle: 'italic', lineHeight: 1.45, color: 'var(--fg-2, #4a3f35)', margin: 0 }}>
          Scegli lo stile con cui il tuo sommelier digitale parla ai clienti al tavolo. La conoscenza dei vini resta identica — cambia solo il tono.
        </p>

        {error && (
          <div style={{ padding: '10px 12px', background: '#fef0f0', border: '1px solid #f0c4c4', color: '#7a1f1f', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
            {error}
          </div>
        )}

        {presets.length === 0 && !error && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--fg-3, #6b5f52)', fontSize: 13 }}>Caricamento…</div>
        )}

        {presets.map((p) => {
          const active = current === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              disabled={saving !== null}
              style={{
                textAlign: 'left',
                background: active ? '#fffaf2' : '#ffffff',
                border: `1.5px solid ${active ? 'var(--lapa-red-700, #951616)' : 'var(--border, #e5e2dd)'}`,
                padding: '16px 16px 18px',
                cursor: saving ? 'wait' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                opacity: saving && saving !== p.id ? 0.5 : 1,
                transition: 'border-color 120ms ease, background 120ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, fontStyle: 'italic', color: 'var(--fg-1, #1c1815)' }}>
                  {p.label}
                </div>
                {active && (
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--lapa-red-700, #951616)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Check size={16} strokeWidth={2.5} />
                  </div>
                )}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--fg-3, #6b5f52)', letterSpacing: '0.02em' }}>
                {p.shortDesc}
              </div>
              <div
                style={{
                  marginTop: 4,
                  padding: '12px 14px',
                  background: '#fbf8f1',
                  border: '1px solid var(--border-subtle, #ece8e1)',
                  borderRadius: 4,
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: 14,
                  fontStyle: 'italic',
                  lineHeight: 1.45,
                  color: 'var(--fg-2, #4a3f35)',
                }}
              >
                “{p.exampleReply}”
              </div>
              {saving === p.id && (
                <div style={{ fontSize: 11, color: 'var(--fg-3, #6b5f52)', fontFamily: 'Inter, sans-serif' }}>Salvataggio…</div>
              )}
            </button>
          );
        })}
      </div>

      <BottomNav />
    </>
  );
}
