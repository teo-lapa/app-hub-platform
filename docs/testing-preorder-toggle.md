# Test Plan: Toggle PRE-ORDINE

## Prerequisiti
- ✅ Utente loggato su staging
- ✅ Cookie `odoo_session_id` valido
- ✅ Accesso a pagina `/prodotti-preordine`

## Test Case 1: Attivazione Tag PRE-ORDINE

### Steps:
1. Naviga a `/prodotti-preordine`
2. Trova un prodotto senza checkbox ☑️ attivato
3. Clicca sul checkbox
4. Verifica che appaia spinner di loading
5. Attendi completamento (dovrebbe essere < 2 secondi)
6. Verifica che il checkbox sia ora ☑️ attivato

### Verifica Backend:
```bash
# Controlla i log in console browser
# Dovresti vedere:
🔍 Toggle PRE-ORDINE per prodotto 123, enable=true
🔍 Cercando tag PRE-ORDINE...
🔍 Tag trovati: [{id: X, name: "PRE-ORDINE"}]
🔍 Template ID: 456
🔍 Tag attuali del template 456: [...]
➕ Aggiungendo tag X ai tag esistenti: [...] → [...]
💾 Scrivendo su product.template ID 456 i tag: [...]
💾 Comando Odoo write: { product_tag_ids: [[6, 0, [...]]] }
✅ Write completato, verifico risultato...
🔍 Tag dopo il save: [...]
✅ Tag PRE-ORDINE aggiunto a prodotto 123 - Salvato correttamente: true
```

### Verifica Odoo:
1. Vai su Odoo staging: https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com
2. Apri Inventario → Prodotti → Cerca prodotto ID 123
3. Nella scheda prodotto, controlla "Tags"
4. Dovresti vedere tag **"PRE-ORDINE"** (viola)

### Expected Result:
✅ Checkbox attivato
✅ Nessun errore in console
✅ Tag visibile su Odoo

---

## Test Case 2: Disattivazione Tag PRE-ORDINE

### Steps:
1. Trova un prodotto con checkbox ☑️ già attivato
2. Clicca sul checkbox per disattivare
3. Verifica spinner
4. Attendi completamento
5. Verifica che checkbox sia ora ☐ disattivato

### Expected Result:
✅ Checkbox disattivato
✅ Tag rimosso da Odoo
✅ Nessun errore

---

## Test Case 3: Persistenza Tag dopo Reload

### Steps:
1. Attiva un tag su un prodotto
2. Fai refresh della pagina (F5)
3. Attendi il caricamento completo
4. Verifica che il prodotto abbia ancora checkbox ☑️

### Expected Result:
✅ Tag persiste dopo reload
✅ Prodotto appare nella lista con tag attivo

---

## Test Case 4: Cache Odoo (Potential Issue)

### Problem:
Se il tag viene scritto ma Odoo ha cache, potrebbe non apparire subito nella query successiva.

### Mitigazione:
Il codice attuale fa una **verifica immediata** dopo il write:
```typescript
const verifyTemplates = await rpc.searchRead(
  'product.template',
  [['id', '=', templateId]],
  ['product_tag_ids']
);
```

Se la verifica fallisce → Errore

### Test:
1. Attiva tag su 5 prodotti rapidamente (< 10 secondi)
2. Verifica che tutti i checkbox siano attivati
3. Fai refresh
4. Tutti i 5 prodotti devono avere ancora il tag

### Expected Result:
✅ Nessuna perdita di tag
✅ Nessun errore di cache

---

## Troubleshooting

### Problema: Checkbox attivato ma dopo refresh è disattivato
**Causa:** Tag non salvato correttamente su Odoo
**Fix:** Controlla logs per errore nel `write()`

### Problema: Errore "Tag PRE-ORDINE non trovato"
**Causa:** Tag non esiste e creazione fallisce
**Fix:** Crea manualmente il tag su Odoo:
- Vai su Inventario → Configurazione → Tags
- Crea tag "PRE-ORDINE" con colore viola

### Problema: Spinner infinito
**Causa:** API non risponde
**Fix:** Controlla logs Vercel per errori 500
