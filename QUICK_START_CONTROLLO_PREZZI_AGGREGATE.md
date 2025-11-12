# Quick Start - API Controllo Prezzi Aggregate

## Uso Rapido

### 1. Endpoint
```
GET /api/controllo-prezzi/aggregate
```

### 2. Esempio Fetch
```typescript
const response = await fetch('/api/controllo-prezzi/aggregate', {
  credentials: 'include'
});
const data = await response.json();
```

### 3. Response Rapida
```json
{
  "stats": {
    "sotto_pc": 12,           // ⚠️ CRITICI
    "tra_pc_medio": 25,       // ⚡ ATTENZIONE
    "sopra_medio": 48,        // ✅ OK
    "richieste_blocco": 3,    // 📋 DA APPROVARE
    "total_products": 85,
    "total_orders": 15
  },
  "products": [ /* array completo */ ]
}
```

## Come Funziona

### Input
- Nessun parametro richiesto
- Usa la session cookie dell'utente loggato

### Output
1. **Stats**: Conteggi aggregati per categoria
2. **Products**: Lista completa con tutti i dettagli

### Categorie
```javascript
// Punto Critico = Costo × 1.4

if (prezzo < PC) → "sotto_pc"          // 🔴 CRITICO
else if (prezzo < medio) → "tra_pc_medio"  // 🟡 ATTENZIONE
else → "sopra_medio"                   // 🟢 OK
```

## Esempio Dashboard

```typescript
// components/PriceControlDashboard.tsx
export default function PriceControlDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/controllo-prezzi/aggregate', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Controllo Prezzi</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card color="red">
          <h3>Sotto PC</h3>
          <p>{data.stats.sotto_pc}</p>
        </Card>
        <Card color="yellow">
          <h3>PC - Medio</h3>
          <p>{data.stats.tra_pc_medio}</p>
        </Card>
        <Card color="green">
          <h3>Sopra Medio</h3>
          <p>{data.stats.sopra_medio}</p>
        </Card>
        <Card color="purple">
          <h3>Richieste</h3>
          <p>{data.stats.richieste_blocco}</p>
        </Card>
      </div>

      {/* Products Table */}
      <Table>
        {data.products.map(p => (
          <tr key={p.lineId}>
            <td>{p.productName}</td>
            <td>{p.currentPriceUnit} CHF</td>
            <td>{p.category}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
```

## Filtri Rapidi

```typescript
// Filtra prodotti critici
const critici = data.products.filter(p => p.category === 'sotto_pc');

// Filtra per ordine specifico
const ordine123 = data.products.filter(p => p.orderId === 123);

// Filtra per cliente
const cliente567 = data.products.filter(p => p.customerId === 567);

// Filtra prezzi bloccati
const bloccati = data.products.filter(p => p.isLocked);
```

## Use Cases

### 1. Dashboard Paul/Laura
```typescript
// Mostra solo prodotti critici
const Dashboard = () => {
  const critici = data.products.filter(p => p.category === 'sotto_pc');

  return (
    <Alert type="danger">
      {critici.length} prodotti sotto punto critico!
    </Alert>
  );
};
```

### 2. Lista Richieste Blocco
```typescript
// Conta richieste pendenti
const RichiesteWidget = () => (
  <Badge count={data.stats.richieste_blocco}>
    Richieste da Approvare
  </Badge>
);
```

### 3. Report Excel
```typescript
// Export CSV
const exportCSV = () => {
  const csv = data.products.map(p =>
    `${p.orderName},${p.productName},${p.currentPriceUnit},${p.category}`
  ).join('\n');

  downloadFile(csv, 'prezzi-report.csv');
};
```

## Performance Tips

### Cache (Raccomandato)
```typescript
// Cache 5 minuti lato client
const CACHE_TTL = 5 * 60 * 1000;

const cachedFetch = async () => {
  const cached = localStorage.getItem('price-data');
  const cacheTime = localStorage.getItem('price-data-time');

  if (cached && cacheTime && Date.now() - parseInt(cacheTime) < CACHE_TTL) {
    return JSON.parse(cached);
  }

  const response = await fetch('/api/controllo-prezzi/aggregate');
  const data = await response.json();

  localStorage.setItem('price-data', JSON.stringify(data));
  localStorage.setItem('price-data-time', Date.now().toString());

  return data;
};
```

### Loading State
```typescript
const [loading, setLoading] = useState(true);

// Mostra skeleton mentre carica (può richiedere 10-30 secondi)
if (loading) {
  return <SkeletonLoader />;
}
```

## Troubleshooting

### Error 401
```typescript
if (response.status === 401) {
  // Redirect a login
  router.push('/login');
}
```

### Timeout
```typescript
// L'API ha maxDuration 120s
// Se timeout, riprova dopo 1 minuto
```

### Nessun Ordine
```json
{
  "stats": { "total_orders": 0, ... },
  "products": []
}
// Normale se non ci sono ordini in draft/sent
```

## Prossimi Passi

1. ✅ Usa l'API nel tuo componente
2. ✅ Implementa cache client-side
3. ✅ Aggiungi filtri per categoria
4. ✅ Mostra stats in cards colorate
5. ✅ Export CSV per report

## Link Utili

- **Documentazione Completa**: `API_CONTROLLO_PREZZI_AGGREGATE_DOCS.md`
- **Esempio Response**: `EXAMPLE_CONTROLLO_PREZZI_AGGREGATE_RESPONSE.json`
- **API Source**: `app/api/controllo-prezzi/aggregate/route.ts`
