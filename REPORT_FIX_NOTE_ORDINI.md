# REPORT: Fix Gestione Note negli Ordini

## Data: 2025-11-13

---

## PROBLEMA RISOLTO

### Situazione Iniziale
- **Note Magazzino (warehouseNotes)**: andavano nel chatter invece che in un campo interno
- **Note Venditore (orderNotes)**: andavano nel campo `note` invece che nel chatter

### Soluzione Implementata

#### 1. Note Magazzino (warehouseNotes)
- **Destinazione**: Campo `internal_note` di Odoo (sale.order)
- **Tipo campo**: HTML
- **Visibilità**: Solo operatori interni LAPA
- **NON visibile al cliente**: Corretto ✓

#### 2. Note Venditore (orderNotes)
- **Destinazione**: Chatter di Odoo tramite `message_post`
- **Tipo messaggio**: `comment` con `subtype_xmlid: 'mail.mt_comment'`
- **Visibilità**: Pubblico (visibile al cliente)
- **Visibile nel chatter**: Corretto ✓

---

## CAMPI ODOO UTILIZZATI

### sale.order Model

| Campo | Tipo | Descrizione | Uso |
|-------|------|-------------|-----|
| `internal_note` | HTML | Internal Note | Note Magazzino (solo interno) |
| `note` | HTML | Terms and conditions | Termini e condizioni standard (non usato per le note dell'ordine) |

### Chatter (mail.message)

| Metodo | Parametri | Uso |
|--------|-----------|-----|
| `message_post` | `body`, `message_type: 'comment'`, `subtype_xmlid: 'mail.mt_comment'` | Note Venditore (visibili al cliente) |

---

## FILE MODIFICATI

### 1. `app/api/catalogo-venditori/create-order/route.ts`

#### Modifiche principali:

**Linea 55-63**: Aggiornati commenti nell'interfaccia
```typescript
interface CreateOrderRequest {
  customerId: number;
  deliveryAddressId: number | null;
  orderLines: OrderLine[];
  orderNotes?: string; // Customer-visible notes (goes to Chatter via message_post)
  warehouseNotes?: string; // Internal notes (goes to internal_note field)
  deliveryDate?: string; // Format: YYYY-MM-DD
  aiData?: AIData; // AI processing data (transcription, matches)
}
```

**Linea 295-299**: Note Magazzino → campo internal_note
```typescript
// Add warehouse notes (internal) to the internal_note field
if (warehouseNotes && warehouseNotes.trim()) {
  orderData.internal_note = warehouseNotes.trim();
  console.log('✅ [CREATE-ORDER-API] Warehouse notes added to internal_note field');
}
```

**Linea 445-469**: Note Venditore → Chatter (message_post)
```typescript
// Post order notes (customer-visible) to Chatter if provided
if (orderNotes && orderNotes.trim()) {
  try {
    console.log('📝 [CREATE-ORDER-API] Posting order notes to Chatter...');

    const notesMessage = `<p><strong>💬 Note Ordine dal Cliente</strong></p><p>${orderNotes.replace(/\n/g, '<br/>')}</p><p><em>Inserite dal venditore tramite Catalogo Venditori</em></p>`;

    await callOdoo(
      cookies,
      'sale.order',
      'message_post',
      [[odooOrderId]],
      {
        body: notesMessage,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment', // Public message (visible to customer)
      }
    );

    console.log('✅ [CREATE-ORDER-API] Order notes posted to Chatter (customer-visible)');
  } catch (notesError: any) {
    console.error('❌ [CREATE-ORDER-API] Failed to post order notes to Chatter:', notesError.message);
    // Continue anyway - not critical
  }
}
```

### 2. `app/catalogo-venditori/components/NotesInput.tsx`

#### Modifiche UI per chiarezza:

**Linea 71-77**: Label Note Venditore
```typescript
{/* ORDER NOTES (Customer-visible - goes to Chatter) */}
<div className="space-y-3">
  <label className="block text-sm font-medium text-slate-300 flex items-center justify-between">
    <span>
      Note Venditore
      <span className="text-slate-500 ml-2">(visibili al cliente)</span>
    </span>
```

**Linea 105-107**: Help text Note Venditore
```typescript
<p style={{ fontSize: '14px', lineHeight: '1.5' }}>
  Queste note saranno visibili al cliente nel chatter dell'ordine
</p>
```

**Linea 111-117**: Label Note Magazzino
```typescript
{/* WAREHOUSE NOTES (Internal - goes to internal_note field) */}
<div className="space-y-3">
  <label className="block text-sm font-medium text-slate-300 flex items-center justify-between">
    <span>
      Note Magazzino
      <span className="text-slate-500 ml-2">(solo uso interno)</span>
    </span>
```

**Linea 145-147**: Help text Note Magazzino
```typescript
<p style={{ fontSize: '14px', lineHeight: '1.5' }}>
  Note interne solo per il team LAPA (non visibili al cliente in nessun modo)
</p>
```

---

## TEST ESEGUITI

### Script di Test: `scripts/test-notes-functionality.ts`

#### Test Case:
1. Creato ordine con entrambe le note
2. Verificato campo `internal_note` in Odoo
3. Verificato messaggio nel chatter

#### Risultati:

**Ordine creato**: S34735 (ID: 34164)
**URL Odoo**: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#id=34164&model=sale.order&view_type=form

✓ **Campo internal_note**:
```
Questa è una nota INTERNA per il magazzino.
Deve andare nel campo internal_note e NON essere visibile al cliente.
```
- Salvato correttamente nel campo `internal_note`
- Visibile solo nel tab "Note" dell'ordine
- NON visibile al cliente ✓

✓ **Messaggio nel Chatter**:
```
💬 Note Ordine dal Cliente
Questo è un messaggio VISIBILE AL CLIENTE.
Deve apparire nel chatter come messaggio pubblico.
Inserite dal venditore tramite Catalogo Venditori
```
- Postato correttamente tramite `message_post`
- Visibile nel chatter come messaggio pubblico
- Visibile al cliente ✓

#### Output Console Test:
```
✅ Ordine creato con ID: 34164
✅ Note venditore inviate al chatter
✅ CORRETTO: Le note magazzino sono nel campo internal_note
✅ CORRETTO: Le note venditore sono nel chatter
```

---

## VERIFICA MANUALE IN ODOO

### Screenshot Verifiche:

1. **Tab "Note"** (internal_note field):
   - Il campo mostra correttamente le note magazzino
   - Testo: "Questa è una nota INTERNA per il magazzino..."
   - Visibile solo agli operatori interni

2. **Chatter**:
   - Messaggio pubblico con titolo "💬 Note Ordine dal Cliente"
   - Testo: "Questo è un messaggio VISIBILE AL CLIENTE..."
   - Visibile al cliente come messaggio normale

---

## RIEPILOGO CAMPI

### Prima del Fix:
- orderNotes → campo `note` (Terms and Conditions) ❌
- warehouseNotes → Chatter come nota interna ❌

### Dopo il Fix:
- orderNotes → Chatter tramite `message_post` (pubblico) ✓
- warehouseNotes → campo `internal_note` (privato) ✓

---

## COMPATIBILITÀ

### Backward Compatibility:
- Le modifiche sono retrocompatibili
- Gli ordini esistenti non sono influenzati
- I nuovi ordini utilizzano il nuovo sistema

### Database:
- Nessuna migrazione necessaria
- I campi `internal_note` e il chatter esistono già in Odoo

---

## CONCLUSIONI

### Obiettivi Raggiunti:

✓ Note Magazzino (warehouseNotes):
  - Salvate nel campo `internal_note` di Odoo
  - NON visibili al cliente
  - Visibili solo nel tab "Note" per gli operatori

✓ Note Venditore (orderNotes):
  - Pubblicate nel chatter tramite `message_post`
  - Visibili al cliente
  - Funzionano correttamente

### Testing:
✓ Test automatico completato con successo
✓ Verifica manuale in Odoo completata
✓ Entrambi i tipi di note funzionano come richiesto

### Note Tecniche:
- Odoo wrappa automaticamente il testo in tag `<p>` quando salva nel campo HTML `internal_note`
- Il metodo `message_post` è il modo corretto per postare messaggi pubblici nel chatter
- Il subtype `mail.mt_comment` rende il messaggio visibile al cliente

---

## FILE SCRIPT CREATI

1. `scripts/check-sale-order-fields.ts` - Verifica campi disponibili in sale.order
2. `scripts/test-notes-functionality.ts` - Test automatico funzionalità note

---

**Report generato**: 2025-11-13
**Fix completato e testato con successo** ✓
