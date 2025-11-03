# ProductAnalysisDashboard Component

Dashboard completa per l'analisi dettagliata di un singolo prodotto con KPI, grafici, tabelle e suggerimenti operativi.

## Caratteristiche Principali

### 1. **KPI Cards (6 metriche principali)**
- Fatturato Totale (con trend)
- Costi Totali
- Profitto Netto (con trend)
- Margine % (con trend)
- Quantità Venduta
- Giacenza Attuale

### 2. **Grafici Interattivi (Recharts)**
- **LineChart**: Vendite vs Acquisti nel tempo
- **BarChart**: Top 5 clienti per fatturato
- **PieChart**: Distribuzione percentuale vendite per cliente

### 3. **Tabelle Dati**
- **Top 10 Clienti**: Nome, quantità, fatturato
- **Fornitori Configurati**: Nome, prezzo, lead time, preferito

### 4. **Sezione Magazzino**
- Giacenza attuale e valore stock
- Ubicazioni fisiche (locations)
- Movimenti in arrivo/uscita
- Punto di riordino e scorta di sicurezza

### 5. **Suggerimenti Intelligenti**
- Priorità: low, medium, high, critical
- Azione consigliata
- Motivo della raccomandazione
- Indicatore necessità riordino
- Barra progressiva livello scorta
- Quick actions (Ordina Ora, Dettagli)

## Design

- **Colori vivaci** con gradienti tipo Super Dashboard
- **Cards animate** con hover effects (framer-motion)
- **Icons** da lucide-react
- **Responsive** (grid responsive a tutte le risoluzioni)
- **Loading states** (spinner animato con framer-motion)
- **Error handling** (card errore con retry button)

## Props

```typescript
interface ProductAnalysisDashboardProps {
  data: ProductData | null;
  isLoading: boolean;
  error: string | null;
}
```

### ProductData Interface

```typescript
interface ProductData {
  product: {
    id: string;
    name: string;
    code: string;
    category: string;
  };
  period: {
    start: string;        // 'YYYY-MM-DD'
    end: string;          // 'YYYY-MM-DD'
    label: string;        // 'Ottobre 2024'
  };
  kpis: {
    totalRevenue: number;
    totalCosts: number;
    netProfit: number;
    marginPercent: number;
    quantitySold: number;
    currentStock: number;
  };
  trends: {
    revenueChange: number;    // percentuale +12.5 = +12.5%
    profitChange: number;
    marginChange: number;
  };
  salesVsPurchases: Array<{
    date: string;             // 'DD/MM' o 'YYYY-MM-DD'
    sales: number;            // valore vendite
    purchases: number;        // valore acquisti
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  customerDistribution: Array<{
    customer: string;
    value: number;
    percentage: number;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    price: number;
    leadTime: number;         // giorni
    isPreferred: boolean;
  }>;
  inventory: {
    currentStock: number;
    locations: Array<{
      location: string;
      quantity: number;
    }>;
    incoming: number;
    outgoing: number;
    reorderPoint: number;
    safetyStock: number;
  };
  recommendations: {
    reorderNeeded: boolean;
    action: string;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}
```

## Utilizzo Base

```tsx
import { ProductAnalysisDashboard } from '@/components/super-dashboard';

export default function ProductPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch data from API
    fetchProductAnalysis();
  }, []);

  return (
    <ProductAnalysisDashboard
      data={data}
      isLoading={isLoading}
      error={error}
    />
  );
}
```

## Esempi di Implementazione

### 1. Con Mock Data (sviluppo/test)

```tsx
const mockData = {
  product: {
    id: 'PROD-001',
    name: 'Parmigiano Reggiano DOP 24 Mesi',
    code: 'PAR-24M-1KG',
    category: 'Formaggi',
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
  // ... resto dei dati
};

<ProductAnalysisDashboard
  data={mockData}
  isLoading={false}
  error={null}
/>
```

### 2. Con API Fetch

```tsx
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  async function fetchData() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/products/${productId}/analysis`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  fetchData();
}, [productId]);

return (
  <ProductAnalysisDashboard
    data={data}
    isLoading={isLoading}
    error={error}
  />
);
```

## Stati del Componente

### Loading State
Mostra uno spinner animato con messaggio "Caricamento Analisi Prodotto..."

```tsx
<ProductAnalysisDashboard
  data={null}
  isLoading={true}
  error={null}
/>
```

### Error State
Mostra un messaggio di errore con pulsante "Riprova"

```tsx
<ProductAnalysisDashboard
  data={null}
  isLoading={false}
  error="Errore di connessione al server"
/>
```

### Success State
Mostra la dashboard completa con tutti i dati

```tsx
<ProductAnalysisDashboard
  data={productData}
  isLoading={false}
  error={null}
/>
```

## Priority Levels

Il componente gestisce 4 livelli di priorità per i suggerimenti:

- **low** (verde): Situazione ottimale
- **medium** (giallo): Monitoraggio consigliato
- **high** (arancione): Attenzione necessaria
- **critical** (rosso): Azione urgente richiesta

## KPI Card Gradients

```css
Fatturato:  from-emerald-500 to-teal-600
Costi:      from-orange-500 to-red-600
Profitto:   from-purple-500 to-pink-600
Margine:    from-blue-500 to-cyan-600
Quantità:   from-violet-500 to-purple-600
Giacenza:   from-amber-500 to-orange-600
```

## Grafici Recharts

### LineChart (Sales vs Purchases)
- Asse X: Date
- Asse Y: Valori in CHF (formattato in K)
- 2 linee: Vendite (verde) e Acquisti (rosso)
- Tooltip personalizzato

### BarChart (Top Customers)
- Mostra top 5 clienti
- Barre viola con bordi arrotondati
- Valori in CHF

### PieChart (Distribution)
- Colori: 6 colori COLORS array
- Label: Nome cliente + percentuale
- Tooltip con valori

## Responsive Breakpoints

- **Mobile**: 1 colonna (sm)
- **Tablet**: 2 colonne (md)
- **Desktop**: 3-4 colonne (lg, xl)
- **Wide**: 6 colonne per KPI (xl, 2xl)

## Dipendenze

```json
{
  "framer-motion": "^10.16.16",
  "lucide-react": "^0.294.0",
  "recharts": "^3.3.0"
}
```

## CSS/Styling

- **Tailwind CSS** per tutti gli stili
- **Gradients** per le KPI cards
- **Backdrop blur** per le section cards
- **Border glow** effects
- **Hover animations** con framer-motion

## File Correlati

- `ProductAnalysisDashboard.tsx` - Componente principale
- `ProductAnalysisDashboard.example.tsx` - Esempi di utilizzo
- `index.ts` - Export barrel

## Note Implementative

1. **Performance**: Usa `ResponsiveContainer` di Recharts per grafici responsive
2. **Animations**: Tutte le animazioni con `framer-motion` per performance ottimali
3. **TypeScript**: Completamente tipizzato con interfaces chiare
4. **Error Boundary**: Gestisce gracefully errori e stati di caricamento
5. **Accessibility**: Usa semantic HTML e ARIA labels dove appropriato

## Estensioni Future

- Export PDF/Excel dei dati
- Confronto periodi multipli
- Filtri avanzati
- Alert notifications
- Integration con sistema notifiche
- Grafici aggiuntivi (heatmap, scatter plot)
- Previsioni AI/ML

## Autore

LAPA Finest Italian Food - Super Dashboard Components
