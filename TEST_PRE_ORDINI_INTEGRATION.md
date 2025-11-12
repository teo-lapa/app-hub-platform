# TEST INTEGRAZIONE PRE-ORDINI - GUIDA COMPLETA

## 🎯 OBIETTIVO
Verificare che l'integrazione tra pre-ordini e dashboard Smart Ordering funzioni correttamente.

---

## 📋 PREREQUISITI

1. **Database**: Tabella `preorder_customer_assignments` deve esistere
2. **Odoo**: Prodotti con tag "PRE-ORDINE"
3. **Server**: `npm run dev` avviato su staging

---

## 🧪 TEST PLAN

### TEST 1: API Pre-Orders Summary

**Endpoint**: `/api/smart-ordering-v2/pre-orders-summary`

**Verifica**:
```bash
node test-pre-orders-summary-api.js
```

**Risultato Atteso**:
```json
{
  "success": true,
  "preOrderSuppliers": [
    {
      "supplierId": 123,
      "supplierName": "Fornitore X",
      "products": [...],
      "totalProducts": 5,
      "totalCustomers": 3,
      "totalQuantity": 150
    }
  ],
  "stats": {
    "totalSuppliers": 2,
    "totalProducts": 10,
    "totalCustomers": 5
  }
}
```

---

### TEST 2: Sezione PRE-ORDINI nel Dashboard

**URL**: `https://staging.hub.lapa.ch/ordini-smart-v2`

**Steps**:
1. Apri il dashboard
2. Verifica che appaia la sezione "📦 PRE-ORDINI PROGRAMMATI"
3. Verifica che sia SOPRA "ORDINI PROGRAMMATI OGGI"

**Risultato Atteso**:
- ✅ Sezione visibile con card purple
- ✅ Ogni card mostra: nome fornitore, N° prodotti, N° clienti, quantità totale
- ✅ Badge "PRE-ORDINE" viola
- ✅ Bottone "🚀 Crea Ordini"

---

### TEST 3: Click su Card Pre-Ordine

**Steps**:
1. Click su una card nella sezione PRE-ORDINI
2. Verifica che si apra il modal del fornitore
3. Verifica che i prodotti pre-ordine siano già selezionati

**Risultato Atteso**:
- ✅ Modal si apre con prodotti del fornitore
- ✅ Prodotti pre-ordine hanno checkbox ✓ selezionato
- ✅ Quantità già impostate (somma clienti)
- ✅ Campo "Quantità" mostra valori corretti

---

### TEST 4: Bottone "📋 Carica Pre-Ordini"

**Steps**:
1. Apri un fornitore che HA pre-ordini
2. Deseleziona tutti i prodotti
3. Click su "📋 Carica Pre-Ordini"

**Risultato Atteso**:
- ✅ Alert di conferma con statistiche
- ✅ Prodotti pre-ordine vengono selezionati automaticamente
- ✅ Quantità corrette (somma dei clienti assegnati)

---

### TEST 5: Bottone "📋 Carica Pre-Ordini" (Nessun Pre-Ordine)

**Steps**:
1. Apri un fornitore che NON ha pre-ordini
2. Click su "📋 Carica Pre-Ordini"

**Risultato Atteso**:
- ✅ Alert: "ℹ️ Nessun pre-ordine trovato per questo fornitore"
- ✅ Nessun prodotto viene selezionato

---

### TEST 6: Creazione Ordini dalla Card

**Steps**:
1. Nella sezione PRE-ORDINI, click su "🚀 Crea Ordini"
2. Conferma il dialog
3. Attendi creazione ordini

**Risultato Atteso**:
- ✅ Dialog di conferma con: nome fornitore, N° prodotti, N° clienti, quantità
- ✅ Dopo conferma: chiamata API a `/api/smart-ordering-v2/create-all-preorders`
- ✅ Alert di successo con conteggi preventivi
- ✅ Card scompare dal dashboard (assegnazioni cancellate)
- ✅ Dashboard si ricarica automaticamente

---

### TEST 7: Creazione Ordini dal Modal

**Steps**:
1. Click su card pre-ordine → Apre modal
2. Prodotti pre-ordine già selezionati
3. Click "Conferma Ordine" in fondo al modal
4. Attendi creazione

**Risultato Atteso**:
- ✅ Ordine creato in Odoo
- ✅ Sale.order per ogni cliente
- ✅ Purchase.order per fornitore
- ✅ Messaggi nel chatter con dettagli pre-ordine
- ✅ Assegnazioni cancellate dal database
- ✅ Modal si chiude
- ✅ Card pre-ordine scompare

---

### TEST 8: Verifica Ordini in Odoo

**URL**: `https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com`

**Steps - Sale Orders**:
1. Vai in Vendite → Preventivi
2. Cerca ordini creati oggi
3. Apri un preventivo
4. Verifica chatter

**Risultato Atteso**:
- ✅ 1 preventivo per ogni cliente con pre-ordini
- ✅ Prodotti corretti con quantità
- ✅ Data consegna = DOMANI
- ✅ Chatter contiene messaggio: "📦 Prodotti aggiunti da Pre-Ordine..."
- ✅ Lista prodotti nel chatter

**Steps - Purchase Orders**:
1. Vai in Acquisti → RFQ
2. Cerca ordini creati oggi
3. Apri un RFQ
4. Verifica chatter

**Risultato Atteso**:
- ✅ 1 RFQ per fornitore con pre-ordini
- ✅ Quantità = somma di tutti i clienti
- ✅ Data ordine = DOMANI
- ✅ Chatter contiene breakdown clienti: "Cliente A: 10 unità, Cliente B: 20 unità"

---

### TEST 9: Database Cleanup

**Query**:
```sql
SELECT * FROM preorder_customer_assignments;
```

**Risultato Atteso**:
- ✅ Assegnazioni per ordini creati sono state cancellate
- ✅ Rimangono solo assegnazioni non ancora ordinate

---

## 🐛 TROUBLESHOOTING

### Problema: Sezione PRE-ORDINI non appare

**Cause possibili**:
1. Nessun prodotto con tag PRE-ORDINE
2. Nessun cliente assegnato ai prodotti
3. API `/api/smart-ordering-v2/pre-orders-summary` fallisce

**Debug**:
```bash
# Verifica API
node test-pre-orders-summary-api.js

# Verifica database
psql -d [database] -c "SELECT COUNT(*) FROM preorder_customer_assignments;"
```

---

### Problema: Prodotti non vengono selezionati

**Cause possibili**:
1. `productId` nel database non corrisponde a prodotti del fornitore
2. Fornitore (seller_ids) non corrisponde

**Debug**:
```javascript
// Nel browser console:
console.log(preOrderSuppliers);
console.log(selectedSupplier);
console.log(selectedProducts);
```

---

### Problema: Creazione ordini fallisce

**Cause possibili**:
1. Session Odoo scaduta
2. Prodotto non trovato in Odoo
3. Cliente non trovato in Odoo
4. Permessi insufficienti

**Debug**:
- Controlla console browser (F12)
- Controlla logs server (`npm run dev`)
- Verifica session cookie valido

---

## ✅ CHECKLIST FINALE

Prima di considerare il test completato:

- [ ] API `/api/smart-ordering-v2/pre-orders-summary` funziona
- [ ] Sezione PRE-ORDINI appare nel dashboard
- [ ] Click su card apre modal con prodotti selezionati
- [ ] Bottone "Carica Pre-Ordini" funziona
- [ ] Creazione ordini dalla card funziona
- [ ] Creazione ordini dal modal funziona
- [ ] Sale orders creati in Odoo
- [ ] Purchase orders creati in Odoo
- [ ] Messaggi chatter presenti
- [ ] Assegnazioni cancellate dal database
- [ ] Dashboard si ricarica correttamente

---

## 📊 REPORT FINALE

Dopo aver completato tutti i test, compila questo report:

```
DATA TEST: ___________
TESTER: ___________

RISULTATI:
- TEST 1 (API): ✅ / ❌
- TEST 2 (Sezione Dashboard): ✅ / ❌
- TEST 3 (Click Card): ✅ / ❌
- TEST 4 (Carica Pre-Ordini): ✅ / ❌
- TEST 5 (Nessun Pre-Ordine): ✅ / ❌
- TEST 6 (Crea da Card): ✅ / ❌
- TEST 7 (Crea da Modal): ✅ / ❌
- TEST 8 (Verifica Odoo): ✅ / ❌
- TEST 9 (Database Cleanup): ✅ / ❌

NOTE:
_______________________
_______________________
_______________________

BUGS TROVATI:
_______________________
_______________________
_______________________
```

---

## 🚀 PRONTO PER STAGING!

Se tutti i test passano, l'integrazione è completa e pronta per l'uso in staging! 🎉
