# Differenze tra /api/ubicazioni/transfer e /api/scadenze/transfer

Questo documento evidenzia le differenze tra i due endpoint di trasferimento.

## Differenze Principali

### 1. Parametri Request

**ubicazioni/transfer**:
```typescript
{
  productId: number;
  sourceLocationId: number;
  destLocationId: number;        // ← Parametro richiesto
  quantity: number;
  lotName?: string;              // ← Nome lotto (opzionale)
  lotId?: number;
  expiryDate?: string;
  isFromCatalog?: boolean;
}
```

**scadenze/transfer**:
```typescript
{
  productId: number;
  sourceLocationId: number;
  // destLocationId: RIMOSSO      ← Hardcoded a 648
  quantity: number;
  lotId: number;                 // ← OBBLIGATORIO (non opzionale)
  reason?: string;               // ← NUOVO: motivo trasferimento
}
```

### 2. Destinazione

| Endpoint | Destinazione |
|----------|-------------|
| ubicazioni/transfer | Parametro `destLocationId` (flessibile) |
| scadenze/transfer | **Hardcoded**: `WASTE_LOCATION_ID = 648` (MERCE DETERIORATA) |

### 3. Gestione Lotto

**ubicazioni/transfer**:
- Lotto opzionale (dipende dal tracking del prodotto)
- Supporta creazione lotto se `isFromCatalog=true`
- Può trasferire prodotti senza lotto

**scadenze/transfer**:
- Lotto **sempre obbligatorio** (`lotId` required)
- Non crea nuovi lotti (devono già esistere)
- Valida che il lotto esista e sia associato al prodotto

### 4. Origin del Picking

**ubicazioni/transfer**:
```typescript
origin: `WEB-UBICAZIONI-${Date.now()}`
```

**scadenze/transfer**:
```typescript
origin: reason
  ? `SCADENZE-SCARTI: ${reason} - ${Date.now()}`
  : `SCADENZE-SCARTI-${Date.now()}`
```

### 5. Validazioni

**ubicazioni/transfer**:
```typescript
// Validazione base
if (!productId || !sourceLocationId || !destLocationId || !quantity) {
  return 400;
}

// Validazione tracking
if (hasTracking && !lotName) {
  return 400 - "Lotto obbligatorio";
}

// Validazione scadenza se da catalogo
if (isFromCatalog && lotName && !expiryDate) {
  return 400 - "Scadenza obbligatoria";
}
```

**scadenze/transfer**:
```typescript
// Validazione base
if (!productId || !sourceLocationId || !quantity) {
  return 400;
}

// Validazione lotto (sempre obbligatorio)
if (!lotId) {
  return 400 - "lotId obbligatorio";
}
```

### 6. Logging

**ubicazioni/transfer**:
```typescript
console.log('🚚 Trasferimento interno:', {...});
console.log('✅ Picking validato - trasferimento completato');
```

**scadenze/transfer**:
```typescript
console.log('🗑️ Trasferimento a scarti:', {...});
console.log('✅ Picking validato - trasferimento a scarti completato');
```

### 7. Response Type

**Entrambi restituiscono**:
```typescript
{
  success: boolean;
  pickingId?: number;
  moveId?: number;
  error?: string;
}
```

Ma hanno tipi diversi:
- ubicazioni: tipo implicito (non esportato)
- scadenze: `TransferToWasteResponse` (da `/lib/types/expiry.ts`)

## Logica Odoo Identica

Entrambi eseguono la stessa sequenza di operazioni Odoo:

1. ✅ Ottieni picking type 'internal'
2. ✅ Verifica/crea lotto (ubicazioni) o verifica lotto (scadenze)
3. ✅ Crea stock.picking
4. ✅ Crea stock.move
5. ✅ Crea stock.move.line con lot_id
6. ✅ Conferma picking (action_confirm)
7. ✅ Valida picking (button_validate)

## Gestione Errori

**Entrambi** hanno gestione errori dettagliata con try/catch che cattura:
- Errori di autenticazione (401)
- Errori di validazione (400)
- Errori Odoo specifici (500)
- Logging dettagliato con emoji per debugging

## Use Cases

### Usa ubicazioni/transfer quando:
- Devi spostare prodotti tra ubicazioni generiche
- La destinazione può variare
- Devi creare nuovi lotti
- Gestisci prodotti senza lotto (non tracciati)

### Usa scadenze/transfer quando:
- Devi spostare prodotti alla location scarti
- Il prodotto ha già un lotto esistente
- Vuoi tracciare il motivo del trasferimento
- Gestisci prodotti scaduti o in scadenza

## Codice Condiviso

Entrambi condividono:
- `getOdooSessionId()` da `@/lib/odoo/odoo-helper`
- Stessa struttura delle chiamate Odoo RPC
- Stessi field nei model Odoo
- Stesso flusso di creazione picking → move → move.line

## Possibili Refactoring

Per ridurre duplicazione, si potrebbe creare:

```typescript
// lib/odoo/transfer-service.ts
export async function executeInternalTransfer({
  sessionId,
  productId,
  sourceLocationId,
  destLocationId,
  quantity,
  lotId,
  origin
}: TransferParams) {
  // ... logica condivisa ...
}
```

E poi chiamarlo da entrambi gli endpoint con parametri specifici.
