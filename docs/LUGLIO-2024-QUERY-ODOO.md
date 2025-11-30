# QUERY ODOO - LUGLIO 2024

Quick reference per verifica in Odoo Web Interface

---

## SETUP

1. Login: https://erp.alpenpur.ch
2. Menu: Contabilita > Primanota
3. Attiva filtri personalizzati

---

## QUERY 1: Saldi Apertura (30 Giugno 2024)

**Filtri:**
```
Conto: 1024, 1025, 1026
Data: < 01/07/2024
Stato: Registrato
```

**Azione:**
- Raggruppa per: Conto
- Mostra colonne: Dare, Avere
- Calcola: Saldo = Dare - Avere

**Risultati attesi:**
- 1024: CHF 142,785.59
- 1025: EUR -50,573.62
- 1026: TBD

---

## QUERY 2: Movimenti Luglio 2024

**Filtri:**
```
Conto: 1024, 1025, 1026
Data: >= 01/07/2024 AND <= 31/07/2024
Stato: Registrato
```

**Colonne da esportare:**
- ID
- Data
- Descrizione
- Riferimento
- Dare
- Avere
- Saldo
- Partner
- Giornale

**Ordinamento:** Data ASC

**Esporta:** CSV/Excel

---

## QUERY 3: Saldi Chiusura (31 Luglio 2024)

**Filtri:**
```
Conto: 1024, 1025, 1026
Data: <= 31/07/2024
Stato: Registrato
```

**Azione:**
- Raggruppa per: Conto
- Mostra colonne: Dare, Avere
- Calcola: Saldo = Dare - Avere

**Risultati attesi:**
- 1024: CHF 345,760.44
- 1025: EUR 14,702.54
- 1026: TBD

---

## QUERY 4: Duplicati

**Filtri:**
```
Conto: 1024, 1025, 1026
Data: >= 01/07/2024 AND <= 31/07/2024
```

**Azione:**
- Raggruppa per: Data, Dare, Avere
- Filtra: Conta > 1

**Se trovi duplicati:**
1. Verifica descrizioni
2. Verifica partner
3. Verifica se legittimi o errori

---

## QUERY 5: Movimenti Grandi (>50K)

**Filtri:**
```
Conto: 1024, 1025, 1026
Data: >= 01/07/2024 AND <= 31/07/2024
Dare: > 50,000 OR Avere: > 50,000
```

**Colonne:**
- Data
- Descrizione
- Dare
- Avere
- Partner
- Riferimento

**Ordinamento:** Dare DESC, Avere DESC

---

## QUERY ALTERNATIVE (Python XML-RPC)

### Query 1: Opening Balance

```python
domain = [
    ('account_id.code', 'in', ['1024', '1025', '1026']),
    ('date', '<', '2024-07-01'),
    ('parent_state', '=', 'posted')
]
fields = ['account_id', 'debit', 'credit']
# Aggregate in Python: group by account_id, sum debit - credit
```

### Query 2: July Movements

```python
domain = [
    ('account_id.code', 'in', ['1024', '1025', '1026']),
    ('date', '>=', '2024-07-01'),
    ('date', '<=', '2024-07-31'),
    ('parent_state', '=', 'posted')
]
fields = ['id', 'date', 'name', 'ref', 'debit', 'credit',
          'balance', 'move_id', 'partner_id', 'journal_id']
order = 'date ASC, id ASC'
```

### Query 3: Closing Balance

```python
domain = [
    ('account_id.code', 'in', ['1024', '1025', '1026']),
    ('date', '<=', '2024-07-31'),
    ('parent_state', '=', 'posted')
]
fields = ['account_id', 'debit', 'credit']
# Aggregate in Python: group by account_id, sum debit - credit
```

### Query 4: Find Duplicates

```python
domain = [
    ('account_id.code', 'in', ['1024', '1025', '1026']),
    ('date', '>=', '2024-07-01'),
    ('date', '<=', '2024-07-31')
]
fields = ['date', 'debit', 'credit', 'name', 'id']
# Group in Python: by (date, debit, credit), count > 1
```

### Query 5: Large Movements

```python
domain = [
    ('account_id.code', 'in', ['1024', '1025', '1026']),
    ('date', '>=', '2024-07-01'),
    ('date', '<=', '2024-07-31'),
    '|',
    ('debit', '>', 50000),
    ('credit', '>', 50000)
]
fields = ['date', 'name', 'debit', 'credit', 'partner_id', 'ref']
order = 'debit DESC, credit DESC'
```

---

## EXPORT EXCEL

### Via Odoo UI

1. Esegui query
2. Seleziona tutte le righe (checkbox)
3. Menu: Azione > Esporta
4. Seleziona colonne desiderate
5. Formato: Excel
6. Download

### Salva come

- `luglio-2024-konto-1024-movimenti.xlsx`
- `luglio-2024-konto-1025-movimenti.xlsx`
- `luglio-2024-konto-1026-movimenti.xlsx`

---

## PIVOT ANALYSIS

In Excel, crea Pivot Table con:

**Righe:** Data (gruppo per settimana)
**Colonne:** Dare vs Avere
**Valori:** Somma importi
**Filtri:** Partner, Giornale

Questo ti da visione settimanale dei flussi.

---

## VERIFICATION FORMULAS

### In Excel/Calc

```excel
# Saldo finale
= Saldo_Apertura + SOMMA(Dare) - SOMMA(Avere)

# Verifica singola riga
= SE(ABS(Saldo_Calcolato - Saldo_Atteso) < 0.01; "OK"; "ERRORE")

# Conta movimenti senza partner
= CONTA.SE(Partner; "")

# Conta movimenti zero
= CONTA.PIU.SE(Dare; 0; Avere; 0)
```

---

## QUICK CHECKS

### 1. Completeness Check
```
Numero movimenti Odoo = Numero righe estratto bancario?
```

### 2. Balance Check
```
Saldo calcolato Odoo = Saldo estratto bancario?
Tolleranza: ±0.01
```

### 3. Partner Check
```
Movimenti senza partner = 0?
Se > 0: assegna partner mancanti
```

### 4. Duplicate Check
```
Duplicati trovati = 0?
Se > 0: investiga e risolvi
```

### 5. Reconciliation Check
```
Movimenti riconciliati / Totale movimenti = 100%?
```

---

## TROUBLESHOOTING

### Saldo non corrisponde

1. Verifica filtro data corretto
2. Verifica stato = "Registrato" (no bozze)
3. Verifica no movimenti dopo 31/07
4. Controlla movimenti stornati
5. Verifica valuta corretta (CHF vs EUR)

### Movimenti mancanti

1. Controlla filtro account code
2. Verifica periodo esatto
3. Cerca per importo specifico
4. Verifica stato registrazione

### Performance lenta

1. Usa date range limitato
2. Query solo campi necessari
3. Limita risultati (es. 1000 righe)
4. Esporta e analizza offline

---

## CONTACT

Per supporto tecnico Odoo:
- Documentazione: https://www.odoo.com/documentation
- Query XML-RPC: vedi `scripts/verifica-luglio-2024-completa.py`
- Report strutturato: vedi `REPORT-LUGLIO-2024.json`
