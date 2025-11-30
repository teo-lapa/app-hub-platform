# Scripts Riconciliazione Account 1022

Questo folder contiene gli script Python per la riconciliazione del conto 1022 (Outstanding Receipts).

---

## Quick Start

### 1. Installazione Dipendenze

```bash
pip install pandas openpyxl
```

### 2. Esecuzione Rapida

```bash
# Analisi situazione corrente
python find-large-movements-1022.py

# Riconciliazione assistita Top 15
python manual-reconcile-top15.py
```

---

## Scripts Disponibili

### 1. odoo-reconcile-1022.py

**Scopo:** Riconciliazione automatica completa di tutte le righe non riconciliate.

**Uso:**
```bash
python odoo-reconcile-1022.py
```

**Output:**
- `reconciliation-report-YYYYMMDD-HHMMSS.xlsx` (Excel con 4 sheets)
- Console output con progress

**Quando usarlo:**
- Prima analisi completa
- Per verificare quante righe possono essere auto-riconciliate
- Per identificare patterns di errore

**Tempo esecuzione:** ~5-10 minuti per 204 righe

---

### 2. find-large-movements-1022.py

**Scopo:** Identifica i movimenti più grandi non riconciliati.

**Uso:**
```bash
python find-large-movements-1022.py
```

**Output:**
- Lista Top 20 movimenti ordinati per importo
- Distribuzione per categoria (piccoli, medi, grandi)
- Dettagli completi di ogni movimento

**Quando usarlo:**
- Per identificare priorità (strategia 80/20)
- Per capire dove concentrare effort
- Per verifica finale dopo riconciliazioni

**Tempo esecuzione:** ~30 secondi

---

### 3. manual-reconcile-top15.py

**Scopo:** Assistente interattivo per riconciliare i 15 movimenti più grandi.

**Uso:**
```bash
python manual-reconcile-top15.py
```

**Funzionalità:**
- Mostra dettagli payment
- Cerca automaticamente invoices corrispondenti
- Prompt interattivo per selezione
- Esegue riconciliazione con conferma

**Workflow:**
```
For each payment:
  1. Display payment details
  2. Search matching invoices
  3. User selects invoice (or skip)
  4. Confirm reconciliation
  5. Execute or skip
```

**Quando usarlo:**
- Dopo aver risolto "merenda69"
- Per riconciliare Top 15 (96% del problema)
- Quando serve controllo manuale

**Tempo esecuzione:** ~15-20 min per payment (4-5 ore totale)

---

### 4. cleanup-zero-payments.py

**Scopo:** Elimina righe con amount=0 (PERICOLOSO - richiede approvazione).

**Uso:**
```bash
# Dry-run (simulazione)
python cleanup-zero-payments.py --dry-run

# Execution (SOLO SE APPROVATO DAL COMMERCIALISTA)
python cleanup-zero-payments.py --execute
```

**ATTENZIONE:**
- Operazione IRREVERSIBILE
- Richiede approvazione commercialista
- Crea backup automatico prima di eliminare
- Mostra prompt di conferma

**Quando usarlo:**
- Solo SE commercialista approva eliminazione righe zero
- Dopo aver verificato che sono errori di migrazione
- Come cleanup finale

**Tempo esecuzione:** ~2 minuti

---

### 5. analyze-reconciliation-report.py

**Scopo:** Analizza il report Excel generato da odoo-reconcile-1022.py

**Uso:**
```bash
python analyze-reconciliation-report.py
```

**Output:**
- Summary statistics
- Error breakdown
- Top failures
- Manual review items

**Quando usarlo:**
- Dopo esecuzione di odoo-reconcile-1022.py
- Per capire perché riconciliazione automatica fallisce
- Per identificare patterns

**Tempo esecuzione:** ~10 secondi

---

### 6. investigate-merenda69.py

**Scopo:** Analisi dettagliata del movimento critico "Ricorrente merenda69".

**Uso:**
```bash
python investigate-merenda69.py
```

**Output:**
- Dettagli completi movimento
- Tutte le righe del move
- Transazioni correlate stesso periodo
- Raccomandazioni per risoluzione

**Quando usarlo:**
- Per capire natura del movimento merenda69
- Prima di contattare commercialista
- Per documentazione tecnica

**Tempo esecuzione:** ~30 secondi

**NOTA:** Script potrebbe non trovare il movimento se nome è diverso.
Usa `find-large-movements-1022.py` per confermare.

---

## Workflow Raccomandato

### Step 1: Analisi Iniziale
```bash
# 1. Riconciliazione automatica completa
python odoo-reconcile-1022.py

# 2. Analizza report
python analyze-reconciliation-report.py

# 3. Identifica Top movements
python find-large-movements-1022.py
```

### Step 2: Risolvi Movimento Critico
```bash
# 1. Investigare merenda69
python investigate-merenda69.py

# 2. Contattare commercialista con findings
# 3. Aspettare decisione/approvazione
```

### Step 3: Riconciliazione Top 15
```bash
# Riconciliazione assistita (dopo risoluzione merenda69)
python manual-reconcile-top15.py
```

### Step 4: Cleanup Finale
```bash
# Verifica saldo rimanente
python find-large-movements-1022.py

# Se necessario, cleanup righe zero (CON APPROVAZIONE)
python cleanup-zero-payments.py --dry-run
python cleanup-zero-payments.py --execute  # Solo se approvato
```

### Step 5: Verifica Finale
```bash
# Check saldo finale
python find-large-movements-1022.py

# Output atteso:
# Balance: CHF 0.00
# Remaining lines: 0
```

---

## Troubleshooting

### Errore: "Authentication failed"
```
Verifica credenziali in script:
- ODOO_URL
- ODOO_DB
- ODOO_USERNAME
- ODOO_PASSWORD
```

### Errore: "UnicodeEncodeError"
```
Windows console encoding issue - già fixato negli script.
Se persiste, eseguire:
chcp 65001
```

### Errore: "Account 1022 not found"
```
Verifica codice account in Odoo.
Potrebbe essere diverso da "1022".
```

### Script lento / timeout
```
Aumentare timeout in script:
timeout=300000  # 5 minuti
```

---

## Files Generati

### reconciliation-report-YYYYMMDD-HHMMSS.xlsx

Excel con 4 sheets:

1. **Summary**
   - Totale righe
   - Riconciliati
   - Falliti
   - Manual review
   - Balance amounts

2. **Reconciled**
   - Payment details
   - Invoice matched
   - Reconciliation result

3. **Failed**
   - Payment details
   - Error message
   - Raggruppato per tipo errore

4. **Manual Review**
   - Payments con match parziale
   - Confidence score
   - Invoices suggerite

### backup-zero-payments-YYYYMMDD-HHMMSS.json

Backup righe eliminate da cleanup-zero-payments.py.
Formato JSON per facile restore se necessario.

---

## Configurazione

Tutti gli script usano le stesse credenziali Odoo:

```python
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"
ACCOUNT_1022_CODE = "1022"
```

Per usare credenziali diverse, modificare le costanti in ogni script.

---

## Sicurezza

### Credenziali
Scripts contengono credenziali hardcoded per semplicità.
Per produzione, considerare:
- Environment variables
- Config file esterno
- Odoo API key invece di password

### Backup
Prima di operazioni distruttive:
- cleanup-zero-payments.py crea backup automatico JSON
- Odoo mantiene audit log di tutti i changes

### Permissions
Scripts richiedono permessi Odoo:
- account.move.line: read, write, unlink
- account.move: read, write
- res.partner: read

---

## FAQ

### Q: Posso eseguire scripts su produzione?
A: Scripts sono testati su staging. Per produzione:
   1. Backup database completo
   2. Test su copia database
   3. Esecuzione in orario non lavorativo
   4. Monitoring durante esecuzione

### Q: Cosa fare se riconciliazione fallisce?
A: Script non interrompe su errori. Continua con altre righe.
   Errori sono loggati in Excel report sheet "Failed".

### Q: Posso annullare riconciliazioni?
A: Si, in Odoo:
   1. Vai a account.move.line
   2. Trova righe riconciliate
   3. Click "Remove matching"

   Oppure via script (da creare se necessario).

### Q: Quanto tempo richiede riconciliazione completa?
A: Dipende da quante righe:
   - Analisi automatica: 5-10 min
   - Riconciliazione Top 15 manuale: 4-5 ore
   - Cleanup finale: 1-2 ore
   - **Totale: 6-8 ore spread over 2-3 giorni**

---

## Support

Per problemi tecnici:
- Odoo Integration Master
- paul@lapa.ch

Per approvazioni business:
- Commercialista
- CFO

---

## Version History

**v1.0** (2025-11-15)
- Initial release
- 6 scripts
- Excel reporting
- Interactive assistant

---

## TODO Future Improvements

- [ ] Config file per credenziali
- [ ] Logging a file invece di console
- [ ] Progress bar per operazioni lunghe
- [ ] Email notifications su completion
- [ ] Dashboard web per monitoring
- [ ] Scheduled automatic reconciliation
- [ ] Machine learning per migliorare matching
- [ ] Integration con banking API per auto-import

---

**Last Updated:** 2025-11-15
**Author:** Odoo Integration Master
**License:** Internal use Lapa only
