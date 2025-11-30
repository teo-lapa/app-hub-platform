# 📦 LAPA DELIVERY v4.0 - ANALISI COMPLETA

## 📋 INDICE
1. [Metadata e Configurazione](#metadata)
2. [Struttura UI Completa](#struttura-ui)
3. [Funzionalità Principali](#funzionalita)
4. [Sistema JavaScript](#javascript)
5. [Integrazione Odoo](#odoo)
6. [Storage e Offline](#storage)
7. [Sistema Allegati](#allegati)
8. [Firma Digitale](#firma)
9. [Navigazione e Mappa](#mappa)
10. [Stati e Workflow](#stati)
11. [Checklist Implementazione](#checklist)

---

## 1️⃣ METADATA E CONFIGURAZIONE {#metadata}

### Versione
- **Nome**: LAPA Delivery v4.0
- **Sottotitolo**: Sistema Allegati Unificato
- **Data**: 09/09/2025

### Meta Tags
```html
- viewport: width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no
- apple-mobile-web-app-capable: yes (PWA iOS)
- mobile-web-app-capable: yes (PWA Android)
- apple-mobile-web-app-status-bar-style: black-translucent
- theme-color: #4f46e5 (colore indigo per browser mobile)
- Cache policies: no-cache (sempre contenuto fresco)
```

### Librerie Esterne
1. **Dexie.js v3.2.4** - Database IndexedDB per storage locale
2. **Google Maps API** - Per mappe e navigazione

### Ottimizzazioni Specifiche
- **Android Tablet**: font-size aumentato, min-height pulsanti 48px
- **Touch targets**: minimo 44x44px per accessibilità
- **Prevent zoom**: font-size 16px su input per evitare zoom iOS
- **Touch callout**: disabilitato per app-like experience

---

## 2️⃣ STRUTTURA UI COMPLETA {#struttura-ui}

### A. HEADER (Fisso Top)
**Elementi:**
1. **Logo/Titolo app** - "🚚 LAPA Delivery"
2. **Driver info** - Nome autista loggato
3. **Vehicle badge** - Targa/nome veicolo
4. **Status indicators** - Online/Offline, GPS attivo

**CSS:**
- Position: fixed top
- Height: 60px
- Background: white
- Z-index: 1000
- Box-shadow per depth

### B. STATS CONTAINER (Subito sotto header)
**3 Card Statistics:**
1. **Totale Consegne** - Numero totale per oggi
2. **Completate** - Consegne già fatte (verde)
3. **Pendenti** - Rimanenti da fare (arancione)

**Layout:**
- Grid 3 colonne
- Gap 12px
- Padding 16px
- Card con shadow

### C. MAIN CONTENT (Scrollabile)
**Sezioni:**

#### 1. LISTA CONSEGNE (Vista Default)
Ogni **delivery-card** contiene:
- **Numero sequenziale** - Badge circolare viola
- **Status badge** - "IN CONSEGNA" / "COMPLETATA"
- **Customer name** - Nome cliente in bold
- **Address** - Indirizzo completo con icona 📍
- **Phone** - Numero telefono con link tel:
- **Order info** - Numero ordine ODO
- **Delivery time** - Orario consegna previsto
- **ETA badge** - Tempo stimato arrivo (es. "15 min")
- **Products summary** - "12 articoli" con icona 📦
- **Total amount** - Importo totale ordine €
- **Payment status** - "DA PAGARE" / "PAGATO" / "GIÀ PAGATO"
- **Action buttons**:
  - 🗺️ NAVIGA
  - ✅ COMPLETA
  - 📦 SCARICO (badge con numero prodotti backorder)

**Stati visivi:**
- `.completed`: opacità 0.6, background azzurro chiaro
- `.active`: transform scale su touch
- `.has-issues`: border rosso se problemi

#### 2. VISTA MAPPA
- Mappa Google Maps fullscreen
- Markers per ogni consegna:
  - 🔵 Blu: Pendenti
  - 🟢 Verde: Completate
  - 🔴 Rosso: Posizione corrente autista
- Info window al click su marker
- Polyline per percorso ottimizzato
- Controlli mappa:
  - Toggle POI (punti interesse)
  - Centra su posizione corrente
  - Fullscreen

### D. BOTTOM NAVIGATION (Fisso Bottom)
**4 Tab:**
1. **📋 Lista** - Vista lista consegne
2. **🗺️ Mappa** - Vista mappa
3. **🔄 Ricarica** - Refresh dati da Odoo
4. **📊 Stats** - Statistiche giornata

**CSS:**
- Position: fixed bottom
- Height: 70px
- Background: white
- Border-top: 1px solid gray
- Z-index: 1000

---

## 3️⃣ FUNZIONALITÀ PRINCIPALI {#funzionalita}

### 🔐 1. AUTENTICAZIONE
**Processo:**
- Login con email/password
- Chiamata a Odoo `web/session/authenticate`
- Salvataggio session_id in localStorage
- Riconoscimento automatico driver da user Odoo
- Assegnazione veicolo al driver

**Dati salvati:**
```javascript
{
  session_id: "xyz123",
  uid: 42,
  name: "Mario Rossi",
  vehicle_id: 5,
  vehicle_name: "FIAT DUCATO - AB123CD"
}
```

### 📦 2. CARICAMENTO DELIVERIES
**Fonte dati:** Modello Odoo `stock.picking`

**Filtri:**
```python
[
  ('picking_type_id.code', '=', 'outgoing'),  # Solo consegne uscita
  ('scheduled_date', '>=', inizio_giornata),  # Oggi
  ('scheduled_date', '<=', fine_giornata),
  ('state', 'in', ['assigned', 'done']),      # Pronte o completate
  ('vehicle_id', '=', vehicle_id_driver)      # Solo del driver loggato
]
```

**Campi letti:**
- `id, name` - ID e numero picking (es. WH/OUT/00123)
- `partner_id` - Cliente (nome, indirizzo, telefono, coordinate GPS)
- `scheduled_date` - Data/ora consegna prevista
- `state` - Stato (assigned/done)
- `origin` - Numero ordine vendita collegato
- `move_lines` - Righe prodotti da consegnare
  - `product_id` (nome, codice)
  - `product_uom_qty` - Quantità ordinata
  - `quantity_done` - Quantità consegnata
  - `backorder_qty` - Quantità in backorder
- `sale_id` - Ordine vendita per importo totale
- `payment_status` - Stato pagamento
- `latitude, longitude` - Coordinate GPS destinazione
- `note` - Note consegna

**Ordinamento:**
- Default: per `scheduled_date` crescente
- Dopo ottimizzazione: per ordine percorso

### 🚗 3. NAVIGAZIONE
**Metodi:**
- **Google Maps**: `https://www.google.com/maps/dir/?api=1&destination=lat,lng`
- **Apple Maps** (iOS): `maps://maps.apple.com/?daddr=lat,lng`
- **Waze**: `waze://?ll=lat,lng&navigate=yes`

**Geolocalizzazione:**
- Tracking continuo posizione driver
- Aggiornamento ogni 30 secondi
- Calcolo distanza da prossima consegna
- ETA dinamico

### ⏱️ 4. CALCOLO ETA (Estimated Time Arrival)
**Processo:**
1. Richiesta a Google Maps Directions API
2. Input: posizione corrente → coordinate consegna
3. Output: distanza (km) + durata (minuti)
4. Salvataggio ETA per ogni consegna
5. Aggiornamento automatico dopo ogni consegna completata
6. Ricalcolo per tutte le consegne rimanenti

**Display:**
- Badge con minuti: "🕒 15 min"
- Colori:
  - Verde: < 10 min
  - Giallo: 10-30 min
  - Arancione: > 30 min

### 🎯 5. OTTIMIZZAZIONE PERCORSO
**Algoritmo Google Maps Optimization:**
1. Waypoints: tutte le consegne pendenti
2. Optimize: true (Google calcola ordine ottimale)
3. Output: ordine consegne + tempo totale percorso
4. Applicazione nuovo ordine alla lista
5. Aggiornamento numeri sequenziali

**Organizer Manuale:**
- Modal drag & drop per riordinare consegne
- Touch-friendly per tablet
- Preview percorso su mappa
- Salvataggio ordine temporaneo
- Apply per applicare definitivamente

### 📦 6. SCARICO PRODOTTI
**Flow completo:**

#### Step 1: Apertura Vista Scarico
- Click su "SCARICO" da delivery card
- Caricamento prodotti del picking da Odoo
- Mostra solo prodotti con `backorder_qty > 0`

#### Step 2: Lista Prodotti Interattiva
Ogni prodotto ha:
- **Nome + codice prodotto**
- **Quantità ordinata** vs **già consegnata**
- **Quantità backorder** (da scaricare ora)
- **Input quantità** con:
  - Pulsanti -/+ per incremento
  - Click per aprire calcolatrice
  - Validazione max = backorder_qty
- **Checkbox "Scaricare"** - seleziona prodotto
- **Note prodotto** (textarea)

#### Step 3: Filtri e Ricerca
- 🔍 Search box per nome/codice
- Toggle "Solo da scaricare"
- Counter prodotti selezionati/totali

#### Step 4: Completamento
**3 Opzioni:**

**A. Completa con Firma** ✍️
- Canvas firma digitale
- Salvataggio firma come PNG base64
- Upload allegato "Firma Cliente" a Odoo

**B. Solo Foto** 📸
- Scatta foto consegna
- Upload come allegato a Odoo
- Nota obbligatoria

**C. Pagamento alla Consegna** 💰
- Se ordine ha payment_status = 'to_pay'
- Modal metodo pagamento:
  - 💵 Contanti
  - 💳 Carta
  - 🏦 Bonifico
- Input importo pagato
- Creazione payment in Odoo
- Riconciliazione automatica con invoice

#### Step 5: Validazione Odoo
- Chiamata a `button_validate()` su picking
- Aggiornamento `quantity_done` per ogni prodotto
- Creazione backorder se prodotti non scaricati
- Cambio stato picking → 'done'
- Invio notifica al warehouse

### 📸 7. SISTEMA ALLEGATI UNIFICATO
**Database IndexedDB con Dexie:**

**Struttura:**
```javascript
db.attachments = {
  id: auto_increment,
  picking_id: number,
  context: string,  // 'signature', 'photo', 'payment', 'reso'
  data: blob,       // Immagine base64
  timestamp: Date,
  uploaded: boolean,
  odoo_attachment_id: number
}
```

**Contesti allegati:**
1. **signature** - Firma cliente
2. **photo** - Foto consegna
3. **payment** - Ricevuta pagamento
4. **reso** - Foto prodotto reso

**Modal Gestione:**
- Visualizzazione griglia thumbnails
- Click per preview fullscreen
- Pulsante elimina
- Upload batch a Odoo
- Indicatore count allegati per contesto

**Upload Odoo:**
- Modello: `ir.attachment`
- Campi:
  - `name`: "Firma Cliente - WH/OUT/00123 - 15:30"
  - `datas`: base64 immagine
  - `res_model`: 'stock.picking'
  - `res_id`: picking_id
  - `mimetype`: 'image/png'

### ✍️ 8. FIRMA DIGITALE
**Implementazione Canvas HTML5:**

**Setup:**
```javascript
<canvas id="signatureCanvas" width="800" height="400"></canvas>
```

**Event Handlers:**
- `touchstart` / `mousedown`: inizia disegno
- `touchmove` / `mousemove`: disegna linea
- `touchend` / `mouseup`: fine disegno
- Line width: 2px
- Stroke color: #000
- Line cap: round (bordi arrotondati)

**Features:**
- Smooth drawing con lineTo()
- Clear button per ricominciare
- Preview firma prima di salvare
- Validazione: almeno 10 stroke points
- Conversione canvas → PNG base64

### 💰 9. GESTIONE PAGAMENTI
**Tipi supportati:**
1. **Contanti** (cash)
2. **Carta** (card)
3. **Bonifico** (bank_transfer)

**Flow Odoo:**
1. Ricerca invoice collegato a sale_order
2. Creazione `account.payment`:
   - `payment_type`: 'inbound'
   - `partner_type`: 'customer'
   - `amount`: importo pagato
   - `payment_method_id`: metodo scelto
   - `ref`: "Pagamento delivery WH/OUT/00123"
3. Post payment (conferma)
4. Riconciliazione automatica con invoice
5. Aggiornamento payment_status → 'paid'

**Validazioni:**
- Importo > 0
- Importo <= totale fattura
- Invoice trovato e non pagato
- Metodo pagamento valido

### 🔄 10. GESTIONE RESI
**Processo:**
1. Click "RESO" da dettaglio consegna
2. Modal selezione prodotti da rendere
3. Input quantità reso per prodotto
4. Scatta foto prodotto danneggiato
5. Nota motivo reso (obbligatoria)

**Creazione Picking Reso Odoo:**
```python
{
  'picking_type_id': tipo_reso_id,  # Return picking type
  'partner_id': cliente_id,
  'origin': picking_originale_name,
  'move_lines': [
    {
      'product_id': prodotto_id,
      'product_uom_qty': qty_resa,
      'name': descrizione_prodotto
    }
  ]
}
```

**Allegati reso:**
- Foto prodotto → context: 'reso'
- Upload a picking reso creato

### 🖨️ 11. STAMPA BOLLA
**Generazione PDF:**
- Chiamata a Odoo `stock.picking.print_delivery_note()`
- Download PDF bolla
- Apertura in nuova tab per stampa
- Salvataggio in attachments Odoo

**Contenuto bolla:**
- Header LAPA con logo
- Dati cliente e consegna
- Tabella prodotti scaricati
- Totali e note
- Firma cliente se presente

### 📊 12. STATISTICHE GIORNATA
**Metriche calcolate:**
- Totale consegne assegnate
- Consegne completate (%)
- Consegne pendenti
- Km percorsi (somma distanze)
- Tempo medio consegna
- ETA medio vs tempo reale
- Numero resi
- Importo totale incassato
- Pagamenti alla consegna

### 🔔 13. NOTIFICHE
**Eventi notificati:**
- Nuova consegna assegnata
- Consegna completata
- Problema durante scarico
- GPS disattivato
- Connessione persa/ripristinata
- Storage pieno

---

## 4️⃣ SISTEMA JAVASCRIPT - TUTTE LE FUNZIONI {#javascript}

### INIZIALIZZAZIONE
1. **`init()`** - Avvio app, check session, load deliveries
2. **`getSession()`** - Ottiene/verifica sessione Odoo
3. **`initMap()`** - Inizializza Google Maps
4. **`startGPS()`** - Avvia tracking GPS
5. **`initDragAndDrop()`** - Gestione drag & drop organizer

### ODOO INTEGRATION
6. **`callOdoo(model, method, args, kwargs)`** - RPC generico a Odoo
7. **`loadDeliveries()`** - Carica consegne da stock.picking
8. **`loadScaricoProducts(pickingId)`** - Carica prodotti picking

### RENDERING UI
9. **`renderDeliveries()`** - Renderizza lista delivery cards
10. **`renderScaricoProducts(filteredProducts)`** - Lista prodotti scarico
11. **`updateStats()`** - Aggiorna statistics cards
12. **`updateBackorderBadge()`** - Badge count backorder
13. **`updateScaricoStats()`** - Stats scarico (selezionati/totali)
14. **`updateDeliveryNumbers()`** - Numeri sequenziali dopo riordino

### NAVIGAZIONE APP
15. **`switchView(view)`** - Cambia tra lista/mappa/stats
16. **`openDelivery(delivery)`** - Apre modal dettaglio consegna
17. **`closeModal()`** - Chiude modal corrente
18. **`openScaricoView(delivery)`** - Apre vista scarico
19. **`closeScaricoView()`** - Chiude scarico e torna a lista

### NAVIGAZIONE MAPS
20. **`navigate()`** - Apre navigatore esterno (Google/Apple/Waze)
21. **`navigateTo(lat, lng)`** - Naviga a coordinate specifiche
22. **`updateMap()`** - Aggiorna markers su mappa
23. **`updateMapPOI()`** - Toggle POI su mappa
24. **`toggleMapControls()`** - Show/hide controlli mappa
25. **`drawRouteOnMap()`** - Disegna polyline percorso ottimizzato

### OTTIMIZZAZIONE PERCORSO
26. **`optimizeRoute()`** - Entry point ottimizzazione
27. **`optimizeWithGoogle()`** - Chiama Google Directions API con waypoints
28. **`showRouteOrganizerModal(deliveries)`** - Modal drag & drop manuale
29. **`applyRouteOrder()`** - Applica ordine scelto
30. **`updateTempOrder()`** - Salva ordine temporaneo durante drag
31. **`showRouteOnMap()`** - Preview percorso su mappa

### CALCOLO ETA
32. **`calculateETAsForDeliveries(orderedDeliveries)`** - ETA per tutte consegne
33. **`updateOdooScheduledDate(deliveryId)`** - Aggiorna scheduled_date con ETA
34. **`recalculateETAsAfterDelivery()`** - Ricalcola ETA dopo consegna completata
35. **`getCurrentPosition()`** - Ottiene posizione GPS corrente

### GESTIONE SCARICO
36. **`updateScaricoQty(productId, qty)`** - Aggiorna quantità prodotto
37. **`openCalculator(productId, maxQty)`** - Apre calcolatrice
38. **`calcPress(num)`** - Input numero calcolatrice
39. **`calcPressDecimal()`** - Punto decimale
40. **`calcClear()`** - Clear calcolatrice
41. **`calcConfirm(productId)`** - Conferma quantità
42. **`completeScarico()`** - Completa scarico senza firma
43. **`confirmScaricoWithSignature()`** - Completa con firma
44. **`confirmScaricoPhotoOnly()`** - Completa con solo foto
45. **`validateDeliveryGroup()`** - Valida picking su Odoo

### FIRMA
46. **`openSignatureModal()`** - Apre modal firma
47. **`initSignatureCanvas()`** - Setup canvas e event listeners
48. **`startDrawing(e)`** - Inizia disegno firma
49. **`draw(e)`** - Disegna mentre si muove
50. **`stopDrawing()`** - Fine disegno
51. **`clearSignature()`** - Cancella firma
52. **`completeWithSignature()`** - Salva firma e completa

### ALLEGATI
53. **`openAttachmentModalForSignature()`** - Mostra allegati firma
54. **`openAttachmentModalForPhoto()`** - Mostra allegati foto
55. **`openAttachmentModalForPayment()`** - Mostra allegati pagamento
56. **`openAttachmentModalForReso(deliveryId)`** - Mostra allegati resi
57. **`closeAttachmentModal()`** - Chiude modal allegati
58. **`updateAttachmentCount(context, deliveryId)`** - Aggiorna count badge
59. **`checkStorageQuota()`** - Verifica spazio disponibile

### PAGAMENTI
60. **`openPaymentAtDeliveryModal()`** - Modal pagamento
61. **`processPaymentAtDelivery()`** - Processa pagamento scelto
62. **`savePaymentData()`** - Salva payment in Odoo

### RESI
63. **`handleReso(deliveryId)`** - Apre modal resi
64. **`saveReso(deliveryId)`** - Crea picking reso in Odoo

### ALTRE
65. **`markComplete()`** - Segna consegna completata (senza scarico)
66. **`reloadData()`** - Ricarica dati da Odoo
67. **`printDelivery(deliveryId)`** - Stampa bolla
68. **`countBackorderProducts()`** - Conta prodotti backorder
69. **`checkBackorderProducts()`** - Verifica se ci sono backorder
70. **`openStockApp()`** - Apre app gestione stock
71. **`showLoading(show)`** - Mostra/nascondi loading spinner
72. **`showToast(message, type)`** - Toast notification
73. **`isAndroidTablet()`** - Detect se tablet Android
74. **`getMapStyles()`** - Stili custom Google Maps
75. **`getDragAfterElement(container, y)`** - Helper drag & drop
76. **`closeAfterInvoice()`** - Chiude dopo creazione invoice
77. **`initAfterMapsLoad()`** - Callback dopo load Google Maps API

---

## 5️⃣ INTEGRAZIONE ODOO {#odoo}

### CONFIGURAZIONE
```javascript
const ODOO_URL = 'https://your-instance.odoo.com';
const ODOO_DB = 'your-database';
```

### AUTENTICAZIONE
**Endpoint:** `POST /web/session/authenticate`

**Payload:**
```json
{
  "jsonrpc": "2.0",
  "params": {
    "db": "lapa-db",
    "login": "driver@lapa.ch",
    "password": "password123"
  }
}
```

**Response:**
```json
{
  "result": {
    "session_id": "abc123xyz",
    "uid": 42,
    "name": "Mario Rossi",
    "username": "driver@lapa.ch"
  }
}
```

### RPC CALLS
**Pattern generico:**
```javascript
async function callOdoo(model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Openerp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: method,
        args: args,
        kwargs: kwargs
      }
    })
  });
  return response.json();
}
```

### MODELLI ODOO UTILIZZATI

#### 1. `stock.picking` (Consegne)
**Metodi:**
- `search_read()` - Carica consegne
- `read()` - Leggi dettagli picking
- `write()` - Aggiorna campi
- `button_validate()` - Valida picking
- `action_assign()` - Assegna prodotti
- `do_unreserve()` - Rilascia prenotazione

**Campi custom:**
- `vehicle_id` - Many2one fleet.vehicle
- `driver_id` - Many2one res.users
- `latitude` - Float
- `longitude` - Float
- `delivery_note` - Text
- `payment_status` - Selection

#### 2. `stock.move` (Movimenti/Prodotti)
**Campi:**
- `picking_id` - Link a consegna
- `product_id` - Prodotto
- `product_uom_qty` - Quantità ordinata
- `quantity_done` - Quantità effettiva
- `state` - Stato movimento

#### 3. `sale.order` (Ordini Vendita)
**Campi usati:**
- `name` - Numero ordine
- `partner_id` - Cliente
- `amount_total` - Totale
- `payment_state` - Stato pagamento
- `invoice_ids` - Fatture collegate

#### 4. `account.payment` (Pagamenti)
**Metodi:**
- `create()` - Crea pagamento
- `action_post()` - Conferma pagamento

**Campi:**
- `payment_type` - 'inbound'
- `partner_type` - 'customer'
- `amount` - Importo
- `payment_method_id` - Metodo
- `journal_id` - Giornale
- `ref` - Riferimento

#### 5. `account.move` (Fatture)
**Campi:**
- `name` - Numero fattura
- `invoice_origin` - Ordine origine
- `amount_residual` - Da pagare
- `payment_state` - Stato

#### 6. `ir.attachment` (Allegati)
**Metodi:**
- `create()` - Upload allegato

**Campi:**
- `name` - Nome file
- `datas` - Base64
- `res_model` - 'stock.picking'
- `res_id` - ID picking
- `mimetype` - 'image/png'

#### 7. `fleet.vehicle` (Veicoli)
**Campi:**
- `name` - Nome/Targa veicolo
- `driver_id` - Autista assegnato

### QUERIES PRINCIPALI

**1. Carica consegne del driver:**
```python
domain = [
  ('picking_type_id.code', '=', 'outgoing'),
  ('vehicle_id', '=', vehicle_id),
  ('scheduled_date', '>=', today_start),
  ('scheduled_date', '<=', today_end),
  ('state', 'in', ['assigned', 'done'])
]
fields = ['id', 'name', 'partner_id', 'scheduled_date',
          'state', 'origin', 'latitude', 'longitude']
```

**2. Carica prodotti picking:**
```python
domain = [('picking_id', '=', picking_id)]
fields = ['product_id', 'product_uom_qty', 'quantity_done',
          'product_uom', 'name']
```

**3. Valida picking:**
```python
picking.button_validate()
# Se quantità parziali → crea backorder automatico
```

**4. Crea pagamento:**
```python
payment = self.env['account.payment'].create({
  'payment_type': 'inbound',
  'partner_id': partner_id,
  'amount': amount,
  'payment_method_id': method_id,
  'journal_id': journal_id,
})
payment.action_post()
```

---

## 6️⃣ STORAGE E OFFLINE {#storage}

### INDEXEDDB CON DEXIE

**Configurazione:**
```javascript
const db = new Dexie('LapaDeliveryDB');
db.version(1).stores({
  attachments: '++id, picking_id, context, timestamp, uploaded',
  deliveries: 'id, scheduled_date, state',
  offline_actions: '++id, timestamp, synced'
});
```

### TABELLE

#### 1. `attachments`
**Schema:**
```typescript
{
  id: number,              // Auto-increment
  picking_id: number,      // ID consegna
  context: string,         // 'signature'|'photo'|'payment'|'reso'
  data: string,            // Base64 immagine
  timestamp: Date,
  uploaded: boolean,       // Già caricato su Odoo?
  odoo_attachment_id: number | null
}
```

**Operazioni:**
- `db.attachments.add()` - Salva nuovo allegato
- `db.attachments.where({picking_id, context}).toArray()` - Leggi allegati
- `db.attachments.delete(id)` - Elimina
- `db.attachments.where('uploaded').equals(0).toArray()` - Allegati da uploadare

#### 2. `deliveries` (Cache locale)
**Schema:**
```typescript
{
  id: number,              // ID picking Odoo
  name: string,
  partner_id: object,
  scheduled_date: string,
  state: string,
  products: array,
  eta: number,
  // ... tutti i campi picking
}
```

**Sync:**
- Salvataggio dopo ogni `loadDeliveries()`
- Lettura se offline
- Merge con server quando torna online

#### 3. `offline_actions` (Azioni da sincronizzare)
**Schema:**
```typescript
{
  id: number,
  action_type: string,     // 'validate'|'payment'|'reso'
  payload: object,         // Dati azione
  timestamp: Date,
  synced: boolean
}
```

**Flow:**
1. Se offline → salva azione in queue
2. Quando torna online → processa tutte le azioni
3. Segna come `synced: true`
4. Rimuove vecchie azioni (> 7 giorni)

### GESTIONE OFFLINE

**Rilevamento:**
```javascript
window.addEventListener('online', () => {
  // Sincronizza azioni pending
  syncOfflineActions();
  // Ricarica dati freschi
  loadDeliveries();
});

window.addEventListener('offline', () => {
  showToast('Modalità offline attiva', 'warning');
});
```

**Sync Strategy:**
1. **Read**: Sempre da cache locale
2. **Write**: Queue se offline, sync immediato se online
3. **Conflict resolution**: Server wins (last write wins)

### STORAGE QUOTA CHECK
```javascript
async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    const percentUsed = (usage / quota) * 100;

    if (percentUsed > 80) {
      showToast('Storage quasi pieno! Elimina vecchi allegati', 'warning');
    }
  }
}
```

**Cleanup automatico:**
- Allegati già uploadati > 30 giorni
- Azioni sincronizzate > 7 giorni
- Cache deliveries completate > 3 giorni

---

## 7️⃣ SISTEMA ALLEGATI {#allegati}

### CONTESTI ALLEGATI

1. **`signature`** - Firma cliente
   - Max 1 per consegna
   - Formato: PNG base64
   - Size: ~50KB
   - Canvas 800x400px

2. **`photo`** - Foto consegna
   - Max 5 per consegna
   - Formato: JPEG base64
   - Compressione: 0.8
   - Max width: 1920px

3. **`payment`** - Ricevuta pagamento
   - Max 3 per consegna
   - Screenshot o foto scontrino
   - Formato: JPEG/PNG

4. **`reso`** - Foto prodotto reso
   - Max 10 per consegna (più prodotti)
   - Foto danno/difetto
   - Formato: JPEG

### MODAL GESTIONE

**UI:**
```
┌─────────────────────────────────┐
│  Allegati Firma (2)        [X]  │
├─────────────────────────────────┤
│  📸 Scatta Foto                 │
│  📁 Carica da Galleria          │
├─────────────────────────────────┤
│  ┌───────┐ ┌───────┐           │
│  │ IMG 1 │ │ IMG 2 │           │
│  │ 15:30 │ │ 15:32 │           │
│  └───────┘ └───────┘           │
│    [X]       [X]                │
├─────────────────────────────────┤
│  📤 Upload Tutti  [✓ 0/2]      │
└─────────────────────────────────┘
```

**Features:**
- Grid layout responsive
- Thumbnail 120x120px
- Click → fullscreen preview
- Long press → elimina
- Badge count non uploadati
- Pulsante upload batch

### CAPTURE FOTO

**Camera API:**
```javascript
<input
  type="file"
  accept="image/*"
  capture="environment"  // Camera posteriore
  onchange="handlePhotoCapture(event)"
>
```

**Processing:**
```javascript
async function handlePhotoCapture(event) {
  const file = event.target.files[0];

  // Comprimi immagine
  const compressed = await compressImage(file, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8
  });

  // Converti in base64
  const base64 = await fileToBase64(compressed);

  // Salva in IndexedDB
  await db.attachments.add({
    picking_id: currentDelivery.id,
    context: 'photo',
    data: base64,
    timestamp: new Date(),
    uploaded: false
  });

  // Aggiorna UI
  updateAttachmentCount('photo', currentDelivery.id);
}
```

### UPLOAD ODOO

**Batch Upload:**
```javascript
async function uploadAttachments(pickingId, context) {
  // Prendi tutti non uploadati per questo context
  const attachments = await db.attachments
    .where({picking_id: pickingId, context: context, uploaded: false})
    .toArray();

  for (const att of attachments) {
    try {
      // Upload a Odoo
      const result = await callOdoo('ir.attachment', 'create', [{
        name: `${context}_${pickingId}_${att.timestamp.toISOString()}.png`,
        datas: att.data.split(',')[1],  // Remove data:image/png;base64,
        res_model: 'stock.picking',
        res_id: pickingId,
        mimetype: att.data.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      }]);

      // Segna come uploadato
      await db.attachments.update(att.id, {
        uploaded: true,
        odoo_attachment_id: result
      });

    } catch (error) {
      console.error('Upload failed:', error);
      // Retry più tardi
    }
  }
}
```

**Auto-upload:**
- Dopo completamento consegna con firma
- Al tap su pulsante "Upload Tutti"
- Quando torna connessione (se offline)

### PREVIEW FULLSCREEN

```javascript
function previewAttachment(attachmentId) {
  const att = await db.attachments.get(attachmentId);

  const modal = `
    <div class="fullscreen-preview">
      <button onclick="closePreview()">✕</button>
      <img src="${att.data}" />
      <div class="preview-info">
        ${new Date(att.timestamp).toLocaleString('it-IT')}
        ${att.uploaded ? '✓ Caricato' : '⏳ Da caricare'}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modal);
}
```

---

## 8️⃣ FIRMA DIGITALE {#firma}

### CANVAS SETUP

**HTML:**
```html
<canvas
  id="signatureCanvas"
  width="800"
  height="400"
  style="border: 2px dashed #ccc; touch-action: none;"
></canvas>
```

**Inizializzazione:**
```javascript
function initSignatureCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');

  // Stile linea
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';

  // Variabili stato
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Event listeners per touch
  canvas.addEventListener('touchstart', startDrawing);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDrawing);

  // Event listeners per mouse (desktop)
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
}
```

### DRAWING LOGIC

**Start:**
```javascript
function startDrawing(e) {
  e.preventDefault();
  isDrawing = true;

  // Ottieni coordinate relative a canvas
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;

  lastX = touch.clientX - rect.left;
  lastY = touch.clientY - rect.top;

  // Inizia path
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
}
```

**Draw:**
```javascript
function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;

  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  // Disegna linea da ultimo punto a nuovo punto
  ctx.lineTo(x, y);
  ctx.stroke();

  lastX = x;
  lastY = y;

  // Conta stroke per validazione
  strokeCount++;
}
```

**Stop:**
```javascript
function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  ctx.closePath();
}
```

### CLEAR

```javascript
function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokeCount = 0;
}
```

### SAVE

**Conversione a Base64:**
```javascript
async function saveSignature() {
  // Validazione: almeno 10 stroke
  if (strokeCount < 10) {
    showToast('Firma troppo breve, riprovare', 'error');
    return null;
  }

  // Converti canvas in base64 PNG
  const dataUrl = canvas.toDataURL('image/png');

  // Salva in IndexedDB
  await db.attachments.add({
    picking_id: currentDelivery.id,
    context: 'signature',
    data: dataUrl,
    timestamp: new Date(),
    uploaded: false
  });

  return dataUrl;
}
```

### INTEGRAZIONE COMPLETAMENTO

```javascript
async function confirmScaricoWithSignature() {
  // Salva firma
  const signatureData = await saveSignature();
  if (!signatureData) return;

  // Valida picking su Odoo
  await validateDeliveryGroup();

  // Upload firma
  await uploadAttachments(currentDelivery.id, 'signature');

  // Chiudi e torna a lista
  closeScaricoView();

  showToast('Consegna completata con firma!', 'success');
}
```

### PREVIEW FIRMA

**Thumbnail:**
```javascript
function showSignaturePreview() {
  const preview = document.getElementById('signaturePreview');
  preview.innerHTML = `
    <img src="${signatureData}" style="max-width: 200px; border: 1px solid #ccc;" />
    <button onclick="clearSignature()">🗑️ Cancella</button>
  `;
}
```

---

## 9️⃣ NAVIGAZIONE E MAPPA {#mappa}

### GOOGLE MAPS INTEGRATION

**Load API:**
```html
<script async defer
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initAfterMapsLoad&libraries=places">
</script>
```

**Inizializzazione:**
```javascript
function initMap() {
  const mapElement = document.getElementById('map');

  map = new google.maps.Map(mapElement, {
    zoom: 12,
    center: { lat: 45.4642, lng: 9.1900 },  // Milano centro default
    styles: getMapStyles(),
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    gestureHandling: 'greedy'  // Scrolling senza 2 dita
  });

  // Posizione corrente driver
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      currentPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // Centra su posizione corrente
      map.setCenter(currentPosition);

      // Marker rosso per autista
      new google.maps.Marker({
        position: currentPosition,
        map: map,
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        },
        title: 'La tua posizione'
      });
    });
  }
}
```

### MARKERS CONSEGNE

```javascript
function updateMap() {
  // Rimuovi vecchi markers
  markers.forEach(m => m.setMap(null));
  markers = [];

  // Aggiungi marker per ogni consegna
  deliveries.forEach((delivery, index) => {
    if (!delivery.latitude || !delivery.longitude) return;

    const marker = new google.maps.Marker({
      position: {
        lat: delivery.latitude,
        lng: delivery.longitude
      },
      map: map,
      label: {
        text: String(index + 1),
        color: 'white',
        fontWeight: 'bold'
      },
      icon: {
        url: delivery.state === 'done'
          ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
          : 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        labelOrigin: new google.maps.Point(16, 16)
      },
      title: delivery.partner_id[1]
    });

    // Info window al click
    marker.addListener('click', () => {
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3>${delivery.partner_id[1]}</h3>
            <p>${delivery.street || ''}</p>
            <p><strong>ETA:</strong> ${delivery.eta || 'N/A'} min</p>
            <button onclick="navigateTo(${delivery.latitude}, ${delivery.longitude})">
              🗺️ Naviga
            </button>
          </div>
        `
      });
      infoWindow.open(map, marker);
    });

    markers.push(marker);
  });
}
```

### POLYLINE PERCORSO

```javascript
async function drawRouteOnMap() {
  // Rimuovi vecchia polyline
  if (routePolyline) {
    routePolyline.setMap(null);
  }

  // Prepara waypoints
  const waypoints = deliveries
    .filter(d => d.state !== 'done')
    .map(d => ({
      location: { lat: d.latitude, lng: d.longitude },
      stopover: true
    }));

  if (waypoints.length === 0) return;

  // Richiesta a Directions API
  const directionsService = new google.maps.DirectionsService();
  const request = {
    origin: currentPosition,
    destination: waypoints[waypoints.length - 1].location,
    waypoints: waypoints.slice(0, -1),
    travelMode: 'DRIVING',
    optimizeWaypoints: false  // Già ottimizzato
  };

  directionsService.route(request, (result, status) => {
    if (status === 'OK') {
      // Disegna polyline
      routePolyline = new google.maps.Polyline({
        path: result.routes[0].overview_path,
        geodesic: true,
        strokeColor: '#4f46e5',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });

      // Fit bounds per vedere tutto il percorso
      const bounds = new google.maps.LatLngBounds();
      result.routes[0].overview_path.forEach(point => {
        bounds.extend(point);
      });
      map.fitBounds(bounds);
    }
  });
}
```

### NAVIGAZIONE ESTERNA

```javascript
function navigateTo(lat, lng) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  let url;

  // Preferenze per piattaforma
  if (isIOS) {
    // Prova Apple Maps
    url = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  } else if (isAndroid) {
    // Prova Google Maps app
    url = `google.navigation:q=${lat},${lng}`;
  } else {
    // Fallback web
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  // Apri navigatore
  window.location.href = url;

  // Fallback dopo 1 secondo se app non si apre
  setTimeout(() => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  }, 1000);
}
```

### MAP STYLES (Custom)

```javascript
function getMapStyles() {
  return [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: showPOI ? 'on' : 'off' }]
    },
    {
      featureType: 'transit',
      stylers: [{ visibility: 'simplified' }]
    },
    // ... altri stili per look personalizzato
  ];
}
```

### TOGGLE POI

```javascript
function updateMapPOI() {
  showPOI = !showPOI;
  map.setOptions({ styles: getMapStyles() });

  const btn = document.getElementById('poiToggle');
  btn.textContent = showPOI ? '🏢 Nascondi POI' : '🏢 Mostra POI';
}
```

### TRACKING GPS CONTINUO

```javascript
function startGPS() {
  if (!navigator.geolocation) {
    showToast('GPS non disponibile', 'error');
    return;
  }

  // Watch position
  watchId = navigator.geolocation.watchPosition(
    position => {
      currentPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // Aggiorna marker posizione corrente
      if (currentMarker) {
        currentMarker.setPosition(currentPosition);
      }

      // Ricalcola ETA se cambiato significativamente
      if (hasMovedSignificantly(lastPosition, currentPosition)) {
        recalculateETAsAfterDelivery();
        lastPosition = currentPosition;
      }
    },
    error => {
      console.error('GPS error:', error);
      showToast('Errore GPS', 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000  // Cache max 30 sec
    }
  );
}

function hasMovedSignificantly(pos1, pos2) {
  if (!pos1 || !pos2) return true;

  // Calcola distanza (Haversine)
  const R = 6371; // Raggio Terra in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // km

  // Significativo se > 500 metri
  return distance > 0.5;
}
```

---

## 🔟 STATI E WORKFLOW {#stati}

### STATI CONSEGNA

1. **`assigned`** - Pronta per consegna
   - Picking validato dal warehouse
   - Assegnata a driver e veicolo
   - Prodotti prenotati

2. **`in_transit`** - In viaggio (custom state)
   - Driver ha iniziato giro
   - GPS attivo
   - ETA calcolato

3. **`done`** - Consegnata
   - Validazione completata
   - Quantità scaricate
   - Firma/foto salvate
   - Pagamento registrato (se richiesto)

4. **`failed`** - Fallita (custom state)
   - Cliente assente
   - Rifiutato
   - Indirizzo errato

### TRANSIZIONI

```
assigned → in_transit → done
   ↓
  failed
   ↓
  assigned (riprova domani)
```

### WORKFLOW COMPLETO CONSEGNA

```
1. CARICAMENTO
   └─ loadDeliveries()
      ├─ Filtro per vehicle_id e data
      ├─ State = 'assigned' o 'done'
      └─ Ordinamento per scheduled_date

2. VISUALIZZAZIONE
   └─ renderDeliveries()
      ├─ Delivery cards
      ├─ Badge ETA
      └─ Buttons azioni

3. NAVIGAZIONE
   └─ Click "NAVIGA"
      ├─ navigateTo(lat, lng)
      └─ Apre app navigatore

4. SCARICO
   └─ Click "SCARICO"
      ├─ openScaricoView(delivery)
      ├─ loadScaricoProducts(picking_id)
      └─ Mostra lista prodotti
         ├─ Modifica quantità
         ├─ Note per prodotto
         └─ Checkbox "da scaricare"

5. COMPLETAMENTO
   └─ 3 Opzioni:

   A. CON FIRMA
      ├─ Click "Completa con Firma"
      ├─ openSignatureModal()
      ├─ Draw firma su canvas
      ├─ saveSignature() → IndexedDB
      ├─ confirmScaricoWithSignature()
      ├─ validateDeliveryGroup() → Odoo
      ├─ Upload firma → ir.attachment
      ├─ State → 'done'
      └─ closeScaricoView()

   B. SOLO FOTO
      ├─ Click "Solo Foto"
      ├─ openPhotoOnlyModal()
      ├─ Capture foto
      ├─ Nota obbligatoria
      ├─ confirmScaricoPhotoOnly()
      ├─ Upload foto → ir.attachment
      └─ State → 'done'

   C. CON PAGAMENTO
      ├─ Click "Pagamento alla Consegna"
      ├─ openPaymentAtDeliveryModal()
      ├─ Selezione metodo
      ├─ Input importo
      ├─ processPaymentAtDelivery()
      ├─ Crea account.payment
      ├─ Riconcilia con invoice
      ├─ Upload ricevuta (opzionale)
      └─ State → 'done'

6. GESTIONE RESI (Opzionale)
   └─ Click "RESO"
      ├─ handleReso(delivery_id)
      ├─ Modal selezione prodotti
      ├─ Input quantità reso
      ├─ Foto danno
      ├─ Nota motivo
      ├─ saveReso(delivery_id)
      ├─ Crea stock.picking type=return
      └─ Upload allegati reso

7. POST-COMPLETAMENTO
   ├─ Aggiorna stats
   ├─ Recalculate ETAs
   ├─ Upload allegati pending
   ├─ Sync offline actions
   └─ Refresh lista

8. STAMPA (Opzionale)
   └─ Click "STAMPA"
      ├─ printDelivery(delivery_id)
      ├─ Odoo genera PDF bolla
      └─ Download + print
```

### VALIDAZIONI

**Prima di completare:**
- [ ] Almeno un prodotto selezionato
- [ ] Quantità <= backorder_qty per prodotto
- [ ] Firma presente OPPURE foto + nota
- [ ] Se pagamento richiesto → payment completato

**Odoo-side:**
- Picking state = 'assigned'
- Prodotti disponibili
- No other validation in progress
- Vehicle assigned

---

## 1️⃣1️⃣ CHECKLIST IMPLEMENTAZIONE COMPLETA {#checklist}

### 🎯 FASE 1: SETUP BASE (15 punti)
- [ ] 1. Creare cartella `/app/delivery` in app-hub-platform
- [ ] 2. File `page.tsx` base con "use client"
- [ ] 3. Imports React necessari (useState, useEffect, useRef)
- [ ] 4. Layout base con Header, Main, Bottom Nav
- [ ] 5. Configurazione ODOO_URL da env
- [ ] 6. Hook `useSession` per autenticazione
- [ ] 7. State per deliveries array
- [ ] 8. State per currentDelivery
- [ ] 9. State per view ('list' | 'map' | 'stats')
- [ ] 10. State per loading/error
- [ ] 11. Tailwind CSS setup (già presente)
- [ ] 12. Google Maps script load
- [ ] 13. IndexedDB setup con Dexie (npm install dexie)
- [ ] 14. TypeScript interfaces per Delivery, Product, etc
- [ ] 15. API route `/api/delivery/list` per fetch deliveries

### 📱 FASE 2: UI HEADER (8 punti)
- [ ] 16. Header component fisso top (h-[60px])
- [ ] 17. Logo "🚚 LAPA Delivery"
- [ ] 18. Display nome driver da session
- [ ] 19. Badge veicolo (nome/targa)
- [ ] 20. Indicator status online/offline
- [ ] 21. Indicator GPS attivo
- [ ] 22. Responsive mobile/tablet
- [ ] 23. Shadow e border-bottom

### 📊 FASE 3: STATS CARDS (5 punti)
- [ ] 24. Container grid 3 colonne
- [ ] 25. Card "Totale" con count
- [ ] 26. Card "Completate" con count e %
- [ ] 27. Card "Pendenti" con count
- [ ] 28. Aggiornamento dinamico dopo azioni

### 📋 FASE 4: LISTA CONSEGNE (20 punti)
- [ ] 29. Scrollable container (calc(100vh - 130px))
- [ ] 30. DeliveryCard component
- [ ] 31. Badge numero sequenziale
- [ ] 32. Status badge (stato consegna)
- [ ] 33. Customer name bold
- [ ] 34. Address con icona 📍
- [ ] 35. Phone con link tel:
- [ ] 36. Order info (numero ODO)
- [ ] 37. Scheduled time
- [ ] 38. ETA badge colorato per minuti
- [ ] 39. Products summary "X articoli"
- [ ] 40. Total amount €
- [ ] 41. Payment status badge
- [ ] 42. Button "NAVIGA" con icona 🗺️
- [ ] 43. Button "COMPLETA" con icona ✅
- [ ] 44. Button "SCARICO" con badge count backorder
- [ ] 45. Stato visivo .completed (opacità + bg azzurro)
- [ ] 46. Touch feedback (active:scale-98)
- [ ] 47. Click card → apri modal dettaglio
- [ ] 48. Empty state se nessuna consegna

### 🗺️ FASE 5: VISTA MAPPA (15 punti)
- [ ] 49. Google Maps component (react-google-maps o native)
- [ ] 50. Stato mapRef con useRef
- [ ] 51. Caricamento API key da env
- [ ] 52. Centro mappa su posizione corrente
- [ ] 53. Marker rosso per driver
- [ ] 54. Markers blu per consegne pendenti
- [ ] 55. Markers verdi per completate
- [ ] 56. Label numero consegna su marker
- [ ] 57. InfoWindow al click marker
- [ ] 58. Polyline percorso (se ottimizzato)
- [ ] 59. Toggle POI button
- [ ] 60. Centra su posizione button
- [ ] 61. Fullscreen control
- [ ] 62. Gesture handling ottimizzato mobile
- [ ] 63. Custom map styles (getMapStyles)

### 🔄 FASE 6: BOTTOM NAVIGATION (7 punti)
- [ ] 64. Nav fisso bottom (h-[70px])
- [ ] 65. Tab "Lista" con icona 📋
- [ ] 66. Tab "Mappa" con icona 🗺️
- [ ] 67. Tab "Ricarica" con icona 🔄
- [ ] 68. Tab "Stats" con icona 📊
- [ ] 69. Highlight tab attivo
- [ ] 70. Switch view on click

### 🚀 FASE 7: FETCH DELIVERIES (12 punti)
- [ ] 71. API route `/api/delivery/list` GET
- [ ] 72. Autenticazione con session Odoo
- [ ] 73. RPC call a stock.picking search_read
- [ ] 74. Filtri: outgoing, vehicle_id, today, assigned|done
- [ ] 75. Campi: tutti necessari per UI
- [ ] 76. Fetch anche move_lines (prodotti)
- [ ] 77. Fetch sale_order per importo e payment
- [ ] 78. Calcolo backorder_qty per prodotto
- [ ] 79. Ordinamento per scheduled_date
- [ ] 80. Error handling e retry
- [ ] 81. Loading state durante fetch
- [ ] 82. useEffect per fetch al mount

### 📦 FASE 8: MODAL DETTAGLIO CONSEGNA (18 punti)
- [ ] 83. Modal fullscreen overlay
- [ ] 84. Header con nome cliente e X close
- [ ] 85. Sezione info cliente (nome, indirizzo, tel)
- [ ] 86. Sezione info ordine (numero, data, importo)
- [ ] 87. Sezione payment status con badge
- [ ] 88. Lista prodotti con quantità
- [ ] 89. Note consegna (se presenti)
- [ ] 90. Mappa mini con marker destinazione
- [ ] 91. Button "NAVIGA" grande
- [ ] 92. Button "APRI SCARICO"
- [ ] 93. Button "GESTIONE RESI" (se applicabile)
- [ ] 94. Button "STAMPA BOLLA"
- [ ] 95. Sezione allegati (count per tipo)
- [ ] 96. Click allegato → apri modal galleria
- [ ] 97. Button "SEGNA COMPLETATA" (senza scarico)
- [ ] 98. Animazione entrata/uscita modal (framer-motion)
- [ ] 99. Backdrop click → chiude
- [ ] 100. Escape key → chiude

### 🎯 FASE 9: NAVIGAZIONE (5 punti)
- [ ] 101. Funzione navigateTo(lat, lng)
- [ ] 102. Detect iOS → Apple Maps URL
- [ ] 103. Detect Android → Google Maps app URL
- [ ] 104. Fallback web Google Maps
- [ ] 105. Timeout fallback se app non si apre

### ⏱️ FASE 10: CALCOLO ETA (10 punti)
- [ ] 106. API route `/api/delivery/calculate-eta` POST
- [ ] 107. Google Directions API integration
- [ ] 108. Input: currentPosition, destinationLat, destinationLng
- [ ] 109. Output: distance (km), duration (min)
- [ ] 110. Calcolo ETA per singola consegna
- [ ] 111. Batch calcolo per tutte consegne pendenti
- [ ] 112. Salvataggio ETA in state
- [ ] 113. Badge colorato per ETA (verde/giallo/arancione)
- [ ] 114. Ricalcolo automatico dopo consegna completata
- [ ] 115. Aggiornamento scheduled_date su Odoo con ETA

### 🎯 FASE 11: OTTIMIZZAZIONE PERCORSO (12 punti)
- [ ] 116. Button "OTTIMIZZA PERCORSO" in header
- [ ] 117. Funzione optimizeRoute()
- [ ] 118. Google Directions con optimizeWaypoints: true
- [ ] 119. Input: posizione corrente + array consegne pendenti
- [ ] 120. Output: ordine ottimizzato
- [ ] 121. Applicazione nuovo ordine a deliveries state
- [ ] 122. Aggiornamento numeri sequenziali
- [ ] 123. Ricalcolo ETAs dopo ottimizzazione
- [ ] 124. Modal conferma prima di applicare
- [ ] 125. Toast "Percorso ottimizzato!" success
- [ ] 126. Disegno polyline su mappa
- [ ] 127. Loading durante ottimizzazione

### 🎨 FASE 12: ORGANIZER MANUALE (15 punti)
- [ ] 128. Button "ORGANIZZA MANUALMENTE"
- [ ] 129. Modal fullscreen organizer
- [ ] 130. Lista consegne draggable
- [ ] 131. Touch handlers (touchstart, touchmove, touchend)
- [ ] 132. Visual feedback durante drag (opacity, transform)
- [ ] 133. Drop zones tra consegne
- [ ] 134. Aggiornamento ordine in temp state
- [ ] 135. Anteprima percorso su mappa laterale
- [ ] 136. Calcolo distanza totale percorso
- [ ] 137. Calcolo tempo totale percorso
- [ ] 138. Button "APPLICA" per confermare
- [ ] 139. Button "ANNULLA" per scartare
- [ ] 140. Button "OTTIMIZZA CON GOOGLE"
- [ ] 141. Animazioni smooth per riordino
- [ ] 142. Responsive tablet/mobile

### 📦 FASE 13: VISTA SCARICO (25 punti)
- [ ] 143. Component ScaricoView separato
- [ ] 144. API route `/api/delivery/scarico/products` GET
- [ ] 145. Fetch stock.move per picking_id
- [ ] 146. Filtro solo prodotti con backorder_qty > 0
- [ ] 147. Header con nome consegna e X close
- [ ] 148. Search bar per filtrare prodotti
- [ ] 149. Toggle "Solo da scaricare"
- [ ] 150. Lista prodotti scrollabile
- [ ] 151. ProductRow component
- [ ] 152. Display: nome, codice, qty ordinata, qty consegnata, backorder
- [ ] 153. Checkbox "Scaricare" per prodotto
- [ ] 154. Input quantità con validation (max = backorder_qty)
- [ ] 155. Buttons -1 / +1 per quantità
- [ ] 156. Click input → apri calcolatrice
- [ ] 157. Textarea note per prodotto
- [ ] 158. Counter "X di Y selezionati"
- [ ] 159. Stats totali (articoli, pezzi)
- [ ] 160. Button "Seleziona Tutti"
- [ ] 161. Button "Deseleziona Tutti"
- [ ] 162. Bottom bar con azioni
- [ ] 163. Button "COMPLETA CON FIRMA"
- [ ] 164. Button "SOLO FOTO"
- [ ] 165. Button "PAGAMENTO ALLA CONSEGNA"
- [ ] 166. Validazione: almeno 1 prodotto selezionato
- [ ] 167. Sticky bottom bar

### 🔢 FASE 14: CALCOLATRICE (10 punti)
- [ ] 168. Modal calcolatrice fullscreen
- [ ] 169. Display valore corrente grande
- [ ] 170. Grid numeri 0-9
- [ ] 171. Button punto decimale
- [ ] 172. Button clear (C)
- [ ] 173. Button backspace (←)
- [ ] 174. Button conferma (✓)
- [ ] 175. Max value validation
- [ ] 176. Touch-friendly buttons (min 44x44)
- [ ] 177. Chiusura su conferma e aggiornamento qty

### ✍️ FASE 15: FIRMA DIGITALE (18 punti)
- [ ] 178. Modal firma fullscreen
- [ ] 179. Canvas HTML5 (800x400)
- [ ] 180. useRef per canvas
- [ ] 181. Context 2D setup
- [ ] 182. Line style: width 2, cap round, color black
- [ ] 183. State isDrawing, lastX, lastY
- [ ] 184. Handler touchstart/mousedown
- [ ] 185. Handler touchmove/mousemove
- [ ] 186. Handler touchend/mouseup
- [ ] 187. Drawing logic con lineTo()
- [ ] 188. Smooth drawing
- [ ] 189. Counter stroke points
- [ ] 190. Button "Cancella" firma
- [ ] 191. Funzione clearSignature()
- [ ] 192. Preview firma prima salvataggio
- [ ] 193. Validazione: minimo 10 stroke points
- [ ] 194. Conversione canvas → PNG base64
- [ ] 195. Salvataggio in IndexedDB

### 📸 FASE 16: SISTEMA ALLEGATI (22 punti)
- [ ] 196. Setup IndexedDB con Dexie
- [ ] 197. Schema attachments table
- [ ] 198. Funzione openAttachmentModal(context, deliveryId)
- [ ] 199. Modal gestione allegati
- [ ] 200. Button "Scatta Foto"
- [ ] 201. Input file con capture="environment"
- [ ] 202. Button "Carica da Galleria"
- [ ] 203. Handler photo capture
- [ ] 204. Image compression (max 1920px, quality 0.8)
- [ ] 205. Conversione file → base64
- [ ] 206. Salvataggio in IndexedDB
- [ ] 207. Griglia thumbnails allegati
- [ ] 208. Click thumbnail → fullscreen preview
- [ ] 209. Long press → elimina allegato
- [ ] 210. Badge count allegati per contesto
- [ ] 211. Contesti: signature, photo, payment, reso
- [ ] 212. Button "Upload Tutti"
- [ ] 213. Batch upload a Odoo ir.attachment
- [ ] 214. Indicatore "uploaded: true/false"
- [ ] 215. Retry upload se fallito
- [ ] 216. Auto-upload dopo completamento
- [ ] 217. Storage quota check

### ✅ FASE 17: VALIDAZIONE ODOO (15 punti)
- [ ] 218. API route `/api/delivery/validate` POST
- [ ] 219. Input: pickingId, productsData, signatureData
- [ ] 220. Ciclo aggiornamento quantity_done per ogni prodotto
- [ ] 221. Write su stock.move
- [ ] 222. Chiamata button_validate() su picking
- [ ] 223. Gestione creazione backorder automatica
- [ ] 224. Upload firma a ir.attachment
- [ ] 225. Upload foto a ir.attachment
- [ ] 226. Link attachments a picking (res_model, res_id)
- [ ] 227. Aggiornamento stato picking → done
- [ ] 228. Error handling Odoo
- [ ] 229. Validazione lato server
- [ ] 230. Notifica warehouse (opzionale)
- [ ] 231. Response con picking aggiornato
- [ ] 232. Toast success/error

### 💰 FASE 18: PAGAMENTI (20 punti)
- [ ] 233. Modal pagamento alla consegna
- [ ] 234. Check if payment required (payment_status = 'to_pay')
- [ ] 235. Display importo totale ordine
- [ ] 236. Radio buttons metodi:
  - [ ] 237. 💵 Contanti
  - [ ] 238. 💳 Carta
  - [ ] 239. 🏦 Bonifico
- [ ] 240. Input importo pagato
- [ ] 241. Validation: importo > 0 e <= totale
- [ ] 242. Textarea note pagamento (opzionale)
- [ ] 243. Button "Scatta foto ricevuta" (opzionale)
- [ ] 244. API route `/api/delivery/payment` POST
- [ ] 245. Ricerca invoice collegato a sale_order
- [ ] 246. Validation invoice esiste e non pagato
- [ ] 247. Creazione account.payment
- [ ] 248. Campi payment: type, partner, amount, method, ref
- [ ] 249. Chiamata action_post() su payment
- [ ] 250. Riconciliazione automatica con invoice
- [ ] 251. Upload ricevuta se presente
- [ ] 252. Aggiornamento payment_status → paid

### 🔄 FASE 19: GESTIONE RESI (18 punti)
- [ ] 253. Button "GESTIONE RESI" in dettaglio
- [ ] 254. Modal selezione prodotti da rendere
- [ ] 255. Lista prodotti consegnati
- [ ] 256. Checkbox per ogni prodotto rendibile
- [ ] 257. Input quantità reso (max = qty consegnata)
- [ ] 258. Textarea motivo reso (obbligatoria)
- [ ] 259. Button "Scatta foto danno/difetto"
- [ ] 260. Preview foto reso
- [ ] 261. Validazione: almeno 1 prodotto + motivo + foto
- [ ] 262. API route `/api/delivery/reso` POST
- [ ] 263. Ricerca picking_type per resi
- [ ] 264. Creazione stock.picking reso
- [ ] 265. Campi: partner, origin, move_lines
- [ ] 266. Creazione stock.move per ogni prodotto reso
- [ ] 267. Upload foto reso a ir.attachment
- [ ] 268. Link a picking reso
- [ ] 269. Notifica warehouse reso ricevuto
- [ ] 270. Toast "Reso registrato"

### 🖨️ FASE 20: STAMPA BOLLA (8 punti)
- [ ] 271. Button "STAMPA BOLLA"
- [ ] 272. API route `/api/delivery/print` POST
- [ ] 273. Chiamata a Odoo report controller
- [ ] 274. Download PDF bolla
- [ ] 275. Apertura in nuova tab
- [ ] 276. Print dialog automatico
- [ ] 277. Salvataggio PDF in attachments
- [ ] 278. Error handling se report fails

### 📊 FASE 21: STATISTICS VIEW (12 punti)
- [ ] 279. Component StatsView
- [ ] 280. Card "Consegne Totali" con numero
- [ ] 281. Card "Completate" con % e grafico
- [ ] 282. Card "Pendenti" con numero
- [ ] 283. Card "Km Percorsi" (somma distanze)
- [ ] 284. Card "Tempo Medio Consegna"
- [ ] 285. Card "ETA vs Reale" comparison
- [ ] 286. Card "Numero Resi"
- [ ] 287. Card "Importo Incassato"
- [ ] 288. Chart.js per grafici (opzionale)
- [ ] 289. Export CSV statistiche (opzionale)
- [ ] 290. Refresh stats ogni completamento

### 🔔 FASE 22: NOTIFICHE (8 punti)
- [ ] 291. Component Toast per notifiche
- [ ] 292. Types: success, error, warning, info
- [ ] 293. Auto-dismiss dopo 3 secondi
- [ ] 294. Stack multiple toasts
- [ ] 295. Icons per tipo
- [ ] 296. Animazione slide-in/out
- [ ] 297. Notifica nuova consegna assegnata
- [ ] 298. Notifica problema sincronizzazione

### 🌐 FASE 23: OFFLINE SUPPORT (15 punti)
- [ ] 299. Service Worker per PWA (opzionale)
- [ ] 300. Listener online/offline events
- [ ] 301. Indicator connessione in header
- [ ] 302. Queue azioni offline in IndexedDB
- [ ] 303. Schema offline_actions table
- [ ] 304. Salvataggio azioni: validate, payment, reso
- [ ] 305. Funzione syncOfflineActions()
- [ ] 306. Esecuzione queue quando torna online
- [ ] 307. Error handling durante sync
- [ ] 308. Retry failed syncs
- [ ] 309. Toast "Sincronizzazione completata"
- [ ] 310. Cache deliveries localmente
- [ ] 311. Merge dati local/server
- [ ] 312. Conflict resolution (server wins)
- [ ] 313. Cleanup vecchie azioni (> 7 giorni)

### 🔒 FASE 24: SECURITY & VALIDATION (10 punti)
- [ ] 314. Check autenticazione su ogni API call
- [ ] 315. Validation input lato server
- [ ] 316. Sanitizzazione dati da Odoo
- [ ] 317. Rate limiting API routes
- [ ] 318. CSRF protection
- [ ] 319. SQL injection prevention (Odoo ORM)
- [ ] 320. XSS prevention (sanitize HTML)
- [ ] 321. Secure storage credentials (httpOnly cookies)
- [ ] 322. Permissions check (driver può vedere solo sue consegne)
- [ ] 323. Audit log azioni critiche

### 🚀 FASE 25: PERFORMANCE (12 punti)
- [ ] 324. Lazy loading images
- [ ] 325. Virtual scrolling lista consegne (se > 100)
- [ ] 326. Debounce search input
- [ ] 327. Memoizzazione componenti con React.memo
- [ ] 328. useMemo per calcoli pesanti (ETA, stats)
- [ ] 329. useCallback per funzioni passate a children
- [ ] 330. Image compression prima upload
- [ ] 331. Batch API calls dove possibile
- [ ] 332. Prefetch dati prossima consegna
- [ ] 333. Code splitting per routes
- [ ] 334. Service worker caching
- [ ] 335. Bundle size optimization

### 🎨 FASE 26: UX ENHANCEMENTS (15 punti)
- [ ] 336. Loading skeleton per cards
- [ ] 337. Pull-to-refresh lista consegne
- [ ] 338. Swipe gesture su card per azioni rapide
- [ ] 339. Haptic feedback su azioni (vibrazione)
- [ ] 340. Animazioni transizioni (framer-motion)
- [ ] 341. Empty states con illustrazioni
- [ ] 342. Error states con retry button
- [ ] 343. Confirmation dialogs azioni critiche
- [ ] 344. Progress indicators (upload, sync)
- [ ] 345. Toasts auto-dismiss con progress bar
- [ ] 346. Keyboard shortcuts (desktop)
- [ ] 347. Focus management per accessibility
- [ ] 348. Color blind friendly palette
- [ ] 349. Dark mode support (opzionale)
- [ ] 350. Sound effects azioni (opzionale)

### 🧪 FASE 27: TESTING (10 punti)
- [ ] 351. Unit tests funzioni principali
- [ ] 352. Integration tests API routes
- [ ] 353. E2E tests flow completo consegna
- [ ] 354. Test offline functionality
- [ ] 355. Test responsive mobile/tablet
- [ ] 356. Test cross-browser (Chrome, Safari)
- [ ] 357. Test performance (Lighthouse)
- [ ] 358. Test accessibility (a11y)
- [ ] 359. Test con dati reali Odoo
- [ ] 360. Load testing (molte consegne)

### 📱 FASE 28: PWA (Progressive Web App) (12 punti)
- [ ] 361. Manifest.json con icons
- [ ] 362. Service Worker per offline
- [ ] 363. Add to Home Screen prompt
- [ ] 364. Splash screen iOS/Android
- [ ] 365. Icon set (192x192, 512x512)
- [ ] 366. Cache strategy (Network First)
- [ ] 367. Background sync per upload
- [ ] 368. Push notifications (opzionale)
- [ ] 369. Badge app icon con count pendenti
- [ ] 370. Standalone mode (nasconde browser UI)
- [ ] 371. Orientamento portrait lock
- [ ] 372. Status bar style

### 🐛 FASE 29: ERROR HANDLING (8 punti)
- [ ] 373. Try-catch su tutte API calls
- [ ] 374. Error boundary React component
- [ ] 375. Sentry integration per monitoring (opzionale)
- [ ] 376. User-friendly error messages
- [ ] 377. Fallback UI per errori critici
- [ ] 378. Retry logic con exponential backoff
- [ ] 379. Network error handling
- [ ] 380. Odoo RPC error parsing

### 📚 FASE 30: DOCUMENTAZIONE (5 punti)
- [ ] 381. README completo
- [ ] 382. Commenti JSDoc su funzioni
- [ ] 383. Diagramma architettura
- [ ] 384. User manual per autisti
- [ ] 385. Developer guide per manutenzione

### 🚢 FASE 31: DEPLOYMENT (10 punti)
- [ ] 386. Build production Next.js
- [ ] 387. Environment variables su Vercel
- [ ] 388. Google Maps API key setup
- [ ] 389. Odoo CORS configuration
- [ ] 390. CDN per assets statici
- [ ] 391. Monitoring setup
- [ ] 392. Analytics (Google Analytics/Plausible)
- [ ] 393. Backup strategy
- [ ] 394. CI/CD pipeline
- [ ] 395. Rollback plan

---

## 📊 RIEPILOGO TOTALE

**395 PUNTI DA IMPLEMENTARE**

### Per Fase:
1. Setup Base: 15
2. UI Header: 8
3. Stats Cards: 5
4. Lista Consegne: 20
5. Vista Mappa: 15
6. Bottom Nav: 7
7. Fetch Deliveries: 12
8. Modal Dettaglio: 18
9. Navigazione: 5
10. Calcolo ETA: 10
11. Ottimizzazione: 12
12. Organizer: 15
13. Vista Scarico: 25
14. Calcolatrice: 10
15. Firma: 18
16. Allegati: 22
17. Validazione: 15
18. Pagamenti: 20
19. Resi: 18
20. Stampa: 8
21. Statistics: 12
22. Notifiche: 8
23. Offline: 15
24. Security: 10
25. Performance: 12
26. UX: 15
27. Testing: 10
28. PWA: 12
29. Errors: 8
30. Docs: 5
31. Deploy: 10

### Per Complessità:
- 🟢 Easy: ~150 punti (UI, layout, stati)
- 🟡 Medium: ~180 punti (logic, API, integrazione)
- 🔴 Hard: ~65 punti (performance, offline, testing)

---

## 🎯 ORDINE CONSIGLIATO IMPLEMENTAZIONE

### Sprint 1 (3-4 giorni) - MVP Base
Fasi: 1, 2, 3, 4, 6, 7, 8, 9

### Sprint 2 (3-4 giorni) - Core Features
Fasi: 13, 14, 15, 16, 17

### Sprint 3 (2-3 giorni) - Advanced
Fasi: 10, 11, 18, 19, 20

### Sprint 4 (2-3 giorni) - Polish
Fasi: 5, 12, 21, 22, 26

### Sprint 5 (2-3 giorni) - Production Ready
Fasi: 23, 24, 25, 28, 29, 31

---

Fine analisi. Pronti per iniziare! 🚀
