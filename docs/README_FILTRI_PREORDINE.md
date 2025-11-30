# Filtri Odoo PRE-ORDINE - Guida Completa

## Panoramica

Questa guida fornisce tutti gli strumenti necessari per filtrare e raggruppare i **1,532 prodotti con tag PRE-ORDINE** (ID: 314) per fornitore in Odoo 17.

---

## File Disponibili

### 1. FILTRI_ODOO_PRE_ORDINE.md
Guida completa con:
- Filtri domain Odoo pronti all'uso
- Istruzioni step-by-step per Odoo UI
- Filtri avanzati
- Sintassi domain reference
- Troubleshooting

**Quando usarlo**: Per capire la sintassi e creare filtri personalizzati

---

### 2. FILTRI_PRE_ORDINE_QUICK.txt
Cheat sheet da stampare con:
- Filtro principale
- Filtri per fornitore specifico
- Metodi alternativi
- Export CSV
- Quick reference

**Quando usarlo**: Quando hai fretta e ti serve solo il filtro da incollare

---

### 3. scripts/analizza-preordine-fornitori.py
Script Python completo che:
- Connette a Odoo via XML-RPC
- Scarica tutti i prodotti PRE-ORDINE
- Raggruppa per fornitore
- Genera report dettagliato
- Esporta JSON e CSV

**Quando usarlo**: Per analisi offline o automatizzazione

**Esecuzione**:
```bash
python scripts/analizza-preordine-fornitori.py
```

---

### 4. scripts/analizza-preordine-fornitori.js
Script Node.js (equivalente allo script Python)

**Esecuzione**:
```bash
node scripts/analizza-preordine-fornitori.js
```

---

## Quick Start - 3 Metodi

### Metodo 1: Filtro Diretto in Odoo (PIÙ VELOCE)

1. Vai su **Inventario > Prodotti > Prodotti**
2. **Filtri** > **Aggiungi filtro personalizzato**
3. Incolla:
   ```
   [('categ_id', '=', 314)]
   ```
4. **Raggruppa per** > **Fornitore** (seller_ids > partner_id)
5. Done!

---

### Metodo 2: Ricerca Testuale (PIÙ SEMPLICE)

1. Vai su **Inventario > Prodotti > Prodotti**
2. Barra di ricerca: digita **"PRE-ORDINE"**
3. Premi Invio
4. **Raggruppa per** > **Fornitore**
5. Done!

---

### Metodo 3: Script Automatico (PIÙ COMPLETO)

1. Configura credenziali in `scripts/analizza-preordine-fornitori.py`
2. Esegui:
   ```bash
   python scripts/analizza-preordine-fornitori.py
   ```
3. Ottieni:
   - Report stampato a console
   - File JSON con tutti i dati
   - File CSV pronto per Excel
4. Done!

---

## Filtri Pronti all'Uso

### Tutti i Prodotti PRE-ORDINE
```python
[('categ_id', '=', 314)]
```

### Per Fornitore Specifico
```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'NOME_FORNITORE')]
```

Sostituisci `NOME_FORNITORE` con:
- `ALIGRO`
- `RISTORIS`
- `AURICCHIO`
- etc.

### Senza Fornitore Configurato
```python
[('categ_id', '=', 314), ('seller_ids', '=', False)]
```

### Con Stock Disponibile
```python
[('categ_id', '=', 314), ('qty_available', '>', 0)]
```

### Prezzo > 50 CHF
```python
[('categ_id', '=', 314), ('list_price', '>', 50)]
```

---

## Export CSV da Odoo

1. Applica filtro PRE-ORDINE
2. Seleziona tutti i prodotti (checkbox in alto)
3. **Azione** > **Esporta**
4. Seleziona campi:
   - Nome Prodotto
   - Codice Prodotto (default_code)
   - Fornitore (seller_ids > partner_id > name)
   - Prezzo Listino (list_price)
   - Stock Disponibile (qty_available)
5. **Esporta**
6. Apri in Excel e raggruppa per colonna "Fornitore"

---

## Salva Filtro Personalizzato

Per riutilizzare il filtro in futuro:

1. Applica il filtro + raggruppamento
2. **Filtri** > **Salva ricerca corrente**
3. Nome: **"PRE-ORDINE per Fornitore"**
4. ✓ Usa di default
5. ✓ Condividi con tutti gli utenti
6. **Salva**

Ora disponibile in: **Filtri > Preferiti > PRE-ORDINE per Fornitore**

---

## Struttura Dati Odoo

### Modello: product.product

**Campo Tag/Categoria**:
- Nome campo: `categ_id`
- Tipo: Many2one -> product.category
- Tag PRE-ORDINE: ID = 314

**Campo Fornitori**:
- Nome campo: `seller_ids`
- Tipo: Many2many -> product.supplierinfo
- Ogni supplier contiene: `partner_id` (fornitore), `price`, `min_qty`, `delay`

### Modello: product.supplierinfo

**Campi**:
- `partner_id`: Many2one -> res.partner (fornitore)
- `price`: Float (prezzo fornitore)
- `min_qty`: Integer (quantità minima)
- `delay`: Integer (lead time in giorni)
- `product_code`: Char (codice fornitore)

---

## Esempi Output Script

### Report Console

```
================================================================================
        REPORT PRODOTTI PRE-ORDINE PER FORNITORE
================================================================================
Data: 2025-11-09 14:30:00
Totale fornitori: 45
Prodotti senza fornitore: 78
================================================================================

--------------------------------------------------------------------------------
                 TOP 10 FORNITORI PER NUMERO PRODOTTI
--------------------------------------------------------------------------------

1. ALIGRO Demaurex & Cie SA
   Prodotti:      342
   Prezzo medio:  CHF 12.50
   Valore stock:  CHF 45,890.00
   Stock totale:  3,671 unità
   Campione prodotti:
     - [ALIG-123] Formaggio Grana Padano DOP 1kg
       Prezzo: CHF 18.50 | Stock: 25 kg
     - [ALIG-456] Prosciutto Crudo Parma 500g
       Prezzo: CHF 22.00 | Stock: 15 kg
     ... e altri 340 prodotti

2. RISTORIS SRL
   Prodotti:      187
   ...
```

### File JSON

```json
{
  "timestamp": "2025-11-09T14:30:00.000Z",
  "total_suppliers": 45,
  "total_products_without_supplier": 78,
  "suppliers": {
    "ALIGRO Demaurex & Cie SA": {
      "supplier_id": 123,
      "total_products": 342,
      "avg_price": 12.50,
      "products": [
        {
          "id": 1234,
          "name": "Formaggio Grana Padano DOP 1kg",
          "sku": "ALIG-123",
          "list_price": 18.50,
          "supplier_price": 16.00,
          "qty_available": 25,
          "uom": "kg"
        }
      ]
    }
  }
}
```

### File CSV

```csv
Fornitore,SKU,Nome Prodotto,Prezzo Listino,Prezzo Fornitore,Stock Disponibile,UdM
ALIGRO Demaurex & Cie SA,ALIG-123,Formaggio Grana Padano DOP 1kg,18.50,16.00,25,kg
ALIGRO Demaurex & Cie SA,ALIG-456,Prosciutto Crudo Parma 500g,22.00,19.50,15,kg
RISTORIS SRL,RIST-789,Pasta Barilla Penne 500g,2.50,2.10,150,pz
...
```

---

## Troubleshooting

### Problema: "Campo categ_id non trovato"

**Soluzione**: In alcuni Odoo il campo tags si chiama `tag_ids` invece di `categ_id`. Prova:
```python
[('tag_ids', 'in', [314])]
```

---

### Problema: "Campo seller_ids non accessibile"

**Soluzione**: Verifica di avere permessi di lettura su `product.supplierinfo`. Chiedi all'admin di Odoo.

---

### Problema: "Raggruppamento per Fornitore non disponibile"

**Soluzione**:
1. Cambia vista da **Kanban** a **Lista**
2. Verifica che i prodotti abbiano `seller_ids` popolati
3. Controlla permessi utente

---

### Problema: "ID tag 314 non corrisponde a PRE-ORDINE"

**Soluzione**:
1. Vai su **Inventario > Configurazione > Product Tags**
2. Cerca "PRE-ORDINE"
3. Annota l'ID corretto
4. Sostituisci 314 con l'ID corretto nei filtri

---

## Documentazione Odoo Domain

### Sintassi Base

```python
[('campo', 'operatore', valore)]
```

### Operatori

| Operatore | Descrizione |
|-----------|-------------|
| `=` | Uguale |
| `!=` | Diverso |
| `>` | Maggiore |
| `>=` | Maggiore o uguale |
| `<` | Minore |
| `<=` | Minore o uguale |
| `ilike` | Contiene (case-insensitive) |
| `like` | Contiene (case-sensitive) |
| `in` | Valore in lista |
| `not in` | Valore non in lista |

### Operatori Logici

**AND** (default):
```python
[('campo1', '=', 'val1'), ('campo2', '=', 'val2')]
```

**OR**:
```python
['|', ('campo1', '=', 'val1'), ('campo2', '=', 'val2')]
```

**NOT**:
```python
['!', ('campo', '=', 'valore')]
```

---

## Best Practices

1. **Salva i filtri più usati** come Preferiti
2. **Esporta in CSV** per analisi offline in Excel
3. **Usa script automatici** per report periodici
4. **Verifica i fornitori** mancanti e configurali in Odoo
5. **Raggruppa per fornitore** per negoziazioni bulk

---

## Risorse

- [Documentazione Odoo Domain](https://www.odoo.com/documentation/17.0/developer/reference/backend/orm.html#reference-orm-domains)
- [Odoo XML-RPC External API](https://www.odoo.com/documentation/17.0/developer/reference/external_api.html)
- File: `FILTRI_ODOO_PRE_ORDINE.md` (guida completa)
- File: `FILTRI_PRE_ORDINE_QUICK.txt` (quick reference)

---

## Supporto

Per problemi o domande:

1. Consulta `FILTRI_ODOO_PRE_ORDINE.md` - sezione Troubleshooting
2. Verifica permessi utente in Odoo
3. Testa i filtri manualmente nell'interfaccia Odoo
4. Controlla log degli script per errori di connessione

---

## Changelog

**2025-11-09**: Creazione iniziale
- Filtri domain per tag PRE-ORDINE (ID: 314)
- Script Python e Node.js
- Export JSON e CSV
- Documentazione completa

---

**Buon lavoro con i filtri PRE-ORDINE! 🎯**
