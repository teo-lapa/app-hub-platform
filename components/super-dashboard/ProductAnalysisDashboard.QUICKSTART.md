# ProductAnalysisDashboard - Quick Start Guide

Guida rapida per iniziare ad utilizzare il componente ProductAnalysisDashboard.

## 📦 File Creati

```
components/super-dashboard/
├── ProductAnalysisDashboard.tsx            # Componente principale (29KB)
├── ProductAnalysisDashboard.types.ts       # TypeScript interfaces (5KB)
├── ProductAnalysisDashboard.mock.ts        # Mock data generator (11KB)
├── ProductAnalysisDashboard.example.tsx    # Esempi di utilizzo (8KB)
├── ProductAnalysisDashboard.page.example.tsx # Esempio pagina Next.js (9KB)
├── ProductAnalysisDashboard.README.md      # Documentazione completa (8KB)
└── ProductAnalysisDashboard.QUICKSTART.md  # Questa guida
```

## 🚀 Quick Start (30 secondi)

### 1. Import del componente

```tsx
import { ProductAnalysisDashboard } from '@/components/super-dashboard';
```

### 2. Utilizzo base con mock data

```tsx
import { ProductAnalysisDashboard } from '@/components/super-dashboard';
import { generateMockProductData } from '@/components/super-dashboard/ProductAnalysisDashboard.mock';

export default function TestPage() {
  const mockData = generateMockProductData();

  return (
    <ProductAnalysisDashboard
      data={mockData}
      isLoading={false}
      error={null}
    />
  );
}
```

### 3. Utilizzo con API reale

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ProductAnalysisDashboard } from '@/components/super-dashboard';

export default function ProductPage({ productId }: { productId: string }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/products/${productId}/analysis`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [productId]);

  return (
    <ProductAnalysisDashboard
      data={data}
      isLoading={isLoading}
      error={error}
    />
  );
}
```

## 🎨 Scenari Pre-configurati

Usa gli scenari mock pre-configurati per testare diversi stati:

```tsx
import { MOCK_SCENARIOS } from '@/components/super-dashboard/ProductAnalysisDashboard.mock';

// Scenario ottimale (tutto verde)
const optimalData = MOCK_SCENARIOS.optimal();

// Scenario critico (stock basso, necessita riordino urgente)
const criticalData = MOCK_SCENARIOS.critical();

// Scenario normale
const normalData = MOCK_SCENARIOS.normal();

<ProductAnalysisDashboard data={optimalData} isLoading={false} error={null} />
```

## 📊 Struttura Dati Minima

```typescript
const minimalData = {
  product: {
    id: 'PROD-001',
    name: 'Nome Prodotto',
    code: 'CODICE',
    category: 'Categoria',
  },
  period: {
    start: '2024-10-01',
    end: '2024-10-31',
    label: 'Ottobre 2024',
  },
  kpis: {
    totalRevenue: 125000,
    totalCosts: 75000,
    netProfit: 50000,
    marginPercent: 40.0,
    quantitySold: 850,
    currentStock: 120,
  },
  trends: {
    revenueChange: 12.5,
    profitChange: 15.3,
    marginChange: 2.1,
  },
  salesVsPurchases: [
    { date: '01/10', sales: 12000, purchases: 8000 },
    // ... altri punti dati
  ],
  topCustomers: [
    { id: 'C1', name: 'Cliente 1', quantity: 150, revenue: 22500 },
    // ... altri clienti
  ],
  customerDistribution: [
    { customer: 'Cliente 1', value: 22500, percentage: 18 },
    // ... altri
  ],
  suppliers: [
    { id: 'S1', name: 'Fornitore 1', price: 88.5, leadTime: 7, isPreferred: true },
    // ... altri fornitori
  ],
  inventory: {
    currentStock: 120,
    locations: [
      { location: 'A-01-001', quantity: 80 },
      // ... altre ubicazioni
    ],
    incoming: 50,
    outgoing: 30,
    reorderPoint: 100,
    safetyStock: 80,
  },
  recommendations: {
    reorderNeeded: false,
    action: 'Azione consigliata',
    reason: 'Motivo',
    priority: 'low', // 'low' | 'medium' | 'high' | 'critical'
  },
};
```

## 🔧 Test Rapidi

### Test 1: Loading State

```tsx
<ProductAnalysisDashboard data={null} isLoading={true} error={null} />
```

### Test 2: Error State

```tsx
<ProductAnalysisDashboard
  data={null}
  isLoading={false}
  error="Errore di connessione"
/>
```

### Test 3: Success State con Mock

```tsx
import { generateMockProductData } from '@/components/super-dashboard/ProductAnalysisDashboard.mock';

const mockData = generateMockProductData();

<ProductAnalysisDashboard data={mockData} isLoading={false} error={null} />
```

### Test 4: Scenario Critico (Stock Basso)

```tsx
import { generateMockProductData } from '@/components/super-dashboard/ProductAnalysisDashboard.mock';

const criticalData = generateMockProductData({
  generateCriticalScenario: true,
  productName: 'Prodotto Urgente',
});

<ProductAnalysisDashboard data={criticalData} isLoading={false} error={null} />
```

## 🎯 Integrazione API

### Step 1: Crea l'endpoint API

```typescript
// app/api/products/[productId]/analysis/route.ts

import { NextResponse } from 'next/server';
import { generateMockProductData } from '@/components/super-dashboard/ProductAnalysisDashboard.mock';

export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  try {
    // TODO: Sostituisci con query reale al database/Odoo
    const data = generateMockProductData({
      productId: params.productId,
    });

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

### Step 2: Crea la pagina

```tsx
// app/super-dashboard/products/[productId]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ProductAnalysisDashboard } from '@/components/super-dashboard';

export default function ProductAnalysisPage() {
  const params = useParams();
  const productId = params.productId as string;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/products/${productId}/analysis`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
        else setError(result.error);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [productId]);

  return (
    <ProductAnalysisDashboard
      data={data}
      isLoading={isLoading}
      error={error}
    />
  );
}
```

### Step 3: Testa la pagina

```
http://localhost:3000/super-dashboard/products/PROD-001
```

## 🎨 Personalizzazione

### Cambia i colori KPI

Nel componente `ProductAnalysisDashboard.tsx`, cerca:

```tsx
const kpis = [
  {
    title: 'Fatturato Totale',
    gradient: 'from-emerald-500 to-teal-600', // Cambia qui
    // ...
  },
];
```

### Aggiungi nuove metriche

```tsx
// Aggiungi nel kpis array
{
  title: 'Nuova Metrica',
  value: 'Valore',
  subtitle: 'Sottotitolo',
  icon: <YourIcon className="w-6 h-6 text-white" />,
  gradient: 'from-pink-500 to-rose-600',
  index: 6,
}
```

## 📚 Risorse Utili

- **README completo**: `ProductAnalysisDashboard.README.md`
- **Esempi**: `ProductAnalysisDashboard.example.tsx`
- **Tipi TypeScript**: `ProductAnalysisDashboard.types.ts`
- **Mock data**: `ProductAnalysisDashboard.mock.ts`
- **Esempio pagina**: `ProductAnalysisDashboard.page.example.tsx`

## ❓ Troubleshooting

### Problema: Componente non si carica

**Soluzione**: Verifica che il componente sia esportato in `index.ts`:

```typescript
// components/super-dashboard/index.ts
export { ProductAnalysisDashboard } from './ProductAnalysisDashboard';
```

### Problema: Errori TypeScript

**Soluzione**: Importa i tipi:

```typescript
import type { ProductData } from '@/components/super-dashboard/ProductAnalysisDashboard.types';
```

### Problema: Grafici non si visualizzano

**Soluzione**: Verifica che `recharts` sia installato:

```bash
npm install recharts
```

### Problema: Animazioni non funzionano

**Soluzione**: Verifica che `framer-motion` sia installato:

```bash
npm install framer-motion
```

## 🚀 Next Steps

1. ✅ Testa il componente con mock data
2. ✅ Crea l'endpoint API
3. ✅ Integra con dati reali dal database
4. ✅ Personalizza colori e layout
5. ✅ Aggiungi funzionalità export PDF
6. ✅ Integra con sistema notifiche

## 💡 Tips & Tricks

- Usa `MOCK_SCENARIOS` per demo e presentazioni
- Testa diversi livelli di priorità (low, medium, high, critical)
- Il componente è completamente responsive
- Tutti i grafici sono interattivi con tooltip
- Loading e error states sono gestiti automaticamente

## 📞 Support

Per domande o problemi:
- Consulta il README completo
- Vedi gli esempi nella cartella
- Controlla i tipi TypeScript

---

**Buon sviluppo!** 🎉
