# Scadenze Transfer to Waste API

API endpoint per trasferire prodotti scaduti o in scadenza alla location "MERCE DETERIORATA" (Scarti).

## Endpoint

```
POST /api/scadenze/transfer
```

## Request Body

```typescript
interface TransferToWasteRequest {
  productId: number;           // ID del prodotto in Odoo (obbligatorio)
  lotId: number;              // ID del lotto in Odoo (obbligatorio)
  sourceLocationId: number;   // ID della location di origine (obbligatorio)
  quantity: number;           // Quantità da trasferire (obbligatorio)
  reason: string;             // Motivo del trasferimento (opzionale)
}
```

## Response

```typescript
interface TransferToWasteResponse {
  success: boolean;
  pickingId?: number;         // ID del picking creato in Odoo
  moveId?: number;           // ID del movimento creato in Odoo
  error?: string;            // Messaggio di errore se success=false
}
```

## Destinazione

La location di destinazione è **hardcoded**:
- **ID**: 648
- **Nome**: "MERCE DETERIORATA"

Questa è la location degli scarti in Odoo.

## Flusso Operativo

L'endpoint esegue automaticamente le seguenti operazioni in Odoo:

1. **Autenticazione**: Verifica la sessione Odoo attiva
2. **Validazione parametri**: Controlla che tutti i parametri obbligatori siano presenti
3. **Ricerca picking type**: Trova il picking type "internal" per trasferimenti interni
4. **Verifica lotto**: Controlla che il lotto esista ed sia associato al prodotto
5. **Creazione stock.picking**: Crea un nuovo picking con:
   - `picking_type_id`: ID del tipo "internal"
   - `location_id`: sourceLocationId (origine)
   - `location_dest_id`: 648 (MERCE DETERIORATA)
   - `origin`: "SCADENZE-SCARTI: {reason}" o "SCADENZE-SCARTI-{timestamp}"
6. **Creazione stock.move**: Crea il movimento di magazzino
7. **Creazione stock.move.line**: Crea la linea con **lot_id** specificato
8. **Conferma picking**: Esegue `action_confirm()` sul picking
9. **Validazione picking**: Esegue `button_validate()` per completare il trasferimento

## Esempi di Utilizzo

### Esempio 1: Prodotto scaduto

```bash
curl -X POST http://localhost:3000/api/scadenze/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 12345,
    "lotId": 67890,
    "sourceLocationId": 150,
    "quantity": 5,
    "reason": "Prodotto scaduto"
  }'
```

### Esempio 2: Scadenza imminente

```bash
curl -X POST http://localhost:3000/api/scadenze/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 12345,
    "lotId": 67890,
    "sourceLocationId": 150,
    "quantity": 10,
    "reason": "Scadenza tra 2 giorni - rimozione preventiva"
  }'
```

### Esempio 3: Confezione danneggiata

```bash
curl -X POST http://localhost:3000/api/scadenze/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 12345,
    "lotId": 67890,
    "sourceLocationId": 150,
    "quantity": 3,
    "reason": "Confezione danneggiata"
  }'
```

## Gestione Errori

L'endpoint gestisce diversi tipi di errori con try/catch dettagliati:

### Errori di validazione (400)
- Parametri mancanti (productId, sourceLocationId, quantity)
- Lotto mancante (lotId obbligatorio)

### Errori di autenticazione (401)
- Sessione Odoo non valida

### Errori Odoo (500)
- Picking type "internal" non trovato
- Lotto non trovato o non associato al prodotto
- Errori nella creazione del picking
- Errori nella creazione del movimento
- Errori nella creazione della linea di movimento
- Errori nella conferma del picking
- Errori nella validazione del picking

Ogni errore Odoo include dettagli specifici dal messaggio di errore restituito da Odoo.

## Logging

L'endpoint produce log dettagliati per debugging:

```
🗑️ Trasferimento a scarti: { productId, lotId, from, to, qty, reason }
✅ Picking type interno trovato: {pickingTypeId}
✅ Lotto verificato: {lotName}
✅ Picking creato: {pickingId}
✅ Move creato: {moveId}
✅ Move line creata con lotto: {lotId}
✅ Picking confermato
✅ Picking validato - trasferimento a scarti completato
```

In caso di errore:
```
❌ Errore Odoo (fase): {error details}
❌ Errore trasferimento a scarti: {error message}
```

## Integrazione con Frontend

### React/Next.js Component

```typescript
import type { TransferToWasteRequest, TransferToWasteResponse } from '@/lib/types/expiry';

async function transferToWaste(
  productId: number,
  lotId: number,
  sourceLocationId: number,
  quantity: number,
  reason: string
): Promise<TransferToWasteResponse> {
  const request: TransferToWasteRequest = {
    productId,
    lotId,
    sourceLocationId,
    quantity,
    reason
  };

  const response = await fetch('/api/scadenze/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  const data: TransferToWasteResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Errore nel trasferimento');
  }

  return data;
}

// Uso nel componente
const handleTransfer = async () => {
  try {
    setLoading(true);
    const result = await transferToWaste(
      product.id,
      product.lotId!,
      product.locationId,
      product.quantity,
      'Prodotto scaduto'
    );

    toast.success(`Prodotto trasferito a scarti (Picking: ${result.pickingId})`);
    refreshData();
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};
```

## Differenze con /api/ubicazioni/transfer

| Caratteristica | /api/ubicazioni/transfer | /api/scadenze/transfer |
|---------------|-------------------------|------------------------|
| Destinazione | Parametro `destLocationId` | Hardcoded: 648 (MERCE DETERIORATA) |
| Lotto | Opzionale (dipende dal tracking) | **Obbligatorio** sempre |
| Origin | `WEB-UBICAZIONI-{timestamp}` | `SCADENZE-SCARTI: {reason}` |
| Use case | Spostamenti generici | Gestione prodotti scaduti/in scadenza |
| Reason | Non previsto | Campo dedicato per motivazione |

## Note Tecniche

- **Location ID hardcoded**: La location "MERCE DETERIORATA" (ID: 648) è hardcoded nel codice. Se cambia in produzione, aggiornare la costante `WASTE_LOCATION_ID`.
- **Lotto obbligatorio**: Questo endpoint richiede sempre un `lotId` perché i prodotti con scadenza hanno sempre tracking attivo.
- **Transazione atomica**: Tutte le operazioni vengono eseguite in sequenza. Se una fallisce, le precedenti rimangono in Odoo (non c'è rollback automatico).
- **Unità di misura**: Il campo `product_uom` è hardcoded a `1` (unità base). Per UoM diverse, modificare il codice.

## Sicurezza

- Richiede sessione Odoo valida
- Non esegue validazioni sul valore di `quantity` (può essere negativo in teoria)
- Non verifica la disponibilità del prodotto nella location di origine
- Non controlla i permessi utente in Odoo (delegato a Odoo stesso)

## TODO / Miglioramenti Futuri

- [ ] Aggiungere validazione della quantità (>0)
- [ ] Verificare disponibilità stock prima del trasferimento
- [ ] Supportare batch transfer (array di prodotti)
- [ ] Aggiungere campo `notes` per note addizionali
- [ ] Creare scrap order automatico dopo il trasferimento
- [ ] Inviare notifica email dopo trasferimenti importanti
- [ ] Logging su database dei trasferimenti effettuati
- [ ] API per consultare storico trasferimenti a scarti
