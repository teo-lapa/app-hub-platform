# Filtri Odoo - Prodotti PRE-ORDINE per Fornitore

## Contesto
- **Totale prodotti taggati PRE-ORDINE**: 1,532 prodotti
- **ID Tag PRE-ORDINE**: 314
- **Obiettivo**: Raggruppare questi prodotti per fornitore in Odoo

---

## 1. FILTRO PRINCIPALE - Tutti i Prodotti PRE-ORDINE

### Filtro Domain (da incollare in Odoo)

```python
[('categ_id', '=', 314)]
```

### Dove incollarlo in Odoo

1. Vai su **Inventario > Prodotti > Prodotti** (o **Vendite > Prodotti**)
2. Clicca su **Filtri** (icona imbuto in alto a destra)
3. Clicca su **Aggiungi filtro personalizzato**
4. Seleziona:
   - Campo: `categ_id` (o `Tag Prodotto` / `Product Tags`)
   - Operatore: `=` o `contiene`
   - Valore: `314` o cerca "PRE-ORDINE"
5. Clicca **Applica**

### Raggruppamento per Fornitore

Dopo aver applicato il filtro:

1. Clicca su **Raggruppa per** (icona gruppo in alto a destra)
2. Seleziona **Fornitore** (campo `seller_ids > partner_id`)
3. I prodotti verranno raggruppati per fornitore

**NOTA**: In Odoo, il campo `seller_ids` è una relazione Many2many con il modello `product.supplierinfo`, che contiene i fornitori configurati per ogni prodotto.

---

## 2. FILTRI PER FORNITORE SPECIFICO

### Sintassi Generica

```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'NOME_FORNITORE')]
```

### Spiegazione della Sintassi

- `categ_id` = Tag/Categoria del prodotto
- `seller_ids` = Relazione Many2many con `product.supplierinfo`
- `seller_ids.partner_id` = Fornitore (relazione Many2one con `res.partner`)
- `seller_ids.partner_id.name` = Nome del fornitore
- `ilike` = Operatore "contiene" (case-insensitive)

---

## 3. FILTRI PRE-CONFIGURATI PER TOP FORNITORI

### Esempio 1: Fornitore "ALIGRO"

```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'ALIGRO')]
```

### Esempio 2: Fornitore "RISTORIS"

```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'RISTORIS')]
```

### Esempio 3: Fornitore "AURICCHIO"

```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'AURICCHIO')]
```

### Esempio 4: Fornitore "Caseificio"

```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'Caseificio')]
```

---

## 4. FILTRI AVANZATI

### A. Prodotti PRE-ORDINE senza Fornitore Configurato

```python
[('categ_id', '=', 314), ('seller_ids', '=', False)]
```

Questo filtro mostra i prodotti PRE-ORDINE che **non hanno fornitori configurati** in Odoo.

---

### B. Prodotti PRE-ORDINE con Stock Disponibile

```python
[('categ_id', '=', 314), ('qty_available', '>', 0)]
```

Mostra solo i prodotti PRE-ORDINE che hanno giacenza in magazzino.

---

### C. Prodotti PRE-ORDINE con Più di un Fornitore

```python
[('categ_id', '=', 314), ('seller_ids', '!=', False)]
```

Poi raggruppa manualmente per contare i fornitori.

---

### D. Prodotti PRE-ORDINE con Prezzo > 50 CHF

```python
[('categ_id', '=', 314), ('list_price', '>', 50)]
```

---

## 5. QUERY ALTERNATIVE (se Domain non funziona)

Se il filtro domain non funziona nell'interfaccia Odoo, puoi usare la **ricerca avanzata**:

### Opzione A: Ricerca Testuale

1. Nella barra di ricerca dei prodotti, digita:
   ```
   PRE-ORDINE
   ```
2. Premi Invio
3. Clicca su **Raggruppa per > Fornitore**

### Opzione B: Usa Filtri Predefiniti

1. Clicca su **Filtri**
2. Seleziona **Tag Prodotto**
3. Scegli **PRE-ORDINE** dalla lista
4. Clicca **Applica**
5. Clicca su **Raggruppa per > Fornitore**

---

## 6. SCRIPT PYTHON PER ANALISI APPROFONDITA

Se hai accesso XML-RPC o API di Odoo, puoi usare questo script per analizzare i prodotti PRE-ORDINE per fornitore:

```python
import xmlrpc.client

ODOO_URL = 'https://tuodominio.odoo.com'
ODOO_DB = 'tuo_database'
ODOO_USERNAME = 'admin'
ODOO_PASSWORD = 'password'

# Authenticate
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

# Get products with PRE-ORDINE tag
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
products = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'product.product', 'search_read',
    [[('categ_id', '=', 314)]],
    {
        'fields': ['id', 'name', 'default_code', 'seller_ids', 'list_price'],
        'limit': 1532
    }
)

print(f"Trovati {len(products)} prodotti PRE-ORDINE")

# Group by supplier
suppliers_map = {}

for product in products:
    # Get supplier info
    if product['seller_ids']:
        supplier_infos = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'product.supplierinfo', 'read',
            [product['seller_ids']],
            {'fields': ['partner_id']}
        )

        for supplier_info in supplier_infos:
            supplier_name = supplier_info['partner_id'][1]

            if supplier_name not in suppliers_map:
                suppliers_map[supplier_name] = []

            suppliers_map[supplier_name].append({
                'name': product['name'],
                'sku': product['default_code'],
                'price': product['list_price']
            })
    else:
        # No supplier configured
        if 'SENZA FORNITORE' not in suppliers_map:
            suppliers_map['SENZA FORNITORE'] = []

        suppliers_map['SENZA FORNITORE'].append({
            'name': product['name'],
            'sku': product['default_code'],
            'price': product['list_price']
        })

# Print results
print("\n=== PRODOTTI PRE-ORDINE PER FORNITORE ===\n")

for supplier_name, products_list in sorted(suppliers_map.items(), key=lambda x: len(x[1]), reverse=True):
    print(f"{supplier_name}: {len(products_list)} prodotti")

    # Show first 3 products as sample
    for product in products_list[:3]:
        print(f"  - [{product['sku']}] {product['name']} - CHF {product['price']:.2f}")

    if len(products_list) > 3:
        print(f"  ... e altri {len(products_list) - 3} prodotti")
    print()
```

---

## 7. VISUALIZZAZIONE IN ODOO

### Step-by-Step per Visualizzare Prodotti PRE-ORDINE Raggruppati per Fornitore

#### Passo 1: Applica il Filtro

1. Vai su **Inventario > Prodotti > Prodotti**
2. Clicca su **Filtri** (imbuto)
3. Aggiungi filtro personalizzato:
   - Campo: `Tag Prodotto` o `categ_id`
   - Operatore: `=`
   - Valore: `PRE-ORDINE` o `314`
4. Clicca **Applica**

#### Passo 2: Raggruppa per Fornitore

1. Clicca su **Raggruppa per** (icona gruppo)
2. Seleziona **Fornitore** o `Seller > Partner`
3. I prodotti verranno automaticamente raggruppati

#### Passo 3: Visualizza Dettagli

- Clicca su ogni gruppo fornitore per espandere e vedere i prodotti
- Puoi esportare i risultati cliccando su **Azione > Esporta**

---

## 8. EXPORT CSV DEI RISULTATI

Per esportare la lista dei prodotti PRE-ORDINE raggruppati per fornitore:

1. Applica il filtro PRE-ORDINE
2. Seleziona tutti i prodotti (checkbox in alto)
3. Clicca su **Azione > Esporta**
4. Seleziona i campi:
   - Nome Prodotto
   - Codice Prodotto (SKU)
   - Fornitore (seller_ids > partner_id > name)
   - Prezzo Listino
   - Giacenza Disponibile
5. Clicca **Esporta**
6. Apri il CSV in Excel e usa **Dati > Raggruppa per** sulla colonna Fornitore

---

## 9. FILTRI SALVATI (Favorites)

Per salvare il filtro e riutilizzarlo:

1. Applica il filtro PRE-ORDINE con raggruppamento per fornitore
2. Clicca su **Filtri > Salva ricerca corrente**
3. Dai un nome: "PRE-ORDINE per Fornitore"
4. Seleziona:
   - ✅ Usa di default
   - ✅ Condividi con tutti gli utenti
5. Clicca **Salva**

Ora il filtro sarà disponibile nel menu **Filtri > Preferiti**.

---

## 10. TROUBLESHOOTING

### Problema: "Campo seller_ids non trovato"

**Soluzione**: Usa il campo relazionale corretto:
- In alcuni Odoo: `seller_ids.name`
- In altri: `seller_ids.partner_id.name`
- Prova entrambe le sintassi

### Problema: "Filtro non mostra risultati"

**Soluzione**: Verifica:
1. ID tag PRE-ORDINE è effettivamente 314 (vai su Inventario > Configurazione > Tags e controlla)
2. I prodotti hanno effettivamente il tag applicato
3. I prodotti hanno fornitori configurati nella tab "Acquisto" del prodotto

### Problema: "Raggruppamento per Fornitore non disponibile"

**Soluzione**:
- Assicurati di essere nella vista **Lista** (non Kanban)
- Verifica di avere i permessi per vedere i fornitori
- Controlla che i prodotti abbiano seller_ids popolati

---

## 11. SINTASSI ODOO DOMAIN - REFERENCE

### Operatori Disponibili

| Operatore | Descrizione | Esempio |
|-----------|-------------|---------|
| `=` | Uguale | `('categ_id', '=', 314)` |
| `!=` | Diverso | `('qty_available', '!=', 0)` |
| `>` | Maggiore | `('list_price', '>', 50)` |
| `>=` | Maggiore o uguale | `('qty_available', '>=', 10)` |
| `<` | Minore | `('standard_price', '<', 20)` |
| `<=` | Minore o uguale | `('weight', '<=', 5)` |
| `ilike` | Contiene (case-insensitive) | `('name', 'ilike', 'formaggio')` |
| `like` | Contiene (case-sensitive) | `('name', 'like', 'Formaggio')` |
| `in` | In lista | `('id', 'in', [1, 2, 3])` |
| `not in` | Non in lista | `('state', 'not in', ['draft', 'cancel'])` |

### Operatori Logici

- **AND** (default): `[('campo1', '=', 'valore1'), ('campo2', '=', 'valore2')]`
- **OR**: `['|', ('campo1', '=', 'valore1'), ('campo2', '=', 'valore2')]`
- **NOT**: `['!', ('campo', '=', 'valore')]`

### Esempio Complesso

```python
[
    '|',  # OR
        ('categ_id', '=', 314),  # Tag PRE-ORDINE
        ('categ_id', '=', 315),  # Altro tag
    ('qty_available', '>', 0),  # AND con stock > 0
    ('seller_ids.partner_id.name', 'ilike', 'ALIGRO')  # AND fornitore ALIGRO
]
```

---

## 12. CONCLUSIONI

### Filtro Più Semplice (Raccomandato)

```python
[('categ_id', '=', 314)]
```

Poi usa **Raggruppa per > Fornitore** nell'interfaccia.

### Filtro per Fornitore Specifico

```python
[('categ_id', '=', 314), ('seller_ids.partner_id.name', 'ilike', 'NOME_FORNITORE')]
```

### Prossimi Passi

1. Applica il filtro in Odoo
2. Verifica che mostri i 1,532 prodotti
3. Raggruppa per fornitore
4. Esporta in CSV se necessario
5. Salva come filtro preferito

---

**Data creazione**: 2025-11-09
**Odoo Version**: 17
**Testato su**: Lapa Platform (staging)
