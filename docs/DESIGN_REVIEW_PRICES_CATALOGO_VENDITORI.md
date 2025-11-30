# Design Completo: Pagina Revisione Prezzi - Catalogo Venditori AI

**Versione:** 1.0
**Data:** 2025-11-08
**Autore:** Sistema di Design AI

---

## Indice

1. [Overview](#overview)
2. [Flusso Utente Completo](#flusso-utente-completo)
3. [Schema Database](#schema-database)
4. [API Endpoints](#api-endpoints)
5. [Campi Odoo Necessari](#campi-odoo-necessari)
6. [UI/UX Design](#uiux-design)
7. [Logica di Business](#logica-di-business)
8. [Implementazione Step-by-Step](#implementazione-step-by-step)
9. [Testing e Validazione](#testing-e-validazione)

---

## Overview

### Obiettivo
Creare una pagina intermedia di revisione prezzi che permetta ai venditori di:
- Visualizzare tutti i prodotti dell'ordine DRAFT appena creato
- Vedere prezzi di listino cliente (se presente) o prezzi standard
- Applicare sconti percentuali o fissi per prodotto
- Bloccare/sbloccare prezzi per prodotti specifici
- Confermare prezzi e finalizzare l'ordine (da DRAFT a SALE)

### Benefici
- Maggior controllo sui prezzi prima di confermare l'ordine
- Applicazione di sconti personalizzati per cliente
- Trasparenza totale sui prezzi applicati
- Tracciabilità delle modifiche prezzi tramite Chatter Odoo

---

## Flusso Utente Completo

### Flusso Attuale (DA MODIFICARE)
```
1. Utente seleziona cliente
2. Aggiunge prodotti al carrello (AI o manuale)
3. Clicca "Conferma Ordine" → Crea ordine DRAFT in Odoo
4. Mostra messaggio successo
```

### Nuovo Flusso (DA IMPLEMENTARE)
```
1. Utente seleziona cliente
2. Aggiunge prodotti al carrello (AI o manuale)
3. Clicca "Conferma Carrello" → Crea ordine DRAFT in Odoo
4. ✨ NUOVO: Redirect automatico a → /catalogo-venditori/review-prices/[orderId]
5. ✨ NUOVO: Pagina Review Prices mostra:
   - Elenco prodotti con prezzi dal listino cliente
   - Campi per applicare sconti % o fissi
   - Indicatori di prezzi bloccati/modificabili
   - Totale ordine dinamico
6. ✨ NUOVO: Utente clicca "Conferma Prezzi":
   - Aggiorna tutti i prezzi nelle sale.order.line
   - Applica tutti gli sconti configurati
   - Cambia stato ordine da 'draft' a 'sale'
   - Scrive nel Chatter: "Prezzi confermati e ordine finalizzato da [username]"
   - Redirect a pagina successo o dashboard
```

---

## Schema Database

### Nuova Tabella: `order_price_locks`

Questa tabella gestisce i prezzi bloccati per prodotti specifici di un ordine.

```sql
CREATE TABLE order_price_locks (
  id SERIAL PRIMARY KEY,
  odoo_order_id INTEGER NOT NULL,
  odoo_order_line_id INTEGER NOT NULL,
  odoo_product_id INTEGER NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_price NUMERIC(10, 2),
  locked_by_uid INTEGER,
  locked_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_order_price_locks_order ON order_price_locks(odoo_order_id);
CREATE INDEX idx_order_price_locks_line ON order_price_locks(odoo_order_line_id);
CREATE INDEX idx_order_price_locks_product ON order_price_locks(odoo_product_id);
```

**Note:**
- `is_locked`: Se TRUE, il prezzo non può essere modificato dall'utente
- `locked_price`: Prezzo bloccato (se applicabile)
- `locked_by_uid`: UID Odoo dell'utente che ha bloccato il prezzo
- `notes`: Motivazione del blocco

**OPZIONALE:** Questa tabella può essere omessa se non si vuole gestire il blocco prezzi. In tal caso, tutti i prezzi saranno sempre modificabili.

---

## API Endpoints

### 1. GET /api/catalogo-venditori/order-prices/[orderId]

**Scopo:** Recupera tutti i dati necessari per mostrare la pagina di revisione prezzi.

**Parametri:**
- `orderId` (path): ID dell'ordine Odoo

**Response:**
```typescript
{
  success: true,
  order: {
    id: number,
    name: string,              // es. "SO0123"
    state: string,             // "draft" | "sale" | "done"
    partner_id: [number, string],
    partner_name: string,
    date_order: string,
    amount_untaxed: number,
    amount_tax: number,
    amount_total: number,
    pricelist_id: [number, string] | null,  // Listino cliente
    currency_id: [number, string]
  },
  lines: [
    {
      id: number,                    // sale.order.line ID
      product_id: [number, string],
      product_name: string,
      product_code: string | null,
      quantity: number,
      uom_name: string,
      price_unit: number,            // Prezzo unitario attuale
      price_subtotal: number,        // Subtotale riga
      discount: number,              // Sconto % attuale
      tax_id: [[number]],           // IVA applicata
      pricelist_price: number,       // Prezzo da listino cliente
      standard_price: number,        // Prezzo standard prodotto
      is_price_locked: boolean,      // Se il prezzo è bloccato
      locked_notes: string | null,   // Note blocco prezzo
      image_url: string | null
    }
  ]
}
```

**Implementazione:**
```typescript
// File: app/api/catalogo-venditori/order-prices/[orderId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = parseInt(params.orderId);

    // 1. Autenticazione utente
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // 2. Recupera ordine da Odoo
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: [
          'id', 'name', 'state', 'partner_id', 'date_order',
          'amount_untaxed', 'amount_tax', 'amount_total',
          'pricelist_id', 'currency_id'
        ],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    const order = orders[0];

    // 3. Recupera righe ordine
    const lines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['order_id', '=', orderId]],
        fields: [
          'id', 'product_id', 'name', 'product_uom_qty',
          'product_uom', 'price_unit', 'price_subtotal',
          'discount', 'tax_id'
        ],
        order: 'id ASC'
      }
    );

    // 4. Per ogni riga, calcola prezzo da listino e prezzo standard
    const enrichedLines = await Promise.all(
      lines.map(async (line: any) => {
        const productId = Array.isArray(line.product_id)
          ? line.product_id[0]
          : line.product_id;

        // Recupera info prodotto
        const products = await callOdoo(
          cookies,
          'product.product',
          'search_read',
          [],
          {
            domain: [['id', '=', productId]],
            fields: ['default_code', 'list_price', 'image_128'],
            limit: 1
          }
        );

        const product = products?.[0] || {};

        // Calcola prezzo da listino cliente
        let pricelistPrice = line.price_unit;
        if (order.pricelist_id && order.pricelist_id[0]) {
          try {
            const priceResult = await callOdoo(
              cookies,
              'product.pricelist',
              'get_product_price',
              [
                order.pricelist_id[0],
                productId,
                line.product_uom_qty,
                order.partner_id[0]
              ],
              {}
            );
            pricelistPrice = priceResult || line.price_unit;
          } catch (e) {
            console.warn('Errore calcolo prezzo listino:', e);
          }
        }

        // Verifica se prezzo è bloccato (da DB locale)
        let isLocked = false;
        let lockedNotes = null;

        try {
          const lockResult = await sql`
            SELECT is_locked, notes
            FROM order_price_locks
            WHERE odoo_order_line_id = ${line.id}
            ORDER BY created_at DESC
            LIMIT 1
          `;

          if (lockResult.rows.length > 0) {
            isLocked = lockResult.rows[0].is_locked;
            lockedNotes = lockResult.rows[0].notes;
          }
        } catch (e) {
          // Tabella non esiste o errore DB - continua senza blocco
          console.warn('Tabella order_price_locks non disponibile:', e);
        }

        return {
          id: line.id,
          product_id: line.product_id,
          product_name: Array.isArray(line.product_id)
            ? line.product_id[1]
            : line.name,
          product_code: product.default_code || null,
          quantity: line.product_uom_qty,
          uom_name: Array.isArray(line.product_uom)
            ? line.product_uom[1]
            : 'Unità',
          price_unit: line.price_unit,
          price_subtotal: line.price_subtotal,
          discount: line.discount || 0,
          tax_id: line.tax_id,
          pricelist_price: pricelistPrice,
          standard_price: product.list_price || 0,
          is_price_locked: isLocked,
          locked_notes: lockedNotes,
          image_url: product.image_128
            ? `data:image/png;base64,${product.image_128}`
            : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        name: order.name,
        state: order.state,
        partner_id: order.partner_id,
        partner_name: Array.isArray(order.partner_id)
          ? order.partner_id[1]
          : 'Cliente',
        date_order: order.date_order,
        amount_untaxed: order.amount_untaxed,
        amount_tax: order.amount_tax,
        amount_total: order.amount_total,
        pricelist_id: order.pricelist_id,
        currency_id: order.currency_id
      },
      lines: enrichedLines
    });

  } catch (error: any) {
    console.error('Error fetching order prices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nel recupero dei prezzi'
      },
      { status: 500 }
    );
  }
}
```

---

### 2. POST /api/catalogo-venditori/update-prices

**Scopo:** Aggiorna prezzi e sconti per le righe ordine specificate.

**Body:**
```typescript
{
  orderId: number,
  updates: [
    {
      lineId: number,           // sale.order.line ID
      price_unit?: number,      // Nuovo prezzo unitario
      discount?: number,        // Nuovo sconto %
      discount_fixed?: number   // Sconto fisso (alternativo a %)
    }
  ]
}
```

**Response:**
```typescript
{
  success: true,
  message: "Prezzi aggiornati con successo",
  updated_lines: number
}
```

**Implementazione:**
```typescript
// File: app/api/catalogo-venditori/update-prices/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface PriceUpdate {
  lineId: number;
  price_unit?: number;
  discount?: number;
  discount_fixed?: number;
}

interface UpdatePricesRequest {
  orderId: number;
  updates: PriceUpdate[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticazione
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: UpdatePricesRequest = await request.json();
    const { orderId, updates } = body;

    if (!orderId || !updates || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dati richiesta non validi' },
        { status: 400 }
      );
    }

    console.log(`📝 [UPDATE-PRICES] Updating ${updates.length} lines for order ${orderId}`);

    // 3. Verifica che ordine sia in stato DRAFT
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['state'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    if (orders[0].state !== 'draft') {
      return NextResponse.json(
        {
          success: false,
          error: 'Impossibile modificare prezzi: ordine già confermato'
        },
        { status: 409 }
      );
    }

    // 4. Aggiorna ogni riga ordine
    let updatedCount = 0;

    for (const update of updates) {
      const updateData: any = {};

      // Prezzo unitario
      if (update.price_unit !== undefined) {
        updateData.price_unit = update.price_unit;
      }

      // Sconto percentuale
      if (update.discount !== undefined) {
        updateData.discount = update.discount;
      }

      // Sconto fisso (calcola % equivalente)
      if (update.discount_fixed !== undefined && update.price_unit) {
        const discountPercent = (update.discount_fixed / update.price_unit) * 100;
        updateData.discount = Math.min(discountPercent, 100);
      }

      if (Object.keys(updateData).length > 0) {
        await callOdoo(
          cookies,
          'sale.order.line',
          'write',
          [[update.lineId], updateData],
          {}
        );
        updatedCount++;
        console.log(`✅ [UPDATE-PRICES] Updated line ${update.lineId}`);
      }
    }

    console.log(`✅ [UPDATE-PRICES] Updated ${updatedCount} order lines`);

    return NextResponse.json({
      success: true,
      message: 'Prezzi aggiornati con successo',
      updated_lines: updatedCount
    });

  } catch (error: any) {
    console.error('Error updating prices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nell\'aggiornamento dei prezzi'
      },
      { status: 500 }
    );
  }
}
```

---

### 3. POST /api/catalogo-venditori/confirm-order

**Scopo:** Conferma ordine (da DRAFT a SALE) e scrive nel Chatter.

**Body:**
```typescript
{
  orderId: number
}
```

**Response:**
```typescript
{
  success: true,
  message: "Ordine confermato con successo",
  orderId: number,
  orderName: string,
  newState: "sale"
}
```

**Implementazione:**
```typescript
// File: app/api/catalogo-venditori/confirm-order/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticazione
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // 2. Parse request
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId richiesto' },
        { status: 400 }
      );
    }

    console.log(`📝 [CONFIRM-ORDER] Confirming order ${orderId}`);

    // 3. Recupera username utente corrente
    const users = await callOdoo(
      cookies,
      'res.users',
      'search_read',
      [],
      {
        domain: [['id', '=', uid]],
        fields: ['name'],
        limit: 1
      }
    );

    const username = users?.[0]?.name || 'Utente';

    // 4. Verifica stato ordine
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['state', 'name'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    const order = orders[0];

    if (order.state !== 'draft') {
      return NextResponse.json(
        {
          success: false,
          error: `Ordine già nello stato: ${order.state}`
        },
        { status: 409 }
      );
    }

    // 5. Conferma ordine (action_confirm)
    console.log('✅ [CONFIRM-ORDER] Calling action_confirm...');

    await callOdoo(
      cookies,
      'sale.order',
      'action_confirm',
      [[orderId]],
      {}
    );

    console.log('✅ [CONFIRM-ORDER] Order confirmed');

    // 6. Scrivi nel Chatter
    try {
      const chatterMessage = `<p><strong>✅ Prezzi Confermati e Ordine Finalizzato</strong></p><p>Ordine confermato da <strong>${username}</strong> tramite Catalogo Venditori AI.</p><p><em>Data conferma: ${new Date().toLocaleString('it-IT')}</em></p>`;

      await callOdoo(
        cookies,
        'mail.message',
        'create',
        [{
          model: 'sale.order',
          res_id: orderId,
          body: chatterMessage,
          message_type: 'comment',
          subtype_id: 1, // mt_note (internal note)
        }],
        {}
      );

      console.log('✅ [CONFIRM-ORDER] Chatter message posted');
    } catch (chatterError: any) {
      console.warn('⚠️ [CONFIRM-ORDER] Failed to post Chatter message:', chatterError.message);
      // Continue anyway - order is confirmed
    }

    return NextResponse.json({
      success: true,
      message: 'Ordine confermato con successo',
      orderId: orderId,
      orderName: order.name,
      newState: 'sale'
    });

  } catch (error: any) {
    console.error('Error confirming order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nella conferma dell\'ordine'
      },
      { status: 500 }
    );
  }
}
```

---

## Campi Odoo Necessari

### Modello: sale.order

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | Integer | ID ordine |
| `name` | Char | Nome ordine (es. SO0123) |
| `state` | Selection | Stato: draft, sent, sale, done, cancel |
| `partner_id` | Many2one | Cliente (res.partner) |
| `date_order` | Datetime | Data ordine |
| `amount_untaxed` | Monetary | Imponibile |
| `amount_tax` | Monetary | IVA |
| `amount_total` | Monetary | Totale |
| `pricelist_id` | Many2one | Listino prezzi cliente |
| `currency_id` | Many2one | Valuta |
| `origin` | Char | Origine ordine |

### Modello: sale.order.line

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | Integer | ID riga ordine |
| `order_id` | Many2one | Ordine (sale.order) |
| `product_id` | Many2one | Prodotto (product.product) |
| `name` | Text | Descrizione prodotto |
| `product_uom_qty` | Float | Quantità |
| `product_uom` | Many2one | Unità di misura |
| `price_unit` | Monetary | Prezzo unitario |
| `price_subtotal` | Monetary | Subtotale |
| `discount` | Float | Sconto % |
| `tax_id` | Many2many | Tasse (account.tax) |

### Modello: product.pricelist

| Campo/Metodo | Tipo | Descrizione |
|--------------|------|-------------|
| `get_product_price()` | Method | Calcola prezzo prodotto per listino |

**Parametri metodo:**
```python
get_product_price(pricelist_id, product_id, quantity, partner_id)
```

### Modello: product.product

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | Integer | ID prodotto |
| `name` | Char | Nome prodotto |
| `default_code` | Char | Codice prodotto |
| `list_price` | Float | Prezzo di listino standard |
| `image_128` | Binary | Immagine 128x128 (base64) |

### Modello: mail.message

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `model` | Char | Modello target (es. 'sale.order') |
| `res_id` | Integer | ID record target |
| `body` | Html | Corpo messaggio |
| `message_type` | Selection | Tipo: email, comment, notification |
| `subtype_id` | Many2one | Sottotipo messaggio |

---

## UI/UX Design

### Pagina: `/catalogo-venditori/review-prices/[orderId]`

#### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header (Sticky)                                              │
│  [← Indietro]  Revisione Prezzi - SO0123      [🏠 Home]     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Info Ordine                                                  │
│  Cliente: ROSSI SRL                                         │
│  Ordine: SO0123                                             │
│  Data: 08/11/2025 14:30                                     │
│  Listino: Listino Standard                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Prodotto 1                                         [LOCKED] │
│  ┌───┐                                                      │
│  │IMG│  CARTA IGIENICA 10 ROTOLI                           │
│  └───┘  Cod: CART001                                       │
│                                                              │
│  Quantità: 50 PZ                                            │
│                                                              │
│  Prezzo Listino: €2.50     Prezzo Standard: €3.00          │
│  Prezzo Unitario: [€2.50]  (Bloccato - Prezzo contratto)   │
│                                                              │
│  Sconto %: [____10____]%   o   Sconto Fisso: [€0.25]       │
│                                                              │
│  Subtotale: €112.50  (dopo sconto 10%)                     │
│                                                              │
│  🔒 Prezzo bloccato - Contratto annuale cliente            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Prodotto 2                                                  │
│  ┌───┐                                                      │
│  │IMG│  DETERSIVO PAVIMENTI 5L                             │
│  └───┘  Cod: DET005                                        │
│                                                              │
│  Quantità: 20 PZ                                            │
│                                                              │
│  Prezzo Listino: €8.00     Prezzo Standard: €10.00         │
│  Prezzo Unitario: [€8.00]  ✏️ Modificabile                 │
│                                                              │
│  Sconto %: [____5_____]%   o   Sconto Fisso: [€0.40]       │
│                                                              │
│  Subtotale: €152.00  (dopo sconto 5%)                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Riepilogo Ordine                                            │
│                                                              │
│  Imponibile:    €264.50                                     │
│  IVA (22%):     €58.19                                      │
│  ───────────────────────                                    │
│  TOTALE:        €322.69                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│        [  ✅  CONFERMA PREZZI E FINALIZZA ORDINE  ]         │
└─────────────────────────────────────────────────────────────┘
```

#### Componenti UI

**1. Header Card**
```tsx
<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-white">
        Revisione Prezzi - {orderName}
      </h1>
      <p className="text-slate-400 mt-1">
        Cliente: {customerName} | Data: {formatDate(orderDate)}
      </p>
      {pricelistName && (
        <p className="text-emerald-400 text-sm mt-1">
          📋 Listino: {pricelistName}
        </p>
      )}
    </div>
    <button
      onClick={() => router.back()}
      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
    >
      ← Indietro
    </button>
  </div>
</div>
```

**2. Product Line Card**
```tsx
<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
  {/* Header con immagine e nome */}
  <div className="flex items-start gap-4 mb-4">
    {imageUrl ? (
      <img
        src={imageUrl}
        alt={productName}
        className="w-20 h-20 rounded-lg object-cover"
      />
    ) : (
      <div className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center">
        <PackageIcon className="w-10 h-10 text-slate-600" />
      </div>
    )}

    <div className="flex-1">
      <h3 className="text-xl font-bold text-white">
        {productName}
      </h3>
      {productCode && (
        <p className="text-sm text-slate-400">Cod: {productCode}</p>
      )}
      <p className="text-slate-300 mt-1">
        Quantità: <strong>{quantity} {uomName}</strong>
      </p>
    </div>

    {isLocked && (
      <div className="bg-red-500/20 border border-red-500 rounded-lg px-3 py-1">
        <span className="text-red-400 text-sm font-semibold">
          🔒 BLOCCATO
        </span>
      </div>
    )}
  </div>

  {/* Prezzi */}
  <div className="grid grid-cols-2 gap-4 mb-4">
    <div className="bg-slate-900 rounded-lg p-3">
      <p className="text-xs text-slate-400 mb-1">Prezzo Listino</p>
      <p className="text-lg font-bold text-emerald-400">
        €{pricelistPrice.toFixed(2)}
      </p>
    </div>
    <div className="bg-slate-900 rounded-lg p-3">
      <p className="text-xs text-slate-400 mb-1">Prezzo Standard</p>
      <p className="text-lg font-bold text-slate-300">
        €{standardPrice.toFixed(2)}
      </p>
    </div>
  </div>

  {/* Prezzo unitario corrente */}
  <div className="mb-4">
    <label className="text-sm text-slate-400 mb-2 block">
      Prezzo Unitario {isLocked ? '(Bloccato)' : '(Modificabile)'}
    </label>
    <input
      type="number"
      step="0.01"
      value={priceUnit}
      onChange={(e) => onPriceChange(parseFloat(e.target.value))}
      disabled={isLocked}
      className={`w-full px-4 py-3 rounded-lg text-white text-lg font-bold ${
        isLocked
          ? 'bg-slate-900 cursor-not-allowed opacity-60'
          : 'bg-slate-900 border border-slate-700 focus:border-emerald-500'
      }`}
    />
  </div>

  {/* Sconti */}
  <div className="grid grid-cols-2 gap-4 mb-4">
    <div>
      <label className="text-sm text-slate-400 mb-2 block">
        Sconto %
      </label>
      <input
        type="number"
        step="0.1"
        min="0"
        max="100"
        value={discountPercent}
        onChange={(e) => onDiscountPercentChange(parseFloat(e.target.value))}
        disabled={isLocked}
        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-emerald-500"
      />
    </div>
    <div>
      <label className="text-sm text-slate-400 mb-2 block">
        o Sconto Fisso €
      </label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={discountFixed}
        onChange={(e) => onDiscountFixedChange(parseFloat(e.target.value))}
        disabled={isLocked}
        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-emerald-500"
      />
    </div>
  </div>

  {/* Subtotale */}
  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <span className="text-slate-300 font-semibold">
        Subtotale riga
      </span>
      <span className="text-2xl font-bold text-emerald-400">
        €{calculateSubtotal().toFixed(2)}
      </span>
    </div>
    {discountPercent > 0 && (
      <p className="text-xs text-slate-400 mt-1">
        (Sconto {discountPercent}% applicato)
      </p>
    )}
  </div>

  {/* Note blocco prezzo */}
  {isLocked && lockedNotes && (
    <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
      <p className="text-sm text-yellow-400">
        🔒 <strong>Motivo blocco:</strong> {lockedNotes}
      </p>
    </div>
  )}
</div>
```

**3. Summary Card**
```tsx
<div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border-2 border-emerald-500/30 shadow-2xl">
  <h2 className="text-xl font-bold text-white mb-4">
    📊 Riepilogo Ordine
  </h2>

  <div className="space-y-3">
    <div className="flex items-center justify-between text-slate-300">
      <span>Imponibile:</span>
      <span className="font-semibold">€{amountUntaxed.toFixed(2)}</span>
    </div>

    <div className="flex items-center justify-between text-slate-300">
      <span>IVA:</span>
      <span className="font-semibold">€{amountTax.toFixed(2)}</span>
    </div>

    <div className="border-t border-slate-700 pt-3 mt-3">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-white">TOTALE:</span>
        <span className="text-3xl font-bold text-emerald-400">
          €{amountTotal.toFixed(2)}
        </span>
      </div>
    </div>
  </div>

  <p className="text-xs text-slate-400 mt-4 text-center">
    I totali si aggiorneranno automaticamente dopo la conferma
  </p>
</div>
```

**4. Confirm Button**
```tsx
<button
  onClick={handleConfirmPrices}
  disabled={isConfirming || hasValidationErrors}
  className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-3 transition-all ${
    isConfirming || hasValidationErrors
      ? 'bg-slate-700 cursor-not-allowed opacity-60'
      : 'bg-gradient-to-r from-emerald-500 to-blue-500 hover:shadow-xl hover:scale-105 active:scale-95'
  }`}
>
  {isConfirming ? (
    <>
      <Loader2 className="w-6 h-6 animate-spin" />
      <span>Conferma in corso...</span>
    </>
  ) : (
    <>
      <CheckCircle className="w-6 h-6" />
      <span>Conferma Prezzi e Finalizza Ordine</span>
    </>
  )}
</button>

{hasValidationErrors && (
  <div className="mt-3 bg-red-500/20 border border-red-500 rounded-lg p-3">
    <p className="text-sm text-red-400">
      ⚠️ Alcuni prezzi non sono validi. Controlla i campi evidenziati.
    </p>
  </div>
)}
```

#### Responsive Design

**Mobile (<640px):**
- Griglia 1 colonna
- Prezzi listino/standard impilati verticalmente
- Campi sconto impilati verticalmente
- Pulsante conferma fisso in basso (sticky)

**Tablet (640px-1024px):**
- Griglia 2 colonne per prezzi
- Campi sconto affiancati
- Layout più arioso

**Desktop (>1024px):**
- Layout massimo 1200px centrato
- Spaziatura generosa
- Sidebar con riepilogo sempre visibile (opzionale)

---

## Logica di Business

### 1. Calcolo Prezzi

**Priorità prezzi:**
1. **Prezzo bloccato** (se presente in `order_price_locks`)
2. **Prezzo da listino cliente** (se cliente ha listino configurato)
3. **Prezzo standard** (list_price del prodotto)

**Pseudo-codice:**
```typescript
function calculateFinalPrice(line: OrderLine): number {
  // 1. Se prezzo bloccato, usa quello
  if (line.is_price_locked && line.locked_price) {
    return line.locked_price;
  }

  // 2. Se esiste listino cliente, usa quello
  if (line.pricelist_price && line.pricelist_price > 0) {
    return line.pricelist_price;
  }

  // 3. Altrimenti usa prezzo standard
  return line.standard_price;
}
```

### 2. Applicazione Sconti

**Regole:**
- Se sconto % è inserito, applica quello (priorità)
- Se sconto fisso è inserito, converti in % equivalente
- Sconto max: 100%
- Sconto min: 0%

**Pseudo-codice:**
```typescript
function applyDiscount(
  priceUnit: number,
  discountPercent?: number,
  discountFixed?: number
): { finalPrice: number; discount: number } {
  let discount = 0;

  // Priorità a sconto %
  if (discountPercent !== undefined && discountPercent > 0) {
    discount = Math.min(Math.max(discountPercent, 0), 100);
  }
  // Altrimenti usa sconto fisso
  else if (discountFixed !== undefined && discountFixed > 0) {
    discount = Math.min((discountFixed / priceUnit) * 100, 100);
  }

  const finalPrice = priceUnit * (1 - discount / 100);

  return { finalPrice, discount };
}
```

### 3. Validazione Input

**Regole validazione:**
- Prezzo unitario > 0
- Sconto % tra 0 e 100
- Sconto fisso >= 0
- Sconto fisso < prezzo unitario
- Prezzi bloccati non modificabili

**Pseudo-codice:**
```typescript
function validateLine(line: OrderLine): ValidationError[] {
  const errors: ValidationError[] = [];

  if (line.price_unit <= 0) {
    errors.push({ field: 'price_unit', message: 'Prezzo deve essere > 0' });
  }

  if (line.discount < 0 || line.discount > 100) {
    errors.push({ field: 'discount', message: 'Sconto % tra 0 e 100' });
  }

  if (line.discount_fixed && line.discount_fixed >= line.price_unit) {
    errors.push({
      field: 'discount_fixed',
      message: 'Sconto fisso deve essere < prezzo unitario'
    });
  }

  return errors;
}
```

### 4. Conferma Ordine

**Sequenza operazioni:**
1. Valida tutti i prezzi inseriti
2. Aggiorna prezzi e sconti di tutte le righe ordine (API update-prices)
3. Conferma ordine (action_confirm) - cambia stato da 'draft' a 'sale'
4. Scrivi messaggio nel Chatter con dettagli conferma
5. Redirect a pagina successo o dashboard

**Pseudo-codice:**
```typescript
async function confirmOrder(orderId: number, updates: PriceUpdate[]) {
  // 1. Valida
  const validationErrors = updates.flatMap(u => validateLine(u));
  if (validationErrors.length > 0) {
    throw new ValidationError('Alcuni prezzi non sono validi');
  }

  // 2. Aggiorna prezzi
  const updateResult = await fetch('/api/catalogo-venditori/update-prices', {
    method: 'POST',
    body: JSON.stringify({ orderId, updates })
  });

  if (!updateResult.ok) {
    throw new Error('Errore aggiornamento prezzi');
  }

  // 3. Conferma ordine
  const confirmResult = await fetch('/api/catalogo-venditori/confirm-order', {
    method: 'POST',
    body: JSON.stringify({ orderId })
  });

  if (!confirmResult.ok) {
    throw new Error('Errore conferma ordine');
  }

  // 4. Redirect
  router.push(`/catalogo-venditori/success?order=${orderId}`);
}
```

---

## Implementazione Step-by-Step

### Step 1: Setup Database (Opzionale)

Se si vuole supportare il blocco prezzi:

```bash
# Esegui migration
psql $DATABASE_URL << EOF
CREATE TABLE order_price_locks (
  id SERIAL PRIMARY KEY,
  odoo_order_id INTEGER NOT NULL,
  odoo_order_line_id INTEGER NOT NULL,
  odoo_product_id INTEGER NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_price NUMERIC(10, 2),
  locked_by_uid INTEGER,
  locked_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_price_locks_order ON order_price_locks(odoo_order_id);
CREATE INDEX idx_order_price_locks_line ON order_price_locks(odoo_order_line_id);
CREATE INDEX idx_order_price_locks_product ON order_price_locks(odoo_product_id);
EOF
```

### Step 2: Crea API Endpoints

```bash
# Crea le cartelle
mkdir -p app/api/catalogo-venditori/order-prices/[orderId]
mkdir -p app/api/catalogo-venditori/update-prices
mkdir -p app/api/catalogo-venditori/confirm-order

# Crea i file (usa il codice fornito sopra nelle sezioni API)
# - order-prices/[orderId]/route.ts
# - update-prices/route.ts
# - confirm-order/route.ts
```

### Step 3: Crea Pagina UI

```bash
# Crea cartella pagina
mkdir -p app/catalogo-venditori/review-prices/[orderId]

# Crea componenti
touch app/catalogo-venditori/review-prices/[orderId]/page.tsx
touch app/catalogo-venditori/review-prices/components/ProductLineCard.tsx
touch app/catalogo-venditori/review-prices/components/OrderSummary.tsx
touch app/catalogo-venditori/review-prices/components/ConfirmButton.tsx
```

**File:** `app/catalogo-venditori/review-prices/[orderId]/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import ProductLineCard from '../components/ProductLineCard';
import OrderSummary from '../components/OrderSummary';
import ConfirmButton from '../components/ConfirmButton';

interface OrderLine {
  id: number;
  product_id: [number, string];
  product_name: string;
  product_code: string | null;
  quantity: number;
  uom_name: string;
  price_unit: number;
  price_subtotal: number;
  discount: number;
  pricelist_price: number;
  standard_price: number;
  is_price_locked: boolean;
  locked_notes: string | null;
  image_url: string | null;
}

interface Order {
  id: number;
  name: string;
  state: string;
  partner_name: string;
  date_order: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  pricelist_id: [number, string] | null;
}

export default function ReviewPricesPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [priceUpdates, setPriceUpdates] = useState<Map<number, any>>(new Map());
  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch order data
  useEffect(() => {
    if (!orderId) return;

    const fetchOrderData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/catalogo-venditori/order-prices/${orderId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Errore nel caricamento dati ordine');
        }

        setOrder(data.order);
        setLines(data.lines);
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(err.message || 'Errore nel caricamento ordine');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId]);

  // Handle price change for a line
  const handlePriceChange = (lineId: number, field: string, value: number) => {
    setPriceUpdates(prev => {
      const updated = new Map(prev);
      const current = updated.get(lineId) || {};
      updated.set(lineId, { ...current, lineId, [field]: value });
      return updated;
    });
  };

  // Calculate total with updates
  const calculateUpdatedTotal = () => {
    let total = 0;
    lines.forEach(line => {
      const update = priceUpdates.get(line.id);
      const priceUnit = update?.price_unit ?? line.price_unit;
      const discount = update?.discount ?? line.discount;
      const subtotal = priceUnit * line.quantity * (1 - discount / 100);
      total += subtotal;
    });
    return total;
  };

  // Confirm prices and finalize order
  const handleConfirmPrices = async () => {
    try {
      setIsConfirming(true);
      setError(null);

      // 1. Update prices if there are changes
      if (priceUpdates.size > 0) {
        const updates = Array.from(priceUpdates.values());

        const updateResponse = await fetch('/api/catalogo-venditori/update-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: parseInt(orderId),
            updates
          })
        });

        const updateData = await updateResponse.json();
        if (!updateData.success) {
          throw new Error(updateData.error || 'Errore aggiornamento prezzi');
        }

        console.log(`✅ Aggiornati ${updateData.updated_lines} righe`);
      }

      // 2. Confirm order
      const confirmResponse = await fetch('/api/catalogo-venditori/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: parseInt(orderId)
        })
      });

      const confirmData = await confirmResponse.json();
      if (!confirmData.success) {
        throw new Error(confirmData.error || 'Errore conferma ordine');
      }

      console.log('✅ Ordine confermato:', confirmData.orderName);

      // 3. Redirect to success page
      router.push(`/catalogo-venditori/success?order=${confirmData.orderName}`);

    } catch (err: any) {
      console.error('Error confirming order:', err);
      setError(err.message || 'Errore nella conferma ordine');
    } finally {
      setIsConfirming(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Caricamento dati ordine...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 text-center mb-2">
            Errore
          </h2>
          <p className="text-red-300 text-center mb-4">{error || 'Ordine non trovato'}</p>
          <button
            onClick={() => router.push('/catalogo-venditori')}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            Torna al Catalogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Indietro</span>
            </button>

            <h1 className="text-2xl font-bold text-white">
              Revisione Prezzi - {order.name}
            </h1>

            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-colors"
            >
              <Home className="h-5 w-5" />
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24">
        {/* Order Info Card */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">
                {order.partner_name}
              </h2>
              <p className="text-slate-400">
                Ordine: <strong className="text-white">{order.name}</strong> |
                Data: <strong className="text-white">{new Date(order.date_order).toLocaleDateString('it-IT')}</strong>
              </p>
              {order.pricelist_id && (
                <p className="text-emerald-400 text-sm mt-1">
                  📋 Listino: {order.pricelist_id[1]}
                </p>
              )}
            </div>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-2">
              <p className="text-blue-400 text-sm font-semibold">
                Stato: {order.state.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Product Lines */}
        <div className="space-y-4 mb-6">
          {lines.map((line) => (
            <ProductLineCard
              key={line.id}
              line={line}
              onPriceChange={(field, value) => handlePriceChange(line.id, field, value)}
              currentUpdate={priceUpdates.get(line.id)}
            />
          ))}
        </div>

        {/* Order Summary */}
        <OrderSummary
          originalTotal={order.amount_total}
          updatedTotal={calculateUpdatedTotal()}
          amountUntaxed={order.amount_untaxed}
          amountTax={order.amount_tax}
        />

        {/* Confirm Button */}
        <div className="mt-6">
          <ConfirmButton
            onClick={handleConfirmPrices}
            isConfirming={isConfirming}
            disabled={order.state !== 'draft'}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-500/20 border-2 border-red-500 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-red-400 mb-1">Errore</h3>
                <p className="text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

### Step 4: Modifica `create-order` API

Modifica il file `app/api/catalogo-venditori/create-order/route.ts` per fare redirect invece di mostrare successo:

```typescript
// Dopo aver creato l'ordine, invece di ritornare il successo:
return NextResponse.json({
  success: true,
  message: 'Ordine creato - redirect alla revisione prezzi',
  orderId: odooOrderId,
  orderName: orderName,
  redirectTo: `/catalogo-venditori/review-prices/${odooOrderId}` // NUOVO
});
```

### Step 5: Modifica componente SmartCart

Nel file `app/catalogo-venditori/components/SmartCart.tsx`, modifica il pulsante:

```tsx
// Cambia il testo del pulsante da "Conferma Ordine" a "Conferma Carrello"
<span>Conferma Carrello</span>
```

### Step 6: Modifica pagina principale

Nel file `app/catalogo-venditori/page.tsx`, modifica `handleConfirmOrder`:

```tsx
const handleConfirmOrder = async () => {
  // ... codice esistente ...

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Errore nella creazione dell\'ordine');
  }

  // NUOVO: Redirect alla pagina review-prices invece di mostrare successo
  if (data.redirectTo) {
    router.push(data.redirectTo);
  } else {
    // Fallback: redirect manuale
    router.push(`/catalogo-venditori/review-prices/${data.orderId}`);
  }
};
```

### Step 7: Crea pagina successo (opzionale)

```bash
touch app/catalogo-venditori/success/page.tsx
```

```tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Home, FileText } from 'lucide-react';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderName = searchParams?.get('order');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-green-500/20 border-2 border-green-500 rounded-xl p-8 max-w-md w-full text-center">
        <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4 animate-bounce" />

        <h1 className="text-3xl font-bold text-green-400 mb-2">
          Ordine Confermato!
        </h1>

        {orderName && (
          <p className="text-xl text-green-300 mb-6">
            Ordine <strong>{orderName}</strong> creato con successo
          </p>
        )}

        <p className="text-slate-300 mb-8">
          L'ordine è stato confermato e inviato al sistema.
          Riceverai una notifica quando sarà processato.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/catalogo-venditori')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-bold rounded-lg hover:shadow-xl transition-all"
          >
            <FileText className="w-5 h-5" />
            <span>Nuovo Ordine</span>
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Torna alla Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Testing e Validazione

### Test Case 1: Flusso Completo Happy Path

**Steps:**
1. Login come venditore
2. Vai a Catalogo Venditori
3. Seleziona cliente "ROSSI SRL"
4. Aggiungi 3 prodotti al carrello
5. Clicca "Conferma Carrello"
6. Verifica redirect a `/catalogo-venditori/review-prices/[orderId]`
7. Verifica che i prezzi da listino cliente siano visualizzati
8. Applica sconto 10% al primo prodotto
9. Applica sconto fisso €5 al secondo prodotto
10. Lascia terzo prodotto invariato
11. Clicca "Conferma Prezzi e Finalizza Ordine"
12. Verifica redirect a pagina successo
13. Verifica in Odoo che ordine sia nello stato "sale"
14. Verifica nel Chatter il messaggio di conferma

**Expected Result:**
- Tutti i passaggi completati senza errori
- Ordine confermato in Odoo
- Prezzi e sconti applicati correttamente
- Messaggio Chatter presente

### Test Case 2: Prezzo Bloccato

**Setup:**
```sql
INSERT INTO order_price_locks (
  odoo_order_id,
  odoo_order_line_id,
  odoo_product_id,
  is_locked,
  locked_price,
  notes
) VALUES (
  123,
  456,
  789,
  true,
  2.50,
  'Prezzo contrattuale vincolante'
);
```

**Steps:**
1. Crea ordine con prodotto ID 789
2. Vai a review-prices
3. Verifica che campo prezzo sia disabilitato
4. Verifica presenza badge "BLOCCATO"
5. Verifica visualizzazione note blocco
6. Tenta di modificare prezzo (dovrebbe essere impossibile)
7. Conferma ordine

**Expected Result:**
- Campo prezzo non modificabile
- Badge e note visibili
- Ordine confermato con prezzo bloccato

### Test Case 3: Validazione Errori

**Steps:**
1. Crea ordine
2. Vai a review-prices
3. Inserisci prezzo unitario negativo (-10)
4. Inserisci sconto % 150
5. Inserisci sconto fisso maggiore di prezzo unitario
6. Clicca "Conferma Prezzi"

**Expected Result:**
- Pulsante conferma disabilitato
- Messaggi di errore visualizzati per ogni campo non valido
- Impossibile procedere fino a correzione errori

### Test Case 4: Ordine già Confermato

**Steps:**
1. Crea e conferma ordine manualmente in Odoo (stato = "sale")
2. Prova ad accedere a `/catalogo-venditori/review-prices/[orderId]`
3. Verifica messaggio errore

**Expected Result:**
- Errore: "Ordine già confermato - impossibile modificare prezzi"
- Link per tornare al catalogo

### Test Case 5: Performance con Molte Righe

**Steps:**
1. Crea ordine con 50+ prodotti
2. Vai a review-prices
3. Misura tempo di caricamento
4. Applica sconti multipli
5. Conferma ordine
6. Misura tempo di conferma

**Expected Result:**
- Caricamento < 3 secondi
- UI responsive durante scrolling
- Conferma completata < 10 secondi
- Nessun timeout o errore

---

## Conclusioni

### Benefici della Soluzione

1. **Controllo Totale sui Prezzi**: Il venditore può rivedere e modificare ogni prezzo prima di confermare
2. **Trasparenza**: Visualizzazione chiara di prezzo listino vs prezzo standard
3. **Flessibilità**: Supporto per sconti % e fissi
4. **Sicurezza**: Prezzi bloccati per contratti speciali
5. **Tracciabilità**: Ogni modifica registrata nel Chatter Odoo

### Tempi Stimati di Implementazione

| Task | Ore Stimate |
|------|-------------|
| Setup Database | 1h |
| API order-prices | 3h |
| API update-prices | 2h |
| API confirm-order | 2h |
| UI Page Component | 4h |
| ProductLineCard Component | 3h |
| OrderSummary Component | 1h |
| Integration & Testing | 4h |
| **TOTALE** | **20h** |

### Priorità Features

**Must Have (MVP):**
- ✅ Visualizzazione prezzi da listino
- ✅ Modifica prezzi e sconti
- ✅ Conferma ordine
- ✅ Messaggio Chatter

**Should Have (v1.1):**
- ⏳ Blocco prezzi da DB
- ⏳ Validazione avanzata
- ⏳ Cronologia modifiche prezzi

**Nice to Have (v2.0):**
- 💡 Suggerimenti AI per sconti ottimali
- 💡 Comparazione prezzi concorrenza
- 💡 Promozioni automatiche
- 💡 Export PDF preventivo

---

**Fine Documento**

Versione: 1.0
Autore: Sistema di Design AI
Data: 2025-11-08
