# Controllo Prezzi - Implementazione Completa

## Panoramica
App per il controllo dei prezzi di vendita rispetto al **Punto Critico** (costo +40%) e alla **Media vendita** (ultimi 3 mesi).

**Accesso:** SOLO Paul e Laura (hard-coded email check)

## Struttura Implementata

### 📁 File Creati

#### 1. Types
- `lib/types/price-check.ts` - Tipi TypeScript per tutto il sistema

#### 2. Componenti
- `components/controllo-prezzi/PriceCategoryFilterBar.tsx` - 4 card grandi per selezione categoria
- `components/controllo-prezzi/PriceCheckProductCard.tsx` - Card prodotto in griglia

#### 3. Pagina Principale
- `app/controllo-prezzi/page.tsx` - Pagina principale con pattern identico a Scadenze

#### 4. API Routes (stub da implementare)
- `app/api/controllo-prezzi/counts/route.ts` - GET conteggi per categoria
- `app/api/controllo-prezzi/products/route.ts` - GET lista prodotti per categoria
- `app/api/controllo-prezzi/mark-reviewed/route.ts` - POST marca come controllato
- `app/api/controllo-prezzi/block-price/route.ts` - POST blocca prezzo
- `app/api/controllo-prezzi/mark-pending/route.ts` - POST riporta a pending

#### 5. Registrazione App
- `lib/data/apps.ts` - App già registrata (id: '20', icona: 💰)

---

## Pattern Implementato

### Vista 1: Selezione Categoria (4 Card)

```
🔴 SOTTO PUNTO CRITICO     🟡 TRA PC E MEDIO
(12 prodotti)               (8 prodotti)

🟢 SOPRA MEDIO              🔔 RICHIESTE BLOCCO
(45 prodotti)               (3 prodotti)
```

### Vista 2: Lista Prodotti

Grid 2-7 colonne responsive con card:
- Foto prodotto
- Nome
- Badge stato (Da Controllare/Controllato/Bloccato)
- Prezzo venduto + sconto
- Cliente
- Nota venditore

### Vista 3: Modal Prodotto

Dettaglio con:
- Foto grande
- Nome e codice
- **Slider prezzi visuale**:
  - Marker PC (giallo)
  - Marker Medio (blu)
  - Marker Prezzo Venduto (bianco)
- Info ordine e cliente
- 3 Azioni:
  1. ✅ Marca come Controllato
  2. 🔒 Blocca Prezzo (blocca + rimuovi)
  3. ⏭️ Da Controllare (riporta in pending)

---

## Logica di Business

### Categorie Prezzo

#### 🔴 Sotto Punto Critico
```
soldPrice < criticalPrice (dove criticalPrice = costPrice * 1.4)
```
**Alert rosso**: Vendite in perdita o margine troppo basso

#### 🟡 Tra PC e Medio
```
criticalPrice <= soldPrice < avgSellingPrice
```
**Alert giallo**: Margine accettabile ma sotto la media

#### 🟢 Sopra Medio
```
soldPrice >= avgSellingPrice
```
**OK verde**: Prezzo ottimale

#### 🔔 Richieste Blocco
Prodotti con `status: 'blocked'` - necessitano approvazione

---

## Calcoli Prezzi

### Dati necessari da Odoo per ogni riga ordine:

1. **costPrice** - Prezzo d'acquisto (standard_price del prodotto)
2. **criticalPrice** - Calcolato: `costPrice * 1.4`
3. **avgSellingPrice** - Media prezzi vendita ultimi 3 mesi (query su sale.order.line)
4. **soldPrice** - Prezzo effettivo di vendita (`price_unit`)
5. **discount** - Sconto applicato (`discount`)
6. **listPrice** - Prezzo listino base (`list_price`)

### Query Odoo Necessarie

#### Conteggi per categoria
```python
# GET /api/controllo-prezzi/counts
# Recupera ordini confermati ultimi 7 giorni
# Per ogni riga, calcola categoria e conta
```

#### Lista prodotti
```python
# GET /api/controllo-prezzi/products?category=below_critical&days=7
# Filtra righe ordine per:
# - Ordini confermati (state='sale')
# - Ultimi N giorni
# - Categoria prezzo corrispondente
# Ritorna con tutti i dati per card e modal
```

---

## Slider Prezzi - Algoritmo

```typescript
const min = costPrice * 1.05;  // +5% margine minimo
const max = avgSellingPrice > 0
  ? avgSellingPrice * 2.5       // +150% su media
  : costPrice * 4.2;             // 420% su costo se no media

// Posizioni marker (0-100%)
const criticalPos = ((critical - min) / (max - min)) * 100;
const avgPos = ((avg - min) / (max - min)) * 100;
const valuePos = ((value - min) / (max - min)) * 100;
```

Gradiente: `from-red-500 via-yellow-500 via-green-500 to-blue-500`

---

## Stati Controllo

### 1. Pending (⏳ Da Controllare)
- Stato iniziale
- Appare nelle liste per categoria
- Necessita verifica di Paul/Laura

### 2. Reviewed (✅ Controllato)
- Prezzo verificato e approvato
- Rimosso dalle liste
- Tracciato: chi, quando

### 3. Blocked (🔒 Bloccato)
- Prezzo bloccato definitivamente
- Non modificabile da venditori
- Rimosso dalle liste
- Tracciato: chi, quando, nota

---

## Persistenza Dati

### Opzione 1: Custom Model Odoo
Creare `price.check.review` con campi:
- product_id
- order_id
- order_line_id
- status ('pending' | 'reviewed' | 'blocked')
- reviewed_by
- reviewed_at
- blocked_by
- blocked_at
- note

### Opzione 2: File JSON
File locale `data/price-checks.json`:
```json
{
  "productId-orderId": {
    "status": "reviewed",
    "reviewedBy": "paul@...",
    "reviewedAt": "2025-11-11T10:30:00Z"
  }
}
```

---

## TODO - Implementazione API

### 1. `/api/controllo-prezzi/counts/route.ts`
- [ ] Connessione Odoo
- [ ] Query ordini confermati ultimi 7gg
- [ ] Calcolo categorie per ogni riga
- [ ] Conteggio per categoria
- [ ] Check stato reviewed/blocked

### 2. `/api/controllo-prezzi/products/route.ts`
- [ ] Connessione Odoo
- [ ] Query righe ordine filtrate per categoria
- [ ] Recupero prezzi storici (media 3 mesi)
- [ ] Calcolo criticalPrice
- [ ] Recupero immagini prodotto
- [ ] Join con dati cliente/ordine
- [ ] Mapping a PriceCheckProduct[]

### 3. `/api/controllo-prezzi/mark-reviewed/route.ts`
- [ ] Validazione input
- [ ] Salvataggio stato reviewed
- [ ] Timestamp e user tracking

### 4. `/api/controllo-prezzi/block-price/route.ts`
- [ ] Validazione input
- [ ] Salvataggio stato blocked
- [ ] Opzionale: flag su sale.order.line in Odoo
- [ ] Timestamp e user tracking

### 5. `/api/controllo-prezzi/mark-pending/route.ts`
- [ ] Validazione input
- [ ] Reset stato a pending
- [ ] Rimozione flag blocco

---

## Sicurezza

### Email Whitelist (hard-coded)
```typescript
const allowedEmails = [
  'paul.diserens@gmail.com',
  'laura.diserens@gmail.com'
];
```

Check in `useEffect` della pagina principale:
```typescript
if (!allowedEmails.includes(user.email)) {
  toast.error('Accesso negato');
  router.push('/');
}
```

---

## Testing Checklist

### UI/UX
- [ ] 4 card categoria responsive
- [ ] Grid prodotti 2-7 colonne
- [ ] Modal dettaglio con slider
- [ ] Ricerca prodotti/clienti
- [ ] Badge stati colorati
- [ ] Toast notifications

### Funzionalità
- [ ] Conteggi categoria corretti
- [ ] Filtro per categoria funzionante
- [ ] Slider prezzi con marker precisi
- [ ] Marca come controllato → rimuove
- [ ] Blocca prezzo → rimuove
- [ ] Riporta a pending → aggiorna stato
- [ ] Access control Paul/Laura

### Performance
- [ ] Caricamento rapido conteggi
- [ ] Lazy loading immagini
- [ ] Debounce ricerca
- [ ] Ottimizzazione query Odoo

---

## Note Implementazione

1. **Pattern identico a Scadenze**: stesso layout, stessa UX, stessa logica di navigazione
2. **Slider come in review-prices**: stesso componente visuale con marker PC e Medio
3. **Accesso esclusivo**: controllo email in client-side, ma validare anche lato API
4. **Mock data**: API ritorna dati mock, da sostituire con query Odoo reali
5. **Stato persistente**: scegliere tra custom model Odoo o file JSON per tracking

---

## File da Implementare (Backend)

Per completare il sistema, implementare query Odoo in:
1. `counts/route.ts` - Calcolo conteggi reali
2. `products/route.ts` - Recupero prodotti filtrati
3. Persistenza stati (custom model o JSON)

---

## Esempio Query Odoo (Pseudocodice)

```python
# Recupera ordini confermati ultimi 7 giorni
orders = odoo.env['sale.order'].search([
  ('state', '=', 'sale'),
  ('date_order', '>=', today - 7days)
])

# Per ogni riga ordine
for line in orders.mapped('order_line'):
  # Recupera costo
  cost = line.product_id.standard_price
  critical = cost * 1.4

  # Calcola media ultimi 3 mesi
  avg = calculate_avg_price(line.product_id, 90days)

  # Classifica
  if line.price_unit < critical:
    category = 'below_critical'
  elif line.price_unit < avg:
    category = 'critical_to_avg'
  else:
    category = 'above_avg'
```

---

## Deploy

Dopo implementazione backend:
1. Test locale con dati reali Odoo
2. Verifica accesso Paul/Laura
3. Test tutte le azioni (mark reviewed, block, pending)
4. Deploy in produzione
5. Aggiungere icona app in homepage gestione-apps

---

**Status**: ✅ Frontend completo, ⏳ Backend da implementare
**Priorità**: Alta - richiesto da Paul per controllo prezzi vendita
**Effort**: ~4-6 ore per implementazione backend + testing
