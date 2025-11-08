# Analisi Prodotto

Dashboard completa per l'analisi dettagliata di un prodotto con dati da Odoo.

## Percorso
`/analisi-prodotto`

## Caratteristiche

### 1. Form di Ricerca (Sticky)
- **Autocomplete Prodotti**: Ricerca prodotti da Odoo con debounce (300ms)
  - Minimo 3 caratteri per attivare la ricerca
  - Mostra nome prodotto e codice
  - Dropdown con risultati in tempo reale
- **Date Picker**: Selezione periodo di analisi
  - Data inizio (dateFrom)
  - Data fine (dateTo)
  - Validazione: dateTo >= dateFrom
  - Default: ultimi 3 mesi
- **Bottone Analizza**: Esegue l'analisi con validazione completa

### 2. Dashboard Dati (ProductAnalysisDashboard)
Visualizzazione completa dei dati quando disponibili:

#### KPI Cards
- **Quantità Venduta**: Totale + media giornaliera
- **Revenue Totale**: Totale + media giornaliera
- **Clienti Serviti**: Totale + top cliente
- **Giorni di Stock**: Copertura + status (critical/low/adequate/high)

#### Viste Multiple
1. **Panoramica**:
   - Analisi Stock (stock corrente, giorni copertura, punto riordino, qtà suggerita)
   - Performance Vendite (totali, medie, trend)

2. **Clienti**:
   - Top 10 clienti
   - Quantità acquistata
   - Revenue generata
   - Numero ordini

3. **Timeline Vendite**:
   - Grafico giornaliero vendite
   - Quantità per giorno
   - Revenue per giorno
   - Numero ordini

### 3. Features Aggiuntive

#### Export Dati
- **Export PDF**: Report completo in PDF con jsPDF
  - Info prodotto e periodo
  - Riepilogo vendite
  - Analisi stock
  - Top 5 clienti
- **Export Excel/CSV**: Dati completi in formato CSV
  - Tutte le metriche
  - Timeline completa
  - Top clienti

#### UI/UX
- **Loading States**: Spinner durante fetch con messaggi descrittivi
- **Error Handling**: Messaggi utente chiari con suggerimenti
- **Mobile Responsive**: Layout ottimizzato per tutti i dispositivi
- **Animations**: Transizioni smooth con Framer Motion
- **Sticky Form**: Form rimane visibile durante scroll
- **Toast Notifications**: Feedback immediato per azioni utente

### 4. Validazioni
- Prodotto obbligatorio (selezionato da autocomplete)
- Date obbligatorie
- dateTo >= dateFrom
- Messaggio di errore visibile per validazioni fallite

### 5. Stati Applicazione
- **Empty State**: Messaggio iniziale invitante
- **Loading State**: Spinner con descrizione operazione
- **Error State**: Messaggio errore con dettagli
- **Success State**: Dashboard completa con dati

## API Utilizzata
`GET /api/analisi-prodotto`

### Query Parameters
- `productName` (required): Nome prodotto
- `dateFrom` (required): Data inizio periodo (YYYY-MM-DD)
- `dateTo` (required): Data fine periodo (YYYY-MM-DD)

### Response
```typescript
{
  product: {
    id: number;
    name: string;
    qtyAvailable: number;
    uom: string;
    // ... altri campi
  };
  statistics: {
    totalSold: number;
    totalRevenue: number;
    weeklyAvgSales: number;
    daysOfCoverage: number;
    // ... altri campi
  };
  topCustomers: Array<{
    customerName: string;
    qty: number;
    revenue: number;
    orders: number;
  }>;
  saleOrders: Array<{
    createDate: string;
    productQty: number;
    priceSubtotal: number;
    // ... altri campi
  }>;
  // ... altri dati
}
```

## Tecnologie
- **Next.js 14**: App Router
- **React Query / SWR**: Non utilizzato (fetch diretto per semplicità)
- **Framer Motion**: Animazioni
- **Lucide React**: Icone
- **jsPDF**: Export PDF
- **React Hot Toast**: Notifiche
- **TypeScript**: Type safety

## Componenti
1. `app/analisi-prodotto/page.tsx`: Pagina principale
2. `components/analisi-prodotto/ProductAnalysisDashboard.tsx`: Dashboard dati
3. `app/api/analisi-prodotto/route.ts`: API route (già esistente)

## Utilizzo
1. Accedi a `/analisi-prodotto`
2. Cerca e seleziona un prodotto usando l'autocomplete
3. Seleziona il periodo di analisi
4. Clicca "Analizza"
5. Visualizza i dati nella dashboard
6. Esporta in PDF o Excel se necessario

## Note Tecniche
- **Debounce Search**: 300ms per ottimizzare le chiamate API
- **Date Default**: Ultimi 3 mesi
- **Timeout API**: 120 secondi (maxDuration in route.ts)
- **Cache**: Nessuna cache, dati sempre freschi da Odoo
- **Error Handling**: Try-catch completo con messaggi user-friendly

## Future Enhancements
- Comparazione tra periodi
- Grafici più avanzati con Recharts
- Filtri aggiuntivi (categoria, fornitore)
- Previsioni vendite con AI
- Export formati aggiuntivi (XLSX nativo)
- Salvataggio analisi preferite
