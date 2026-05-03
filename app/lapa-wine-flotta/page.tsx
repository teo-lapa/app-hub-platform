'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Search, Plus, Circle } from 'lucide-react';

// TODO Prisma: sostituire mock con query reali su restaurant + sales_orders
type Restaurant = {
  id: string;
  slug: string;
  name: string;
  city: string;
  area: 'ZH' | 'AG' | 'BS' | 'TI' | 'BE' | 'SG' | 'SH' | 'LU';
  conto: number;
  topLabel: string;
  lastOrder: string;
  rotation: number;
  status: 'attivo' | 'a-rischio' | 'lapsed';
  supplier: 'Vergani' | 'Berta' | 'La Scolca' | 'Pio Cesare';
  warn?: boolean;
};

const RESTAURANTS: Restaurant[] = [
  { id: 'ZH-014', slug: 'trattoria-da-mario', name: 'Trattoria da Mario', city: 'Zürich', area: 'ZH', conto: 2847, topLabel: 'Romeo · Mura Mura', lastOrder: '03.05', rotation: 4.2, status: 'attivo', supplier: 'Vergani' },
  { id: 'ZH-018', slug: 'osteria-bellinda', name: 'Osteria Bellinda', city: 'Zürich', area: 'ZH', conto: 4120, topLabel: "L'Anima Amarone", lastOrder: '01.05', rotation: 5.8, status: 'attivo', supplier: 'Vergani' },
  { id: 'AG-002', slug: 'la-pergola', name: 'La Pergola', city: 'Aarau', area: 'AG', conto: 1240, topLabel: 'Prosecco Brut', lastOrder: '28.04', rotation: 3.1, status: 'attivo', supplier: 'Vergani' },
  { id: 'BS-007', slug: 'il-borgo', name: 'Il Borgo', city: 'Basel', area: 'BS', conto: 980, topLabel: 'Romeo · Mura Mura', lastOrder: '02.05', rotation: 2.4, status: 'a-rischio', supplier: 'Vergani', warn: true },
  { id: 'TI-011', slug: 'cantina-del-sasso', name: 'Cantina del Sasso', city: 'Lugano', area: 'TI', conto: 3680, topLabel: 'Barolo · Pio Cesare', lastOrder: '04.05', rotation: 6.1, status: 'attivo', supplier: 'Pio Cesare' },
  { id: 'ZH-022', slug: 'locanda-verdi', name: 'Locanda Verdi', city: 'Zürich', area: 'ZH', conto: 720, topLabel: "L'Anima Bianco", lastOrder: '02.04', rotation: 1.2, status: 'lapsed', supplier: 'Vergani', warn: true },
  { id: 'BE-005', slug: 'trattoria-roma', name: 'Trattoria Roma', city: 'Bern', area: 'BE', conto: 2180, topLabel: "L'Anima Rosé", lastOrder: '02.05', rotation: 3.6, status: 'attivo', supplier: 'Vergani' },
  { id: 'SG-003', slug: 'don-camillo', name: 'Don Camillo', city: 'St. Gallen', area: 'SG', conto: 1540, topLabel: 'Romeo · Mura Mura', lastOrder: '30.04', rotation: 2.9, status: 'attivo', supplier: 'Berta' },
  { id: 'ZH-031', slug: 'enoteca-bacco', name: 'Enoteca Bacco', city: 'Winterthur', area: 'ZH', conto: 3240, topLabel: 'Gavi del Comune', lastOrder: '03.05', rotation: 4.7, status: 'attivo', supplier: 'La Scolca' },
  { id: 'TI-014', slug: 'grotto-ticinese', name: 'Grotto Ticinese', city: 'Bellinzona', area: 'TI', conto: 2110, topLabel: 'Barolo · Pio Cesare', lastOrder: '04.05', rotation: 3.9, status: 'attivo', supplier: 'Pio Cesare' },
  { id: 'LU-002', slug: 'ristorante-galileo', name: 'Ristorante Galileo', city: 'Luzern', area: 'LU', conto: 1860, topLabel: 'Romeo · Mura Mura', lastOrder: '29.04', rotation: 2.7, status: 'attivo', supplier: 'Vergani' },
  { id: 'SH-001', slug: 'la-cucina-nostra', name: 'La Cucina Nostra', city: 'Schaffhausen', area: 'SH', conto: 540, topLabel: "L'Anima Bianco", lastOrder: '20.03', rotation: 0.8, status: 'lapsed', supplier: 'Vergani', warn: true },
  { id: 'BS-012', slug: 'osteria-tre-re', name: 'Osteria Tre Re', city: 'Basel', area: 'BS', conto: 2920, topLabel: "L'Anima Amarone", lastOrder: '01.05', rotation: 4.4, status: 'attivo', supplier: 'Vergani' },
  { id: 'BE-008', slug: 'casa-italia', name: 'Casa Italia', city: 'Thun', area: 'BE', conto: 1380, topLabel: 'Prosecco Brut', lastOrder: '27.04', rotation: 2.6, status: 'attivo', supplier: 'Vergani' },
  { id: 'ZH-040', slug: 'antica-osteria', name: 'Antica Osteria', city: 'Zürich', area: 'ZH', conto: 4560, topLabel: 'Berta Bric del Gaian', lastOrder: '04.05', rotation: 6.5, status: 'attivo', supplier: 'Berta' },
];

const KPI = [
  { label: 'Ristoranti attivi', value: '47', delta: '+3 questo mese', positive: true },
  { label: 'GMV maggio', value: "CHF 184'620", delta: '+12% vs aprile', positive: true },
  { label: 'Top etichetta', value: 'Romeo · Mura Mura', delta: '892 btl venduti', sub: true },
  { label: 'Senza riordino > 30gg', value: '6', delta: 'Azione raccomandata', warn: true },
];

const FILTERS = [
  { key: 'area', label: 'Area', options: ['Tutte', 'ZH', 'AG', 'BS', 'TI', 'BE', 'SG', 'SH', 'LU'] },
  { key: 'supplier', label: 'Fornitore', options: ['Tutti', 'Vergani', 'Berta', 'La Scolca', 'Pio Cesare'] },
  { key: 'rotation', label: 'Soglia rotazione', options: ['Tutte', '> 2 btl/sett', '> 4 btl/sett'] },
  { key: 'status', label: 'Status', options: ['Attivi', 'A rischio', 'Lapsed', 'Tutti'] },
];

export default function LapaWineFlottaPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    area: 'Tutte',
    supplier: 'Tutti',
    rotation: 'Tutte',
    status: 'Tutti',
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    return RESTAURANTS.filter((r) => {
      if (filters.area !== 'Tutte' && r.area !== filters.area) return false;
      if (filters.supplier !== 'Tutti' && r.supplier !== filters.supplier) return false;
      if (filters.rotation === '> 2 btl/sett' && r.rotation <= 2) return false;
      if (filters.rotation === '> 4 btl/sett' && r.rotation <= 4) return false;
      if (filters.status === 'Attivi' && r.status !== 'attivo') return false;
      if (filters.status === 'A rischio' && r.status !== 'a-rischio') return false;
      if (filters.status === 'Lapsed' && r.status !== 'lapsed') return false;
      if (search && !`${r.name} ${r.city}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filters, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 52px)' }}>
      {/* Title bar */}
      <div
        style={{
          padding: '18px 22px 10px',
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-100)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            LAPA WINE — Flotta ristoranti
          </h1>
          <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 4 }}>
            47 ristoranti attivi · backoffice LAPA × Vergani
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 10px',
              border: '1px solid var(--neutral-200)',
              borderRadius: 6,
              background: 'var(--neutral-0)',
            }}
          >
            <Search size={13} color="var(--neutral-500)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca ristorante o città"
              style={{
                border: 'none',
                outline: 'none',
                fontSize: 12,
                width: 200,
                background: 'transparent',
                color: 'var(--neutral-900)',
              }}
            />
          </div>
          <button
            style={{
              height: 32,
              padding: '0 14px',
              background: 'var(--lapa-red-600)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} /> Nuovo ristorante
          </button>
        </div>
      </div>

      {/* KPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          padding: '16px 22px 8px',
        }}
      >
        {KPI.map((k) => (
          <div
            key={k.label}
            style={{
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 8,
              padding: 14,
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
              {k.label}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: k.sub ? 16 : 22,
                fontWeight: k.sub ? 500 : 600,
                color: 'var(--neutral-900)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {k.value}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: k.warn
                  ? 'var(--warning-700)'
                  : k.positive
                    ? 'var(--success-700)'
                    : 'var(--neutral-500)',
              }}
            >
              {k.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 22px 10px',
          borderBottom: '1px solid var(--neutral-100)',
          background: 'var(--neutral-25)',
        }}
      >
        <Filter size={14} color="var(--neutral-500)" />
        {FILTERS.map((f) => (
          <div key={f.key} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenFilter(openFilter === f.key ? null : f.key)}
              style={{
                height: 28,
                padding: '0 10px',
                border: '1px solid var(--neutral-200)',
                background: 'var(--neutral-0)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--neutral-700)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ color: 'var(--neutral-500)' }}>{f.label}:</span>
              <span style={{ color: 'var(--neutral-900)', fontWeight: 500 }}>
                {filters[f.key]}
              </span>
              <ChevronDown size={12} />
            </button>
            {openFilter === f.key && (
              <div
                style={{
                  position: 'absolute',
                  top: 32,
                  left: 0,
                  background: 'var(--neutral-0)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  zIndex: 10,
                  minWidth: 160,
                  padding: 4,
                }}
              >
                {f.options.map((o) => (
                  <div
                    key={o}
                    onClick={() => {
                      setFilters((s) => ({ ...s, [f.key]: o }));
                      setOpenFilter(null);
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      borderRadius: 4,
                      color:
                        filters[f.key] === o
                          ? 'var(--lapa-red-700)'
                          : 'var(--neutral-700)',
                      fontWeight: filters[f.key] === o ? 600 : 400,
                      background:
                        filters[f.key] === o ? 'var(--lapa-red-50)' : 'transparent',
                    }}
                  >
                    {o}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>
          <span style={{ color: 'var(--neutral-900)', fontWeight: 600 }}>{rows.length}</span>{' '}
          risultati
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--neutral-0)' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--neutral-25)',
                borderBottom: '1px solid var(--neutral-200)',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              {[
                { l: 'Ristorante', a: 'left' },
                { l: 'Città', a: 'left' },
                { l: 'Area', a: 'left' },
                { l: 'Conto vendita', a: 'right' },
                { l: 'Top etichetta', a: 'right' },
                { l: 'Ultimo ordine', a: 'right' },
                { l: 'Rotazione/sett', a: 'right' },
                { l: '', a: 'right' },
              ].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 14px',
                    textAlign: h.a as 'left' | 'right',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--neutral-500)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                style={{
                  borderBottom: '1px solid var(--neutral-100)',
                  height: 40,
                  background: r.status === 'lapsed' ? 'var(--warning-50)' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  window.location.href = `/lapa-wine-flotta/${r.slug}`;
                }}
              >
                <td style={{ padding: '0 14px', color: 'var(--neutral-900)', fontWeight: 500 }}>
                  <Link
                    href={`/lapa-wine-flotta/${r.slug}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    {r.warn && (
                      <Circle size={8} fill="var(--warning-600)" stroke="var(--warning-600)" />
                    )}
                    {r.name}
                  </Link>
                </td>
                <td style={{ padding: '0 14px', color: 'var(--neutral-700)' }}>{r.city}</td>
                <td style={{ padding: '0 14px' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--neutral-700)',
                      background: 'var(--neutral-100)',
                      padding: '3px 6px',
                      borderRadius: 2,
                    }}
                  >
                    {r.area}
                  </span>
                </td>
                <td
                  style={{
                    padding: '0 14px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--neutral-900)',
                    fontFamily: 'var(--text-mono, ui-monospace, monospace)',
                  }}
                >
                  CHF {r.conto.toLocaleString('de-CH').replace(/,/g, "'")}
                </td>
                <td
                  style={{
                    padding: '0 14px',
                    textAlign: 'right',
                    color: 'var(--neutral-700)',
                    fontStyle: 'italic',
                    fontFamily: 'Fraunces, serif',
                    fontSize: 13.5,
                  }}
                >
                  {r.topLabel}
                </td>
                <td
                  style={{
                    padding: '0 14px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'var(--text-mono, ui-monospace, monospace)',
                    color: r.warn ? 'var(--warning-700)' : 'var(--neutral-700)',
                  }}
                >
                  {r.lastOrder}
                </td>
                <td
                  style={{
                    padding: '0 14px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'var(--text-mono, ui-monospace, monospace)',
                    color: 'var(--neutral-900)',
                    fontWeight: 600,
                  }}
                >
                  {r.rotation.toFixed(1)} btl
                </td>
                <td style={{ padding: '0 14px', textAlign: 'right' }}>
                  <ChevronRight size={14} color="var(--neutral-400)" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
