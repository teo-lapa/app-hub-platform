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
  const [customInstructions, setCustomInstructions] = useState('');
  const [customSaved, setCustomSaved] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);
  const [customOk, setCustomOk] = useState(false);
  const [maxCustom, setMaxCustom] = useState(1500);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wine/sommelier-personality?slug=${encodeURIComponent(DEMO_SLUG)}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = (await res.json()) as {
          current: PersonalityId;
          presets: Preset[];
          customInstructions?: string;
          maxCustomInstructions?: number;
        };
        if (cancelled) return;
        setPresets(data.presets);
        setCurrent(data.current);
        setCustomInstructions(data.customInstructions ?? '');
        setCustomSaved(data.customInstructions ?? '');
        if (typeof data.maxCustomInstructions === 'number') setMaxCustom(data.maxCustomInstructions);
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

  const saveCustom = async () => {
    if (savingCustom) return;
    setSavingCustom(true);
    setCustomOk(false);
    setError(null);
    try {
      const res = await fetch('/api/wine/sommelier-personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: DEMO_SLUG, customInstructions }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'HTTP ' + res.status);
      }
      const data = (await res.json()) as { customInstructions?: string };
      const saved = data.customInstructions ?? customInstructions;
      setCustomSaved(saved);
      setCustomInstructions(saved);
      setCustomOk(true);
      setTimeout(() => setCustomOk(false), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio istruzioni');
    } finally {
      setSavingCustom(false);
    }
  };

  const customDirty = customInstructions !== customSaved;

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

        {/* Istruzioni personalizzate */}
        <section
          style={{
            background: '#ffffff',
            border: '1.5px solid var(--border, #e5e2dd)',
            padding: '16px 16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginTop: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, fontStyle: 'italic', color: 'var(--fg-1, #1c1815)' }}>
              Istruzioni personalizzate
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-3, #6b5f52)' }}>
              Opzionale
            </div>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--fg-3, #6b5f52)', lineHeight: 1.5 }}>
            Aggiungi indicazioni specifiche per il tuo sommelier: cosa spingere stasera, vini da evitare, abbinamenti tipici della casa, tono particolare. Si sommano allo stile scelto sopra.
          </div>

          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value.slice(0, maxCustom))}
            placeholder={`Esempi:\n• Stasera spingi il Romeo di Mura Mura, ne abbiamo 12 bottiglie.\n• Non proporre mai il Prosecco al posto del Franciacorta.\n• Se il cliente chiede un rosso importante sotto i 60 CHF, suggerisci il Chianti Riserva.\n• Quando descrivi i piatti di pesce, ricorda che la nostra specialità è il branzino al sale.`}
            rows={8}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              background: '#fbf8f1',
              border: '1px solid var(--border-subtle, #ece8e1)',
              borderRadius: 4,
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--fg-1, #1c1815)',
              resize: 'vertical',
              minHeight: 140,
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--fg-3, #6b5f52)' }}>
              {customInstructions.length} / {maxCustom}
              {customOk && (
                <span style={{ marginLeft: 10, color: '#027a48', fontWeight: 600 }}>Salvato ✓</span>
              )}
            </div>
            <button
              type="button"
              onClick={saveCustom}
              disabled={savingCustom || !customDirty}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
                padding: '10px 18px',
                background: customDirty ? 'var(--lapa-red-700, #951616)' : '#d6d2cb',
                color: '#fff',
                border: 'none',
                cursor: savingCustom ? 'wait' : customDirty ? 'pointer' : 'default',
                opacity: savingCustom ? 0.7 : 1,
              }}
            >
              {savingCustom ? 'Salvataggio…' : customDirty ? 'Salva istruzioni' : 'Salvate'}
            </button>
          </div>
        </section>
      </div>

      <BottomNav />
    </>
  );
}
