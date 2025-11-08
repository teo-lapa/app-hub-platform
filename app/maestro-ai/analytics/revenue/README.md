# Revenue Detail Page - Documentazione

## Percorso
`/maestro-ai/analytics/revenue`

## Descrizione
Pagina di dettaglio per l'analisi approfondita del KPI "Revenue Totale". Mostra statistiche, grafici e breakdown dettagliati delle vendite.

## Dati Mostrati

### 1. Header
- **Titolo**: Revenue Totale con icona
- **Valore Principale**: Revenue totale formattata (CHF)
- **Periodo**: Badge con periodo selezionato (Settimana/Mese/3 Mesi/Anno)
- **Venditore**: Badge con nome venditore (se filtrato)

### 2. Quick Stats (4 card)
- **Ordini Totali**: Numero totale ordini nel periodo
- **Clienti Attivi**: Numero clienti che hanno ordinato
- **Valore Medio**: Valore medio per ordine (CHF)
- **Media Giornaliera**: Revenue media al giorno (CHF)

### 3. Grafico Principale - Revenue Trend
- **Tipo**: LineChart (Recharts)
- **Dimensioni**: 400px altezza (responsive)
- **Dati**:
  - Asse sinistro: Revenue (CHF) - linea verde
  - Asse destro: Ordini - linea blu
- **Features**:
  - Tooltip con valori formattati
  - Legend
  - Grid
  - Dots su ogni punto dati

### 4. Statistiche Aggiuntive (3 card)
- **Picco Massimo**: Giorno con revenue più alta
- **Valore Minimo**: Giorno con revenue più bassa
- **Giorni Analizzati**: Numero totale giorni nel periodo

### 5. Breakdown per Venditore
**Condizione**: Mostrato solo se NON c'è filtro venditore attivo

#### Tabella Venditori
- Nome venditore
- Revenue totale (CHF)
- Numero ordini
- Numero clienti
- Percentuale del totale
- Barra progressiva visuale

#### Pie Chart
- Distribuzione revenue tra top 5 venditori
- Colori diversi per ogni venditore
- Label con percentuali
- Tooltip con valori (CHF)

### 6. Top 10 Prodotti per Revenue
- Classifica prodotti ordinata per revenue
- Per ogni prodotto:
  - Nome
  - Revenue totale (CHF)
  - Quantità venduta
  - Numero clienti
  - Percentuale del totale
  - Barra progressiva visuale

## API Chiamate

### 1. useAnalytics Hook
```typescript
useAnalytics(period, selectedVendor?.id)
```
**Endpoint**: `/api/maestro/analytics/period`
**Params**:
- `period`: week | month | quarter | year
- `salesperson_id`: ID venditore (opzionale)
- `include_trend`: true

**Dati Ritornati**:
- `kpis`: { revenue, orders, customers, avgOrderValue }
- `revenueByMonth`: Array di { month, revenue, orders }
- `topPerformers`: Array di venditori con statistiche
- `topProducts`: Array di prodotti con revenue

## Grafici Utilizzati

### 1. LineChart (Revenue Trend)
- **Libreria**: Recharts
- **Componenti**: Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
- **Dual Y-Axis**: Revenue (sinistra) + Ordini (destra)
- **Responsive**: ResponsiveContainer al 100%

### 2. PieChart (Distribuzione Venditori)
- **Libreria**: Recharts
- **Componenti**: Pie, Cell, Tooltip
- **Features**: Label inline con percentuali
- **Colori**: Palette COLORS (8 colori predefiniti)

### 3. Progress Bars
- **Componenti**: Div nativi con Tailwind
- **Stile**: Gradient (green-to-emerald per venditori, blue-to-purple per prodotti)

## Design

### Colori
- **Background**: Gradient slate-900 → slate-800
- **Cards**: bg-slate-800 border-slate-700
- **Revenue**: text-green-400
- **Ordini**: text-blue-400
- **Accenti**: purple, orange per statistiche

### Responsive
- **Mobile**:
  - Grid 2 colonne per quick stats
  - Stack verticale per grafici
  - Font size ridotti
- **Tablet**:
  - Grid 4 colonne per quick stats
  - Grid 2 colonne per breakdown venditori
- **Desktop**:
  - Layout completo
  - Grafici affiancati

### Animazioni
- **Framer Motion**: Fade-in + slide-up
- **Delays**: Scaglionati (0.1s - 0.5s)
- **Transitions**: Smooth per hover states

## Filtri Globali
La pagina rispetta i filtri globali dal context:
- **Periodo**: Selezionato nella dashboard
- **Venditore**: Se selezionato, mostra solo i suoi dati

## Navigation
- **Back Button**: Torna alla dashboard (`router.back()`)
- **Link da Dashboard**: Click sulla KPICard "Revenue Totale"

## Stati

### Loading
- Spinner centrale
- Messaggio "Caricamento dati revenue..."

### Error
- Card rossa con messaggio errore
- Back button sempre disponibile

### Empty State
- Gestito automaticamente dai componenti
- Array vuoti → nessun rendering della sezione

## Mobile Optimization
- Touch target minimo 44px (back button)
- Pull-to-refresh compatibile (eredita da layout)
- Scroll smooth per tabelle lunghe
- Font responsive (text-sm → text-base → text-lg)
