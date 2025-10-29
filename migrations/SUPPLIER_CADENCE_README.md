# Supplier Order Cadence - Sistema di Pianificazione Ordini Ricorrenti

Sistema completo per gestire cadenze automatiche degli ordini ai fornitori, con tracking, statistiche e storico modifiche.

## 📁 File Creati

1. **Migration SQL**: `migrations/create-supplier-order-cadence.sql`
   - Schema database completo
   - Indici ottimizzati per performance
   - View per query frequenti
   - Trigger auto-update

2. **TypeScript Types**: `lib/types/supplier-cadence.ts`
   - Types completi per API
   - Enums per cadence types
   - Helper functions per validazione e calcoli
   - Utility per UI

3. **Database Client**: `lib/db/supplier-cadence-db.ts`
   - CRUD operations ottimizzate
   - Query helpers con indici ottimizzati
   - Statistiche aggregate
   - Fallback in-memory mode

## 🚀 Quick Start

### 1. Esegui Migration

**Opzione A - Via Vercel Dashboard** (raccomandato):
1. Vai a Vercel Dashboard → Project → Storage → Postgres
2. Tab "Query"
3. Copia/incolla contenuto di `create-supplier-order-cadence.sql`
4. Esegui query

**Opzione B - Via CLI locale** (se hai accesso diretto):
```bash
# Assicurati di avere POSTGRES_URL configurato
psql $POSTGRES_URL -f migrations/create-supplier-order-cadence.sql
```

### 2. Verifica Installazione

```sql
-- Verifica tabelle create
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('supplier_order_cadence', 'supplier_order_cadence_history');

-- Verifica indici creati
SELECT indexname FROM pg_indexes
WHERE tablename = 'supplier_order_cadence';

-- Verifica view create
SELECT * FROM suppliers_to_order_today;
SELECT * FROM upcoming_supplier_orders;
```

### 3. Usa in Next.js API Route

```typescript
// app/api/supplier-cadence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getSupplierCadence,
  getSuppliersToOrderToday,
  createSupplierCadence
} from '@/lib/db/supplier-cadence-db';
import { CadenceType } from '@/lib/types/supplier-cadence';

// GET /api/supplier-cadence?supplier_id=123
export async function GET(req: NextRequest) {
  const supplierId = req.nextUrl.searchParams.get('supplier_id');

  if (supplierId) {
    const cadence = await getSupplierCadence(parseInt(supplierId));
    return NextResponse.json({ cadence });
  }

  // Nessun supplier_id: ritorna fornitori da ordinare oggi
  const suppliersToday = await getSuppliersToOrderToday();
  return NextResponse.json({ suppliers: suppliersToday });
}

// POST /api/supplier-cadence
export async function POST(req: NextRequest) {
  const body = await req.json();

  const cadence = await createSupplierCadence({
    supplier_id: body.supplier_id,
    supplier_name: body.supplier_name,
    cadence_type: body.cadence_type as CadenceType,
    cadence_value: body.cadence_value,
    next_order_date: body.next_order_date,
    updated_by: body.user_email,
  });

  return NextResponse.json({ cadence }, { status: 201 });
}
```

## 📊 Schema Database

### Tabella: `supplier_order_cadence`

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | SERIAL | Primary key |
| `supplier_id` | INTEGER | ID fornitore Odoo (UNIQUE) |
| `supplier_name` | VARCHAR(255) | Nome fornitore |
| `cadence_type` | VARCHAR(50) | Tipo cadenza: `fixed_days`, `weekly`, `biweekly`, `monthly` |
| `cadence_value` | INTEGER | Giorni tra ordini o giorno del mese |
| `weekdays` | JSONB | Array giorni settimana: `[1, 4]` (Lunedì, Giovedì) |
| `is_active` | BOOLEAN | Cadenza attiva/disattiva |
| `next_order_date` | DATE | Prossimo ordine previsto |
| `last_order_date` | DATE | Ultimo ordine effettuato |
| `average_lead_time_days` | INTEGER | Lead time medio fornitore |
| `total_orders_last_6m` | INTEGER | Numero ordini ultimi 6 mesi |
| `calculated_cadence_days` | DECIMAL(5,2) | Cadenza reale calcolata da storico |
| `notes` | TEXT | Note libere |
| `created_at` | TIMESTAMP | Data creazione |
| `updated_at` | TIMESTAMP | Data ultimo aggiornamento (auto-update via trigger) |
| `updated_by` | VARCHAR(100) | Username/email utente |

### Indici Creati

1. **`idx_supplier_cadence_supplier`** - Index su `supplier_id`
   - Per query: "Ottieni cadenza per fornitore X"
   - Tipo: B-tree standard

2. **`idx_supplier_cadence_next_order`** - Partial index su `next_order_date` WHERE `is_active = true`
   - Per query: "Fornitori da ordinare oggi/domani"
   - Tipo: Partial index (riduce size, solo record attivi)

3. **`idx_supplier_cadence_active_next_order`** - Composite index su `(is_active, next_order_date)` WHERE `is_active = true`
   - Per query range: "Fornitori da ordinare questa settimana"
   - Tipo: Partial composite index

### View Create

1. **`suppliers_to_order_today`**
   - Fornitori con `next_order_date <= CURRENT_DATE` e `is_active = true`
   - Include: `days_since_last_order`, `days_overdue`
   - Ordinata per: `next_order_date ASC`

2. **`upcoming_supplier_orders`**
   - Fornitori da ordinare nei prossimi 30 giorni
   - Include: `days_until_order`, `suggested_order_date` (considerando lead time)
   - Ordinata per: `next_order_date ASC`

## 🎯 Esempi d'Uso

### Configurare Cadenza Fissa (ogni 7 giorni)

```typescript
import { createSupplierCadence } from '@/lib/db/supplier-cadence-db';
import { CadenceType } from '@/lib/types/supplier-cadence';

const cadence = await createSupplierCadence({
  supplier_id: 123,
  supplier_name: 'Fornitore Alfa SRL',
  cadence_type: CadenceType.FIXED_DAYS,
  cadence_value: 7, // Ogni 7 giorni
  next_order_date: '2025-11-05',
  average_lead_time_days: 2,
  notes: 'Ordini regolari settimanali',
  updated_by: 'paul@lapa.com',
});
```

### Configurare Cadenza Settimanale (Lunedì e Giovedì)

```typescript
import { Weekday } from '@/lib/types/supplier-cadence';

const cadence = await createSupplierCadence({
  supplier_id: 456,
  supplier_name: 'Fornitore Beta SPA',
  cadence_type: CadenceType.WEEKLY,
  weekdays: [Weekday.MONDAY, Weekday.THURSDAY], // [1, 4]
  next_order_date: '2025-11-03', // Prossimo lunedì
  average_lead_time_days: 1,
  updated_by: 'paul@lapa.com',
});
```

### Configurare Cadenza Mensile (giorno 15 del mese)

```typescript
const cadence = await createSupplierCadence({
  supplier_id: 789,
  supplier_name: 'Fornitore Gamma SRL',
  cadence_type: CadenceType.MONTHLY,
  cadence_value: 15, // Giorno 15 di ogni mese
  next_order_date: '2025-11-15',
  average_lead_time_days: 3,
  updated_by: 'paul@lapa.com',
});
```

### Ottenere Fornitori da Ordinare Oggi

```typescript
import { getSuppliersToOrderToday } from '@/lib/db/supplier-cadence-db';

const suppliersToday = await getSuppliersToOrderToday();

// Response:
// [
//   {
//     id: 1,
//     supplier_id: 123,
//     supplier_name: 'Fornitore Alfa SRL',
//     cadence_type: 'fixed_days',
//     next_order_date: '2025-10-29',
//     last_order_date: '2025-10-22',
//     average_lead_time_days: 2,
//     days_since_last_order: 7,
//     days_overdue: 0,
//   }
// ]

console.log(`Hai ${suppliersToday.length} fornitori da ordinare oggi!`);
```

### Ottenere Prossimi Ordini (range date)

```typescript
import { getSuppliersToOrderInRange } from '@/lib/db/supplier-cadence-db';

// Prossimi 7 giorni
const startDate = new Date().toISOString().split('T')[0];
const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const upcoming = await getSuppliersToOrderInRange(startDate, endDate);

// Response:
// [
//   {
//     id: 2,
//     supplier_id: 456,
//     supplier_name: 'Fornitore Beta SPA',
//     next_order_date: '2025-10-31',
//     days_until_order: 2,
//     suggested_order_date: '2025-10-30', // Considerando lead_time = 1
//   }
// ]
```

### Aggiornare Cadenza

```typescript
import { updateSupplierCadence } from '@/lib/db/supplier-cadence-db';

const updated = await updateSupplierCadence(
  123, // supplier_id
  {
    cadence_value: 10, // Cambia da 7 a 10 giorni
    next_order_date: '2025-11-08',
    updated_by: 'paul@lapa.com',
  },
  'Cliente ha richiesto ordini meno frequenti' // change_reason
);

// Salva automaticamente snapshot in supplier_order_cadence_history
```

### Marcare Ordine Completato

```typescript
import { markOrderCompleted } from '@/lib/db/supplier-cadence-db';

const cadence = await markOrderCompleted(
  123, // supplier_id
  '2025-10-29', // order_date
  'paul@lapa.com'
);

// Aggiorna last_order_date
// TODO: calcolare automaticamente next_order_date (serve funzione PL/pgSQL)
```

### Ottenere Statistiche Dashboard

```typescript
import { getCadenceStatistics } from '@/lib/db/supplier-cadence-db';

const stats = await getCadenceStatistics();

// Response:
// {
//   total_active: 15,
//   total_inactive: 3,
//   due_today: 2,
//   due_this_week: 5,
//   overdue: 1,
//   by_cadence_type: {
//     fixed_days: 8,
//     weekly: 5,
//     biweekly: 3,
//     monthly: 2,
//   }
// }
```

### Lista Cadenze con Filtri e Paginazione

```typescript
import { listCadences } from '@/lib/db/supplier-cadence-db';

const result = await listCadences(
  {
    is_active: true,
    cadence_type: CadenceType.WEEKLY,
    search: 'Alfa', // Cerca per supplier_name
  },
  {
    limit: 20,
    offset: 0,
    order_by: 'next_order_date',
    order_direction: 'asc',
  }
);

// Response:
// {
//   data: [...], // Array di CadenceWithMetadata
//   total: 45,
//   limit: 20,
//   offset: 0,
//   has_more: true,
// }
```

### Ottenere Storico Modifiche

```typescript
import { getCadenceHistory } from '@/lib/db/supplier-cadence-db';

const history = await getCadenceHistory(1); // cadence_id

// Response:
// [
//   {
//     id: 5,
//     cadence_id: 1,
//     previous_cadence_value: 7,
//     new_cadence_value: 10,
//     change_reason: 'Cliente ha richiesto ordini meno frequenti',
//     changed_at: '2025-10-29T10:30:00Z',
//     changed_by: 'paul@lapa.com',
//   }
// ]
```

## 🎨 UI Components Examples

### Dashboard Widget: Fornitori da Ordinare Oggi

```typescript
// app/dashboard/components/SuppliersToOrderToday.tsx
'use client';

import { useEffect, useState } from 'react';
import { SupplierToOrderToday } from '@/lib/types/supplier-cadence';

export default function SuppliersToOrderToday() {
  const [suppliers, setSuppliers] = useState<SupplierToOrderToday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier-cadence/today')
      .then(res => res.json())
      .then(data => {
        setSuppliers(data.suppliers);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">
        Ordini da Fare Oggi ({suppliers.length})
      </h2>

      {suppliers.length === 0 ? (
        <p className="text-gray-500">Nessun ordine previsto oggi</p>
      ) : (
        <ul className="space-y-3">
          {suppliers.map(supplier => (
            <li key={supplier.id} className="flex items-center justify-between border-b pb-2">
              <div>
                <p className="font-medium">{supplier.supplier_name}</p>
                <p className="text-sm text-gray-500">
                  Ultimo ordine: {supplier.last_order_date || 'Mai'}
                  {supplier.days_overdue > 0 && (
                    <span className="text-red-500 ml-2">
                      (In ritardo di {supplier.days_overdue} giorni)
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleCreateOrder(supplier.supplier_id)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Crea Ordine
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  function handleCreateOrder(supplierId: number) {
    // TODO: integrazione con Odoo per creare purchase.order
    console.log('Creating order for supplier:', supplierId);
  }
}
```

### Form: Configura Nuova Cadenza

```typescript
// app/suppliers/components/CadenceConfigForm.tsx
'use client';

import { useState } from 'react';
import { CadenceType, Weekday, WEEKDAY_NAMES } from '@/lib/types/supplier-cadence';

interface Props {
  supplierId: number;
  supplierName: string;
  onSave: () => void;
}

export default function CadenceConfigForm({ supplierId, supplierName, onSave }: Props) {
  const [cadenceType, setCadenceType] = useState<CadenceType>(CadenceType.FIXED_DAYS);
  const [cadenceValue, setCadenceValue] = useState(7);
  const [weekdays, setWeekdays] = useState<Weekday[]>([Weekday.MONDAY]);
  const [nextOrderDate, setNextOrderDate] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      supplier_id: supplierId,
      supplier_name: supplierName,
      cadence_type: cadenceType,
      cadence_value: cadenceType === CadenceType.FIXED_DAYS || cadenceType === CadenceType.MONTHLY
        ? cadenceValue
        : null,
      weekdays: cadenceType === CadenceType.WEEKLY || cadenceType === CadenceType.BIWEEKLY
        ? weekdays
        : null,
      next_order_date: nextOrderDate,
      updated_by: 'current-user@example.com', // TODO: get from session
    };

    const res = await fetch('/api/supplier-cadence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert('Cadenza salvata!');
      onSave();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-bold">Configura Cadenza Ordini</h3>
      <p className="text-gray-600">Fornitore: {supplierName}</p>

      {/* Tipo cadenza */}
      <div>
        <label className="block font-medium mb-2">Tipo Cadenza</label>
        <select
          value={cadenceType}
          onChange={(e) => setCadenceType(e.target.value as CadenceType)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value={CadenceType.FIXED_DAYS}>Ogni N giorni fissi</option>
          <option value={CadenceType.WEEKLY}>Settimanale</option>
          <option value={CadenceType.BIWEEKLY}>Bisettimanale</option>
          <option value={CadenceType.MONTHLY}>Mensile</option>
        </select>
      </div>

      {/* Giorni (fixed_days) */}
      {cadenceType === CadenceType.FIXED_DAYS && (
        <div>
          <label className="block font-medium mb-2">Giorni tra ordini</label>
          <input
            type="number"
            value={cadenceValue}
            onChange={(e) => setCadenceValue(parseInt(e.target.value))}
            min={1}
            max={365}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      )}

      {/* Giorni settimana (weekly/biweekly) */}
      {(cadenceType === CadenceType.WEEKLY || cadenceType === CadenceType.BIWEEKLY) && (
        <div>
          <label className="block font-medium mb-2">Giorni della settimana</label>
          <div className="space-y-2">
            {[Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY].map(day => (
              <label key={day} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={weekdays.includes(day)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setWeekdays([...weekdays, day]);
                    } else {
                      setWeekdays(weekdays.filter(d => d !== day));
                    }
                  }}
                />
                <span>{WEEKDAY_NAMES[day]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Giorno del mese (monthly) */}
      {cadenceType === CadenceType.MONTHLY && (
        <div>
          <label className="block font-medium mb-2">Giorno del mese</label>
          <input
            type="number"
            value={cadenceValue}
            onChange={(e) => setCadenceValue(parseInt(e.target.value))}
            min={1}
            max={31}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      )}

      {/* Prossimo ordine */}
      <div>
        <label className="block font-medium mb-2">Prossimo Ordine Previsto</label>
        <input
          type="date"
          value={nextOrderDate}
          onChange={(e) => setNextOrderDate(e.target.value)}
          required
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
      >
        Salva Cadenza
      </button>
    </form>
  );
}
```

## 🔧 Performance Optimization Tips

### 1. Usa View per Query Frequenti

```typescript
// BAD - query manuale ogni volta
const suppliersToday = await sql`
  SELECT * FROM supplier_order_cadence
  WHERE is_active = true AND next_order_date <= CURRENT_DATE
  ORDER BY next_order_date ASC
`;

// GOOD - usa view ottimizzata
const suppliersToday = await sql`
  SELECT * FROM suppliers_to_order_today
`;
```

### 2. Batch Queries dove Possibile

```typescript
// BAD - N query
for (const supplierId of supplierIds) {
  const cadence = await getSupplierCadence(supplierId);
  // ...
}

// GOOD - single query
const cadences = await listCadences({
  supplier_ids: supplierIds,
});
```

### 3. Usa Paginazione per Liste Grandi

```typescript
// BAD - fetch tutto
const allCadences = await listCadences({}, { limit: 999999 });

// GOOD - pagina 20 alla volta
const page1 = await listCadences({}, { limit: 20, offset: 0 });
const page2 = await listCadences({}, { limit: 20, offset: 20 });
```

### 4. Aggiungi Caching se Necessario

```typescript
// TODO: Aggiungi Redis per cache query pesanti
import { redis } from '@/lib/redis';

export async function getCadenceStatistics(): Promise<CadenceStatistics> {
  // Try cache first (TTL: 5 minuti)
  const cached = await redis.get('cadence:stats');
  if (cached) {
    return JSON.parse(cached);
  }

  // Compute stats
  const stats = await computeStatsFromDB();

  // Cache result
  await redis.setex('cadence:stats', 300, JSON.stringify(stats));

  return stats;
}
```

## 🔐 Security Considerations

1. **Validazione Input**: Sempre validare `supplier_id`, `cadence_type`, etc.
2. **Authorization**: Verificare permessi utente prima di modificare cadenze
3. **SQL Injection**: Usare sempre prepared statements (fatto automaticamente da `@vercel/postgres`)
4. **Audit Trail**: Tutti i cambiamenti salvati in `supplier_order_cadence_history`

## 🚦 Next Steps

1. **Integrare con Odoo**:
   - Sync `supplier_id` da `res.partner`
   - Calcola `average_lead_time_days` da `purchase.order` storico
   - Crea automaticamente `purchase.order` quando `next_order_date` arriva

2. **Implementare Notifiche**:
   - Email alert per ordini in scadenza
   - Push notification su dashboard
   - Slack/Teams integration

3. **Analytics e Reporting**:
   - Dashboard con grafici cadenze
   - Report cadenza reale vs pianificata
   - Forecast budget basato su cadenze

4. **Automazione**:
   - Cron job giornaliero che controlla `suppliers_to_order_today`
   - Auto-create draft purchase orders in Odoo
   - Auto-calcolo `next_order_date` dopo ordine completato

## 📚 Risorse Aggiuntive

- [PostgreSQL Indexes Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [@vercel/postgres SDK](https://vercel.com/docs/storage/vercel-postgres/using-an-orm)

---

**Created by**: Database Optimizer Agent
**Date**: 2025-10-29
**Version**: 1.0.0
