# MAESTRO AI - Quick Start Guide

## Accesso alle Pagine

### 1. Dashboard Manager
**URL**: `http://localhost:3000/maestro-ai`

**Chi lo usa**: Manager team vendite

**Cosa vede**:
- 4 KPI cards (Revenue, Ordini, Clienti, AOV)
- Grafico trend revenue ultimi 6 mesi
- Leaderboard top 5 venditori
- Alert churn risk clienti critici
- Visite pianificate oggi

**Screenshot**:
```
┌─────────────────────────────────────────────────┐
│  MAESTRO AI Dashboard                   [Oggi] │
├─────────┬─────────┬──────────┬─────────────────┤
│ Revenue │ Ordini  │ Clienti  │ Valore Medio    │
│ €485K   │ 1,247   │ 342      │ €389            │
│ +12.5%  │ +8.3%   │ -2.1%    │ +15.2%          │
├─────────┴─────────┴──────────┴─────────────────┤
│ [Revenue Chart]           │ Top Performers    │
│                           │ 1. Mario Rossi    │
│ Gen Feb Mar Apr Mag Giu   │    €125K (+18.5%) │
│                           │ 2. Laura Bianchi  │
│                           │    €98.5K (+12%)  │
└───────────────────────────┴───────────────────┘
```

### 2. Daily Plan Venditore
**URL**: `http://localhost:3000/maestro-ai/daily-plan`

**Chi lo usa**: Venditore singolo

**Cosa vede**:
- Stats personali (visite pianificate, completate, target)
- Sezione URGENTE (clienti churn risk >70%)
- Sezione OPPORTUNITÀ (clienti upsell potential)
- Sezione FOLLOW-UPS (richiami pending)
- Percorso ottimizzato geograficamente

**Interazione tipica**:
1. Vede cliente "Ristorante Da Gianni" in sezione URGENTE (rosso)
2. Legge raccomandazione AI: "Cliente ad alto rischio churn. Offrire sconto 15%"
3. Vede prodotti suggeriti: "Mozzarella Bufala DOP, Prosciutto San Daniele"
4. Clicca "Completa visita"
5. Modal si apre → registra interazione

**Screenshot**:
```
┌──────────────────────────────────────────────────┐
│  Piano Giornaliero - Mario Rossi                 │
│  [Pianificate: 8] [Completate: 3] [Target: €5K] │
├──────────────────────────────────────────────────┤
│  ⚠️ URGENTE - Rischio Churn Alto        (2)     │
│  ┌────────────────────────────────────────────┐ │
│  │ 🔴 Ristorante Da Gianni - Milano          │ │
│  │ Health: 35 (Critico) | Churn: 85%         │ │
│  │ 💡 AI: Cliente ad alto rischio...         │ │
│  │ 🎯 Prodotti: Mozzarella, Prosciutto       │ │
│  │                    [Completa visita] 📞 ✉ │ │
│  └────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│  📈 Opportunità Upsell                    (3)   │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

### 3. Dettaglio Cliente
**URL**: `http://localhost:3000/maestro-ai/customers/101`

**Chi lo usa**: Venditore + Manager

**Tabs disponibili**:

#### TAB 1: Overview
- Health score grande (gauge)
- Grafico revenue trend
- Grafico spesa per categoria (pie)
- Contatti principali
- Info account (credito, saldo)

#### TAB 2: Orders
- Tabella storico ordini completo
- Data, importo, articoli, stato

#### TAB 3: Interactions
- Timeline interazioni (visite, chiamate, email)
- Campioni consegnati
- Outcome e note

#### TAB 4: Products
- Top 5 prodotti acquistati
- AI prodotti suggeriti con confidence score
- Potenziale revenue per prodotto

#### TAB 5: AI Insights
- Raccomandazioni automatiche
- Warning (trend negativo)
- Opportunities (upsell)
- Alerts (pagamenti ritardo)

**Screenshot**:
```
┌─────────────────────────────────────────────────┐
│  [← Torna]  Ristorante Da Gianni                │
│  📍 Via Roma 123, Milano                         │
│  ☎️ +39 02 1234567 | ✉️ info@...                │
│                                                  │
│  Health: 35 (Critico)    [Chiama] [Registra]   │
│  Churn: 85% | Revenue: €125K | AOV: €1,200     │
├─────────────────────────────────────────────────┤
│  [Overview] [Ordini] [Interazioni] [Prodotti]  │
├─────────────────────────────────────────────────┤
│  Revenue Trend          │  Contatti             │
│  [Chart declining]      │  Giovanni Rossi       │
│                         │  Proprietario         │
│  Category Spend         │  +39 333 1234567      │
│  [Pie chart]            │                       │
└─────────────────────────┴───────────────────────┘
```

## Modal Interazione

**Trigger**: Click "Completa visita" su customer card

**Campi**:
1. **Tipo interazione**: Visita / Chiamata / Email (3 bottoni icon)
2. **Esito**: Positivo / Neutrale / Negativo (3 bottoni colorati)
3. **Campioni consegnati**: Input multi-product (tag)
4. **Feedback campioni**: Ottimo / Indifferente / Negativo (se campioni presenti)
5. **Ordine generato**: Checkbox
6. **Note**: Textarea libera

**Submit**: POST `/api/maestro/interactions`

**Screenshot**:
```
┌────────────────────────────────────────┐
│  Registra Interazione                 │
│  Ristorante Da Gianni            [X]  │
├────────────────────────────────────────┤
│  Tipo di interazione                  │
│  [🏢 Visita*] [📞 Chiamata] [✉️ Email]│
│                                        │
│  Esito                                │
│  [✅ Positivo*] [⊝ Neutrale] [❌ Neg] │
│                                        │
│  Campioni consegnati                  │
│  [Input prodotto...........] [Aggiungi]│
│  🎁 Mozzarella Bufala DOP [x]         │
│  🎁 Prosciutto San Daniele [x]        │
│                                        │
│  Feedback campioni                    │
│  [Ottimo*] [Indifferente] [Negativo]  │
│                                        │
│  ☑️ Ordine generato                   │
│                                        │
│  Note                                 │
│  [Textarea.........................]  │
│                                        │
│           [Annulla] [Salva interazione]│
└────────────────────────────────────────┘
```

## Componenti Riutilizzabili

### KPICard
```tsx
import { KPICard } from '@/components/maestro';
import { Euro } from 'lucide-react';

<KPICard
  title="Revenue Totale"
  value={formatCurrency(485230)}
  icon={Euro}
  trend={12.5}
  trendLabel="vs ultimo mese"
  color="green"
/>
```

### HealthScoreBadge
```tsx
import { HealthScoreBadge } from '@/components/maestro';

<HealthScoreBadge score={85} size="lg" showLabel={true} />
// Output: [🟢 85 Eccellente]

<HealthScoreBadge score={35} size="md" />
// Output: [🔴 35 Critico]
```

### CustomerCard
```tsx
import { CustomerCard } from '@/components/maestro';

<CustomerCard
  customer={{
    id: 101,
    name: 'Ristorante Da Gianni',
    city: 'Milano',
    health_score: 35,
    churn_risk: 85,
    recommendation: 'Cliente ad alto rischio...',
    suggested_products: ['Mozzarella', 'Prosciutto']
  }}
  variant="urgent"
  onComplete={(id) => handleCompleteVisit(id)}
/>
```

### InteractionModal
```tsx
import { InteractionModal } from '@/components/maestro';

const [selectedCustomer, setSelectedCustomer] = useState(null);

<InteractionModal
  isOpen={!!selectedCustomer}
  onClose={() => setSelectedCustomer(null)}
  customerId={selectedCustomer?.id}
  customerName={selectedCustomer?.name}
/>
```

## Hooks API

### useDailyPlan
```tsx
import { useDailyPlan } from '@/hooks/useMaestroAI';

function DailyPlanPage() {
  const salespersonId = 14; // Current user
  const { data, isLoading, error } = useDailyPlan(salespersonId);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.urgent.map(customer => (
        <CustomerCard key={customer.id} customer={customer} />
      ))}
    </div>
  );
}
```

### useCreateInteraction
```tsx
import { useCreateInteraction } from '@/hooks/useMaestroAI';

function MyComponent() {
  const createInteraction = useCreateInteraction();

  const handleSubmit = () => {
    createInteraction.mutate({
      customer_id: 101,
      interaction_type: 'visit',
      outcome: 'positive',
      samples_given: ['Mozzarella Bufala', 'Prosciutto'],
      sample_feedback: 'good',
      order_generated: true,
      notes: 'Cliente molto soddisfatto'
    });
    // Auto toast success/error
    // Auto invalidate queries
  };
}
```

## Utilities

### Formatting
```tsx
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

formatCurrency(1234.56)  // "€1.234,56"
formatNumber(1234567)    // "1.234.567"
formatPercent(12.5)      // "12,5%"
```

### Styling Helpers
```tsx
import { cn, getHealthScoreColor } from '@/lib/utils';

// Merge Tailwind classes
const className = cn(
  'base-class',
  condition && 'conditional-class',
  'another-class'
);

// Health score colors
getHealthScoreColor(85)  // "text-green-500"
getHealthScoreColor(35)  // "text-red-500"
```

## Testing Locale

### 1. Avvia dev server
```bash
cd app-hub-platform
npm run dev
```

### 2. Accedi alle pagine
- Manager Dashboard: http://localhost:3000/maestro-ai
- Daily Plan: http://localhost:3000/maestro-ai/daily-plan
- Customer Detail: http://localhost:3000/maestro-ai/customers/101

### 3. Test interazioni
1. Click "Completa visita" su customer card
2. Compila modal interazione
3. Submit
4. Verifica toast success
5. Verifica API call su Network tab

## Mock Data

Attualmente le pagine usano mock data hardcoded. Per integrare backend reale:

1. Implementa API endpoints:
   - `GET /api/maestro/dashboard`
   - `GET /api/maestro/daily-plan?salesperson_id=14`
   - `GET /api/maestro/customers/:id`
   - `POST /api/maestro/interactions`

2. Rimuovi mock data dalle pagine

3. Hook useQuery caricheranno automaticamente dati reali

## Customizzazione

### Cambiare colori tema
```tsx
// lib/utils.ts
export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';  // Custom color
  // ...
}
```

### Aggiungere nuovo KPI
```tsx
// app/maestro-ai/page.tsx
<KPICard
  title="Nuova Metrica"
  value="123"
  icon={MyIcon}
  color="purple"
/>
```

### Personalizzare customer card
```tsx
// components/maestro/CustomerCard.tsx
// Aggiungi nuovi campi, badges, actions
```

## Troubleshooting

**Toast non appare**: Verifica che Toaster sia nel layout
```tsx
// app/maestro-ai/layout.tsx
import { Toaster } from 'react-hot-toast';
```

**Query non carica**: Check QueryProvider wrappa la app
```tsx
// app/maestro-ai/layout.tsx
<QueryProvider>{children}</QueryProvider>
```

**Stili non applicati**: Verifica globals.css importato in root layout

**Icons mancanti**: Verifica import da lucide-react
```tsx
import { Icon } from 'lucide-react';
```

## Next Steps

1. Implementare API backend reali
2. Aggiungere autenticazione (get current user)
3. Filtrare daily plan per salesperson_id corrente
4. Google Maps per route optimizer
5. Real-time updates con WebSocket
6. Notifiche push per alerts urgenti
7. Export PDF reports
8. Mobile PWA version

---

**Domande?** Consulta README.md per architettura completa.
