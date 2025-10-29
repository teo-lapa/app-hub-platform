# Supplier Management - Database Schema

Sistema di gestione cadenze fornitori con tabella `supplier_avatars` su Vercel PostgreSQL, ispirato al sistema `customer_avatars` di Maestro AI.

## 📊 Struttura Database

### Tabella: `supplier_avatars`

Rappresenta il "Digital Twin" di ogni fornitore con tutte le informazioni per gestire le cadenze di riordino.

**Campi Principali:**
- `id`: UUID primary key
- `odoo_supplier_id`: ID univoco dal sistema Odoo (UNIQUE)
- `name`, `email`, `phone`, `city`, `country`: Dati anagrafici
- `cadence_type`: Tipo di cadenza (`fixed_days`, `weekly`, `biweekly`, `monthly`, `custom`)
- `cadence_value`: Giorni tra ordini (default: 7)
- `next_order_date`: Prossima data ordine calcolata automaticamente
- `days_until_next_order`: Giorni mancanti al prossimo ordine (calcolato automaticamente)
- `last_cadence_order_date`: Ultima data ordine per cadenza
- `average_lead_time_days`: Tempo medio di consegna
- `critical_products_count`: Numero prodotti critici
- `reliability_score`, `quality_score`, `price_competitiveness_score`, `delivery_performance_score`: Punteggi fornitore (0-100)

### Tabella: `supplier_order_history`

Storico ordini ai fornitori per analytics e tracking performance.

## 🔄 Trigger Automatici

### 1. Auto-update `updated_at`
Aggiorna automaticamente il timestamp quando un record viene modificato.

### 2. Auto-calculate `next_order_date`
Calcola automaticamente:
- `next_order_date` = `last_cadence_order_date` + `cadence_value` giorni
- `days_until_next_order` = differenza tra `next_order_date` e oggi

**Si attiva quando modifichi:**
- `cadence_value`
- `last_cadence_order_date`
- `last_order_date`

## 📈 Views Predefinite

### `v_urgent_orders_today`
Fornitori da ordinare OGGI (`days_until_next_order = 0`)

### `v_orders_tomorrow`
Fornitori da ordinare DOMANI (`days_until_next_order = 1`)

### `v_upcoming_orders`
Fornitori da ordinare nei prossimi 7 giorni

## 🚀 Setup

### 1. Esegui lo schema SQL

```bash
# Connettiti al tuo database Vercel Postgres
psql $DATABASE_URL

# Esegui lo schema
\i lib/suppliers/db-schema.sql
```

Oppure copia il contenuto di `db-schema.sql` ed eseguilo nella dashboard Vercel Postgres.

### 2. Verifica creazione

```sql
-- Controlla che le tabelle esistano
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('supplier_avatars', 'supplier_order_history');

-- Controlla gli indici
SELECT tablename, indexname FROM pg_indexes
WHERE tablename IN ('supplier_avatars', 'supplier_order_history');
```

## 💡 Esempio d'Uso

### Creare un nuovo fornitore

```sql
INSERT INTO supplier_avatars (
  odoo_supplier_id,
  name,
  email,
  phone,
  cadence_type,
  cadence_value,
  average_lead_time_days,
  last_cadence_order_date,
  critical_products_count
) VALUES (
  123,
  'FERRAIUOLO FOODS SRL',
  'info@ferraiuolo.it',
  '+39 081 123 4567',
  'fixed_days',
  7,
  3,
  CURRENT_DATE,
  5
);

-- next_order_date e days_until_next_order vengono calcolati automaticamente!
```

### Aggiornare la cadenza

```sql
-- Quando modifichi cadence_value o last_cadence_order_date,
-- next_order_date viene ricalcolato automaticamente
UPDATE supplier_avatars
SET
  cadence_value = 14,
  last_cadence_order_date = CURRENT_DATE
WHERE odoo_supplier_id = 123;
```

### Query ordini urgenti

```sql
-- Ordini da fare oggi
SELECT * FROM v_urgent_orders_today;

-- Ordini da fare domani
SELECT * FROM v_orders_tomorrow;

-- Ordini prossimi 7 giorni
SELECT * FROM v_upcoming_orders;

-- Ordini manuali con JOIN
SELECT
  sa.*,
  CASE
    WHEN sa.days_until_next_order = 0 THEN 'OGGI'
    WHEN sa.days_until_next_order = 1 THEN 'DOMANI'
    WHEN sa.days_until_next_order <= 7 THEN 'QUESTA SETTIMANA'
    ELSE 'FUTURO'
  END as urgency
FROM supplier_avatars sa
WHERE sa.is_active = true
ORDER BY sa.days_until_next_order ASC;
```

## 🔗 Integrazione con API

Le API in `app/api/supplier-cadence/` useranno questa tabella invece dei mock data:

- `GET /api/supplier-cadence` → Lista tutti i fornitori con cadenze
- `GET /api/supplier-cadence/today` → Fornitori da ordinare oggi
- `GET /api/supplier-cadence/upcoming` → Fornitori prossimi 7 giorni
- `POST /api/supplier-cadence` → Crea nuova cadenza fornitore
- `PATCH /api/supplier-cadence/[id]` → Aggiorna cadenza
- `DELETE /api/supplier-cadence/[id]` → Disattiva cadenza

## 📝 Note

- **Auto-calculation**: I campi `next_order_date` e `days_until_next_order` sono AUTOMATICI
- **Odoo Sync**: Usa `last_sync_odoo` per tracciare l'ultima sincronizzazione
- **Soft Delete**: Usa `is_active = false` invece di cancellare i record
- **JSONB Fields**: `top_products` e `product_categories` per flessibilità

## 🎯 Prossimi Step

1. ✅ Schema SQL creato
2. ⏳ Creare API endpoints per CRUD operations
3. ⏳ Aggiornare frontend per usare database invece di mock data
4. ⏳ Creare pagina settings per gestione cadenze
5. ⏳ Implementare sincronizzazione da Odoo
