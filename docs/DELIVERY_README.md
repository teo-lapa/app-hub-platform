# 🚚 LAPA Delivery - Documentazione

## 📋 Panoramica

LAPA Delivery è un sistema completo per la gestione delle consegne, progettato specificamente per autisti e magazzinieri. Include:

- ✅ Gestione consegne in tempo reale
- 📍 GPS tracking e navigazione
- ⏱️ Calcolo ETA automatico
- 🎯 Ottimizzazione percorso
- 📦 Scarico prodotti interattivo
- ✍️ Firma digitale cliente
- 📸 Allegati foto/documenti
- 💰 Gestione pagamenti
- 🔄 Gestione resi
- 📊 Statistiche giornata
- 🗺️ Vista mappa Google Maps
- 💾 Supporto offline con IndexedDB

## 🚀 Setup

### 1. Installazione Dipendenze

```bash
npm install
```

Le dipendenze principali sono:
- `dexie` (^3.2.7) - IndexedDB wrapper
- `framer-motion` - Animazioni
- `next` (14.0.3) - Framework

### 2. Variabili d'Ambiente

Aggiungi al file `.env.local`:

```env
# Odoo
ODOO_URL=https://your-instance.odoo.com
ODOO_DB=your-database
NEXT_PUBLIC_ODOO_URL=https://your-instance.odoo.com
NEXT_PUBLIC_ODOO_DB=your-database

# Google Maps (richiesto per mappa e ottimizzazione)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### 3. Configurazione Google Maps API

1. Vai su [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita le seguenti API:
   - Maps JavaScript API
   - Directions API
   - Places API (opzionale)
4. Crea credenziali → API key
5. Copia la chiave in `.env.local`

## 📱 Utilizzo

### Accesso all'App

1. Login su LAPA App Hub
2. Cerca "LAPA Delivery" 🚚
3. Click per aprire

Oppure accedi direttamente a: `https://your-domain.com/delivery`

### Workflow Tipico

1. **Apertura app**
   - Visualizza lista consegne del giorno
   - Controlla statistiche (totale, completate, pendenti)
   - GPS si attiva automaticamente

2. **Ottimizza percorso**
   - Click su pulsante 🎯 (floating button in basso a destra)
   - Attendi calcolo percorso ottimale
   - Consegne vengono riordinate automaticamente
   - ETA calcolato per ogni stop

3. **Navigazione**
   - Click su "NAVIGA" nella card consegna
   - Si apre app navigazione (Google Maps, Apple Maps, Waze)
   - Guida verso destinazione

4. **Scarico prodotti**
   - Click su "SCARICO" quando arrivato
   - Visualizza lista prodotti da consegnare
   - Modifica quantità (click su numero per calcolatrice)
   - Seleziona prodotti da scaricare
   - Aggiungi note se necessario

5. **Completamento con firma**
   - Click "Completa con Firma"
   - Cliente firma su canvas digitale
   - Firma salvata in IndexedDB
   - Upload automatico a Odoo

6. **Pagamento (se richiesto)**
   - Click "Pagamento alla Consegna"
   - Seleziona metodo (contanti/carta/bonifico)
   - Inserisci importo
   - Registrazione automatica in Odoo

7. **Gestione resi (se necessario)**
   - Click "GESTIONE RESI"
   - Seleziona prodotti da rendere
   - Scatta foto prodotto danneggiato
   - Inserisci motivo reso
   - Creazione picking reso automatica

## 🗂️ Struttura File

```
app-hub-platform/
├── app/
│   └── delivery/
│       ├── page.tsx                    # Componente principale
│       ├── delivery.module.css         # Stili specifici
│       └── components/
│           └── DeliveryMap.tsx         # Componente mappa
└── app/api/delivery/
    ├── list/route.ts                   # GET consegne
    ├── validate/route.ts               # POST validazione picking
    ├── upload-attachment/route.ts      # POST upload allegati
    ├── payment/route.ts                # POST pagamento
    ├── reso/route.ts                   # POST reso
    ├── calculate-eta/route.ts          # POST calcolo ETA
    └── optimize-route/route.ts         # POST ottimizzazione
```

## 🔌 API Routes

### GET /api/delivery/list

Carica lista consegne del giorno per l'autista corrente.

**Response:**
```json
[
  {
    "id": 123,
    "name": "WH/OUT/00123",
    "partner_id": [1, "Cliente S.r.l."],
    "partner_street": "Via Roma 1",
    "partner_city": "Milano",
    "partner_zip": "20100",
    "partner_phone": "+39 02 1234567",
    "latitude": 45.4642,
    "longitude": 9.1900,
    "scheduled_date": "2025-01-20T10:00:00",
    "state": "assigned",
    "origin": "SO001",
    "move_lines": [
      {
        "id": 456,
        "product_id": [10, "Prodotto A"],
        "product_uom_qty": 10,
        "quantity_done": 0,
        "backorder_qty": 10
      }
    ],
    "amount_total": 150.50,
    "payment_status": "to_pay"
  }
]
```

### POST /api/delivery/validate

Valida un picking (consegna completata).

**Body:**
```json
{
  "picking_id": 123,
  "products": [
    {
      "move_id": 456,
      "quantity_done": 10
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Consegna validata con successo"
}
```

### POST /api/delivery/upload-attachment

Upload allegato (firma, foto, ricevuta).

**Body:**
```json
{
  "picking_id": 123,
  "context": "signature",
  "data": "data:image/png;base64,iVBORw0KGgo...",
  "timestamp": "2025-01-20T10:30:00"
}
```

**Response:**
```json
{
  "success": true,
  "attachment_id": 789
}
```

### POST /api/delivery/payment

Registra pagamento alla consegna.

**Body:**
```json
{
  "picking_id": 123,
  "sale_id": 100,
  "amount": 150.50,
  "payment_method": "cash",
  "note": "Pagato in contanti"
}
```

### POST /api/delivery/reso

Crea picking di reso.

**Body:**
```json
{
  "original_picking_id": 123,
  "partner_id": 1,
  "products": [
    {
      "product_id": 10,
      "quantity": 2,
      "name": "Prodotto difettoso"
    }
  ],
  "note": "Prodotto danneggiato durante trasporto"
}
```

### POST /api/delivery/calculate-eta

Calcola tempo stimato arrivo.

**Body:**
```json
{
  "origin": { "lat": 45.4642, "lng": 9.1900 },
  "destination": { "lat": 45.4785, "lng": 9.2345 }
}
```

**Response:**
```json
{
  "duration": 15,
  "distance": 3.2,
  "duration_text": "15 mins",
  "distance_text": "3.2 km"
}
```

### POST /api/delivery/optimize-route

Ottimizza percorso consegne.

**Body:**
```json
{
  "origin": { "lat": 45.4642, "lng": 9.1900 },
  "deliveries": [
    { "id": 123, "lat": 45.4785, "lng": 9.2345 },
    { "id": 124, "lat": 45.4890, "lng": 9.2567 }
  ]
}
```

**Response:**
```json
{
  "optimized_order": [124, 123],
  "total_distance_km": "8.5",
  "total_duration_minutes": 25,
  "route_polyline": "encoded_polyline_string"
}
```

## 💾 IndexedDB Schema

### Table: attachments

```typescript
{
  id: number (auto-increment),
  picking_id: number,
  context: 'signature' | 'photo' | 'payment' | 'reso',
  data: string (base64),
  timestamp: Date,
  uploaded: boolean,
  odoo_attachment_id: number | null
}
```

### Table: deliveries (cache)

```typescript
{
  id: number,
  name: string,
  // ... tutti i campi delivery
}
```

### Table: offline_actions

```typescript
{
  id: number (auto-increment),
  action_type: 'validate' | 'payment' | 'reso',
  payload: any,
  timestamp: Date,
  synced: boolean
}
```

## 📦 Modelli Odoo Richiesti

### stock.picking

**Campi custom consigliati:**
- `vehicle_id` (Many2one fleet.vehicle) - Veicolo assegnato
- `driver_id` (Many2one res.users) - Autista
- `latitude` (Float) - Coordinata GPS destinazione
- `longitude` (Float) - Coordinata GPS destinazione

### res.partner

**Campi richiesti:**
- `partner_latitude` (Float)
- `partner_longitude` (Float)

## 🎨 Personalizzazione

### Modificare Stili

Edita `app/delivery/delivery.module.css` per personalizzare:
- Colori tema
- Dimensioni touch target (Android/iOS)
- Animazioni
- Media queries

### Modificare Stati Consegna

Nel file `page.tsx`, cerca:
```typescript
state: 'assigned' | 'done' | 'cancel';
```

Aggiungi stati custom se necessario.

### Modificare Metodi Pagamento

In `payment/route.ts`:
```typescript
const methodMap: Record<string, string> = {
  'cash': 'manual',
  'card': 'electronic',
  'bank_transfer': 'manual',
  // Aggiungi qui altri metodi
};
```

## 🐛 Troubleshooting

### Problema: Mappa non si carica

**Soluzione:**
1. Verifica che `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` sia settata correttamente
2. Controlla che l'API sia abilitata su Google Cloud Console
3. Verifica restrizioni API key (domini consentiti)

### Problema: GPS non funziona

**Soluzione:**
1. Browser deve essere in HTTPS (richiesto per geolocation API)
2. Utente deve dare permesso accesso posizione
3. Verifica console browser per errori

### Problema: Offline sync non funziona

**Soluzione:**
1. Verifica che IndexedDB non sia disabilitato nel browser
2. Controlla storage disponibile (`navigator.storage.estimate()`)
3. Verifica che le azioni siano salvate in `offline_actions` table

### Problema: Allegati non vengono uploadati

**Soluzione:**
1. Verifica dimensione immagini (max ~5MB consigliato)
2. Controlla permessi Odoo per `ir.attachment`
3. Verifica formato base64 corretto

## 📊 Performance Tips

1. **Lazy loading immagini**: Implementato di default
2. **Debounce search**: 300ms delay
3. **Virtual scrolling**: Se consegne > 100, considerare react-window
4. **Image compression**: Attivo, max 1920px width, quality 0.8
5. **Batch API calls**: Aggregare chiamate simili

## 🔒 Security Checklist

- ✅ Session validation su ogni API call
- ✅ Input sanitization
- ✅ SQL injection prevention (Odoo ORM)
- ✅ XSS prevention
- ✅ HTTPS only per GPS
- ✅ Rate limiting consigliato
- ⚠️ Implementare CSRF tokens se necessario

## 🚀 Deploy

### Vercel (Consigliato)

1. Push codice su GitHub
2. Collega repository a Vercel
3. Aggiungi environment variables
4. Deploy!

### Environment Variables su Vercel

Vai su Project Settings → Environment Variables e aggiungi:
- `ODOO_URL`
- `ODOO_DB`
- `GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_ODOO_URL`
- `NEXT_PUBLIC_ODOO_DB`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## 📝 TODO Future Features

- [ ] Push notifications per nuove consegne
- [ ] Voice commands per hands-free
- [ ] Barcode scanner prodotti
- [ ] Export PDF giornata
- [ ] Chat con warehouse
- [ ] Meteo integrato per percorso
- [ ] Traffico real-time
- [ ] Previsioni consegna ML-based

## 📞 Supporto

Per problemi o domande:
- GitHub Issues: [Link al repo]
- Email: support@lapa.com
- Docs: https://docs.lapa.com/delivery

## 📄 License

Proprietario - LAPA S.r.l.

---

Creato con ❤️ da LAPA Team
