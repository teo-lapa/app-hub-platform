# ERRORI CRITICI IVA 2024 - ANALISI

## PROBLEMA PRINCIPALE IDENTIFICATO

**155 movimenti con IVA ma base imponibile = 0**

Dopo analisi dei primi 20 errori, ho identificato il **PATTERN COMUNE:**

### CAUSE PRINCIPALI:

#### 1. PAGAMENTI IVA ALL'ESTV (Ufficio Imposte)
```
- Move ID 72921: CHF -1,373.00 (17/12/2024) - "Eidgenossische Steuerverwaltung ESTV"
- Move ID 64569: CHF -368.15 (31/08/2024) - "Eidgenossische Steuerverwaltung"
- Move ID 72503: CHF -7,387.65 (31/10/2024) - "MWSTNr - 2024-10-03"
```

**SPIEGAZIONE:**
- Questi sono VERSAMENTI IVA all'ufficio imposte (ESTV)
- NON sono fatture con IVA, ma PAGAMENTI di IVA dovuta
- ERRORE: Sono stati registrati su conti IVA invece che come pagamenti

**SOLUZIONE:**
- Spostare da conto 2200/2201 (IVA a debito) a conto bancario
- NON devono apparire nel registro IVA
- Sono solo movimenti di cassa

#### 2. FONDO GARANZIA RESERVESUISSE
```
- Move ID 71205: CHF -17.02 (25/11/2024) - "reservesuisse genossenschaft"
- Move ID 70839: CHF -350.00 (18/11/2024) - "reservesuisse genossenschaft"
- Move ID 68290: CHF -27.11 (28/10/2024) - "reservesuisse genossenschaft"
... (molti altri)
```

**SPIEGAZIONE:**
- Reservesuisse = Fondo di garanzia per scorte obbligatorie (benzina, gas, ecc.)
- Questi sono CONTRIBUTI al fondo, NON fatture
- NON hanno IVA (sono tasse/contributi)

**SOLUZIONE:**
- Registrare come spese (conto 6xxx) senza IVA
- NON usare conti IVA (2200/1170)

#### 3. MOVIMENTI CON DESCRIZIONE "False"
```
- Move ID 72917: CHF -250.00 (17/12/2024) - "False"
- Move ID 59097: CHF -137.15 (31/05/2024) - "False"
```

**SPIEGAZIONE:**
- Errore di registrazione
- Campo descrizione vuoto o null
- Probabilmente movimenti manuali sbagliati

**SOLUZIONE:**
- Verificare manualmente in Odoo
- Correggere descrizione e importi

---

## BREAKDOWN ERRORI PER TIPO

### Tipo 1: Versamenti IVA ESTV (stima ~10 movimenti)
**Totale stimato:** CHF ~15,000
**Azione:** Riclassificare da 2200 a Banca

### Tipo 2: Fondo Reservesuisse (stima ~130 movimenti)
**Totale stimato:** CHF ~5,000
**Azione:** Riclassificare da 2200 a 6xxx (Spese)

### Tipo 3: Errori manuali (stima ~15 movimenti)
**Totale stimato:** CHF ~500
**Azione:** Correggere manualmente

---

## AZIONI CORRETTIVE

### PRIORITA 1: Versamenti IVA ESTV

**SQL per identificarli tutti:**
```sql
SELECT
  aml.id,
  aml.date,
  aml.name,
  aml.debit,
  aml.credit,
  am.name as move_name
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code IN ('2200', '2201')
  AND aml.date >= '2024-01-01' AND aml.date <= '2024-12-31'
  AND am.state = 'posted'
  AND (aml.name LIKE '%ESTV%' OR aml.name LIKE '%Steuerverwaltung%' OR aml.name LIKE '%MWSTNr%')
  AND (aml.tax_base_amount = 0 OR aml.tax_base_amount IS NULL);
```

**Correzione in Odoo:**
1. Trova il movimento (Move ID)
2. Apri in modalita modifica
3. Cambia conto da 2200/2201 a 1020 (Banca)
4. Salva

### PRIORITA 2: Fondo Reservesuisse

**SQL per identificarli tutti:**
```sql
SELECT
  aml.id,
  aml.date,
  aml.name,
  aml.debit,
  aml.credit,
  am.name as move_name
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code IN ('2200', '2201', '1170', '1171')
  AND aml.date >= '2024-01-01' AND aml.date <= '2024-12-31'
  AND am.state = 'posted'
  AND (aml.name LIKE '%reservesuisse%' OR aml.name LIKE '%RESERVESUISSE%')
  AND (aml.tax_base_amount = 0 OR aml.tax_base_amount IS NULL);
```

**Correzione in Odoo:**
1. Trova il movimento
2. Cambia conto da 2200/1170 a 6700 (Tasse e contributi)
3. Rimuovi IVA se presente
4. Salva

### PRIORITA 3: Errori manuali (descrizione "False")

**SQL:**
```sql
SELECT
  aml.id,
  aml.date,
  aml.debit,
  aml.credit,
  am.name as move_name
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code BETWEEN '2200' AND '2299'
  AND aml.date >= '2024-01-01' AND aml.date <= '2024-12-31'
  AND am.state = 'posted'
  AND aml.name = 'False'
  AND (aml.tax_base_amount = 0 OR aml.tax_base_amount IS NULL);
```

**Correzione manuale** necessaria.

---

## SCRIPT PYTHON PER CORREZIONE AUTOMATICA

Crea file: `scripts/correggi-errori-iva-critica.py`

```python
#!/usr/bin/env python3
"""
Corregge automaticamente gli errori IVA critici identificati
"""

import xmlrpc.client

ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USERNAME = 'paul@lapa.ch'
ODOO_PASSWORD = 'lapa201180'

# Connessione
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

def execute(model, method, domain=None, fields=None, **kwargs):
    if domain is None:
        domain = []
    args = [domain]
    if fields:
        kwargs['fields'] = fields
    return models.execute_kw(ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargs)

# 1. Trova movimenti ESTV (versamenti IVA)
print("Cercando versamenti IVA ESTV...")
estv_moves = execute(
    'account.move.line', 'search_read',
    domain=[
        ['account_id.code', 'in', ['2200', '2201']],
        ['date', '>=', '2024-01-01'],
        ['date', '<=', '2024-12-31'],
        ['parent_state', '=', 'posted'],
        '|', '|',
        ['name', 'ilike', 'ESTV'],
        ['name', 'ilike', 'Steuerverwaltung'],
        ['name', 'ilike', 'MWSTNr']
    ],
    fields=['id', 'date', 'name', 'debit', 'credit', 'move_id']
)

print(f"Trovati {len(estv_moves)} movimenti ESTV")
# TODO: Riclassificare su conto bancario

# 2. Trova movimenti Reservesuisse
print("\nCercando contributi Reservesuisse...")
reserve_moves = execute(
    'account.move.line', 'search_read',
    domain=[
        ['account_id.code', 'in', ['2200', '2201', '1170', '1171']],
        ['date', '>=', '2024-01-01'],
        ['date', '<=', '2024-12-31'],
        ['parent_state', '=', 'posted'],
        ['name', 'ilike', 'reservesuisse']
    ],
    fields=['id', 'date', 'name', 'debit', 'credit', 'move_id']
)

print(f"Trovati {len(reserve_moves)} contributi Reservesuisse")
# TODO: Riclassificare su conto spese

print("\nATTENZIONE: Questo script identifica i movimenti ma NON li modifica automaticamente.")
print("Per sicurezza, correggere manualmente in Odoo.")
```

---

## IMPATTO SULLA QUADRATURA IVA

### PRIMA della correzione:
- IVA Vendite: CHF 141,495.28
- IVA Acquisti: CHF 165,492.98
- Saldo: CHF -23,997.70 (A CREDITO)

### DOPO la correzione (stimato):
- IVA Vendite: CHF ~156,000 (+15,000 versamenti ESTV rimossi da credito)
- IVA Acquisti: CHF ~160,000 (-5,000 Reservesuisse rimossi)
- **Nuovo Saldo: CHF ~-4,000 (A CREDITO)**

**ATTENZIONE:** Questi sono stime! Bisogna calcolare con precisione dopo le correzioni.

---

## PROSSIMI STEP

1. **OGGI:** Identificare tutti i movimenti ESTV e Reservesuisse
2. **DOMANI:** Correggere manualmente i primi 10 movimenti piu grandi
3. **QUESTA SETTIMANA:** Completare tutte le 155 correzioni
4. **DOPO CORREZIONI:** Rieseguire `python scripts/riconciliazione-iva-2024.py`
5. **VERIFICA FINALE:** Errori critici = 0

---

**GENERATO DA:** Claude Code - Data Analyst
**DATA:** 2024-11-16
**FILE EXCEL:** RICONCILIAZIONE-IVA-2024.xlsx (Foglio "ERRORI IVA")
