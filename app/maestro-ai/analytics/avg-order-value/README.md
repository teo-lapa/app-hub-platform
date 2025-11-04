# Pagina Dettaglio: Valore Medio Ordine

## Percorso
`/maestro-ai/analytics/avg-order-value`

## Descrizione
Pagina dettagliata di analytics per il KPI "Valore Medio Ordine". Fornisce un'analisi approfondita del valore medio degli ordini nel periodo selezionato, spiegando PERCHE' la media ha quel valore specifico.

## Componenti Implementati

### 1. Header
- **Titolo**: "Valore Medio Ordine"
- **Valore principale**: Valore medio in CHF (formato grande, colore arancione)
- **Periodo attivo**: Badge con periodo selezionato
- **Filtro venditore**: Badge quando filtrato per venditore specifico
- **Bottone indietro**: Torna alla dashboard principale

### 2. Statistiche Rapide (4 cards)
- **Mediana**: Valore centrale della distribuzione
- **Deviazione Standard**: Misura della variabilita
- **Picco Massimo**: Ordine piu grande del periodo
- **Totale Ordini**: Numero ordini analizzati

### 3. Grafico Trend
- **Line Chart** con doppio asse Y:
  - Asse sinistro: Valore medio ordine (CHF) - linea arancione
  - Asse destro: Numero ordini - linea blu
- Mostra l'evoluzione del valore medio nel tempo
- Responsive e interattivo

### 4. Distribuzione per Fascia di Valore
- **Bar Chart** che mostra la distribuzione degli ordini in 4 fasce:
  - 0-100 CHF
  - 100-500 CHF
  - 500-1000 CHF
  - 1000+ CHF
- Due barre per fascia: numero ordini e revenue totale
- Cards sotto il grafico con dettagli percentuali

### 5. Breakdown per Venditore
- Lista dei venditori ordinata per valore medio ordine piu alto
- Per ogni venditore mostra:
  - Nome
  - Numero ordini
  - Revenue totale
  - Valore medio ordine (evidenziato)
  - Progress bar proporzionale alla media generale
- Scrollabile se molti venditori

### 6. Prodotti che Alzano la Media
- Top 10 prodotti ordinati per valore medio degli ordini che li contengono
- Icona verde (trending up) per prodotti che aumentano la media
- Icona rossa (trending down) per prodotti che abbassano la media
- Mostra valore medio ordini contenenti quel prodotto

### 7. Top 10 Ordini Piu Grandi
- Tabella scrollabile con i 10 ordini di valore piu alto
- Colonne:
  - Rank (#)
  - Nome ordine
  - Cliente
  - Venditore
  - Data
  - Importo (CHF)
  - Percentuale vs media (badge arancione)

### 8. Sezione Insights (CHIAVE!)
Box evidenziato che spiega **PERCHE'** la media ha quel valore:
- **Insight 1**: Percentuale ordini nella fascia piu bassa
- **Insight 2**: Confronto mediana vs media (indica presenza outliers)
- **Insight 3**: Interpretazione deviazione standard (variabilita)

## API Endpoint
`GET /api/maestro/analytics/avg-order-value`

### Query Parameters
- `period`: week | month | quarter | year
- `salesperson_id`: (optional) ID venditore

### Response
```typescript
{
  success: true,
  analytics: {
    avgOrderValue: number,
    medianOrderValue: number,
    stdDeviation: number,
    totalOrders: number,
    totalRevenue: number,
    peakOrder: {
      orderId: number,
      orderName: string,
      amount: number,
      date: string
    },
    avgValueTrend: Array<{
      date: string,
      avgValue: number,
      orderCount: number
    }>,
    distributionByRange: Array<{
      range: string,
      rangeLabel: string,
      orderCount: number,
      percentage: number,
      totalRevenue: number
    }>,
    bySalesperson: Array<{
      salespersonId: number,
      salespersonName: string,
      avgOrderValue: number,
      totalOrders: number,
      totalRevenue: number
    }>,
    productImpact: Array<{
      productId: number,
      productName: string,
      avgOrderValue: number,
      orderCount: number,
      totalRevenue: number,
      impact: 'increase' | 'decrease'
    }>,
    topOrders: Array<{
      orderId: number,
      orderName: string,
      customerName: string,
      salespersonName: string,
      date: string,
      amount: number,
      percentageOfAvg: number
    }>
  }
}
```

## Logica di Calcolo

### Valore Medio Ordine
```
avgOrderValue = totalRevenue / totalOrders
```

### Mediana
Valore centrale quando gli ordini sono ordinati per importo.
- Se numero pari di ordini: media dei due centrali
- Se numero dispari: valore centrale

### Deviazione Standard
```
variance = Σ(order_value - avg)² / n
stdDeviation = √variance
```

### Product Impact
Per ogni prodotto, calcola il valore medio degli ordini CHE CONTENGONO quel prodotto.
- Se avg_ordini_con_prodotto > avg_generale → impact = 'increase'
- Altrimenti → impact = 'decrease'

## Features

### Filtri Globali
- Usa il contesto `MaestroFiltersContext`
- Periodo: settimana, mese, trimestre, anno
- Venditore: filtra per venditore specifico

### Responsive Design
- Mobile-first
- Grid adattivi (2 colonne su mobile, 4 su desktop)
- Grafici responsive
- Tabelle scrollabili

### Animazioni
- Framer Motion per animazioni fluide
- Stagger effect sulle sezioni
- Transizioni smooth

### Color Coding
- **Arancione** (#f59e0b): Colore primario KPI
- **Verde**: Valori positivi, aumenti
- **Rosso**: Valori negativi, diminuzioni
- **Blu**: Informazioni secondarie
- **Giallo**: Awards, classifiche

## Stati Gestiti

### Loading
Spinner arancione con messaggio di caricamento.

### Error
Box rosso con icona di errore e messaggio.

### Success
Visualizzazione completa di tutte le sezioni analytics.

## Accessibility
- Bottone "Indietro" con altezza minima 44px (mobile touch)
- Contrast ratio adeguato
- Labels descrittive
- Tooltips sui grafici

## Performance
- React Query per caching (1 minuto)
- useMemo per calcoli derivati
- Lazy loading implicito con Next.js

## Note Implementative
- **Focus sul VALORE MEDIO**, non sul totale
- **Spiegazione del PERCHE'**: sezione insights dedicata
- **Distribuzione degli ordini**: mostra le fasce di valore
- Solo ordini confermati (`state IN ['sale', 'done']`)
- Date basate su `commitment_date`
