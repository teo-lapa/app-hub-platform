# BANK IMPORT 2024 - QUICK START GUIDE

## SITUAZIONE

**Problema**: Mancano gli estratti conto bancari da Giugno 2024 in poi
**Impatto**: CHF 343K di discrepanza + 3,777 transazioni non registrate
**Soluzione**: Import automatizzato PRONTO, serve solo 1 fix configurazione

---

## STEP 1: FIX CONFIGURAZIONE ODOO (2 MINUTI)

### Problema Tecnico
Odoo richiede un "Suspense Account" (conto transitor io) per le righe di estratto conto bancario. Questo account non è configurato nei journal UBS.

### Soluzione Automatica
```bash
cd "C:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/fix-suspense-account.py
```

**Output atteso**:
```
[OK] Connected as paul@lapa.ch
[OK] Found account: 1099 - Bank Suspense Account
[OK] Suspense account set to 1099
CONFIGURATION COMPLETE
```

### Soluzione Manuale (alternativa)
1. Vai su Odoo: **Accounting > Configuration > Journals**
2. Apri journal **BNK1** (UBS CHF 701J)
3. Tab **Incoming/Outgoing Payments**
4. Campo **Suspense Account** → seleziona account **1099**
5. Salva
6. Ripeti per **BNK2** (UBS EUR)

---

## STEP 2: ESEGUI IMPORT (10-15 MINUTI)

```bash
cd "C:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/import-bank-statements-2024.py
```

### Cosa fa lo script:
1. Connette a Odoo
2. Parsifica 6 file CSV (UBS CHF + EUR, tutto 2024)
3. Crea 6 bank statements
4. Importa **3,777 transazioni**
5. Valida balances
6. Genera report

### Monitoraggio
Lo script stampa progress in tempo reale:
```
Processing UBS CHF...
  Creating statement...
  [OK] Statement created (ID: 1076)
  Creating 756 transaction lines...
    100/756 lines created...
    200/756 lines created...
    ...
  [OK] 756/756 lines created
  [OK] Balance matches
```

### Tempi stimati
- UBS CHF Q1 (756 tx): ~2 min
- UBS CHF Q2 (850 tx): ~2 min
- UBS CHF Q3 (828 tx): ~2 min
- UBS CHF Q4 (856 tx): ~2 min
- UBS EUR H1 (267 tx): ~1 min
- UBS EUR H2 (220 tx): ~1 min
**TOTALE: ~10 minuti**

---

## STEP 3: VERIFICA RISULTATI

### Check 1: Report Generato
File: `bank-import-report-YYYYMMDD_HHMMSS.txt`

**Contenuto atteso**:
```
Files processed:      6
Successful imports:   6
Failed imports:       0
Transactions added:   3,777
```

### Check 2: Odoo UI
1. Vai su **Accounting > Bank > Bank Statements**
2. Verifica 6 nuovi statements:
   - UBS CHF 01/01/2024 - 30/03/2024 (756 lines)
   - UBS CHF 02/04/2024 - 29/06/2024 (850 lines)
   - UBS CHF 01/07/2024 - 30/09/2024 (828 lines)
   - UBS CHF 01/10/2024 - 31/12/2024 (856 lines)
   - UBS EUR 03/01/2024 - 28/06/2024 (267 lines)
   - UBS EUR 01/07/2024 - 31/12/2024 (220 lines)

### Check 3: Balances
- **UBS CHF**: Balance finale dovrebbe essere **CHF 182,573.56**
- **UBS EUR**: Balance finale dovrebbe essere **EUR 128,536.57**

---

## STEP 4: RICONCILIAZIONE (MANUALE)

Ora che le transazioni sono importate, serve riconciliarle:

1. **Odoo > Accounting > Bank > Reconciliation**
2. Seleziona journal **BNK1** o **BNK2**
3. Odoo mostrerà transazioni non riconciliate
4. Per ogni transazione:
   - Match automatico: clic su **Validate** se Odoo trova match
   - Match manuale: seleziona invoice/payment corrispondente
   - Nuova entry: crea accounting move se necessario

### Priorità Riconciliazione
1. **Grandi transazioni** (> CHF 10K) - massimo impatto
2. **Transazioni ovvie** (es. pagamenti fornitori con riferimento chiaro)
3. **Batch simili** (es. tutti pagamenti stipendi stesso giorno)

---

## TROUBLESHOOTING

### Errore: "Statement already exists"
**Causa**: Import già eseguito in passato
**Soluzione**:
- Se vuoi re-importare, elimina prima gli statements esistenti in Odoo
- Oppure modifica script per skippare (già configurato con `skip_if_exists: True`)

### Errore: "Journal not found"
**Causa**: Journal ID cambiato
**Soluzione**:
```bash
python scripts/check-odoo-journals.py
```
Verifica ID corretti e aggiorna in `import-bank-statements-2024.py` linea 38-39

### Errore: "Failed to create partner"
**Causa**: Nome partner non valido
**Soluzione**: Lo script skippa e continua, nessun problema critico

### Import molto lento
**Causa**: Connessione lenta o Odoo busy
**Soluzione**: Normale, è XML-RPC over HTTPS. Attendi completamento.

---

## FILE LOCATIONS

### Script Principali
```
C:\Users\lapa\Desktop\Claude Code\app-hub-platform\
  scripts/
    import-bank-statements-2024.py  ← MAIN IMPORT
    fix-suspense-account.py         ← FIX CONFIGURAZIONE
    check-odoo-journals.py          ← UTILITY
```

### CSV Source Files
```
C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\
  UBS CHF/
    - UBS CHF 1.1-31.3.2024.csv
    - UBS CHF 1.4-30.6.2024.csv
    - UBS CHF 1.7-30.9.2024.csv
    - UBS CHF 1.10-31.12.2024.csv
  UBS EUR/
    - UBS EUR 1.1-30.6.2024.csv
    - UBS EUR 1.7-31.12.2024.csv
```

### Reports Generati
```
C:\Users\lapa\Desktop\Claude Code\app-hub-platform\
  bank-import-execution.log           ← Log completo
  bank-import-report-*.txt            ← Summary report
  BANK-IMPORT-2024-REPORT.md          ← Documentazione completa
  BANK-IMPORT-QUICKSTART.md           ← Questa guida
```

---

## DATI IMPORTATI

### UBS CHF (Account: CH02 0027 8278 1220 8701 J)
- Q1 2024: 756 transazioni
- Q2 2024: 850 transazioni
- Q3 2024: 828 transazioni
- Q4 2024: 856 transazioni
- **Subtotal**: 3,290 transazioni CHF
- **Net Change 2024**: +CHF 38,834.09

### UBS EUR (Account: CH25 0027 8278 1220 8760 A)
- H1 2024: 267 transazioni
- H2 2024: 220 transazioni
- **Subtotal**: 487 transazioni EUR
- **Net Change 2024**: +EUR 41,765.59

### GRAND TOTAL
**3,777 transazioni** bancarie importate per anno 2024

---

## RISULTATO ATTESO

Dopo import completo:

✅ **CHF 343K discrepancy RISOLTA**
✅ **3,777 transazioni registrate** in Odoo
✅ **Estratti conto 2024 completi**
✅ **Pronto per chiusura contabile**
✅ **Audit trail completo** per commercialista

---

## SUPPORT

Per problemi:
1. Controlla log: `bank-import-execution.log`
2. Verifica configurazione: `check-odoo-journals.py`
3. Leggi documentazione completa: `BANK-IMPORT-2024-REPORT.md`

**Prepared by**: Claude (Backend Specialist)
**Last Updated**: 16 November 2025
