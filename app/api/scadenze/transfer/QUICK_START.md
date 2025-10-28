# Quick Start Guide - /api/scadenze/transfer

Guida rapida per utilizzare l'endpoint di trasferimento a scarti.

## 📦 Endpoint

```
POST /api/scadenze/transfer
```

## 🚀 Utilizzo Rapido

### 1. Request Base

```typescript
const response = await fetch('/api/scadenze/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 12345,
    lotId: 67890,
    sourceLocationId: 150,
    quantity: 5,
    reason: 'Prodotto scaduto'  // Opzionale
  })
});

const data = await response.json();

if (data.success) {
  console.log('✅ Picking:', data.pickingId);
} else {
  console.error('❌ Errore:', data.error);
}
```

### 2. Con Hook Custom

```typescript
import { useTransferToWaste } from './EXAMPLE_USAGE';

function MyComponent({ product }) {
  const { transferToWaste, isTransferring } = useTransferToWaste();

  const handleTransfer = async () => {
    try {
      await transferToWaste(product, 'Prodotto scaduto');
      toast.success('Trasferito!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <button onClick={handleTransfer} disabled={isTransferring}>
      Trasferisci a Scarti
    </button>
  );
}
```

## 📋 Parametri Obbligatori

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `productId` | number | ID del prodotto in Odoo |
| `lotId` | number | ID del lotto (OBBLIGATORIO) |
| `sourceLocationId` | number | ID location di origine |
| `quantity` | number | Quantità da trasferire |

## 🎯 Parametri Opzionali

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `reason` | string | Motivo del trasferimento |

## 📍 Destinazione

La destination è **hardcoded**:
- **ID**: 648
- **Nome**: "MERCE DETERIORATA"

Non serve specificare `destLocationId` nella request.

## ✅ Response Successo

```json
{
  "success": true,
  "pickingId": 12345,
  "moveId": 67890
}
```

## ❌ Response Errore

```json
{
  "success": false,
  "error": "Descrizione errore"
}
```

## 🔴 Errori Comuni

### 1. Lotto mancante
```json
{
  "success": false,
  "error": "lotId è obbligatorio per il trasferimento a scarti"
}
```
**Soluzione**: Includere sempre `lotId` nella request.

### 2. Lotto non trovato
```json
{
  "success": false,
  "error": "Lotto 12345 non trovato per il prodotto 67890"
}
```
**Soluzione**: Verificare che il lotto esista e sia associato al prodotto.

### 3. Sessione non valida
```json
{
  "success": false,
  "error": "Sessione non valida. Effettua il login."
}
```
**Soluzione**: Effettuare login in Odoo.

### 4. Parametri mancanti
```json
{
  "success": false,
  "error": "Parametri mancanti: productId, sourceLocationId e quantity sono obbligatori"
}
```
**Soluzione**: Includere tutti i parametri obbligatori.

## 🎨 Motivi Predefiniti

```typescript
const WASTE_REASONS = [
  'Prodotto scaduto',
  'Scadenza imminente',
  'Confezione danneggiata',
  'Deterioramento qualità',
  'Richiamo prodotto',
  'Altro motivo'
];
```

## 🧪 Test Rapido con curl

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

## 📊 Verifica in Odoo

1. Vai su **Inventario → Operazioni → Trasferimenti**
2. Cerca picking con origin **"SCADENZE-SCARTI"**
3. Verifica:
   - ✅ Stato = "Fatto"
   - ✅ Destinazione = "MERCE DETERIORATA"
   - ✅ Numero lotto presente nei dettagli

## 🔗 File Utili

- `route.ts` - Implementazione endpoint
- `README.md` - Documentazione completa
- `test.http` - Test HTTP con REST Client
- `EXAMPLE_USAGE.tsx` - Esempi di integrazione
- `DIFFERENCES.md` - Confronto con ubicazioni/transfer

## 💡 Tips

1. **Lotto sempre obbligatorio**: A differenza di `/api/ubicazioni/transfer`, questo endpoint richiede sempre un `lotId`.

2. **Destinazione fissa**: Non puoi cambiare la destinazione. È sempre location 648 (MERCE DETERIORATA).

3. **Tracking origin**: Il picking avrà origin formato `SCADENZE-SCARTI: {reason} - {timestamp}` per tracciabilità.

4. **Errori Odoo**: Gli errori includono dettagli specifici da Odoo per facilità di debugging.

5. **Batch transfer**: Per trasferire più prodotti, chiama l'endpoint più volte in loop (vedi EXAMPLE_USAGE.tsx).

## 🚨 Warning

- ⚠️ Il trasferimento è **irreversibile** (picking validato automaticamente)
- ⚠️ Non verifica disponibilità stock prima del trasferimento
- ⚠️ Non supporta rollback automatico in caso di errore parziale

## 📞 Supporto

Per problemi o domande:
1. Controlla i log di console (emoji per debugging)
2. Verifica la risposta JSON dell'errore
3. Controlla la documentazione completa in `README.md`
4. Verifica lo stato del picking in Odoo

## ⏭️ Next Steps

Dopo il trasferimento:
1. Refresh della lista prodotti nella UI
2. Mostra notifica di successo con pickingId
3. Rimuovi il prodotto dalla vista corrente (se scaduto)
4. Opzionale: Crea scrap order automatico

---

**Pronto per l'uso! 🚀**

L'endpoint è completamente funzionale e pronto per essere integrato nella pagina `/app/scadenze`.
