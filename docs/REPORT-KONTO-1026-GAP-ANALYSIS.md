# ANALISI KONTO 1026 CREDIT SUISSE - GAP CHF 463K

**Data Analisi**: 16 Novembre 2025
**Commercialista**: Backend Specialist (Analisi Tecnica)
**Account**: 1026 - CHF-CRS PRINCIPALE, 3977497-51

---

## EXECUTIVE SUMMARY

**PROBLEMA IDENTIFICATO**: Saldo errato di CHF 466,983.01

- **Saldo Atteso**: CHF 24,897.72
- **Saldo in Odoo**: CHF 491,880.73
- **GAP**: +CHF 466,983.01 (troppo alto)

**CAUSA PRINCIPALE**: Movimenti di "azzeramento 2023" del 03.06.2024 sbagliati

---

## DATI ESTRATTI

- **Totale righe conto 1026**: 3,325 movimenti
- **Totale DARE**: CHF 995,842.28
- **Totale AVERE**: CHF 503,961.55
- **Saldo Calcolato**: CHF 491,880.73
- **Movimenti 2023**: 16
- **Movimenti 2024**: 1,936

---

## MOVIMENTI ANOMALI IDENTIFICATI

### 1. MOVIMENTO PRINCIPALE ERRATO - "Azzeramento 2023" (03.06.2024)

#### Move ID 58103 - CHF 132,834.54
```
Line ID: 266506
Data: 2024-06-03
Descrizione: "azzeramento 2023"
DARE: CHF 132,834.54
AVERE: CHF 0.00
Ref: (vuoto)
Riconciliato: NO
```

#### Move ID 58101 - CHF 50,000.00
```
Line ID: 266504
Data: 2024-06-03
Descrizione: "azzerare 2023"
DARE: CHF 50,000.00
AVERE: CHF 0.00
Ref: (vuoto)
Riconciliato: NO
```

**TOTALE MOVIMENTI ERRATI "AZZERAMENTO"**: CHF 182,834.54

### 2. RETTIFICA SALDO LIQUIDITA 31.12.2023

```
Line ID: 525911
Move ID: 95447
Data: 2023-12-31
Descrizione: "Rettifica CS 51 da -10.000 a 10.903,87"
DARE: CHF 20,903.87
AVERE: CHF 0.00
Ref: "Rettifiche saldi liquidità 31.12.2023 - ALLINEAMENTO PDF COMMERCIALISTA"
Riconciliato: NO
```

### 3. DUPLICATI RICLASSIFICAZIONI 2023

Trovati **3 gruppi di duplicati** da riclassificazioni errate:

#### Gruppo A - 05.07.2023 - CHF 20,000 (DUPLICATO)
- **Line 172751** (Move 34335): Trasferimento AVERE -20,000
- **Line 541002** (Move 97142): Riclassifica DARE +20,000 (RICLASS-BANK-172752)
- **Effetto netto**: CHF 0 (ma doppio movimento)

#### Gruppo B - 23.08.2023 - CHF 20,000 (DUPLICATO)
- **Line 172745** (Move 34331): Trasferimento AVERE -20,000
- **Line 540990** (Move 97136): Riclassifica DARE +20,000 (RICLASS-BANK-172746)
- **Effetto netto**: CHF 0 (ma doppio movimento)

#### Gruppo C - 15.09.2023 - CHF 20,000 (DUPLICATO)
- **Line 172888** (Move 34327): Trasferimento AVERE -20,000
- **Line 540982** (Move 97132): Riclassifica DARE +20,000 (RICLASS-BANK-172889)
- **Effetto netto**: CHF 0 (ma doppio movimento)

**NOTA**: Questi duplicati si compensano a zero, MA potrebbero indicare errori strutturali nella contabilità.

---

## CALCOLO DETTAGLIATO GAP

| Componente | Importo CHF | Tipo |
|------------|-------------|------|
| Saldo calcolato attuale | 491,880.73 | |
| - Azzeramento errato #1 | -132,834.54 | DARE errato |
| - Azzeramento errato #2 | -50,000.00 | DARE errato |
| - Rettifica CS 51 sospetta | -20,903.87 | Da verificare |
| **Saldo dopo correzione principale** | **288,142.32** | |
| Saldo atteso | 24,897.72 | |
| **GAP residuo** | **263,244.60** | Da analizzare |

**ATTENZIONE**: Anche dopo eliminazione movimenti "azzeramento", resta un gap significativo.

---

## IPOTESI CAUSA GAP RESIDUO

### Scenario 1: Saldo Apertura 2024 Errato
Il saldo di apertura 2024 potrebbe essere stato inserito con valore sbagliato.

**VERIFICA NECESSARIA**:
- Controllare saldo chiusura 2023 nel bilancio commercialista
- Confrontare con saldo apertura 2024 in Odoo
- Verificare eventuali movimenti di "riporto" o "apertura"

### Scenario 2: Movimenti 2023 nel 2024
16 movimenti datati 2023 potrebbero contenere errori:

**Totale movimenti 2023**: CHF 100,903.87

Potrebbero essere:
- Movimenti del 2023 registrati tardivamente
- Rettifiche retroattive
- Errori di data entry

### Scenario 3: Cumulo di Piccoli Errori
Il gap potrebbe derivare da somma di:
- Differenze di cambio non contabilizzate
- Commissioni bancarie non registrate
- Interessi attivi/passivi mancanti
- Errori di arrotondamento accumulati

---

## AZIONI CORRETTIVE IMMEDIATE

### STEP 1: Eliminare Movimenti "Azzeramento 2023" Errati

**DA ELIMINARE**:

1. **Move 58103** (Line 266506) - CHF 132,834.54
   ```python
   # Odoo XML-RPC
   models.execute_kw(db, uid, password,
       'account.move', 'button_draft', [[58103]])
   models.execute_kw(db, uid, password,
       'account.move', 'unlink', [[58103]])
   ```

2. **Move 58101** (Line 266504) - CHF 50,000.00
   ```python
   models.execute_kw(db, uid, password,
       'account.move', 'button_draft', [[58101]])
   models.execute_kw(db, uid, password,
       'account.move', 'unlink', [[58101]])
   ```

**SALDO DOPO**: CHF 309,046.19 (invece di 491,880.73)

---

### STEP 2: Verificare Rettifica 31.12.2023

**Move 95447** (Line 525911) - CHF 20,903.87

**DOMANDE**:
1. È corretta questa rettifica?
2. Perché passa da -10,000 a +10,903.87?
3. È allineata al PDF del commercialista?

**AZIONE**: Confrontare con bilancio 31.12.2023

---

### STEP 3: Analizzare Saldo Apertura 2024

**QUERY NECESSARIA**:
```python
# Trova tutti i movimenti di apertura 2024
opening_moves = models.execute_kw(db, uid, password,
    'account.move.line', 'search_read',
    [[
        ['account_id', '=', 182],  # Konto 1026
        ['date', '>=', '2024-01-01'],
        ['date', '<=', '2024-01-05'],
        ['name', 'ilike', 'apertura|opening|riporto']
    ]],
    {'fields': ['id', 'date', 'name', 'debit', 'credit', 'move_id']}
)
```

**VERIFICARE**:
- Importo saldo apertura
- Corrispondenza con saldo chiusura 2023
- Data di registrazione

---

### STEP 4: Eliminare Duplicati Riclassificazioni (Opzionale)

Se le riclassificazioni sono errate, eliminare movimenti:

**DA ELIMINARE**:
- Move 97142 (Riclassifica 05.07.2023) - Line 541002
- Move 97136 (Riclassifica 23.08.2023) - Line 540990
- Move 97132 (Riclassifica 15.09.2023) - Line 540982

**NOTA**: Eliminare solo DOPO verifica con commercialista.

---

## SALDO TEORICO CORRETTO

### Scenario A: Solo Eliminazione Azzeramenti
```
Saldo attuale:           CHF 491,880.73
- Azzeramento #1:        - CHF 132,834.54
- Azzeramento #2:        - CHF  50,000.00
= Saldo corretto:        CHF 309,046.19
Saldo atteso:            CHF  24,897.72
GAP residuo:             CHF 284,148.47
```

### Scenario B: Eliminazione + Correzione Rettifica 31.12
```
Saldo da scenario A:     CHF 309,046.19
- Rettifica CS 51:       - CHF  20,903.87
= Saldo corretto:        CHF 288,142.32
Saldo atteso:            CHF  24,897.72
GAP residuo:             CHF 263,244.60
```

**CONCLUSIONE**: Il problema NON si risolve solo eliminando gli azzeramenti.

---

## NEXT STEPS - INDAGINE APPROFONDITA

### 1. Confronto con Estratti Conto Bancari
- Scaricare estratti conto Credit Suisse 2023-2024
- Confrontare saldo finale dicembre 2023
- Confrontare saldo attuale
- Identificare transazioni mancanti/duplicate

### 2. Verifica Movimenti Clearing
Molti movimenti sono "Pagamento clearing" da CHF 20,000:
- Verificare se sono compensazioni interne LAPA
- Controllare contropartita (quale conto?)
- Assicurarsi che non siano duplicati

### 3. Analisi per Anno Fiscale
```sql
-- Query per Odoo
SELECT
    EXTRACT(YEAR FROM date) as anno,
    SUM(debit) as totale_dare,
    SUM(credit) as totale_avere,
    SUM(debit - credit) as saldo
FROM account_move_line
WHERE account_id = 182  -- Konto 1026
GROUP BY EXTRACT(YEAR FROM date)
ORDER BY anno;
```

### 4. Riconciliazione Bancaria Completa
- Importare estratti conto in Odoo
- Riconciliare ogni movimento
- Identificare partite aperte
- Correggere discrepanze

---

## RACCOMANDAZIONI COMMERCIALISTA

1. **URGENTE**: Eliminare movimenti "azzeramento 2023" (58103, 58101)

2. **PRIORITA' ALTA**: Verificare saldo apertura 2024

3. **NECESSARIO**: Confronto con estratti conto bancari originali

4. **CONSIGLIATO**: Riconciliazione bancaria completa per 2024

5. **IMPORTANTE**: Verificare logica riclassificazioni bank transfer

---

## FILE GENERATI

- `analisi-konto-1026-report.json` - Dati completi analisi
- `REPORT-KONTO-1026-GAP-ANALYSIS.md` - Questo report

---

## CONTATTI

Per ulteriori chiarimenti o esecuzione correzioni:
- **Analisi tecnica**: Backend Specialist
- **Script correzione**: Disponibile su richiesta
- **Verifica commercialista**: Confronto con bilancio ufficiale necessario

---

**FINE REPORT**

*Generato automaticamente da sistema di analisi contabile Odoo*
*Data: 16 Novembre 2025 - Ore 17:45*
