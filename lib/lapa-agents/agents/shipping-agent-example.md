# Shipping Agent - Esempi di Utilizzo

## Panoramica

L'agente Spedizioni è stato aggiornato per collegarsi ai dati reali di Odoo.

## Metodi Principali

### 1. trackShipment(orderId)

Traccia una spedizione usando ID ordine, ID picking, o nome ordine.

```typescript
import { trackShipment } from '@/lib/lapa-agents/agents/shipping-agent';

// Tracciamento per picking ID
const result1 = await trackShipment(12345);

// Tracciamento per sale order ID
const result2 = await trackShipment(67890);

// Tracciamento per nome ordine (es. "S00123")
const result3 = await trackShipment("S00123");

// Response structure:
{
  success: true,
  data: {
    id: 12345,
    name: "WH/OUT/00123",
    state: "assigned",
    state_label: "Pronto",
    customer_id: 456,
    customer_name: "Cliente XYZ",
    scheduled_date: "2025-12-20 14:00:00",
    date_done: null,
    driver_id: 789,
    driver_name: "Mario Rossi",
    vehicle_id: 101,
    vehicle_name: "Furgone A1",
    origin: "S00123",
    note: "Consegna urgente",
    products: [
      {
        product_id: 111,
        product_name: "Prodotto ABC",
        quantity_ordered: 10,
        quantity_delivered: 0,
        unit: "PZ"
      }
    ]
  }
}
```

**Query Odoo utilizzata:**
```python
# Cerca per ID picking o sale_id
[('|', ('id', '=', orderId), ('sale_id', '=', orderId))]

# Oppure per nome ordine
[('|', ('origin', 'ilike', orderId), ('name', '=', orderId))]
```

### 2. getDriverInfo(pickingId)

Recupera informazioni sull'autista dal batch associato al picking.

```typescript
import { getDriverInfo } from '@/lib/lapa-agents/agents/shipping-agent';

const result = await getDriverInfo(12345);

// Response:
{
  success: true,
  data: {
    id: 789,
    name: "Mario Rossi",
    phone: null,
    email: null,
    vehicle_id: 101,
    vehicle_name: "Furgone A1",
    current_deliveries: 15,  // Consegne programmate oggi
    completed_today: 8        // Consegne completate oggi
  }
}
```

**Query Odoo utilizzata:**
```python
# 1. Leggi picking per ottenere batch_id
picking = env['stock.picking'].read([picking_id], ['batch_id'])

# 2. Leggi batch per ottenere autista
batch = env['stock.picking.batch'].read(
  [batch_id],
  ['x_studio_autista_del_giro', 'x_studio_auto_del_giro']
)

# 3. Conta consegne oggi
today_pickings = env['stock.picking'].search_count([
  ('batch_id.x_studio_autista_del_giro', '=', driver_id),
  ('scheduled_date', '>=', today_start),
  ('scheduled_date', '<=', today_end)
])
```

### 3. getDeliveryETA(orderId)

Calcola il tempo stimato di arrivo per una consegna.

```typescript
import { getDeliveryETA } from '@/lib/lapa-agents/agents/shipping-agent';

const result = await getDeliveryETA("S00123");

// Response:
{
  success: true,
  data: {
    picking_id: 12345,
    picking_name: "WH/OUT/00123",
    scheduled_date: "2025-12-20 14:00:00",
    estimated_arrival: "2025-12-20 14:00:00",
    minutes_remaining: 45,
    is_late: false,
    status: "Pronto",
    customer_name: "Cliente XYZ",
    address: "Via Roma 123, 00100 Roma, Italia"
  }
}
```

**Logica ETA:**
- Se `state = 'done'`: ETA = data consegna effettiva (date_done)
- Altrimenti: ETA = scheduled_date
- `is_late = true` se scheduled_date < now
- `minutes_remaining` = differenza tra scheduled_date e now

### 4. getDeliveryHistory(customerId, limit)

Recupera lo storico delle consegne per un cliente.

```typescript
import { getDeliveryHistory } from '@/lib/lapa-agents/agents/shipping-agent';

const result = await getDeliveryHistory(456, 20);

// Response:
{
  success: true,
  data: {
    customer_id: 456,
    customer_name: "Cliente XYZ",
    total_deliveries: 45,
    last_delivery_date: "2025-12-19 15:30:00",
    avg_delivery_time: 15,  // Minuti (vs scheduled_date)
    on_time_percentage: 92,
    deliveries: [
      {
        id: 12344,
        name: "WH/OUT/00122",
        date: "2025-12-19 15:30:00",
        state: "Consegnato",
        driver_name: "Mario Rossi",
        products_count: 5,
        was_on_time: true
      }
    ]
  }
}
```

**Query Odoo utilizzata:**
```python
# Cerca tutti i picking del cliente
pickings = env['stock.picking'].search_read(
  [
    ('partner_id', '=', customer_id),
    ('picking_type_code', '=', 'outgoing'),
    ('state', '!=', 'cancel')
  ],
  fields=['id', 'name', 'state', 'scheduled_date', 'date_done',
          'driver_id', 'move_ids'],
  order='date_done DESC, scheduled_date DESC',
  limit=limit
)
```

**Calcolo metriche:**
- `was_on_time`: `date_done <= scheduled_date + 30 minuti`
- `on_time_percentage`: (consegne_in_orario / totale_consegne) * 100
- `avg_delivery_time`: media di (date_done - scheduled_date)

## Stati Stock.Picking

| State | Label IT | Descrizione |
|-------|----------|-------------|
| draft | Bozza | Picking creato ma non confermato |
| waiting | In Attesa | In attesa di altri picking/risorse |
| confirmed | Confermato | Confermato e in attesa di disponibilità |
| assigned | Pronto | Prodotti riservati, pronto per il prelievo |
| done | Consegnato | Consegna completata |
| cancel | Annullato | Operazione annullata |

## Campi Custom Odoo

### stock.picking.batch
- `x_studio_autista_del_giro`: Many2one → Nome autista (es. "Mario Rossi")
- `x_studio_auto_del_giro`: Many2one → Nome veicolo (es. "Furgone A1")

### stock.picking
- `batch_id`: Many2one → Batch di consegna
- `sale_id`: Many2one → Ordine di vendita collegato
- `origin`: Char → Nome ordine (es. "S00123")
- `scheduled_date`: Datetime → Data/ora programmata
- `date_done`: Datetime → Data/ora effettiva consegna

## Esempi API Route

### Route di esempio: /api/shipping/track

```typescript
// app/api/shipping/track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { trackShipment } from '@/lib/lapa-agents/agents/shipping-agent';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json(
      { error: 'orderId richiesto' },
      { status: 400 }
    );
  }

  // Prova a convertire in numero, altrimenti usa come stringa
  const id = isNaN(Number(orderId)) ? orderId : Number(orderId);

  const result = await trackShipment(id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 404 }
    );
  }

  return NextResponse.json(result.data);
}
```

Uso: `GET /api/shipping/track?orderId=S00123`

## Note Tecniche

1. **Performance**: Le query sono ottimizzate con limit e campi specifici
2. **Error Handling**: Tutti i metodi restituiscono `{ success, data?, error? }`
3. **Compatibilità**: Supporta sia ID numerici che stringhe
4. **Real-time**: I dati provengono direttamente da Odoo in tempo reale
5. **Caching**: Non implementato - valutare per query frequenti

## Testing

Per testare l'agente:

```bash
# Console browser o server
const agent = require('@/lib/lapa-agents/agents/shipping-agent');

// Test tracciamento
const track = await agent.trackShipment(12345);
console.log(track);

// Test info autista
const driver = await agent.getDriverInfo(12345);
console.log(driver);

// Test ETA
const eta = await agent.getDeliveryETA("S00123");
console.log(eta);

// Test storico
const history = await agent.getDeliveryHistory(456, 10);
console.log(history);
```
