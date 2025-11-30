# PIANO ESECUZIONE PRODUCTION - Chiusura Contabile 2024

**Data Creazione**: 16 Novembre 2025
**Ambiente Target**: PRODUCTION
**Ambiente Test**: STAGING (già verificato)
**Database**: lapa-v2-production-XXXXX

---

## EXECUTIVE SUMMARY

Questo documento contiene il **piano step-by-step** per replicare in **PRODUCTION** la chiusura contabile 2024 già testata e verificata in **STAGING**.

**Obiettivo**: Chiudere tutti i conti sospesi e quadrare la contabilità 2024 prima della chiusura fiscale.

**Durata Stimata**: 2-3 ore
**Finestra Manutenzione**: Sabato/Domenica mattina
**Team Richiesto**: Contabile Senior + Developer + Access to Odoo Admin

---

## PREREQUISITI

### 1. Backup Completo

```bash
# CRITICO: Backup database PRIMA di iniziare
# Odoo Cloud: Screenshot stato iniziale
# Download backup via Settings > Database Manager
```

- [ ] Backup database production scaricato
- [ ] Backup salvato in location sicura con timestamp
- [ ] Verifica integrità backup (re-import in test DB)

### 2. Accessi

- [ ] Credenziali Odoo Production (user: paul@lapa.ch)
- [ ] Accesso API XML-RPC attivo
- [ ] Python 3.x installato con xmlrpc.client
- [ ] VPN/Network access se necessario

### 3. Dati Input

- [ ] Estratti conto bancari 2024 (tutti i conti)
- [ ] File PDF/CSV pronti in cartella `data/bank-statements/`
- [ ] Credenziali banche per download se mancano estratti

### 4. Verifica Ambiente

```bash
# Test connessione production
python scripts/test-odoo-connection-prod.py
```

- [ ] Connessione Odoo OK
- [ ] User ha diritti Accounting/Finance
- [ ] Database corretto verificato

---

## STEP-BY-STEP EXECUTION

### STEP 1: Verifica Stato Iniziale (15 min)

**Obiettivo**: Capire la situazione di partenza in production

**Script**: `scripts/verifica-rapida-conti-chiave.py`

```bash
# Esegui verifica conti chiave
python scripts/verifica-rapida-conti-chiave.py --env production

# Output atteso:
# 1099 Transferkonto: CHF ???
# 10901 Liquiditätstransfer: CHF ???
# 1022 Outstanding Receipts: CHF ???
# 1023 Outstanding Payments: CHF ???
# 1001 Cash: CHF ???
```

**Azioni**:
1. Annota i saldi iniziali in `report-stato-iniziale-prod.txt`
2. Confronta con saldi attesi da contabilità
3. Identifica discrepanze maggiori (> CHF 10K)

**Checklist**:
- [ ] Saldi iniziali documentati
- [ ] Nessuna discrepanza critica trovata
- [ ] Trial Balance iniziale estratto

**STOP POINT**: Se discrepanze critiche, FERMA e analizza prima di procedere.

---

### STEP 2: Import Estratti Conto Bancari (30 min)

**Obiettivo**: Importare tutti gli estratti conto 2024 in Odoo

**Script**: `scripts/import-bank-statements-2024.ts`

```bash
# Import automatico tutti i bank statements
npm run import-bank-statements -- --year 2024 --env production

# Oppure manuale via Odoo UI:
# Accounting > Bank > Import Statements
```

**Conti Bancari** (8 conti):
1. 1002 - PostFinance CHF
2. 1003 - UBS CHF
3. 1004 - UBS EUR
4. 1005 - Raiffeisen CHF
5. 1006 - Credit Suisse CHF
6. 1010 - PostFinance EUR
7. 1011 - UBS USD
8. 1012 - PostFinance USD

**Per ogni conto**:
- [ ] File PDF/CSV caricato
- [ ] Parser estratto conto OK (UBS/PostFinance/Raiffeisen)
- [ ] Movimenti importati (contare righe)
- [ ] Nessun errore import

**Verifica**:
```python
# Conta movimenti importati
python scripts/count-imported-statements.py --date-from 2024-01-01
```

**Rollback**: Se errori, DELETE righe importate via Odoo UI (filtro per date)

---

### STEP 3: Riclassificazioni FX (15 min)

**Obiettivo**: Riclassificare movimenti Foreign Exchange dal Konto 10901

**Script**: `scripts/ALLINEA-10901-FX-RICLASSIFICA.py`

```bash
# Riclassifica FX losses/gains
python scripts/ALLINEA-10901-FX-RICLASSIFICA.py --env production

# Output atteso:
# - XX movimenti FX identificati
# - Creazione journal entries di riclassifica
# - Konto 10901 ridotto di CHF XX.XX
```

**Checklist**:
- [ ] Script eseguito senza errori
- [ ] Journal entries create (IDs salvati)
- [ ] Konto 10901 saldo verificato (ridotto)

**Criteri Riclassifica**:
- Descrizione contiene: "EXCHANGE", "CAMBIO", "FX", "Currency"
- Importi tipici: < CHF 100 (currency differences)
- Conto destinazione: 6899 (Altri costi finanziari) o 4899 (Altri ricavi finanziari)

---

### STEP 4: Riclassificazioni Credit Card (10 min)

**Obiettivo**: Riclassificare pagamenti carta di credito dal Konto 10901

**Script**: `scripts/ALLINEA-10901-CREDITCARD-RICLASSIFICA.py`

```bash
# Riclassifica credit card payments
python scripts/ALLINEA-10901-CREDITCARD-RICLASSIFICA.py --env production

# Output atteso:
# - XX pagamenti carta identificati
# - Journal entries create
# - Konto 10901 ridotto ulteriormente
```

**Checklist**:
- [ ] Script eseguito senza errori
- [ ] Pagamenti carta riclassificati
- [ ] Conti bancari corrispondenti aggiornati

**Criteri Riclassifica**:
- Descrizione contiene: "CREDIT CARD", "CARTA", "VISA", "MASTERCARD"
- Match con conti bancari via importo+data (±2 giorni)

---

### STEP 5: Chiusura Konto 10901 Liquiditätstransfer (15 min)

**Obiettivo**: Chiudere completamente il Konto 10901

**Script**: `scripts/chiusura-konto-10901-finale.py`

```bash
# Chiusura finale 10901
python scripts/chiusura-konto-10901-finale.py --env production

# Output atteso:
# - Konto 10901 balance: CHF 0.00
# - XX journal entries creati
```

**Strategia**:
1. Identifica movimenti rimanenti (tipo: bank transfer, cash deposit, etc)
2. Match con conti bancari corrispondenti
3. Crea reverse entries per chiudere saldo

**Checklist**:
- [ ] Konto 10901 = CHF 0.00
- [ ] Tutti i movimenti classificati
- [ ] Journal entries posted (non draft)

**VERIFICATION**:
```python
python scripts/verifica-rapida-conti-chiave.py --account 10901
# Deve mostrare: CHF 0.00
```

---

### STEP 6: Riconciliazione Konto 1022 Outstanding Receipts (15 min)

**Obiettivo**: Riconciliare tutti i pagamenti in entrata pendenti

**Script**: `scripts/riconcilia-konto-1023-advanced.py` (configurato per 1022)

```bash
# Riconciliazione automatica 1022
python scripts/riconcilia-konto-1022-advanced.py --env production

# Output atteso:
# - XX pagamenti riconciliati
# - Konto 1022 balance: CHF 0.00 (o near-zero)
```

**Logica**:
- Match invoices con bank statements via importo+cliente
- Tolerance: ±CHF 5.00
- Auto-riconcilia match > 95% confidence

**Checklist**:
- [ ] Auto-riconciliazione eseguita
- [ ] Konto 1022 verificato
- [ ] Movimenti rimanenti documentati (se saldo non zero)

**Manual Step**: Se restano movimenti non riconciliati (< CHF 1000):
- Via Odoo UI: Accounting > Reconciliation
- Match manualmente le ultime righe

---

### STEP 7: Riconciliazione Konto 1023 Outstanding Payments (15 min)

**Obiettivo**: Riconciliare tutti i pagamenti in uscita pendenti

**Script**: `scripts/riconcilia-konto-1023-advanced.py`

```bash
# Riconciliazione automatica 1023
python scripts/riconcilia-konto-1023-advanced.py --env production

# Output atteso:
# - XX pagamenti riconciliati
# - Konto 1023 balance: CHF 0.00 (o near-zero)
```

**Logica**:
- Match vendor bills con bank payments via importo+fornitore
- Tolerance: ±CHF 5.00
- Auto-riconcilia match > 95% confidence

**Checklist**:
- [ ] Auto-riconciliazione eseguita
- [ ] Konto 1023 verificato
- [ ] Movimenti rimanenti documentati

**Manual Step**: Se restano movimenti (< CHF 1000):
- Via Odoo UI: match manualmente

---

### STEP 8: Chiusura Konto 1099 Transferkonto (10 min)

**Obiettivo**: Chiudere il conto transitorio 1099

**Script**: `scripts/chiusura-konto-1099-final.js`

```bash
# Chiusura 1099
node scripts/chiusura-konto-1099-final.js --env production

# Output atteso:
# - Konto 1099 balance: CHF 0.00
# - Journal entry di chiusura creato
```

**Strategia**:
- Se saldo residuo: gira su Konto 6899/4899 (costi/ricavi vari)
- Crea journal entry di chiusura
- Data: 31/12/2024

**Checklist**:
- [ ] Konto 1099 = CHF 0.00
- [ ] Journal entry posted

---

### STEP 9: Verifica Rettifica Cash 1001 (10 min)

**Obiettivo**: Verificare e rettificare saldo Cash se necessario

**Context**: In staging abbiamo CHF -9,756 invece di ~CHF 90,000. Questo è ANOMALO.

**Script**: `scripts/rettifica-cash-1001.py`

```bash
# Verifica cash
python scripts/rettifica-cash-1001.py --env production --dry-run

# Se OK:
python scripts/rettifica-cash-1001.py --env production --execute
```

**Checklist**:
- [ ] Saldo cash verificato con contabilità fisica
- [ ] Discrepanze > CHF 100 investigate
- [ ] Rettifica applicata se necessario

**STOP POINT**: Se saldo cash molto anomalo, FERMA e consulta commercialista.

---

### STEP 10: Verifica Finale Completa (10 min)

**Obiettivo**: Verificare che TUTTO sia quadrato

**Script**: `scripts/verifica-finale-production-completa.py`

```bash
# Verifica finale
python scripts/verifica-finale-production-completa.py

# Genera report Excel
python scripts/genera-excel-chiusura-2024.py --env production
```

**Output**:
1. `REPORT-FINALE-PRODUCTION-2024.xlsx` - Tutti i saldi finali
2. `report-verifica-production.json` - JSON con status

**Checklist Finale**:
- [ ] Konto 1099 = CHF 0.00
- [ ] Konto 10901 = CHF 0.00
- [ ] Konto 1022 = CHF 0.00 (o < CHF 1000)
- [ ] Konto 1023 = CHF 0.00 (o < CHF 1000)
- [ ] Konto 1001 = saldo realistico (~CHF 80-100K)
- [ ] 8 conti bancari: delta < CHF 100 per conto
- [ ] Trial Balance: DARE = AVERE
- [ ] Nessuna journal entry in draft

**Trial Balance Verification**:
```python
# Export trial balance
python scripts/export-trial-balance-2024.py --env production
# Output: trial-balance-2024-production.xlsx
```

**FINAL CHECK**:
- Totale DARE = Totale AVERE?
- Differenza < CHF 1.00?
- ✓ **QUADRATURA OK**

---

## ROLLBACK PLAN

### Quando Fare Rollback

**FERMA IMMEDIATAMENTE e fai rollback se**:
1. Errori Python non gestiti (exception non caught)
2. Journal entries che non postano (errore Odoo)
3. Discrepanze > CHF 10,000 non spiegate
4. Trial Balance si sbilancia
5. Qualsiasi operazione che cancella dati critici

### Come Fare Rollback

#### Opzione 1: Restore Backup (Completo)

```bash
# Via Odoo Cloud Dashboard:
# 1. Settings > Database Manager
# 2. Restore > Select backup file
# 3. Conferma restore

# Tempo: ~30 minuti
# Perdita dati: ZERO (ritorna a stato pre-intervento)
```

**Quando usare**: Errori gravi, dati corrotti, situazione non recuperabile.

#### Opzione 2: Reverse Journal Entries (Parziale)

```python
# Reverse solo le entries create
python scripts/reverse-journal-entries.py --move-ids "ID1,ID2,ID3"

# Oppure reverse per data
python scripts/reverse-journal-entries.py --date 2025-11-16
```

**Quando usare**: Errori minori, solo alcune operazioni da annullare.

#### Opzione 3: Manual Reverse (Via UI)

```
1. Odoo > Accounting > Journal Entries
2. Filtra per data/tipo
3. Seleziona entries create
4. Actions > Reverse Entry
5. Conferma reverse con data reverse = oggi
```

**Quando usare**: Poche entries (< 10), preferisci controllo manuale.

### Checklist Rollback

- [ ] Identifica punto di errore
- [ ] Salva log errori (`error-log-TIMESTAMP.txt`)
- [ ] Screenshot stato attuale Odoo
- [ ] Esegui rollback (scelta opzione)
- [ ] Verifica stato post-rollback
- [ ] Analizza causa errore
- [ ] Fix script/dati
- [ ] Re-test in staging
- [ ] Retry production

### Contatti Emergenza

- **Odoo Support**: support@odoo.com
- **Commercialista**: [Nome] - [Tel]
- **Developer**: [Nome] - [Tel]
- **Backup Location**: `s3://lapa-backups/odoo/production/`

---

## POST-EXECUTION

### 1. Documentazione

- [ ] Salva tutti i report generati
- [ ] Screenshot stato finale conti chiave
- [ ] Export trial balance PDF
- [ ] Log esecuzione salvato

### 2. Sign-Off

- [ ] Review contabile (Contabile Senior)
- [ ] Verifica tecnica (Developer)
- [ ] Approval finale (CFO/Owner)

### 3. Consegna Commercialista

**Deliverable per commercialista**:
1. `REPORT-FINALE-PRODUCTION-2024.xlsx` - Saldi finali
2. `trial-balance-2024-production.pdf` - Trial Balance ufficiale
3. `journal-entries-created.csv` - Lista tutte le JE create
4. `bank-reconciliation-summary.pdf` - Riconciliazioni bancarie
5. `note-chiusura-2024.md` - Note e anomalie riscontrate

**Email Draft**:
```
Oggetto: Chiusura Contabile 2024 - Documentazione

Buongiorno [Nome Commercialista],

In allegato la documentazione completa della chiusura contabile 2024:

RISULTATI:
- Tutti i conti sospesi chiusi (1099, 10901, 1022, 1023)
- Quadratura Trial Balance: OK (diff < CHF 1)
- Riconciliazioni bancarie: 8/8 conti OK

ANOMALIE RISCONTRATE:
[Lista eventuali anomalie]

PROSSIMI PASSI:
- Verifica documentazione
- Conferma chiusura OK
- Preparazione dichiarazione fiscale

Rimango a disposizione per chiarimenti.

Cordiali saluti,
[Nome]
```

---

## SCRIPTS REFERENCE

Tutti gli script sono nella cartella `scripts/production/`:

| Script | Scopo | Tempo | Critico |
|--------|-------|-------|---------|
| `verifica-rapida-conti-chiave.py` | Verifica 5 conti | 1 min | ✓ |
| `import-bank-statements-2024.ts` | Import estratti | 30 min | ✓ |
| `ALLINEA-10901-FX-RICLASSIFICA.py` | FX riclass | 5 min | ✓ |
| `ALLINEA-10901-CREDITCARD-RICLASSIFICA.py` | Card riclass | 5 min | ✓ |
| `chiusura-konto-10901-finale.py` | Chiudi 10901 | 10 min | ✓ |
| `riconcilia-konto-1022-advanced.py` | Riconcilia 1022 | 15 min | ✓ |
| `riconcilia-konto-1023-advanced.py` | Riconcilia 1023 | 15 min | ✓ |
| `chiusura-konto-1099-final.js` | Chiudi 1099 | 5 min | ✓ |
| `rettifica-cash-1001.py` | Fix cash | 5 min | - |
| `verifica-finale-production-completa.py` | Verifica finale | 5 min | ✓ |
| `genera-excel-chiusura-2024.py` | Report Excel | 5 min | - |

**TOTALE TEMPO**: ~2 ore (senza problemi)
**CON CONTINGENZA**: ~3 ore

---

## NOTES

1. **Sequence è Critica**: Non saltare step, gli script dipendono l'uno dall'altro
2. **Dry-Run Sempre**: Ogni script ha flag `--dry-run`, usalo per preview
3. **Log Everything**: Salva output di ogni comando per debugging
4. **Backup Backup Backup**: Non iniziare senza backup verificato
5. **Test in Staging Prima**: Questo piano deriva da test già fatto in staging

---

## VERSION HISTORY

| Versione | Data | Autore | Changes |
|----------|------|--------|---------|
| 1.0 | 2025-11-16 | Claude Process Automator | Piano iniziale |

---

## APPENDIX

### A. Configurazione Environment

```python
# .env.production
ODOO_URL=https://lapa-v2-production.odoo.com
ODOO_DB=lapa-v2-production-XXXXX
ODOO_USER=paul@lapa.ch
ODOO_PASSWORD=XXXXX
```

### B. Quick Commands

```bash
# Verifica rapida stato
python scripts/quick-check.py --env prod

# Conta movimenti
python scripts/count-moves.py --account 10901

# Export per commercialista
python scripts/export-for-accountant.py --year 2024
```

### C. Troubleshooting

**Problema**: Script timeout
**Soluzione**: Aumenta timeout in `xmlrpc.client` config

**Problema**: "Access Denied"
**Soluzione**: Verifica user ha group "Accounting / Advisor"

**Problema**: Trial Balance non quadra
**Soluzione**: Trova journal entry sbilanciata via `check-unbalanced.py`

---

**END OF DOCUMENT**

Questo piano è pronto per essere usato in production. Leggere completamente PRIMA di eseguire.
