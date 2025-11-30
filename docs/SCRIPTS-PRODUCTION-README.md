# SCRIPTS PRODUCTION - Chiusura Contabile 2024

**Questa guida organizza tutti gli script necessari per la chiusura contabile 2024 in production.**

---

## SCRIPTS PER FASE

### FASE 0: Setup e Verifica

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `test-odoo-connection.py` | Testa connessione Odoo | OK/FAIL | 10s |
| `verifica-rapida-conti-chiave.py` | Verifica 5 conti chiave | Saldi conti | 1min |

**Esecuzione**:
```bash
# Test connessione
python scripts/test-odoo-connection.py

# Verifica conti chiave (stato iniziale)
python scripts/verifica-rapida-conti-chiave.py
```

---

### FASE 1: Import Bank Statements

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `import-bank-statements-2024.py` | Import estratti conto bancari | N movimenti importati | 30min |

**Prerequisiti**:
- File PDF/CSV estratti conto in `data/bank-statements/2024/`
- 8 conti bancari (1002, 1003, 1004, 1005, 1006, 1010, 1011, 1012)

**Esecuzione**:
```bash
# Import automatico tutti gli estratti
python scripts/import-bank-statements-2024.py --year 2024

# Verifica import
python scripts/validate-bank-reconciliation.py
```

**File Input Richiesti**:
```
data/bank-statements/2024/
├── postfinance-chf-2024.pdf
├── ubs-chf-2024.pdf
├── ubs-eur-2024.pdf
├── ubs-usd-2024.pdf
├── raiffeisen-chf-2024.pdf
├── creditsuisse-chf-2024.pdf
├── postfinance-eur-2024.pdf
└── postfinance-usd-2024.pdf
```

---

### FASE 2: Riclassificazioni Konto 10901

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `ALLINEA-10901-FX-RICLASSIFICA.py` | Riclassifica FX | JE IDs | 5min |
| `ALLINEA-10901-CREDITCARD-RICLASSIFICA.py` | Riclassifica carte | JE IDs | 5min |
| `allinea_konto_10901_FINALE.py` | Chiusura completa 10901 | Saldo finale | 10min |

**Sequenza**:
```bash
# 1. Riclassifica FX
python scripts/ALLINEA-10901-FX-RICLASSIFICA.py

# 2. Riclassifica Credit Card
python scripts/ALLINEA-10901-CREDITCARD-RICLASSIFICA.py

# 3. Chiusura finale 10901
python scripts/allinea_konto_10901_FINALE.py

# 4. Verifica saldo = 0
python scripts/verifica_finale_10901.py
```

**Output Atteso**:
```
Konto 10901: CHF 0.00 ✓
```

---

### FASE 3: Riconciliazione Konto 1022 (Outstanding Receipts)

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `find-large-movements-1022.py` | Analisi movimenti grandi | Top movimenti | 2min |
| `odoo-reconcile-1022.py` | Riconciliazione base | N riconciliati | 10min |
| `manual-reconcile-top15.py` | Riconciliazione manuale top 15 | Riconciliazioni | 5min |

**Sequenza**:
```bash
# 1. Analizza movimenti
python scripts/find-large-movements-1022.py

# 2. Auto-riconciliazione
python scripts/odoo-reconcile-1022.py

# 3. Manual top 15 (se saldo non zero)
python scripts/manual-reconcile-top15.py --account 1022

# 4. Verifica saldo
python scripts/verifica-rapida-conti-chiave.py
```

---

### FASE 4: Riconciliazione Konto 1023 (Outstanding Payments)

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `analizza-pattern-1023.py` | Analisi pattern pagamenti | Pattern trovati | 3min |
| `riconcilia-konto-1023-advanced.py` | Riconciliazione avanzata | N riconciliati | 15min |
| `verifica-riconciliazione-1023.py` | Verifica finale | Saldo finale | 1min |

**Sequenza**:
```bash
# 1. Analizza pattern
python scripts/analizza-pattern-1023.py

# 2. Riconciliazione avanzata
python scripts/riconcilia-konto-1023-advanced.py

# 3. Verifica
python scripts/verifica-riconciliazione-1023.py
```

**Alternative** (se script advanced non funziona):
```bash
# Riconciliazione base
python scripts/riconcilia-konto-1023.py

# Chiusura manuale (ultima risorsa)
python scripts/chiudi-konto-1022-1023-v2.py --account 1023
```

---

### FASE 5: Chiusura Konto 1099 (Transferkonto)

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `chiusura-konto-1099.py` | Chiusura 1099 | JE ID chiusura | 5min |

**Esecuzione**:
```bash
# Chiudi 1099
python scripts/chiusura-konto-1099.py

# Verifica saldo = 0
python scripts/verifica-rapida-conti-chiave.py
```

---

### FASE 6: Rettifica Cash 1001

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `ALLINEA-1001-DUPLICATI.py` | Elimina duplicati cash | N eliminati | 3min |
| `rettifica-cash-1001.py` | Rettifica saldo cash | JE rettifica | 5min |

**Sequenza**:
```bash
# 1. Elimina duplicati (se presenti)
python scripts/ALLINEA-1001-DUPLICATI.py

# 2. Rettifica saldo (solo se necessario)
python scripts/rettifica-cash-1001.py --dry-run
python scripts/rettifica-cash-1001.py --execute
```

**ATTENZIONE**: Esegui solo se saldo cash è anomalo (< CHF 0 o > CHF 200K)

---

### FASE 7: Verifica Finale

| Script | Scopo | Output | Tempo |
|--------|-------|--------|-------|
| `verifica-finale-staging-completa.py` | Verifica completa | Report JSON | 5min |
| `genera-excel-chiusura-2024.py` | Report Excel | XLSX file | 3min |
| `genera-pdf-chiusura-2024.py` | Report PDF | PDF file | 3min |
| `VERIFICA-SALDI-FINALE.py` | Verifica saldi finali | OK/FAIL | 2min |

**Sequenza**:
```bash
# 1. Verifica completa
python scripts/verifica-finale-staging-completa.py

# 2. Genera Excel
python scripts/genera-excel-chiusura-2024.py

# 3. Genera PDF (per commercialista)
python scripts/genera-pdf-chiusura-2024.py

# 4. Verifica saldi finale
python scripts/VERIFICA-SALDI-FINALE.py
```

**Output Files**:
- `report-finale-production.json`
- `REPORT-FINALE-PRODUCTION-2024.xlsx`
- `REPORT-CHIUSURA-2024.pdf`

---

## UTILITY SCRIPTS

### Analisi e Debugging

| Script | Scopo |
|--------|-------|
| `analisi_dettagliata_10901.py` | Analisi dettagliata Konto 10901 |
| `analizza-movimenti-anomali-2024.py` | Trova movimenti anomali |
| `check-account-fields.py` | Verifica campi account Odoo |
| `investigate-merenda69.py` | Debug partner "MERENDA69" |

**Usage**:
```bash
# Analisi 10901
python scripts/analisi_dettagliata_10901.py

# Movimenti anomali
python scripts/analizza-movimenti-anomali-2024.py --threshold 10000
```

---

### Cleanup e Manutenzione

| Script | Scopo |
|--------|-------|
| `cleanup-zero-payments.py` | Elimina pagamenti a zero |
| `cancella-move-errati.py` | Cancella JE errati |
| `ELIMINA-MERENDA69.py` | Elimina partner test |

**Usage**:
```bash
# Cleanup zero payments
python scripts/cleanup-zero-payments.py --dry-run
python scripts/cleanup-zero-payments.py --execute

# Cancella JE errati
python scripts/cancella-move-errati.py --move-ids "123,456,789"
```

**ATTENZIONE**: Usa con cautela, operazioni irreversibili!

---

### Riconciliazioni Avanzate

| Script | Scopo |
|--------|-------|
| `run-riconciliazione-completa.py` | Riconciliazione completa tutti i conti |
| `riconciliazione-bancaria-completa-2024.py` | Riconciliazione bancaria |
| `riconciliazione-clienti-fornitori-2024.py` | Riconciliazione AR/AP |
| `riconciliazione-iva-2024.py` | Riconciliazione IVA |

---

### Analisi Mensile e Report

| Script | Scopo |
|--------|-------|
| `analisi-mensile-2024.py` | Report mensile 2024 |
| `genera-master-dashboard.py` | Dashboard completa |
| `aging-analysis-ar.py` | Aging crediti clienti |

---

## SCRIPTS ROLLBACK

### Reverse Operations

**File**: Vedere `ROLLBACK-PLAN.md` per script di rollback completi.

**Quick Commands**:
```bash
# Reverse tutte le JE di oggi
python scripts/reverse-journal-entries.py --date 2025-11-16

# Reverse JE specifiche
python scripts/reverse-journal-entries.py --move-ids "123,456"
```

---

## CONFIGURAZIONE SCRIPTS

### Environment Variables

Crea file `.env.production`:

```bash
# .env.production
ODOO_URL=https://lapa-v2-production.odoo.com
ODOO_DB=lapa-v2-production-XXXXX
ODOO_USER=paul@lapa.ch
ODOO_PASSWORD=XXXXX

# Optional
LOG_LEVEL=INFO
TIMEOUT=300
DRY_RUN=false
```

**Usage in scripts**:
```python
import os
from dotenv import load_dotenv

load_dotenv('.env.production')

ODOO_URL = os.getenv('ODOO_URL')
ODOO_DB = os.getenv('ODOO_DB')
# ...
```

---

### Modifiche Necessarie per Production

**In OGNI script, cambia da staging a production**:

```python
# STAGING (default)
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"

# PRODUCTION (modificare!)
ODOO_URL = "https://lapa-v2-production.odoo.com"  # ← URL production
ODOO_DB = "lapa-v2-production-XXXXX"  # ← DB production
```

**CHECKLIST**:
- [ ] URL modificato in tutti gli script
- [ ] DB name modificato
- [ ] Credenziali production verificate
- [ ] Test connection prima di eseguire

---

## TESTING SCRIPTS

### Pre-Execution Test

```bash
# Test connessione
python scripts/test-odoo-connection.py
# Output atteso: "✓ Connection OK - UID: X"

# Test lettura account
python scripts/check-account-fields.py --account 1099
# Output atteso: Account details

# Test dry-run script
python scripts/[QUALSIASI-SCRIPT].py --dry-run
# Output: Preview senza modifiche
```

---

## COMMON ISSUES

### Problema: "Connection Refused"
**Soluzione**: Verifica URL, DB name, credenziali

### Problema: "Access Denied"
**Soluzione**: User deve avere gruppo "Accounting / Advisor"

### Problema: "Account not found"
**Soluzione**: Verifica codice account esistente in Odoo

### Problema: Script timeout
**Soluzione**: Aumenta timeout in config o splitta operazioni

---

## LOGS

**Ogni script salva log in**:
```
logs/
├── test-connection-TIMESTAMP.log
├── import-statements-TIMESTAMP.log
├── chiusura-10901-TIMESTAMP.log
└── ...
```

**Conserva i log per**:
- Debugging errori
- Audit trail
- Documentazione commercialista

---

## EXECUTION CHECKLIST

Prima di eseguire QUALSIASI script in production:

- [ ] Backup database fatto
- [ ] Script testato in staging
- [ ] Dry-run eseguito (se disponibile)
- [ ] Output dry-run verificato
- [ ] Credenziali production corrette
- [ ] Log directory exists
- [ ] Rollback plan ready

---

## SUPPORT

**In caso di problemi**:

1. **Check logs**: `logs/[script-name]-latest.log`
2. **Dry-run**: Testa con `--dry-run` se disponibile
3. **Staging**: Replica errore in staging
4. **Rollback**: Se in dubbio, fai rollback (vedi `ROLLBACK-PLAN.md`)
5. **Contatti**: Developer on-call

---

## SCRIPT DEPENDENCIES

**Librerie Python richieste**:
```bash
pip install xmlrpc
pip install python-dotenv
pip install openpyxl  # per Excel
pip install reportlab  # per PDF
pip install pandas  # per analisi
```

**Check dependencies**:
```bash
python -c "import xmlrpc.client; print('OK')"
python -c "import openpyxl; print('OK')"
```

---

## FINAL NOTES

1. **Sequenza è critica**: Non saltare step
2. **Dry-run sempre**: Quando disponibile
3. **Verifica dopo ogni step**: Non procedere se errori
4. **Log everything**: Ogni comando salvato
5. **Backup first**: Mai eseguire senza backup

---

**Questo documento è il companion del PIANO-PRODUCTION-2024.md**

**Per l'execution step-by-step, segui il PIANO principale.**

**Per i dettagli tecnici scripts, consulta questo README.**
