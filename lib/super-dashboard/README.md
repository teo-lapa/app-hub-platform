# Super Dashboard

Dashboard amministratore completa per LAPA - controllo totale dell'azienda in un'unica vista.

## Struttura

```
lib/super-dashboard/
├── mockData.ts          # Dati mock centralizzati per development/testing
├── types.ts             # TypeScript type definitions
├── hooks/
│   └── useDashboardData.ts  # Custom React hooks per fetching dati
└── README.md            # Questa documentazione

components/super-dashboard/
├── KPISummarySection.tsx          # 6 KPI cards principali
├── CustomerHealthSection.tsx      # Churn risk, upsell, health matrix
├── OperationsSection.tsx          # Magazzino, stock, scadenze
├── DeliverySection.tsx            # Tracking autisti e consegne
├── FinanceSection.tsx             # P&L, Break-even, AR Aging
├── TeamPerformanceSection.tsx     # Leaderboard venditori
├── ProductIntelligenceSection.tsx # Top products, slow movers, ABC
├── AlertsSection.tsx              # Alert critici e raccomandazioni AI
├── AIInsightsSection.tsx          # AI agents activity e performance
├── QuickActionsSection.tsx        # Azioni rapide e system status
└── index.ts                       # Barrel exports

app/super-dashboard/
└── page.tsx              # Main dashboard page
```

## Configurazione

### Mock Data vs Real Data

La dashboard supporta due modalità di funzionamento:

1. **Mock Data** (default - per development)
2. **Real Data** (produzione - da Odoo API)

### Toggle Mock/Real Data

Nel file `.env.local` (o `.env`):

```bash
# Set to 'true' for mock data, 'false' for real data
NEXT_PUBLIC_USE_MOCK_DATA=true
```

### Come Funziona

1. **Mock Data Mode** (`NEXT_PUBLIC_USE_MOCK_DATA=true`):
   - Usa dati da `lib/super-dashboard/mockData.ts`
   - Simulazione delay API (500ms)
   - Perfetto per development e testing
   - Nessuna connessione Odoo richiesta

2. **Real Data Mode** (`NEXT_PUBLIC_USE_MOCK_DATA=false`):
   - Fetch dati da Odoo API
   - Richiede connessione Odoo attiva
   - Per ambiente production

## Utilizzo

### Importare Dati Mock

```typescript
import { mockKPIData, mockHighRiskCustomers } from '@/lib/super-dashboard/mockData';

// Usa i dati direttamente nei componenti
const kpiData = mockKPIData;
```

### Usare Custom Hook

```typescript
import { useDashboardData } from '@/lib/super-dashboard/hooks/useDashboardData';

function MyComponent() {
  const { data, loading, error } = useDashboardData('month');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Usa data.kpi, data.highRiskCustomers, etc. */}</div>;
}
```

### Hook Disponibili

- `useDashboardData(period)` - Fetch tutti i dati dashboard
- `useRefreshDashboard()` - Refresh manuale dati
- `useExportDashboard()` - Export dashboard (PDF/Excel/CSV)

## Sezioni Dashboard

### 1. KPI Summary (6 Cards)
- Revenue
- Orders
- Customers
- Health Score
- Stock Value
- Deliveries

### 2. Customer Health
- High Risk Customers table (churn risk >70%)
- Upsell Opportunities cards
- Health vs Revenue scatter chart

### 3. Operations
- Arrivi merce timeline
- Stock critico alerts
- Scadenze imminenti (<30 giorni)
- Warehouse capacity gauges

### 4. Delivery Tracking
- Live driver tracking
- Map integration (Google Maps)
- Timeline consegne giornate
- KPI: On-Time%, Completate, In Corso, Issues

### 5. Finance
- P&L Summary (Revenue → Net Income)
- Break-even Analysis chart
- AR Aging report

### 6. Team Performance
- Leaderboard venditori (top 5)
- Activity heatmap (14 giorni)
- KPI per venditore

### 7. Product Intelligence
- Top 5 best sellers
- Slow movers (>90 giorni)
- ABC Analysis chart

### 8. Alerts & Recommendations
- Critical alerts (4 priority levels)
- AI recommendations (confidence scores)
- Today's priorities checklist

### 9. AI Insights
- Recent AI agent activity feed
- Model performance metrics
- Status 4 AI models

### 10. Quick Actions
- 9 action buttons
- System status monitor
- "All Systems Operational" badge

## Aggiungere Nuovi Dati Mock

1. Definisci il type in `types.ts`:
```typescript
export interface MyNewData {
  id: number;
  name: string;
}
```

2. Aggiungi mock data in `mockData.ts`:
```typescript
export const mockMyNewData: MyNewData[] = [
  { id: 1, name: 'Example' },
];
```

3. Aggiungi al DashboardData interface in `types.ts`:
```typescript
export interface DashboardData {
  // ... existing fields
  myNewData: MyNewData[];
}
```

4. Aggiungi al hook in `useDashboardData.ts`:
```typescript
setData({
  // ... existing data
  myNewData: mockMyNewData,
});
```

## Connessione Odoo (TODO)

Quando sarai pronto per connettere dati reali da Odoo:

1. Crea API endpoint: `app/api/dashboard/route.ts`
2. Implementa fetch da Odoo nel hook `useDashboardData.ts`
3. Set `NEXT_PUBLIC_USE_MOCK_DATA=false`

## Development

```bash
# Start dev server
npm run dev

# Dashboard disponibile su:
http://localhost:3000/super-dashboard
```

## Deployment

### Staging
```bash
git add .
git commit -m "feat: Super Dashboard con mock data"
git push origin staging
```

### Production
- Deploy SOLO dopo aver testato su staging
- Assicurati che Odoo sia connesso e funzionante
- Set `NEXT_PUBLIC_USE_MOCK_DATA=false` in production

## Note Importanti

- ⚠️ **NON modificare il design** - solo aggiungere connessioni dati
- ⚠️ **Mock data rimane** - per testing futuro
- ⚠️ **Sempre testare su staging** prima di production
- ✅ Dashboard responsive (mobile, tablet, desktop)
- ✅ Animazioni con Framer Motion
- ✅ Charts con Recharts
- ✅ Dark mode ready

## Supporto

Per domande o problemi, contatta il team di sviluppo.
