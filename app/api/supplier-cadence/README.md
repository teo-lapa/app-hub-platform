# Supplier Cadence API

API REST per gestione cadenze ordini fornitori ricorrenti.

## Endpoints

### 1. GET /api/supplier-cadence

Lista tutti i fornitori con cadenze configurate.

**Query Parameters:**

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `is_active` | boolean | `true`, `false` | Filtra per stato attivo/inattivo |
| `cadence_type` | string | `fixed_days`, `weekly`, `biweekly`, `monthly` | Filtra per tipo cadenza |
| `search` | string | - | Ricerca testuale su nome fornitore |
| `status` | string | `on_time`, `due_soon`, `overdue`, `inactive` | Filtra per urgenza |
| `sort_by` | string | `next_order_date`, `supplier_name`, `last_order_date` | Campo ordinamento |
| `sort_direction` | string | `asc`, `desc` | Direzione ordinamento |

**Response:**

```json
{
  "suppliers": [
    {
      "id": 1,
      "supplier_id": 1593,
      "supplier_name": "ALIGRO Demaurex & Cie SA",
      "cadence_type": "fixed_days",
      "cadence_value": 3,
      "weekdays": null,
      "is_active": true,
      "next_order_date": "2025-10-30",
      "last_order_date": "2025-10-27",
      "average_lead_time_days": 0.4,
      "total_orders_last_6m": 60,
      "calculated_cadence_days": 2.6,
      "notes": "Fornitore principale, consegna rapida",
      "days_since_last_order": 2,
      "days_until_next_order": 1,
      "days_overdue": 0,
      "status": "due_soon"
    }
  ],
  "stats": {
    "total_active": 20,
    "total_inactive": 1,
    "due_today": 1,
    "due_this_week": 5,
    "overdue": 1,
    "by_cadence_type": {
      "fixed_days": 15,
      "weekly": 3,
      "biweekly": 2,
      "monthly": 1
    }
  },
  "count": 20
}
```

**Esempi:**

```bash
# Lista tutti
curl http://localhost:3000/api/supplier-cadence

# Solo attivi
curl "http://localhost:3000/api/supplier-cadence?is_active=true"

# Ordina per nome
curl "http://localhost:3000/api/supplier-cadence?sort_by=supplier_name&sort_direction=asc"

# Ricerca per nome
curl "http://localhost:3000/api/supplier-cadence?search=ALIGRO"

# Solo overdue
curl "http://localhost:3000/api/supplier-cadence?status=overdue"

# Filtra per tipo weekly
curl "http://localhost:3000/api/supplier-cadence?cadence_type=weekly"
```

---

### 2. POST /api/supplier-cadence

Crea nuova cadenza per fornitore.

**Request Body:**

```json
{
  "supplier_id": 9999,
  "supplier_name": "Nuovo Fornitore SRL",
  "cadence_type": "fixed_days",
  "cadence_value": 7,
  "weekdays": null,
  "next_order_date": "2025-11-05",
  "average_lead_time_days": 2,
  "notes": "Ordine settimanale",
  "updated_by": "admin"
}
```

**Required Fields:**
- `supplier_id`: number (ID Odoo fornitore)
- `supplier_name`: string (Nome fornitore)
- `cadence_type`: CadenceType

**Conditional Required:**
- `fixed_days`: richiede `cadence_value` (1-365)
- `weekly/biweekly`: richiede `weekdays` (array 0-6)
- `monthly`: richiede `cadence_value` (1-31, giorno del mese)

**Response:**

```json
{
  "success": true,
  "supplier": {
    "id": 22,
    "supplier_id": 9999,
    "supplier_name": "Nuovo Fornitore SRL",
    "cadence_type": "fixed_days",
    "cadence_value": 7,
    "is_active": true,
    "next_order_date": "2025-11-05",
    "status": "on_time",
    "days_until_next_order": 7
  }
}
```

**Esempi:**

```bash
# Cadenza fixed_days (ogni 5 giorni)
curl -X POST http://localhost:3000/api/supplier-cadence \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 9999,
    "supplier_name": "Test Fornitore",
    "cadence_type": "fixed_days",
    "cadence_value": 5,
    "average_lead_time_days": 2
  }'

# Cadenza weekly (Lunedì e Giovedì)
curl -X POST http://localhost:3000/api/supplier-cadence \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 8888,
    "supplier_name": "Fornitore Settimanale",
    "cadence_type": "weekly",
    "weekdays": [1, 4],
    "average_lead_time_days": 1
  }'

# Cadenza monthly (giorno 15 del mese)
curl -X POST http://localhost:3000/api/supplier-cadence \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 7777,
    "supplier_name": "Fornitore Mensile",
    "cadence_type": "monthly",
    "cadence_value": 15,
    "notes": "Ordine il 15 di ogni mese"
  }'
```

---

### 3. PUT /api/supplier-cadence/[id]

Aggiorna cadenza esistente.

**Request Body (tutti i campi opzionali, almeno uno richiesto):**

```json
{
  "cadence_type": "weekly",
  "weekdays": [1, 3, 5],
  "is_active": true,
  "notes": "Modificato a 3 volte a settimana",
  "updated_by": "admin"
}
```

**Available Fields:**
- `cadence_type`: CadenceType
- `cadence_value`: number | null
- `weekdays`: Weekday[] | null
- `is_active`: boolean
- `next_order_date`: string (ISO date)
- `last_order_date`: string (ISO date)
- `average_lead_time_days`: number
- `notes`: string | null
- `updated_by`: string

**Auto-calculation:**
Se modifichi `cadence_type`, `cadence_value` o `weekdays` senza fornire `next_order_date`, viene ricalcolato automaticamente basandosi su `last_order_date`.

**Response:**

```json
{
  "success": true,
  "supplier": {
    "id": 1,
    "supplier_name": "ALIGRO Demaurex & Cie SA",
    "cadence_type": "weekly",
    "weekdays": [1, 3, 5],
    "is_active": true,
    "next_order_date": "2025-11-03",
    "updated_at": "2025-10-29T15:30:00Z"
  }
}
```

**Esempi:**

```bash
# Modifica cadenza value
curl -X PUT http://localhost:3000/api/supplier-cadence/1 \
  -H "Content-Type: application/json" \
  -d '{
    "cadence_value": 5
  }'

# Disattiva cadenza
curl -X PUT http://localhost:3000/api/supplier-cadence/2 \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false,
    "notes": "Fornitore temporaneamente sospeso"
  }'

# Cambia tipo da fixed_days a weekly
curl -X PUT http://localhost:3000/api/supplier-cadence/3 \
  -H "Content-Type: application/json" \
  -d '{
    "cadence_type": "weekly",
    "cadence_value": null,
    "weekdays": [1, 4]
  }'

# Aggiorna next_order_date manualmente
curl -X PUT http://localhost:3000/api/supplier-cadence/4 \
  -H "Content-Type: application/json" \
  -d '{
    "next_order_date": "2025-11-10"
  }'
```

---

### 4. DELETE /api/supplier-cadence/[id]

Elimina cadenza (hard delete dall'in-memory store).

**Response:**

```json
{
  "success": true,
  "message": "Cadenza per ALIGRO Demaurex & Cie SA eliminata con successo"
}
```

**Esempi:**

```bash
# Elimina cadenza
curl -X DELETE http://localhost:3000/api/supplier-cadence/5

# Verifica eliminazione (ritorna 404)
curl http://localhost:3000/api/supplier-cadence/5
```

---

### 5. GET /api/supplier-cadence/today

Fornitori da ordinare oggi (include overdue).

**Response:**

```json
{
  "suppliers": [
    {
      "id": 9,
      "supplier_name": "jirrolle Hygieneartikel",
      "cadence_type": "fixed_days",
      "next_order_date": "2025-10-29",
      "days_overdue": 0,
      "status": "overdue"
    }
  ],
  "count": 1,
  "summary": {
    "overdue": 1,
    "today": 0
  }
}
```

**Ordinamento:**
- Overdue first (più in ritardo prima)
- Poi today

**Esempi:**

```bash
# Fornitori da ordinare oggi
curl http://localhost:3000/api/supplier-cadence/today

# Integra con script automazione ordini
curl http://localhost:3000/api/supplier-cadence/today | jq '.suppliers[] | .supplier_name'
```

---

### 6. GET /api/supplier-cadence/upcoming

Prossimi ordini pianificati (esclude oggi e overdue).

**Query Parameters:**

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `days` | number | 7 | 1-365 | Numero giorni di lookahead |

**Response:**

```json
{
  "suppliers": [
    {
      "id": 1,
      "supplier_name": "ALIGRO Demaurex & Cie SA",
      "next_order_date": "2025-10-30",
      "days_until_next_order": 1,
      "status": "due_soon"
    },
    {
      "id": 2,
      "supplier_name": "LATTICINI MOLISANI TAMBURRO SRL",
      "next_order_date": "2025-10-30",
      "days_until_next_order": 1,
      "status": "due_soon"
    }
  ],
  "count": 2,
  "filters": {
    "days": 7,
    "date_from": "2025-10-29",
    "date_to": "2025-11-05"
  }
}
```

**Esempi:**

```bash
# Prossimi 7 giorni (default)
curl http://localhost:3000/api/supplier-cadence/upcoming

# Prossimi 14 giorni
curl "http://localhost:3000/api/supplier-cadence/upcoming?days=14"

# Prossimo mese
curl "http://localhost:3000/api/supplier-cadence/upcoming?days=30"

# Report prossimi ordini
curl "http://localhost:3000/api/supplier-cadence/upcoming?days=7" | \
  jq '.suppliers[] | "\(.next_order_date): \(.supplier_name)"'
```

---

## Error Handling

Tutti gli endpoint restituiscono errori strutturati:

### Validation Error (400)

```json
{
  "error": "Parametri query non validi",
  "details": [
    {
      "code": "invalid_type",
      "path": ["cadence_value"],
      "message": "cadence_value è obbligatorio per tipo 'fixed_days'"
    }
  ]
}
```

### Not Found (404)

```json
{
  "error": "Cadenza non trovata",
  "details": "Nessuna cadenza trovata con ID 999"
}
```

### Server Error (500)

```json
{
  "error": "Errore server durante recupero cadenze",
  "details": "Connection timeout"
}
```

---

## Data Types

### CadenceType

```typescript
enum CadenceType {
  FIXED_DAYS = 'fixed_days',   // Ogni N giorni
  WEEKLY = 'weekly',            // Giorni specifici settimana
  BIWEEKLY = 'biweekly',        // Bisettimanale
  MONTHLY = 'monthly'           // Giorno fisso mese
}
```

### Weekday

```typescript
enum Weekday {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}
```

### Status

```typescript
type Status = 'on_time' | 'due_soon' | 'overdue' | 'inactive';
```

- `on_time`: >3 giorni fino a prossimo ordine
- `due_soon`: ≤3 giorni fino a prossimo ordine
- `overdue`: data ordine passata
- `inactive`: cadenza disattivata

---

## Testing Workflow

```bash
# 1. Lista iniziale
curl http://localhost:3000/api/supplier-cadence

# 2. Crea nuova cadenza
curl -X POST http://localhost:3000/api/supplier-cadence \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 9999,
    "supplier_name": "Test SRL",
    "cadence_type": "fixed_days",
    "cadence_value": 3
  }'

# 3. Verifica creazione (ottieni ID dalla response sopra)
curl http://localhost:3000/api/supplier-cadence?search=Test

# 4. Aggiorna cadenza
curl -X PUT http://localhost:3000/api/supplier-cadence/22 \
  -H "Content-Type: application/json" \
  -d '{
    "cadence_value": 5,
    "notes": "Modificato per testing"
  }'

# 5. Verifica update
curl http://localhost:3000/api/supplier-cadence?search=Test

# 6. Check today
curl http://localhost:3000/api/supplier-cadence/today

# 7. Check upcoming
curl "http://localhost:3000/api/supplier-cadence/upcoming?days=7"

# 8. Elimina cadenza test
curl -X DELETE http://localhost:3000/api/supplier-cadence/22

# 9. Verifica eliminazione (404)
curl http://localhost:3000/api/supplier-cadence?search=Test
```

---

## Mock Data

L'API usa mock data in-memory basato sull'analisi Odoo reale. Include:

- 20 fornitori attivi con cadenze realistiche
- 1 fornitore inattivo per testing
- Dati storici: `total_orders_last_6m`, `calculated_cadence_days`
- Lead times reali: 0.4-11.5 giorni
- Mix di tipi: fixed_days, weekly, biweekly, monthly

**Persistenza:**
- In-memory: i dati persistono solo durante runtime server
- Restart server reset dei dati ai mock iniziali

**Prossimi step:**
- Sostituzione con database PostgreSQL (`lib/db/supplier-cadence-db.ts`)
- Integrazione Odoo per sync automatico
- Redis caching per performance

---

## Notes

- Tutti gli endpoint validano input con Zod schemas
- Date in formato ISO `YYYY-MM-DD`
- Timezone-agnostic: usa date local UTC midnight
- Auto-calculation next_order_date quando cadenza viene modificata
- Helper functions per calcoli calendari (weekdays, monthly, etc.)
