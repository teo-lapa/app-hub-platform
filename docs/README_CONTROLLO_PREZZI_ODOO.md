# ANALISI COMPLETA: Requisiti Odoo per "Controllo Prezzi"

## DOCUMENTAZIONE CREATA

Ho analizzato completamente l'app "Controllo Prezzi" e identificato TUTTI i requisiti Odoo necessari.

### DOCUMENTI DISPONIBILI

1. **ANALISI_ODOO_CONTROLLO_PREZZI.md** (31 KB)
   - Analisi completa e dettagliata
   - Tutti i modelli Odoo necessari
   - Campi custom da creare
   - Query e filtri
   - Performance optimization
   - 12 sezioni complete

2. **QUICK_REFERENCE_CONTROLLO_PREZZI.md** (8.4 KB)
   - Riferimento rapido
   - Modelli, campi, formule
   - Query principali
   - Esempi pratici

3. **DIAGRAMMA_FLUSSO_CONTROLLO_PREZZI.md** (25 KB)
   - Diagrammi visuali
   - Flusso dati completo
   - Architettura sistema
   - User flow step-by-step

4. **ODOO_SETUP_CHECKLIST.md** (20 KB)
   - Checklist operativa
   - Step-by-step setup Odoo
   - Codice completo moduli
   - Troubleshooting
   - Test end-to-end

---

## RIEPILOGO ESECUTIVO

### MODELLI ODOO NECESSARI

#### 1. STANDARD (Esistenti - 7 modelli)
```
sale.order              → Ordini vendita (draft/sent)
sale.order.line         → Righe ordine + prezzi
product.product         → Prodotti + costi
res.partner             → Clienti
product.pricelist.item  → Prezzi bloccati
mail.activity           → Richieste blocco
ir.model               → Metadata
```

#### 2. CUSTOM (Da Creare - 1 modello)
```
x_price_review
├─ Tracking revisioni prezzi
├─ Stati: pending / reviewed / blocked
├─ Snapshot prezzi storici
└─ Metadata chi/quando
```

---

### COMPUTED FIELDS NECESSARI

#### 1. avg_selling_price_3m (product.product)
```python
Media vendite ultimi 3 mesi
Store: True
Trigger: create/write su sale.order.line
```

#### 2. critical_price (product.product)
```python
Punto Critico = standard_price * 1.4
Compute: On-the-fly
```

#### 3. price_category (sale.order.line)
```python
Categoria: sotto_pc | tra_pc_medio | sopra_medio
Dipende da: soldPrice vs criticalPrice vs avgPrice
```

---

### FORMULE CHIAVE

```python
# PUNTO CRITICO
critical_price = standard_price * 1.4

# PREZZO MEDIO (3 mesi)
avg_price = AVG(price_unit) WHERE
  - state IN ['sale', 'done']
  - create_date >= (oggi - 90 giorni)

# CLASSIFICAZIONE
if (sold_price < critical_price):
    'sotto_pc'        # ALERT
elif (sold_price < avg_price):
    'tra_pc_medio'    # DA VERIFICARE
else:
    'sopra_medio'     # OK
```

---

## RISPOSTE ALLE DOMANDE

### Q1: Quali modelli Odoo sono necessari?
**A:** 8 modelli totali:
- 7 STANDARD (già esistenti)
- 1 CUSTOM (x_price_review - da creare)

### Q2: Ci sono campi custom da creare in Odoo?
**A:** SI, 3 campi:
1. `product.product.avg_selling_price_3m` (Float, stored, computed)
2. `sale.order.line.critical_price` (Float, computed)
3. Tutti i campi del model `x_price_review` (15+ campi)

### Q3: Ci sono computed fields necessari?
**A:** SI, 3 computed fields:
1. **avgSellingPrice** - Media vendite 3 mesi
2. **criticalPrice** - Costo * 1.4
3. **priceCategory** - Classificazione prezzo

### Q4: Come viene calcolato il "punto critico"?
**A:** Formula semplice:
```
Punto Critico = standard_price * 1.4
Esempio: Costo 10 CHF → PC 14 CHF (40% margine)
```

### Q5: Come viene calcolato il "prezzo medio"?
**A:** Media vendite ultimi 3 mesi:
```python
Query sale.order.line WHERE:
  - product_id = X
  - state IN ['sale', 'done']
  - create_date >= (oggi - 90 giorni)

avgPrice = SUM(price_unit) / COUNT(lines)
```

### Q6: Cosa sono le "richieste di blocco"?
**A:** Task (mail.activity) con:
- res_model: 'sale.order'
- summary: contiene "Blocco Prezzo"
- Creati dai venditori per chiedere approvazione blocco

### Q7: Serve un database custom per tracking?
**A:** SI - 3 opzioni:
1. **Custom Model Odoo** (x_price_review) - RACCOMANDATO
2. PostgreSQL esterno - Alternativa
3. File JSON - NON RACCOMANDATO

---

## ENDPOINTS API

### IMPLEMENTATI
- GET `/api/controllo-prezzi/aggregate` - Core logic, analizza tutti ordini

### DA IMPLEMENTARE (attualmente MOCK)
- GET `/api/controllo-prezzi/counts` - Conteggi per categoria
- GET `/api/controllo-prezzi/products` - Lista prodotti per categoria
- POST `/api/controllo-prezzi/mark-reviewed` - Marca controllato
- POST `/api/controllo-prezzi/block-price` - Blocca prezzo
- POST `/api/controllo-prezzi/mark-pending` - Reset a pending

---

## NEXT STEPS

### IMMEDIATE (Settimana 1)
1. Crea custom model `x_price_review` in Odoo
2. Aggiungi computed field `avg_selling_price_3m`
3. Implementa API `/counts` (completa)
4. Implementa API `/products` (completa)

### SHORT-TERM (Settimana 2)
5. Implementa API `mark-reviewed`
6. Implementa API `block-price`
7. Implementa API `mark-pending`
8. Test end-to-end con Paul/Laura

### MEDIUM-TERM (Settimana 3-4)
9. Ottimizza performance (batch queries)
10. Aggiungi caching (Redis)
11. Aggiungi pagination
12. Dashboard analytics

---

## COME USARE QUESTA DOCUMENTAZIONE

### Per Setup Odoo
1. Leggi **ODOO_SETUP_CHECKLIST.md**
2. Segui step-by-step per creare moduli
3. Verifica con checklist finale

### Per Capire Requisiti
1. Leggi **ANALISI_ODOO_CONTROLLO_PREZZI.md**
2. Sezione per sezione, tutti i dettagli
3. Query, filtri, formule

### Per Riferimento Rapido
1. Usa **QUICK_REFERENCE_CONTROLLO_PREZZI.md**
2. Modelli, campi, formule chiave
3. Esempi pratici

### Per Capire Flusso Dati
1. Visualizza **DIAGRAMMA_FLUSSO_CONTROLLO_PREZZI.md**
2. Architettura sistema
3. User flow completo

---

## FILE ANALIZZATI

### Frontend
- `app/controllo-prezzi/page.tsx` - UI principale
- `components/controllo-prezzi/PriceCheckProductCard.tsx` - Card prodotto
- `components/controllo-prezzi/PriceCategoryFilterBar.tsx` - Filtri categoria

### Backend API
- `app/api/controllo-prezzi/counts/route.ts` - Conteggi (MOCK)
- `app/api/controllo-prezzi/products/route.ts` - Lista prodotti (MOCK)
- `app/api/controllo-prezzi/aggregate/route.ts` - Core logic (IMPLEMENTATO)
- `app/api/controllo-prezzi/mark-reviewed/route.ts` - Marca reviewed (MOCK)
- `app/api/controllo-prezzi/block-price/route.ts` - Blocca prezzo (MOCK)
- `app/api/controllo-prezzi/mark-pending/route.ts` - Reset pending (MOCK)

### Types
- `lib/types/price-check.ts` - TypeScript types

### Odoo Integration
- `lib/odoo-auth.ts` - Autenticazione e chiamate Odoo

---

## STATISTICHE ANALISI

```
Righe di codice analizzate: ~1,800
Modelli Odoo identificati: 8 (7 standard + 1 custom)
Campi necessari: 40+
Query Odoo identificate: 8 query principali
Computed fields: 3
Endpoints API: 6 (1 implementato, 5 da completare)
```

---

## CONTATTI

- **Accesso App:** Solo Paul & Laura (hardcoded)
- **Email Paul:** paul.diserens@gmail.com
- **Email Laura:** laura.diserens@gmail.com

---

## VERSION INFO

- **Analisi completata:** 12 Novembre 2025
- **Version:** 1.0
- **Odoo Version Target:** 17.0
- **Next.js App:** /controllo-prezzi

---

**L'analisi è completa e pronta per implementazione.**

Per iniziare, apri **ODOO_SETUP_CHECKLIST.md** e segui gli step.
