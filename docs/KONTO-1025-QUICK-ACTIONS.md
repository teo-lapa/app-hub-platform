# KONTO 1025 UBS EUR - QUICK ACTIONS

## AZIONI IMMEDIATE DA ESEGUIRE

### ACTION 1: VERIFICA DUPLICATI (5 GRUPPI)

**Duplicato 1: 11/10/2023 - 2 righe da CHF -471.42**
```python
# IDs: 88224, 88226
# Partner: SOLUZIONI ALIMENTARI DI BONOMINI LUIGI
# Verificare se è pagamento duplicato
```

**Duplicato 2: 16/08/2024 - 2 righe da CHF -244.44**
```python
# IDs: 265322, 266365
# Verificare natura duplicazione
```

**Duplicato 3: 12/02/2025 - 2 righe da CHF -1,940.00**
```python
# IDs: 371830, 371832
# Verificare se storno o errore
```

**Duplicato 4: 08/05/2025 - 2 righe da CHF -3,880.00**
```python
# IDs: 454451, 454453
# Importo significativo - verificare fattura
```

**Duplicato 5: 16/10/2025 - 3 righe da CHF -2,233.91**
```python
# IDs: 539921, 539937, 540004
# Partner: INTERFRIGO TRANSPORT SRL
# TRIPLICATO - verificare urgentemente
```

**TOTALE POTENZIALE DUPLICATO:** ~CHF 10,000

---

### ACTION 2: VERIFICARE RIGHE CON IMPORTO ZERO

```python
# Righe da eliminare o correggere:
# - ID 308587 (17/07/2023)
# - ID 308585 (27/07/2023)
# - ID 308581 (08/08/2023)
# Descrizione: "CASANOVA FOOD SRL(pastadivenezia.it)"
# Possibile errore di importazione
```

---

### ACTION 3: ANALIZZARE VERSAMENTI GRANDI (>50k CHF)

#### Versamenti IN (DARE - positivi)
```
Data       Importo CHF    Importo EUR    ID       Note
2023-08-18  145,500.00    150,000.00    172823   Versamento mensile
2023-09-08  145,500.00    150,000.00    172826   Versamento mensile
2023-09-19   97,000.00    100,000.00    172806   Versamento extra
2023-10-06  145,500.00    150,000.00    172829   Versamento mensile
2023-10-23  145,500.00    150,000.00    172832   Versamento mensile
2023-12-08  145,500.00    150,000.00    172839   Versamento mensile
2023-12-21   97,000.00    100,000.00    172861   Versamento extra
...
TOTALE VERSAMENTI: ~6.3M CHF (~6.5M EUR)
```

**PATTERN:** Versamenti mensili ricorrenti di EUR 150,000 da agosto 2023 a gennaio 2025

**DOMANDA CRITICA:** Da dove arrivano questi versamenti?
- Trasferimenti interni da altro conto?
- Incassi da clienti?
- Capital injection?

#### Pagamenti OUT (AVERE - negativi)
```
Data       Importo CHF    Fornitore                   Note
2023-09-11   52,865.00    SC VERBITA TRUCK SRL        Trasporto?
2023-10-18   30,405.19    FERRAIUOLO FOODS SRL        Fornitore food
2023-12-07   35,141.85    FERRAIUOLO FOODS SRL        Fornitore food
2024-01-03   22,618.35    LATTICINI MOLISANI          Doppio pagamento stesso giorno
2024-01-04   22,618.35    LATTICINI MOLISANI          (possibile duplicato!)
...
```

---

### ACTION 4: RICONCILIARE MESI CRITICI

#### GIUGNO 2024: -168,979 CHF (57 righe)
```python
# Mese con crollo più grande
# Verificare:
# - Estratto conto UBS giugno 2024
# - Match tutte le 57 righe
# - Identificare gap
```

#### FEBBRAIO 2025: -156,353 CHF (41 righe)
```python
# Secondo crollo più grande
# Possibile errore contabile sistematico?
```

#### AGOSTO 2025: -173,006 CHF (49 righe)
```python
# Terzo crollo - NESSUN versamento in entrata!
# CRITICO: solo pagamenti, nessun incasso
# Verificare se mancano versamenti
```

---

### ACTION 5: SCRIPT DI CORREZIONE RAPIDA

```python
#!/usr/bin/env python3
"""
CORREZIONI RAPIDE KONTO 1025
Eseguire SOLO dopo validazione con commercialista
"""

import xmlrpc.client

url = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
db = 'lapadevadmin-lapa-v2-staging-2406-25408900'
username = 'paul@lapa.ch'
password = 'lapa201180'

# Connect
common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
uid = common.authenticate(db, username, password, {})
models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

# STEP 1: Elimina righe zero (dopo conferma)
zero_lines = [308587, 308585, 308581]
for line_id in zero_lines:
    # models.execute_kw(db, uid, password, 'account.move.line', 'unlink', [[line_id]])
    print(f"PREPARATO per eliminazione: {line_id}")

# STEP 2: Marca duplicati per revisione (non eliminare, solo tag)
duplicates = {
    '2023-10-11': [88224, 88226],
    '2024-08-16': [265322, 266365],
    '2025-02-12': [371830, 371832],
    '2025-05-08': [454451, 454453],
    '2025-10-16': [539921, 539937, 540004]  # TRIPLICATO!
}

for date, line_ids in duplicates.items():
    print(f"\nPOSSIBILE DUPLICATO {date}:")
    for line_id in line_ids:
        line = models.execute_kw(db, uid, password,
            'account.move.line', 'read',
            [[line_id]],
            {'fields': ['name', 'debit', 'credit', 'partner_id', 'ref']}
        )
        print(f"  - ID {line_id}: {line}")
        # Aggiungere tag o nota per revisione manuale

# STEP 3: Genera report versamenti vs pagamenti per mese critico
critical_months = ['2024-06', '2025-02', '2025-08']
for month in critical_months:
    print(f"\nANALISI DETTAGLIATA {month}:")
    lines = models.execute_kw(db, uid, password,
        'account.move.line', 'search_read',
        [[
            ['account_id.code', '=', '1025'],
            ['date', '>=', f'{month}-01'],
            ['date', '<', f'{month}-31']
        ]],
        {'fields': ['date', 'name', 'debit', 'credit', 'partner_id', 'ref']}
    )

    total_in = sum(l['debit'] for l in lines)
    total_out = sum(l['credit'] for l in lines)

    print(f"  Versamenti IN:  {total_in:>15,.2f} CHF")
    print(f"  Pagamenti OUT:  {total_out:>15,.2f} CHF")
    print(f"  Netto:          {total_in - total_out:>15,.2f} CHF")
    print(f"  Righe:          {len(lines)}")
```

---

## DOMANDE PER PAUL/LAPA

1. **Saldo bancario effettivo UBS EUR al 16/11/2025?**
   - Da online banking o estratto conto
   - Dovrebbe essere ~EUR 128,860.70 secondo aspettative

2. **Da dove arrivano i versamenti mensili di EUR 150,000?**
   - Trasferimenti da UBS CHF?
   - Incassi clienti esteri?
   - Altri conti?

3. **Confermare pagamenti LATTICINI MOLISANI 03-04/01/2024:**
   - Due pagamenti identici EUR 23,317.89
   - Sono legittimi o duplicato?

4. **Autorizzazione a correggere duplicati?**
   - 5 gruppi identificati (~EUR 10,000)
   - Procedere con storno?

5. **Priorità chiusura 2024:**
   - Bloccare fino a risoluzione?
   - O procedere con "reserve" per gap?

---

## TIMELINE SUGGERITA

### OGGI (16 Nov)
- [x] Analisi completa eseguita
- [ ] Conferma saldo bancario UBS EUR
- [ ] Decisione go/no-go correzioni

### DOMANI (17 Nov)
- [ ] Riconciliazione manuale giugno 2024
- [ ] Verifica duplicati
- [ ] Prime correzioni

### 18-20 Nov
- [ ] Riconciliazione febbraio 2025
- [ ] Riconciliazione agosto 2025
- [ ] Correzioni bulk

### 21-22 Nov
- [ ] Validazione finale saldi
- [ ] Conferma gap risolto
- [ ] Go per chiusura 2024

---

## ESCALATION

Se il gap NON si risolve entro 22 Nov:
1. Escalation a commercialista esterno
2. Audit UBS completo (costoso ma necessario)
3. Posticipare chiusura contabile 2024 a dicembre

---

**Prepared by:** Backend Specialist (Commercialista Mode)
**Date:** 2025-11-16
**Status:** READY FOR ACTION
