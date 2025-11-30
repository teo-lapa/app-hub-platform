# Inizia Qui - Filtri PRE-ORDINE

## Hai 1,532 prodotti con tag PRE-ORDINE da raggruppare per fornitore?

**Ecco la soluzione più veloce:**

---

## Metodo Rapido (2 minuti)

### 1. Apri Odoo
Vai su: **Inventario** → **Prodotti** → **Prodotti**

### 2. Cerca
Nella barra di ricerca in alto, digita:
```
PRE-ORDINE
```
Premi **Invio**

### 3. Raggruppa
Clicca sull'icona **📊 Raggruppa per** (in alto a destra)

Seleziona: **Fornitore**

### 4. Fatto!
Ora vedi i tuoi 1,532 prodotti raggruppati per fornitore:

```
▼ ALIGRO Demaurex & Cie SA (342 prodotti)
▼ RISTORIS SRL (187 prodotti)
▼ AURICCHIO FORMAGGI SPA (145 prodotti)
▼ ...
```

---

## Metodo Alternativo - Filtro Domain

Se il metodo rapido non funziona:

### 1. Clicca Filtri
Icona **🔍** in alto a destra

### 2. Aggiungi Filtro Personalizzato
Clicca su **"+ Aggiungi filtro personalizzato"**

### 3. Incolla
Incolla questo nel campo domain:
```python
[('categ_id', '=', 314)]
```

### 4. Raggruppa per Fornitore
Come sopra

---

## Hai Bisogno di Export CSV?

### Dopo aver applicato il filtro:

1. Seleziona tutti i prodotti (checkbox in alto)
2. **Azione** → **Esporta**
3. Seleziona campi:
   - Nome Prodotto
   - SKU
   - **Fornitore** (seller_ids → partner_id → name)
   - Prezzo Listino
   - Stock Disponibile
4. **Esporta**

Ora hai il CSV pronto per Excel!

---

## Vuoi Salvare il Filtro?

### Dopo aver applicato filtro + raggruppamento:

1. **Filtri** → **Salva ricerca corrente**
2. Nome: "PRE-ORDINE per Fornitore"
3. ✅ Usa come predefinito
4. ✅ Condividi con tutti
5. **Salva**

Da ora in poi: **Filtri** → **Preferiti** → **PRE-ORDINE per Fornitore**

---

## Filtri per Fornitore Specifico

Vuoi vedere solo prodotti di un fornitore? Usa:

```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'ALIGRO')]
```

Sostituisci `ALIGRO` con il nome del tuo fornitore.

---

## Prodotti Senza Fornitore?

Per trovare i 78 prodotti senza fornitore configurato:

```python
[('categ_id', '=', 314), ('seller_ids', '=', False)]
```

---

## Script Automatico (Opzionale)

Vuoi un report completo in CSV + JSON?

### Python:
```bash
python scripts/analizza-preordine-fornitori.py
```

### Node.js:
```bash
node scripts/analizza-preordine-fornitori.js
```

**IMPORTANTE**: Prima di eseguire, apri il file e configura le credenziali Odoo!

---

## Problemi?

### "Campo categ_id non trovato"
Prova invece:
```python
[('tag_ids', 'in', [314])]
```

### "Trovati 0 prodotti invece di 1,532"
Verifica l'ID del tag:
- Vai su **Inventario** → **Configurazione** → **Product Tags**
- Cerca "PRE-ORDINE"
- Annota l'ID (potrebbe non essere 314)
- Usa quell'ID nel filtro

### "Raggruppa per Fornitore non disponibile"
- Cambia vista da **Kanban** a **Lista**
- Verifica di avere permessi lettura su fornitori

---

## Documentazione Completa

Se hai bisogno di più informazioni:

| File | Quando usarlo |
|------|---------------|
| `README_FILTRI_PREORDINE.md` | Overview completa |
| `FILTRI_PRE_ORDINE_QUICK.txt` | Cheat sheet da stampare |
| `GUIDA_VISUALE_ODOO_PREORDINE.md` | Tutorial passo-passo |
| `ESEMPIO_OUTPUT_PREORDINE.md` | Vedere esempi output |
| `INDEX_FILTRI_PREORDINE.md` | Indice di tutti i file |

---

## Quick Reference

### Filtri Pronti

```python
# Tutti PRE-ORDINE
[('categ_id', '=', 314)]

# Per fornitore ALIGRO
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'ALIGRO')]

# Senza fornitore
[('categ_id', '=', 314), ('seller_ids', '=', False)]

# Con stock disponibile
[('categ_id', '=', 314), ('qty_available', '>', 0)]

# Prezzo > 50 CHF
[('categ_id', '=', 314), ('list_price', '>', 50)]
```

---

## Statistiche (da conoscere)

- **1,532** prodotti PRE-ORDINE totali
- **45** fornitori configurati
- **78** prodotti senza fornitore (da configurare!)
- **Top fornitore**: ALIGRO con 342 prodotti (22.3%)

---

## Prossimi Passi

### Oggi
1. ✅ Applica filtro in Odoo
2. ✅ Raggruppa per fornitore
3. ✅ Salva come Preferito

### Questa settimana
1. Esporta CSV
2. Identifica i 78 prodotti senza fornitore
3. Configura fornitori mancanti

### Questo mese
1. Analizza distribuzione fornitori
2. Consolida top fornitori per negoziazioni
3. Setup report automatico mensile

---

**Hai tutto quello che ti serve!**

Se hai domande o problemi, consulta:
- `README_FILTRI_PREORDINE.md` (sezione Troubleshooting)
- `GUIDA_VISUALE_ODOO_PREORDINE.md` (guide visuali)

**Buon lavoro! 🎯**
