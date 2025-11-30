# Test Plan - API Controllo Prezzi Aggregate

## Test Cases

### 1. Success - Con Ordini e Prodotti
**Scenario**: Ci sono ordini in draft/sent con prodotti

**Steps**:
1. Creare 2-3 ordini in stato `draft` in Odoo
2. Aggiungere prodotti agli ordini con prezzi diversi
3. Chiamare `GET /api/controllo-prezzi/aggregate`

**Expected**:
```json
{
  "success": true,
  "stats": {
    "sotto_pc": /* >0 se prezzi bassi */,
    "tra_pc_medio": /* >0 se prezzi medi */,
    "sopra_medio": /* >0 se prezzi alti */,
    "richieste_blocco": /* numero task */,
    "total_products": /* >0 */,
    "total_orders": /* >0 */
  },
  "products": [ /* array non vuoto */ ],
  "timestamp": "2025-11-11T..."
}
```

**Status Code**: 200 OK

---

### 2. Success - Nessun Ordine
**Scenario**: Non ci sono ordini in draft/sent

**Steps**:
1. Confermare tutti gli ordini draft (→ sale)
2. Chiamare `GET /api/controllo-prezzi/aggregate`

**Expected**:
```json
{
  "success": true,
  "stats": {
    "sotto_pc": 0,
    "tra_pc_medio": 0,
    "sopra_medio": 0,
    "richieste_blocco": 0,
    "total_products": 0,
    "total_orders": 0
  },
  "products": []
}
```

**Status Code**: 200 OK

---

### 3. Categorizzazione Corretta - Sotto PC
**Scenario**: Prodotto con prezzo sotto punto critico

**Setup**:
- Costo prodotto: 10.00 CHF
- Punto critico: 14.00 CHF (10 × 1.4)
- Prezzo ordine: 12.00 CHF

**Expected Category**: `"sotto_pc"`

**Calculation**:
```javascript
costPrice = 10.00
criticalPoint = 10.00 * 1.4 = 14.00
currentPrice = 12.00
12.00 < 14.00 → "sotto_pc" ✅
```

---

### 4. Categorizzazione Corretta - Tra PC e Medio
**Scenario**: Prodotto tra punto critico e prezzo medio

**Setup**:
- Costo prodotto: 10.00 CHF
- Punto critico: 14.00 CHF
- Prezzo medio (3 mesi): 18.00 CHF
- Prezzo ordine: 16.00 CHF

**Expected Category**: `"tra_pc_medio"`

**Calculation**:
```javascript
costPrice = 10.00
criticalPoint = 14.00
avgSellingPrice = 18.00
currentPrice = 16.00
16.00 >= 14.00 AND 16.00 < 18.00 → "tra_pc_medio" ✅
```

---

### 5. Categorizzazione Corretta - Sopra Medio
**Scenario**: Prodotto sopra prezzo medio

**Setup**:
- Costo prodotto: 10.00 CHF
- Punto critico: 14.00 CHF
- Prezzo medio (3 mesi): 18.00 CHF
- Prezzo ordine: 20.00 CHF

**Expected Category**: `"sopra_medio"`

**Calculation**:
```javascript
costPrice = 10.00
criticalPoint = 14.00
avgSellingPrice = 18.00
currentPrice = 20.00
20.00 >= 18.00 → "sopra_medio" ✅
```

---

### 6. Prezzi Bloccati
**Scenario**: Prodotto con prezzo bloccato nel listino

**Setup**:
1. Creare pricelist item con `compute_price = 'fixed'`
2. Assegnare listino all'ordine
3. Chiamare API

**Expected**:
```json
{
  "products": [{
    "isLocked": true,
    ...
  }]
}
```

---

### 7. Conteggio Richieste Blocco
**Scenario**: Ci sono task pendenti di blocco prezzo

**Setup**:
1. Creare 2 ordini in draft
2. Creare 3 attività con summary "Blocco Prezzo: ..."
3. Chiamare API

**Expected**:
```json
{
  "stats": {
    "richieste_blocco": 3,
    ...
  }
}
```

---

### 8. Error - Session Non Valida
**Scenario**: Utente non autenticato

**Steps**:
1. Chiamare API senza cookie session

**Expected**:
```json
{
  "success": false,
  "error": "User session not valid"
}
```

**Status Code**: 401 Unauthorized

---

### 9. Performance - Large Dataset
**Scenario**: Molti ordini e prodotti

**Setup**:
- 20 ordini in draft/sent
- 200+ prodotti totali
- Call API

**Expected**:
- Response time < 30 secondi
- No timeout error (maxDuration 120s)
- Tutti i prodotti processati

---

### 10. Error Handling - Ordine Senza Prodotti
**Scenario**: Ordine draft senza righe (order_line vuoto)

**Expected**:
- API continua con altri ordini
- Log warning: `⚠️ No lines found for order SO0XXX`
- Stats corretti per altri ordini

---

## Manual Testing

### Test con cURL
```bash
# 1. Get session cookie from browser
# Chrome: DevTools → Application → Cookies → session_id

# 2. Test API
curl -X GET 'http://localhost:3000/api/controllo-prezzi/aggregate' \
  -H 'Cookie: session_id=YOUR_SESSION_ID' \
  | jq .

# 3. Verify response structure
```

### Test con Browser DevTools
```javascript
// Console browser (dopo login)
fetch('/api/controllo-prezzi/aggregate', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Stats:', data.stats);
    console.log('Products:', data.products);

    // Verifica categorizzazione
    const sottoPc = data.products.filter(p => p.category === 'sotto_pc');
    console.log('Prodotti sotto PC:', sottoPc);
  });
```

---

## Automated Tests (Future)

### Jest Unit Tests
```typescript
// __tests__/api/controllo-prezzi/aggregate.test.ts
import { GET } from '@/app/api/controllo-prezzi/aggregate/route';

describe('GET /api/controllo-prezzi/aggregate', () => {
  it('should return stats and products', async () => {
    const req = new NextRequest('http://localhost/api/controllo-prezzi/aggregate');
    const response = await GET(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.stats).toBeDefined();
    expect(data.products).toBeInstanceOf(Array);
  });

  it('should categorize price correctly', () => {
    const costPrice = 10;
    const criticalPoint = costPrice * 1.4;
    const currentPrice = 12;

    expect(currentPrice < criticalPoint).toBe(true); // sotto_pc
  });
});
```

---

## Checklist Pre-Deploy

- [ ] API compila senza errori TypeScript
- [ ] Testato con ordini reali in Odoo staging
- [ ] Verificato conteggio per tutte le 4 categorie
- [ ] Testato performance con 10+ ordini
- [ ] Verificato error handling (401, 500)
- [ ] Log chiari e informativi
- [ ] Documentazione completa
- [ ] Esempio response JSON creato

---

## Known Issues / Limitations

1. **Performance**: Con 20+ ordini può richiedere 20-30 secondi
   - **Soluzione**: Implementare cache Redis in futuro

2. **Precision**: Calcolo media considera solo ultimi 3 mesi
   - **Workaround**: Se prodotto nuovo, usa list_price

3. **Session Timeout**: Se session Odoo scade durante elaborazione
   - **Workaround**: maxDuration 120s, ma session può scadere prima

4. **Company Filter**: Solo company_id = 1 (LAPA)
   - **Design**: Intenzionale per questa app

---

## Success Criteria

✅ API ritorna response corretta in < 30s
✅ Categorizzazione prezzi accurata 100%
✅ Conteggio richieste blocco corretto
✅ Error handling robusto
✅ Logging completo per debug
✅ Zero crash o timeout

---

## Next Steps After Testing

1. Deploy to production
2. Monitor performance in prod
3. Collect feedback da Paul/Laura
4. Iterate on performance se necessario
5. Implementare cache se richiesto

---

## Contact

Per report bug o domande sul test:
- Check logs: `[AGGREGATE-PRICES-API]`
- Verifica Odoo staging setup
- Test con diversi scenari prezzi
