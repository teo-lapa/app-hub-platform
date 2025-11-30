# Quick Start: Pre-Orders Summary API

## 🚀 File Creati

| File | Path | Descrizione |
|------|------|-------------|
| **API Route** | `app/api/smart-ordering-v2/pre-orders-summary/route.ts` | API principale (261 linee) |
| **Test Script** | `test-pre-orders-summary-api.js` | Script per testare API |
| **Documentazione** | `API_PRE_ORDERS_SUMMARY_DOCS.md` | Docs completa API |
| **Esempio UI** | `EXAMPLE_PRE_ORDERS_SUMMARY_COMPONENT.tsx` | Componente React completo |
| **DB Schema** | `DATABASE_SCHEMA_PRE_ORDERS.sql` | Schema database + indici |
| **Summary** | `IMPLEMENTATION_SUMMARY_PRE_ORDERS_SUMMARY.md` | Riepilogo implementazione |

## ⚡ Test Rapido

### 1. Avvia server
```bash
npm run dev
```

### 2. Testa API (se hai dati nel DB)
```bash
node test-pre-orders-summary-api.js
```

### 3. Test manuale con browser
```
http://localhost:3000/api/smart-ordering-v2/pre-orders-summary
```
*(richiede login Odoo prima)*

## 📊 Formato Risposta

```json
{
  "success": true,
  "preOrderSuppliers": [
    {
      "supplierId": 123,
      "supplierName": "Fornitore XYZ",
      "products": [...],
      "totalProducts": 5,
      "totalCustomers": 12,
      "totalQuantity": 150.5,
      "estimatedValue": 1250.75
    }
  ],
  "stats": {
    "totalSuppliers": 3,
    "totalProducts": 15,
    "totalCustomers": 25,
    "totalAssignments": 45,
    "totalQuantity": 500.0,
    "totalEstimatedValue": 5000.00
  }
}
```

## 🗄️ Database Setup

### Crea tabella (se non esiste)
```sql
CREATE TABLE preorder_customer_assignments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, customer_id)
);
```

### Inserisci dati di test
```sql
INSERT INTO preorder_customer_assignments (product_id, customer_id, quantity)
VALUES
  (12345, 100, 10.00),
  (12345, 101, 5.00),
  (12346, 100, 20.00);
```

## 🎯 Cosa Fa l'API

1. ✅ Legge tutte le assegnazioni da `preorder_customer_assignments`
2. ✅ Carica info prodotti da Odoo (nome, fornitore, prezzo)
3. ✅ Carica nomi clienti da Odoo
4. ✅ Raggruppa per fornitore
5. ✅ Calcola statistiche aggregate:
   - Numero prodotti
   - Numero clienti unici
   - Quantità totale
   - Valore stimato
6. ✅ Ritorna JSON strutturato

## 🔧 Funzionalità Chiave

### Per Fornitore
- Lista prodotti con pre-ordini
- Totale prodotti
- Clienti unici
- Quantità totale da ordinare
- Valore stimato ordine

### Per Prodotto
- Nome completo
- Codice articolo
- Prezzo unitario
- Unità di misura
- Quantità totale richiesta
- Numero clienti interessati
- Lista assegnazioni clienti

### Per Cliente (in ogni assegnazione)
- ID cliente
- Nome completo
- Quantità richiesta
- Note (opzionale)

## 📈 Statistiche Globali

- Numero totale fornitori
- Numero totale prodotti
- Numero totale clienti
- Numero totale assegnazioni
- Quantità totale globale
- Valore stimato totale

## 🎨 Integrazione UI

### Copia componente esempio
```bash
cp EXAMPLE_PRE_ORDERS_SUMMARY_COMPONENT.tsx app/pre-orders-summary/page.tsx
```

### Aggiungi al menu
```tsx
<Link href="/pre-orders-summary">
  Riepilogo Pre-Ordini
</Link>
```

## 🐛 Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| "Session non trovata" | Login su Odoo prima di chiamare API |
| Tabella non esiste | Esegui `DATABASE_SCHEMA_PRE_ORDERS.sql` |
| Array vuoto | Nessuna assegnazione nel DB - inserire dati test |
| Prodotti mancanti | Verificare che product_id esistano in Odoo |
| Lento | Implementare cache fornitori (vedi docs) |

## 🔗 Link Utili

- **API Docs**: `API_PRE_ORDERS_SUMMARY_DOCS.md`
- **Implementation**: `IMPLEMENTATION_SUMMARY_PRE_ORDERS_SUMMARY.md`
- **DB Schema**: `DATABASE_SCHEMA_PRE_ORDERS.sql`
- **Test**: `test-pre-orders-summary-api.js`

## ✅ Checklist Setup

- [ ] Crea tabella database
- [ ] Inserisci dati di test
- [ ] Avvia `npm run dev`
- [ ] Testa API con script
- [ ] Verifica risposta JSON
- [ ] Integra UI (opzionale)
- [ ] Deploy in produzione

## 📞 Support

Per domande:
1. Consulta `API_PRE_ORDERS_SUMMARY_DOCS.md`
2. Leggi `IMPLEMENTATION_SUMMARY_PRE_ORDERS_SUMMARY.md`
3. Controlla logs console Next.js
4. Verifica database con query test in `DATABASE_SCHEMA_PRE_ORDERS.sql`

---

**Status**: ✅ Ready for Testing
**Build**: ✅ Successful
**TypeScript**: ✅ No Errors
**Version**: 1.0.0
