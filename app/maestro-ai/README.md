# MAESTRO AI - Frontend Documentation

## Overview

Sistema UI completo per MAESTRO AI - piattaforma intelligente per gestione team vendite e ottimizzazione visite clienti.

## Architettura

### Pages

#### 1. `/maestro-ai` - Manager Dashboard
Dashboard per manager con overview team:
- **KPI Cards**: Revenue, Ordini, Clienti Attivi, Valore Medio Ordine
- **Revenue Trend Chart**: Grafico lineare con trend ultimi 6 mesi
- **Top Performers Leaderboard**: Classifica venditori
- **Churn Alerts**: Lista clienti ad alto rischio
- **Upcoming Visits**: Visite pianificate per oggi

**Componenti usati**:
- `KPICard` - Metriche con trend
- `HealthScoreBadge` - Badge score salute cliente
- Recharts (LineChart, BarChart)

#### 2. `/maestro-ai/daily-plan` - Daily Plan Venditore
Piano giornaliero personalizzato per venditore:

**Sezioni prioritizzate**:
1. **URGENT** (rosso) - Churn risk >70%
2. **OPPORTUNITIES** (verde) - Potenziale upsell >60%
3. **FOLLOW-UPS** (blu) - Interazioni pending
4. **ROUTE OPTIMIZER** - Percorso ottimizzato geograficamente

**Features**:
- Filtri per priorità (all/urgent/high/medium)
- Customer cards con:
  - Health score badge
  - AI raccomandazioni
  - Prodotti suggeriti
  - Bottone "Completa visita" → apre modal
- Stats overview (visite pianificate, completate, target)

**Componenti usati**:
- `CustomerCard` (variants: urgent, opportunity, default)
- `InteractionModal`
- Stats cards

#### 3. `/maestro-ai/customers/[id]` - Customer Detail
Vista dettaglio cliente con tabs:

**Tabs**:
1. **Overview**
   - Revenue trend chart
   - Category spend pie chart
   - Contatti principali
   - Info account (credito, saldo, termini)

2. **Orders**
   - Tabella storico ordini completo
   - Filtri e ordinamento

3. **Interactions**
   - Timeline interazioni (visite, chiamate, email)
   - Campioni consegnati
   - Note e outcome

4. **Products**
   - Top 5 prodotti acquistati
   - Prodotti suggeriti da AI con confidence score
   - Potenziale revenue

5. **AI Insights**
   - Raccomandazioni automatiche
   - Warning, opportunities, alerts
   - Azioni consigliate

**Componenti usati**:
- `HealthScoreBadge` (grande in header)
- Recharts (LineChart, PieChart)
- Tabs navigation
- `InteractionModal`

### Components

#### Shared Components (`/components/maestro/`)

**KPICard**
```tsx
<KPICard
  title="Revenue Totale"
  value="€485,230"
  icon={Euro}
  trend={12.5}
  color="green"
/>
```
Props:
- `title`: string
- `value`: string | number
- `icon`: LucideIcon
- `trend?`: number (percentuale)
- `color?`: 'blue' | 'green' | 'orange' | 'red' | 'purple'

**HealthScoreBadge**
```tsx
<HealthScoreBadge
  score={85}
  size="md"
  showLabel={true}
/>
```
- Verde (80-100): Eccellente
- Giallo (60-79): Buono
- Arancione (40-59): Attenzione
- Rosso (0-39): Critico

**CustomerCard**
```tsx
<CustomerCard
  customer={customerData}
  variant="urgent"
  onComplete={handleCompleteVisit}
/>
```
Variants:
- `urgent`: border rosso, bg red/5
- `opportunity`: border verde, bg green/5
- `default`: border slate

**InteractionModal**
Modal completo per registrare interazioni:
- Tipo: visit/call/email
- Outcome: positive/neutral/negative
- Campioni consegnati (multi-input)
- Feedback campioni: good/bad/indifferent
- Ordine generato: checkbox
- Note libere: textarea

Salva su `POST /api/maestro/interactions`

**LoadingSkeleton**
Skeleton states per tutti i componenti:
- `KPICardSkeleton`
- `CustomerCardSkeleton`
- `DashboardSkeleton`
- `LoadingSpinner`

### Hooks

#### `useMaestroAI` (`/hooks/useMaestroAI.ts`)

Custom hooks per React Query:

```tsx
// Daily plan
const { data, isLoading, error } = useDailyPlan(salespersonId);

// Dashboard
const { data } = useDashboard();

// Customer detail
const { data } = useCustomerDetail(customerId);

// Create interaction (mutation)
const createInteraction = useCreateInteraction();
createInteraction.mutate({
  customer_id: 101,
  interaction_type: 'visit',
  outcome: 'positive',
  // ...
});
```

### Utilities

#### `/lib/utils.ts`

**Formatting**:
- `formatCurrency(value)` → "€1.234,56"
- `formatNumber(value)` → "1.234"
- `formatPercent(value)` → "12,5%"

**Styling helpers**:
- `cn(...classes)` - Merge Tailwind classes (clsx + tailwind-merge)
- `getHealthScoreColor(score)` - Colore testo per score
- `getHealthScoreBg(score)` - Colore background per score
- `getChurnRiskColor(risk)` - Colore per churn risk
- `getPriorityBadgeColor(priority)` - Colore badge priorità

### Styling System

**Design Tokens**:
- Background: `bg-slate-900`, `bg-slate-800`
- Borders: `border-slate-700`
- Text: `text-white`, `text-slate-400`, `text-slate-300`
- Accents:
  - Blue: `bg-blue-600`, `text-blue-400`
  - Green: `bg-green-600`, `text-green-400`
  - Red: `bg-red-600`, `text-red-400`
  - Orange: `bg-orange-600`, `text-orange-400`

**Dark Mode Native**: Tema dark by default, gradient backgrounds.

**Responsive**:
- Mobile-first approach
- Breakpoints: `md:`, `lg:`
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

### Animations

Framer Motion patterns:

**Page entrance**:
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.1 }}
```

**Hover effects**:
```tsx
whileHover={{ y: -2 }}
```

**Modal**:
```tsx
// Backdrop
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}

// Panel
initial={{ opacity: 0, scale: 0.95, y: 20 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
transition={{ type: 'spring', duration: 0.3 }}
```

## API Integration

### Endpoints

**GET** `/api/maestro/dashboard`
Response: KPIs, top performers, churn alerts, revenue trend

**GET** `/api/maestro/daily-plan?salesperson_id={id}`
Response: Urgent, opportunities, follow-ups, route optimization

**GET** `/api/maestro/customers/{id}`
Response: Customer detail completo con orders, interactions, insights

**POST** `/api/maestro/interactions`
Body:
```json
{
  "customer_id": 101,
  "interaction_type": "visit",
  "outcome": "positive",
  "samples_given": ["Product A", "Product B"],
  "sample_feedback": "good",
  "order_generated": true,
  "notes": "Cliente molto soddisfatto"
}
```

## Providers

### QueryProvider
Wrappa tutte le pagine maestro-ai con React Query context.

Config:
- `staleTime`: 1 minuto
- `refetchOnWindowFocus`: false

### Toast Notifications
React Hot Toast integrato:
- Success: verde
- Error: rosso
- Stile dark mode custom

## Performance Optimizations

1. **Code Splitting**: Ogni pagina è lazy-loaded
2. **React Query Caching**: 1 min stale time
3. **Optimistic Updates**: Modal interazioni
4. **Skeleton States**: Loading immediato
5. **Chart Lazy Loading**: Recharts on-demand
6. **Framer Motion**: GPU-accelerated animations

## Future Enhancements

- [ ] Real-time updates (WebSocket)
- [ ] Offline support (PWA)
- [ ] Advanced filters (date range, città, prodotti)
- [ ] Export reports (PDF, Excel)
- [ ] Mobile app version
- [ ] Voice notes per interazioni
- [ ] Photo upload (prodotti, visite)
- [ ] Google Maps integration per route optimizer
- [ ] Push notifications per alerts urgenti

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm run build

# Type check
npm run type-check
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charts**: Recharts
- **State Management**: React Query
- **Icons**: Lucide React
- **Forms**: React Hook Form (futuro)
- **Notifications**: React Hot Toast
- **Type Safety**: TypeScript

## File Structure

```
app/maestro-ai/
├── page.tsx                    # Manager Dashboard
├── layout.tsx                  # Layout con QueryProvider
├── daily-plan/
│   └── page.tsx               # Daily Plan Venditore
└── customers/
    └── [id]/
        └── page.tsx           # Customer Detail

components/maestro/
├── KPICard.tsx
├── HealthScoreBadge.tsx
├── CustomerCard.tsx
├── InteractionModal.tsx
├── LoadingSkeleton.tsx
└── index.ts

hooks/
└── useMaestroAI.ts

lib/
└── utils.ts
```

---

**Built with love by Frontend Specialist Team**
