# Report Problemi Odoo 19 - App HUB (production/)

> Audit automatico del 2026-06-17. 84 file scansionati, 37 problemi, tutti CONFERMATI via schema Odoo 19 (MCP get_model_fields). 23 critici, 14 medi, 4 bassi.

## Riassunto

Tre cause radice dietro quasi tutto:
1. `qty_done` su `stock.move.line` è diventato un **no-op** (la quantità vera ora è `quantity`) → movimenti validati ma stock NON spostato (SILENZIOSO).
2. Il campo `name` è stato **rimosso** da `stock.move` (ora `description_picking`) → la create del move va in errore.
3. `type='product'` non esiste più (ora `consu` + `is_storable`) → ricerche prodotti tornano sempre 0.

Modelli HR rinominati: `hr.contract`→`hr.version`, `hr.expense.sheet` eliminato (accorpato in `hr.expense`).

---

## CRITICI (app live magazzino/autisti) - 23 problemi

### Arrivo merce - `app/api/arrivo-merce/process-reception/route.ts`
- **riga 272** · `stock.move.line.qty_done` (write) → NO-OP, ricezione processata a quantità 0. Fix: `quantity` + `picked=true` sul move.
- **riga 347** · `stock.move.line.qty_done` (create) → riga creata a quantità 0. Fix: `quantity`.
- **riga 409** · `stock.move.line.qty_done` (write `=0`) → righe non usate non si azzerano, si ricevono prodotti non in fattura. Fix: `{ quantity: 0 }`.

### Gestione arrivi - `app/api/gestione-arrivi/process-arrival/route.ts`
- **riga 375** · `stock.move.line.qty_done` (write) → picking validato senza le quantità. Fix: `quantity` + `picked=true`.
- **riga 442** · `stock.move.line.qty_done` (create) → riga a quantità 0. Fix: `quantity`.
- **riga 498** · `stock.move.line.qty_done` (write `=0`) → righe non azzerate. Fix: `{ quantity: 0 }`.

### Resi da furgone - `app/api/inventory/create-van-returns/route.ts`
- **riga 200** · `stock.move.name` (create) → RIMOSSO. Fix: `description_picking`.
- **riga 207** · `stock.move.note` (create) → campo inesistente sul move, fa fallire la create. Fix: rimuovere `note`.

### Trasferimento buffer→scaffale - `app/api/inventory/transfer/route.ts`
- **riga 72** · `stock.move.name` (create) → RIMOSSO. Fix: `description_picking`.
- **riga 131** · `stock.move.line.qty_done` (create, con lotto) → stock NON spostato. Fix: `quantity`.
- **riga 150** · `stock.move.line.qty_done` (create, senza lotto) → idem. Fix: `quantity`.

### Trasferimento ubicazioni - `app/api/ubicazioni/transfer/route.ts`
- **riga 243** · `stock.move.name` (create) → RIMOSSO. Fix: `description_picking`.
- **riga 263** · `stock.move.line.qty_done` (create) → giacenza invariata. Fix: `quantity`.

### Scadenze → scarti - `app/api/scadenze/transfer/route.ts`
- **riga 188** · `stock.move.name` (create) → RIMOSSO. Fix: `description_picking`.
- **riga 228** · `stock.move.line.qty_done` (create) → scarto validato senza scaricare la giacenza. Fix: `quantity`.

### Scarti / merce deteriorata - `app/api/waste/transfer/route.ts`
- **riga 260** · `stock.move.name` (create) → RIMOSSO. Fix: `description_picking`.
- **riga 280** · `stock.move.line.qty_done` (create) → scarto validato senza scaricare la giacenza. Fix: `quantity`.

### Ricarica stock veicolo - `app/api/maestro/vehicle-stock/transfer/route.ts`
- **riga 191** · `stock.move.name` (create) → RIMOSSO. Fix: `description_picking`.

### Prodotti mancanti - `app/api/missing-products/action/route.ts`
- **riga 219** · `product.product.type='product'` (search_read) → torna SEMPRE 0 alternative. Fix: `['is_storable','=',true]`.

### Creazione prodotti - `app/api/product-creator/create-products/route.ts`
- **riga 515** · `product.product.type='product'` (create) → ValueError, prodotto non creato. Fix: `type:'consu', is_storable:true`.

---

## MEDI - 14 problemi

### Arrivo merce / scadenze (scrittura ignorata, non blocca)
- `arrivo-merce/process-reception/route.ts` **riga 280** · `stock.move.line.expiration_date` (write) → read-only in v19, scadenza non salvata. Fix: sul lotto `stock.lot`.
- `arrivo-merce/process-reception/route.ts` **riga 356** · `expiration_date` (create) → ignorato. Fix: sul lotto.
- `gestione-arrivi/process-arrival/route.ts` **riga 177** · `stock.move.line.qty_done` (read) → valore 0 fuorviante al matching AI. Fix: leggere `quantity`.
- `gestione-arrivi/process-arrival/route.ts` **riga 389** · `expiration_date` (write) → non salvata. Fix: sul lotto.
- `gestione-arrivi/process-arrival/route.ts` **riga 455** · `expiration_date` (create) → ignorato. Fix: sul lotto.

### Buste paga - `app/api/hr-payslip/route.ts`
- **riga 170** · modello `hr.contract` → NON esiste più (è `hr.version`), action "contracts" rotta. Fix: `hr.version`.
- **riga 717** · `hr.payslip.line.version_id` mancante + `total` (create) → `version_id` obbligatorio, create fallisce. Fix: leggere `version_id` dal payslip.
- **riga 820** · `hr.payslip.line.total` (write) → read-only/computed, no-op. Fix: scrivere `amount/quantity/rate`.
- **riga 848** · `total` + `version_id` condizionale (create) → senza `version_id` fallisce. Fix: togliere `total`, garantire `version_id`.
- **riga 883** · idem riga 848 + write `total` (riga 902) no-op. Fix: togliere `total`, garantire `version_id`.

### Note spese - `app/api/spese/submit/route.ts`
- **riga 381** · modello `hr.expense.sheet` (create) → eliminato in v19. Fix: gestire su `hr.expense`.
- **riga 391** · metodo `action_submit_sheet` su modello inesistente → fallisce. Fix: invio su `hr.expense`.
- **riga 397** · metodo `approve_expense_sheets` su modello inesistente → fallisce. Fix: approvare su `hr.expense`.

---

## BASSI - 4 problemi

- `inventory/create-van-returns/route.ts` **riga 204** · `stock.move.product_uom=1` hardcoded → se l'UdM base differisce la create può fallire. Fix: omettere o leggere l'UdM reale.
- `scadenze/transfer/route.ts` **riga 191** · `stock.move.product_uom=1` hardcoded → idem. Fix: omettere o leggere l'UdM reale.
- `scarichi-parziali/create-return/route.ts` **riga 286** · `stock.move.line.qty_done` (create) → ridondante (passa già `quantity`). Fix: togliere `qty_done`.
- `scarichi-parziali/process-product/route.ts` **riga 181** · `stock.move.line.qty_done` (create) → ridondante con `quantity`. Fix: togliere `qty_done`.

---

## Note operative

- **Priorità #1:** tutti i `qty_done`→`quantity` sui flussi trasferimento/scarto/arrivo. Oggi il magazzino vede "completato" ma **lo stock non si muove** — danno SILENZIOSO, il peggiore.
- **Priorità #2:** tutti i `name`→`description_picking` su `stock.move`: danno errore esplicito, flussi già bloccati (visibili).
- I `product_uom=1` hardcoded sono bombe a orologeria: funzionano finché l'UdM base del prodotto ha id=1.
- HR (buste/spese) non è live-critical ma le action sono rotte: migrare a `hr.version` / `hr.expense`.
