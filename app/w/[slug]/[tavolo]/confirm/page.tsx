'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MOCK_TENANT, TIER_WINES } from '../../../_data';
import { I18N, type Lang, readSavedLang, writeSavedLang, nextLang } from '../../../_i18n';

type CatalogWine = {
  vergani_sku: string;
  name: string;
  producer: string;
  region: string;
  vintage?: string;
  price_carta_suggested_chf: number;
  image_url?: string | null;
};

export default function ConfirmPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; tavolo: string }>();
  const sp = useSearchParams();
  const tenant = MOCK_TENANT;

  // Params dalla pagina precedente
  const wineIdFromUrl = sp.get('wineId') || '';
  const wineNameFromUrl = sp.get('wine') || TIER_WINES[1].name;
  const subFromUrl = sp.get('sub') || TIER_WINES[1].sub;
  const bottlePriceFromUrl = parseFloat(sp.get('price') || '') || TIER_WINES[1].bottle;
  const glassPriceFromUrl = parseFloat(sp.get('glass') || '') || Math.max(7, Math.round(bottlePriceFromUrl / 5));
  const accent = sp.get('accent') || TIER_WINES[1].accent;
  const imageUrlFromUrl = sp.get('image') || '';

  // Catalog lookup (per beccare image_url se non passato in URL)
  const [imageUrl, setImageUrl] = useState<string>(imageUrlFromUrl);
  useEffect(() => {
    if (imageUrl || !wineIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wine/catalog?slug=${encodeURIComponent(params.slug)}`);
        if (!res.ok) return;
        const { wines } = (await res.json()) as { wines: CatalogWine[] };
        if (cancelled) return;
        const found = wines.find((w) => w.vergani_sku === wineIdFromUrl);
        if (found?.image_url) setImageUrl(found.image_url);
      } catch (e) {
        console.warn('[confirm] catalog lookup failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wineIdFromUrl, imageUrl, params.slug]);

  // Lingua
  const [lang, setLang] = useState<Lang>('it');
  useEffect(() => { setLang(readSavedLang(params.slug, params.tavolo)); }, [params.slug, params.tavolo]);
  const t = I18N[lang];
  const cycleLang = () => {
    const n = nextLang(lang);
    setLang(n);
    writeSavedLang(params.slug, params.tavolo, n);
  };

  // Quantità selezionabili
  const [glasses, setGlasses] = useState(0);
  const [bottles, setBottles] = useState(1); // di default 1 bottiglia
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState(0);

  const total = useMemo(() => glasses * glassPriceFromUrl + bottles * bottlePriceFromUrl, [glasses, bottles, glassPriceFromUrl, bottlePriceFromUrl]);
  const totalItems = glasses + bottles;

  const ink = '#1c1815';
  const subColor = '#6b5f52';
  const line = '#d6cdb8';

  // Quando comanda confermata, animazione fasi
  useEffect(() => {
    if (!confirmed) return;
    const id = setTimeout(() => setPhase(1), 2200);
    return () => clearTimeout(id);
  }, [confirmed]);

  const sendOrder = async () => {
    if (totalItems === 0) return;
    // TODO: POST a /api/wine/order quando il DB è pronto
    setConfirmed(true);
  };

  return (
    <main
      className="wine-surface"
      style={{ background: tenant.cream, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 22px 10px', borderBottom: `1px solid ${line}`,
          background: tenant.cream,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t.back}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: subColor, fontFamily: 'Fraunces, serif', fontSize: 13, fontStyle: 'italic',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 5l-7 7 7 7" />
          </svg>
          {t.back}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            aria-hidden="true"
            style={{
              width: 22, height: 22, border: `1px solid ${ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif', fontStyle: tenant.monoStyle, fontSize: 13, color: ink,
            }}
          >
            {tenant.monogram}
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', color: subColor }}>
            {tenant.eyebrow}
          </span>
        </div>
        <button
          type="button"
          onClick={cycleLang}
          aria-label="Cambia lingua / Change language"
          style={{
            background: 'transparent', border: `1px solid ${subColor}`, color: ink,
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
            padding: '4px 8px', cursor: 'pointer', minWidth: 36,
          }}
        >
          {lang.toUpperCase()}
        </button>
      </header>

      {confirmed ? (
        <ConfirmedView
          wineName={wineNameFromUrl}
          producer={subFromUrl}
          imageUrl={imageUrl}
          accent={accent}
          glasses={glasses}
          bottles={bottles}
          total={total}
          phase={phase}
          backHref={`/w/${params.slug}/${params.tavolo}/chat`}
          ink={ink}
          subColor={subColor}
          line={line}
          t={t}
        />
      ) : (
        <SelectionView
          wineName={wineNameFromUrl}
          producer={subFromUrl}
          imageUrl={imageUrl}
          accent={accent}
          glasses={glasses}
          bottles={bottles}
          glassPrice={glassPriceFromUrl}
          bottlePrice={bottlePriceFromUrl}
          total={total}
          totalItems={totalItems}
          onSetGlasses={setGlasses}
          onSetBottles={setBottles}
          onConfirm={sendOrder}
          ink={ink}
          subColor={subColor}
          line={line}
          t={t}
        />
      )}
    </main>
  );
}

// ── Step 1 — selezione quantità (calici/bottiglie) ────────────────────────
function SelectionView(props: {
  wineName: string;
  producer: string;
  imageUrl: string;
  accent: string;
  glasses: number;
  bottles: number;
  glassPrice: number;
  bottlePrice: number;
  total: number;
  totalItems: number;
  onSetGlasses: (n: number) => void;
  onSetBottles: (n: number) => void;
  onConfirm: () => void;
  ink: string;
  subColor: string;
  line: string;
  t: typeof I18N['it'];
}) {
  const { wineName, producer, imageUrl, accent, glasses, bottles, glassPrice, bottlePrice, total, totalItems, onSetGlasses, onSetBottles, onConfirm, ink, subColor, line, t } = props;

  return (
    <>
      <section style={{ padding: '24px 28px 0', textAlign: 'center' }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={wineName}
            style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain', display: 'inline-block' }}
          />
        ) : (
          <FallbackBottleSvg accent={accent} />
        )}
        <div className="eyebrow-wine" style={{ color: accent, marginTop: 18 }}>
          {producer}
        </div>
        <h2
          style={{
            marginTop: 6,
            font: 'var(--text-display-serif)',
            fontSize: 28, fontStyle: 'italic', fontWeight: 300,
            letterSpacing: '-0.01em', color: ink, lineHeight: 1.1,
          }}
        >
          {wineName}
        </h2>
        <p
          style={{
            margin: '14px auto 0', maxWidth: 320,
            fontFamily: 'Fraunces, serif', fontSize: 14, fontStyle: 'italic',
            color: subColor, fontWeight: 300, lineHeight: 1.5,
          }}
        >
          {t.selectionPrompt}
        </p>
      </section>

      <section style={{ padding: '28px 22px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <QtyRow
          label={t.glassRowLabel}
          unitPrice={glassPrice}
          value={glasses}
          onChange={onSetGlasses}
          accent={accent}
          ink={ink}
          subColor={subColor}
          line={line}
          t={t}
        />
        <QtyRow
          label={t.bottleRowLabel}
          unitPrice={bottlePrice}
          value={bottles}
          onChange={onSetBottles}
          accent={accent}
          ink={ink}
          subColor={subColor}
          line={line}
          t={t}
        />
      </section>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: '14px 22px calc(20px + env(safe-area-inset-bottom, 0px))',
          background: tenantCream,
          borderTop: `1px solid ${line}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: subColor }}>
            {t.totalLabel}
          </span>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, color: ink }}>
            <span style={{ fontSize: 12 }}>CHF </span>
            <span className="tnum">{total.toFixed(0)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={totalItems === 0}
          style={{
            width: '100%', height: 52,
            background: totalItems === 0 ? subColor : accent,
            color: '#fbf8f1', border: 'none',
            cursor: totalItems === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}
        >
          {totalItems === 0 ? t.sendToWaiterEmpty : t.sendToWaiterCount(totalItems)}
        </button>
      </div>
    </>
  );
}

const tenantCream = '#f6f1e8';

// ── Step 2 — comanda confermata ───────────────────────────────────────────
function ConfirmedView(props: {
  wineName: string;
  producer: string;
  imageUrl: string;
  accent: string;
  glasses: number;
  bottles: number;
  total: number;
  phase: number;
  backHref: string;
  ink: string;
  subColor: string;
  line: string;
  t: typeof I18N['it'];
}) {
  const { wineName, producer, imageUrl, accent, glasses, bottles, total, phase, backHref, ink, subColor, line, t } = props;

  const summary: string[] = [];
  if (glasses > 0) summary.push(`${glasses} ${t.glassRowLabel.toLowerCase()}`);
  if (bottles > 0) summary.push(`${bottles} ${t.bottleRowLabel.toLowerCase()}`);

  return (
    <>
      <section style={{ padding: '40px 28px 0', textAlign: 'center' }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={wineName}
            style={{
              maxHeight: 220, maxWidth: '100%', objectFit: 'contain',
              animation: 'bottle-rise 600ms ease-out both',
            }}
          />
        ) : (
          <FallbackBottleSvg accent={accent} animated />
        )}
        <style>{`
          @keyframes bottle-rise { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        `}</style>

        <div className="eyebrow-wine" style={{ color: subColor, marginTop: 22 }}>
          {t.orderSent}
        </div>
        <h2
          style={{
            marginTop: 10,
            font: 'var(--text-display-serif)',
            fontSize: 28, fontStyle: 'italic', fontWeight: 300,
            letterSpacing: '-0.01em', color: ink, lineHeight: 1.05,
          }}
        >
          {wineName}
        </h2>
        <div
          style={{
            marginTop: 6,
            fontFamily: 'Inter, sans-serif',
            fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: subColor,
          }}
        >
          {producer} · {summary.join(' + ')} · CHF {total.toFixed(0)}
        </div>

        {/* Status timeline */}
        <div
          style={{
            marginTop: 32, padding: '18px 18px',
            background: '#fbf8f1', border: `1px solid ${line}`,
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: `1px solid ${line}` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6f6b3c' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', color: subColor, textTransform: 'uppercase' }}>
                {t.phase1}
              </div>
              <div style={{ marginTop: 2, fontFamily: 'Fraunces, serif', fontSize: 16, fontStyle: 'italic', color: ink }}>
                {t.phase1Label}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 14, opacity: phase >= 1 ? 1 : 0.45, transition: 'opacity 600ms' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: phase >= 1 ? accent : line }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', color: subColor, textTransform: 'uppercase' }}>
                {t.phase2}
              </div>
              <div style={{ marginTop: 2, fontFamily: 'Fraunces, serif', fontSize: 16, fontStyle: 'italic', color: ink }}>
                {t.phase2Label}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '14px 22px calc(20px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}>
        <Link
          href={backHref}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: 46,
            background: 'transparent', border: `1px solid ${ink}`, color: ink,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500,
            letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none',
          }}
        >
          {t.addAnother}
        </Link>
        <div style={{ marginTop: 14, fontFamily: 'Fraunces, serif', fontSize: 12, fontStyle: 'italic', color: subColor, fontWeight: 300 }}>
          {t.goodMeal}
        </div>
      </div>
    </>
  );
}

// ── Riga selettore quantità ───────────────────────────────────────────────
function QtyRow({
  label,
  unitPrice,
  value,
  onChange,
  accent,
  ink,
  subColor,
  line,
  t,
}: {
  label: string;
  unitPrice: number;
  value: number;
  onChange: (n: number) => void;
  accent: string;
  ink: string;
  subColor: string;
  line: string;
  t: typeof I18N['it'];
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        background: '#fbf8f1', border: `1px solid ${value > 0 ? accent : line}`,
        transition: 'border-color 120ms',
      }}
    >
      <div>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontStyle: 'italic', color: ink }}>
          {label}
        </div>
        <div style={{ marginTop: 2, fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: subColor }}>
          {t.glassPriceCad(unitPrice)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          aria-label={t.qtyRemove(label)}
          style={qtyBtnStyle(value === 0, accent, line, ink)}
        >
          −
        </button>
        <span
          aria-live="polite"
          className="tnum"
          style={{
            minWidth: 28, textAlign: 'center',
            fontFamily: 'Fraunces, serif', fontSize: 22, fontStyle: 'italic',
            color: value > 0 ? accent : subColor,
            fontWeight: 400,
          }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={t.qtyAdd(label)}
          style={qtyBtnStyle(false, accent, line, ink)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function qtyBtnStyle(disabled: boolean, accent: string, line: string, ink: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: '50%',
    background: disabled ? 'transparent' : '#fbf8f1',
    border: `1px solid ${disabled ? line : accent}`,
    color: disabled ? line : ink,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif',
    fontSize: 18, fontWeight: 400,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  };
}

// ── Fallback SVG quando l'immagine vera non è disponibile ─────────────────
function FallbackBottleSvg({ accent, animated = false }: { accent: string; animated?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {animated && (
        <style>{`@keyframes bottle-rise { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } } .bc-bottle { animation: bottle-rise 600ms ease-out both }`}</style>
      )}
      <svg width="120" height="180" viewBox="0 0 120 180" aria-hidden="true">
        <g className={animated ? 'bc-bottle' : ''}>
          <rect x="48" y="6" width="24" height="22" fill="#1c1815" />
          <path d="M 44 28 L 44 58 Q 36 70 34 90 L 34 162 Q 34 168 40 168 L 80 168 Q 86 168 86 162 L 86 90 Q 84 70 76 58 L 76 28 Z" fill={accent} opacity="0.92" />
          <rect x="40" y="92" width="40" height="44" fill="#fbf8f1" />
          <line x1="46" y1="100" x2="74" y2="100" stroke={accent} strokeWidth="0.6" />
        </g>
      </svg>
    </div>
  );
}
