# Setup Control Logs - Controllo Diretto

Sistema di tracking per i controlli qualità dei prelievi.

## Deploy su Staging - Completato ✅

**Branch:** `staging`
**Commit:** `308cac1`
**Build:** ✅ Passato (fix TypeScript applicato)

## Setup Database - Da Fare

### Opzione 1: Dashboard Vercel (CONSIGLIATO)

1. Vai su [Vercel Dashboard](https://vercel.com)
2. Seleziona il progetto `app-hub-platform`
3. Vai su **Storage** → **Postgres Database**
4. Clicca su **Query**
5. Copia e incolla il contenuto di [db-setup-control-logs.sql](./db-setup-control-logs.sql)
6. Clicca **Run Query**
7. Verifica che appaia "Tabella control_logs creata con X colonne"

### Opzione 2: Script Automatico (richiede env vars)

```bash
# 1. Pull delle variabili d'ambiente da Vercel
vercel env pull .env.local

# 2. Esegui lo script
npm run tsx scripts/create-control-logs-table.ts
```

## Come Funziona

### UI - 3 Pulsanti

```
┌─────────────────────────────────────────┐
│ MOZZARELLA BUFALA                       │
│ Richiesto: 5 | Prelevato: 5            │
├─────────────────────────────────────────┤
│ [  ✅ OK  ] [ ▼ ] [ 📋 Dettagli ]      │
└─────────────────────────────────────────┘
```

**1. ✅ OK** - Tap veloce per prodotti corretti
**2. ▼ Dropdown** - Segnala errori:
   - ⚠️ Errore Quantità
   - ❌ Prodotto Mancante
   - 🔧 Prodotto Danneggiato
   - 📅 Lotto/Scadenza Errata
   - 📍 Ubicazione Errata
   - 📝 Aggiungi Nota

**3. 📋 Dettagli** - Espande info clienti/ubicazioni

### Flusso

1. **Controllo OK**: Tap su ✅ → Salvato subito
2. **Errore**: Tap su ▼ → Scegli tipo → Modal → Scrivi nota → Conferma
3. **Mancante**: Tap diretto → Salvato come "Prodotto non trovato"

### Dopo il Salvataggio

```
┌─────────────────────────────────────────┐
│ MOZZARELLA BUFALA               ✅      │
│ Richiesto: 5 | Prelevato: 5            │
├─────────────────────────────────────────┤
│ ✅ Tutto OK                  14:32     │
├─────────────────────────────────────────┤
│ [  🔄 Cambia  ] [ ▼ ] [ 📋 Dettagli ]  │
└─────────────────────────────────────────┘
```

O con errore:

```
┌─────────────────────────────────────────┐
│ MOZZARELLA BUFALA               ⚠️      │
│ Richiesto: 5 | Prelevato: 4.5          │
├─────────────────────────────────────────┤
│ ⚠️ Errore Quantità           14:32     │
│ "Prelevati 4.5kg invece di 5kg"        │
├─────────────────────────────────────────┤
│ [  🔄 Cambia  ] [ ▼ ] [ 📋 Dettagli ]  │
└─────────────────────────────────────────┘
```

## Database Schema

### Tabella `control_logs`

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| id | UUID | Primary key |
| batch_id | INTEGER | ID batch Odoo |
| batch_name | TEXT | Nome batch (es: GIRO ZURIGO EST) |
| zone_id | TEXT | ID zona (secco/frigo/pingu) |
| zone_name | TEXT | Nome zona |
| product_id | INTEGER | ID prodotto Odoo |
| product_name | TEXT | Nome prodotto |
| qty_requested | DECIMAL | Quantità richiesta |
| qty_picked | DECIMAL | Quantità prelevata |
| **status** | TEXT | **ok, error_qty, missing, damaged, lot_error, location_error, note** |
| note | TEXT | Dettagli problema |
| controlled_by_user_id | INTEGER | ID utente che ha controllato |
| controlled_by_name | TEXT | Nome utente |
| controlled_at | TIMESTAMP | Quando è stato controllato |
| driver_name | TEXT | Nome autista |
| vehicle_name | TEXT | Targa veicolo |

### View `control_summary`

Riepilogo controlli per batch/zona:
- Totale prodotti controllati
- Conteggio OK / Errori / Mancanti / Note
- Primo e ultimo controllo

### View `control_errors`

Solo prodotti con problemi (status != 'ok')

## API Endpoints

### POST `/api/control-logs`

Salva un controllo:

```json
{
  "batch_id": 12345,
  "batch_name": "GIRO ZURIGO EST",
  "zone_id": "frigo",
  "zone_name": "Frigo",
  "product_id": 678,
  "product_name": "MOZZARELLA BUFALA",
  "qty_requested": 5,
  "qty_picked": 4.5,
  "status": "error_qty",
  "note": "Prelevati 4.5kg invece di 5kg",
  "controlled_by_user_id": 10,
  "controlled_by_name": "Stefan Cosmin Rusu",
  "driver_name": "Zamfir Traian Liviu",
  "vehicle_name": "IVECO/Daily 35S18H"
}
```

### GET `/api/control-logs?batch_id=12345&zone_id=frigo`

Recupera controlli (filtri opzionali: batch_id, zone_id, product_id, status)

### DELETE `/api/control-logs?id=xxx-xxx-xxx`

Cancella un controllo (undo)

## Test su Staging

1. Vai su https://lapa.ch (staging)
2. Login
3. Apri app **Controllo Diretto**
4. Seleziona un batch
5. Seleziona una zona
6. Prova:
   - Tap su ✅ OK per un prodotto
   - Tap su ▼ e scegli un errore
   - Verifica che il badge appaia
   - Ricarica la pagina → il controllo deve rimanere

## Prossimi Step (Opzionali)

- [ ] Pagina riepilogo controlli giornalieri
- [ ] Export PDF riepilogo
- [ ] Dashboard errori in tempo reale
- [ ] Notifiche per errori critici

## File Modificati

- [app/controllo-diretto/page.tsx](./app/controllo-diretto/page.tsx) - UI con 3 pulsanti + modal
- [app/api/control-logs/route.ts](./app/api/control-logs/route.ts) - API endpoints
- [lib/db/control-logs-schema.sql](./lib/db/control-logs-schema.sql) - Schema database
- [db-setup-control-logs.sql](./db-setup-control-logs.sql) - Script setup da eseguire
- [scripts/create-control-logs-table.ts](./scripts/create-control-logs-table.ts) - Script automatico

---

**Pronto per il test!** 🚀
