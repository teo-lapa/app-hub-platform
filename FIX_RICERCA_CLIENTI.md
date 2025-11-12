# FIX: Sblocca ricerca "DGD Gastro GmbH" e altri 3360 clienti

## Problema
Il filtro `customer_rank > 0` blocca 3360 clienti che non hanno mai effettuato ordini.

## Soluzione: Opzione 1 (CONSIGLIATA) - Rimuovi completamente il filtro

### File da modificare
`C:\Users\lapa\OneDrive\Desktop\Claude Code\app\api\clienti\search\route.ts`

### PRIMA (righe 109-130):
```typescript
// RICERCA GLOBALE: cerca in TUTTO Odoo, non solo team LAPA
// Permessi gestiti automaticamente da Odoo tramite session_id

// Domain corretto per trovare:
// 1. Aziende (is_company=true)
// 2. Contatti (is_company=false AND type='contact')
// 3. ESCLUSI indirizzi di consegna/fatturazione (type='delivery'/'invoice')
const searchDomain = [
  ['customer_rank', '>', 0],           // Solo clienti (non fornitori)  ← RIMUOVERE!

  // Logica OR: Aziende O Contatti veri (NO indirizzi)
  '|',
    ['is_company', '=', true],         // Aziende
    '&',                                // AND
      ['is_company', '=', false],      // Contatti
      ['type', '=', 'contact'],        // Ma solo type='contact' (NO delivery/invoice)

  // Ricerca testuale (nome, email, telefono, città)
  '|', '|', '|', '|',
  ['name', 'ilike', query],
  ['email', 'ilike', query],
  ['phone', 'ilike', query],
  ['mobile', 'ilike', query],
  ['city', 'ilike', query]
];
```

### DOPO:
```typescript
// RICERCA GLOBALE: cerca in TUTTO Odoo, non solo team LAPA
// Permessi gestiti automaticamente da Odoo tramite session_id

// Domain corretto per trovare:
// 1. Aziende (is_company=true)
// 2. Contatti (is_company=false AND type='contact')
// 3. ESCLUSI indirizzi di consegna/fatturazione (type='delivery'/'invoice')
// NOTA: Non filtriamo per customer_rank per includere anche clienti senza ordini
const searchDomain = [
  // Logica OR: Aziende O Contatti veri (NO indirizzi)
  '|',
    ['is_company', '=', true],         // Aziende
    '&',                                // AND
      ['is_company', '=', false],      // Contatti
      ['type', '=', 'contact'],        // Ma solo type='contact' (NO delivery/invoice)

  // Ricerca testuale (nome, email, telefono, città)
  '|', '|', '|', '|',
  ['name', 'ilike', query],
  ['email', 'ilike', query],
  ['phone', 'ilike', query],
  ['mobile', 'ilike', query],
  ['city', 'ilike', query]
];
```

### Cosa cambia:
1. ❌ **RIMUOVI** la riga 114: `['customer_rank', '>', 0],`
2. ✅ **AGGIUNGI** commento esplicativo sul perché non filtriamo per `customer_rank`

---

## Soluzione: Opzione 2 (ALTERNATIVA) - Aggiungi parametro opzionale

Se vuoi mantenere la possibilità di filtrare per clienti attivi, aggiungi un parametro URL.

### 1. Modifica API Route
`C:\Users\lapa\OneDrive\Desktop\Claude Code\app\api\clienti\search\route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const activeOnly = searchParams.get('active_only') === 'true';  // ← NUOVO

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Query troppo corta (minimo 2 caratteri)'
      }, { status: 400 });
    }

    // ... codice esistente ...

    const searchDomain = [];

    // Filtro customer_rank opzionale
    if (activeOnly) {
      searchDomain.push(['customer_rank', '>', 0]);  // ← CONDIZIONALE
    }

    // Resto del domain
    searchDomain.push(
      '|',
        ['is_company', '=', true],
        '&',
          ['is_company', '=', false],
          ['type', '=', 'contact'],

      '|', '|', '|', '|',
      ['name', 'ilike', query],
      ['email', 'ilike', query],
      ['phone', 'ilike', query],
      ['mobile', 'ilike', query],
      ['city', 'ilike', query]
    );

    // ... resto del codice ...
  }
}
```

### 2. Modifica CustomerSelector
`C:\Users\lapa\OneDrive\Desktop\Claude Code\app\catalogo-venditori\components\CustomerSelector.tsx`

```typescript
export default function CustomerSelector({ onSelect }: CustomerSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeOnly, setActiveOnly] = useState(false);  // ← NUOVO

  // ... codice esistente ...

  const searchCustomers = useCallback(
    debounce(async (searchQuery: string) => {
      // ... codice esistente ...

      try {
        const url = `/api/clienti/search?q=${encodeURIComponent(searchQuery)}&active_only=${activeOnly}`;  // ← MODIFICA
        const response = await fetch(url);

        // ... resto del codice ...
      }
    }, 300),
    [activeOnly]  // ← AGGIUNGI DIPENDENZA
  );

  return (
    <div className="relative">
      {/* Checkbox per filtro "Solo clienti attivi" */}
      <div className="mb-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          <span>Solo clienti attivi (con ordini)</span>
        </label>
      </div>

      {/* Input ricerca esistente */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca cliente..."
        className="..."
      />

      {/* ... resto del codice ... */}
    </div>
  );
}
```

---

## Test della Fix

Dopo aver applicato la fix, testa con:

```bash
# Test 1: Cerca "DGD" (dovrebbe trovare DGD Gastro GmbH)
curl "http://localhost:3000/api/clienti/search?q=DGD"

# Test 2: Cerca "ADA" (dovrebbe trovare ADA Gastro GmbH)
curl "http://localhost:3000/api/clienti/search?q=ADA"

# Test 3 (Opzione 2): Cerca solo clienti attivi
curl "http://localhost:3000/api/clienti/search?q=DGD&active_only=true"
```

**Risultati attesi:**
- Test 1: ✅ 3 risultati (DGD Gastro GmbH + 2 indirizzi)
- Test 2: ✅ 1+ risultati
- Test 3: ❌ 0 risultati (perché DGD ha customer_rank = 0)

---

## Riassunto

### Opzione 1 (CONSIGLIATA): Rimuovi filtro
**PRO:**
- Più semplice da implementare
- Trova TUTTI i clienti
- Nessuna UI aggiuntiva necessaria

**CONTRO:**
- Potrebbe mostrare clienti mai usati

### Opzione 2 (AVANZATA): Filtro opzionale
**PRO:**
- Mantiene la possibilità di filtrare clienti attivi
- Più controllo per l'utente

**CONTRO:**
- Richiede modifiche sia backend che frontend
- Più complesso da implementare

---

**Raccomandazione:** Inizia con **Opzione 1** per sbloccare subito i clienti. Se necessario, implementa **Opzione 2** in seguito.
