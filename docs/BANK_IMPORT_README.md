# Bank Statement Import 2024

Importazione automatica degli estratti conto bancari 2024 in Odoo.

## Overview

Sistema completo per importare estratti conto da:
- **UBS CHF** (Q1-Q4 2024): 4 files CSV
- **UBS EUR** (H1-H2 2024): 2 files CSV
- **Credit Suisse** (2024): PDF (TODO)

### Obiettivi

- Importare TUTTE le transazioni bancarie 2024
- Verificare saldi finali al centesimo:
  - UBS CHF: 182,613.26 CHF
  - UBS EUR: 128,860.70 EUR
  - Credit Suisse 1: 11,120.67 CHF
  - Credit Suisse 2: 13,777.05 CHF

## Architecture

### Components

```
lib/
├── parsers/
│   └── ubs-csv-parser.ts          # Parser CSV UBS (CHF/EUR)
├── odoo/
│   ├── xmlrpc-client.ts           # Client XML-RPC Odoo base
│   └── bank-statement-client.ts   # Client specifico bank statements
└── services/
    └── bank-statement-import-service.ts  # Orchestrazione import

scripts/
├── import-bank-statements-2024.ts # Script principale import
└── test-ubs-parser.js             # Test parser UBS
```

### Data Flow

```
CSV Files → Parser → Validation → Odoo Client → Import → Balance Check
```

## Setup

### 1. Configurazione Odoo

Prima di importare, **devi configurare i journal bancari in Odoo**:

1. Vai in **Contabilità > Configurazione > Journals**
2. Crea/verifica i journal bancari:
   - **UBS CHF**: Code `UBS_CHF`, Currency CHF
   - **UBS EUR**: Code `UBS_EUR`, Currency EUR
3. Associa ogni journal al conto bancario corretto

**IMPORTANTE**: Aggiorna i codici journal in `scripts/import-bank-statements-2024.ts`:

```typescript
const JOURNAL_MAPPINGS: JournalMapping[] = [
  {
    ubsCode: 'UBS CHF',
    odooJournalCode: 'UBS_CHF', // <-- Aggiorna con il tuo codice
    currency: 'CHF',
    targetBalance: 182613.26
  },
  // ...
];
```

### 2. Credenziali Odoo

Le credenziali sono configurate nello script:

```typescript
const ODOO_CONFIG = {
  odooUrl: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  odooDb: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  odooUsername: 'paul@lapa.ch',
  odooPassword: 'lapa201180'
};
```

Oppure usa environment variables:

```bash
export ODOO_URL="https://your-odoo.odoo.com"
export ODOO_DB="your-db"
export ODOO_USERNAME="your@email.com"
export ODOO_PASSWORD="your-password"
```

### 3. Files Disponibili

Verifica che i file siano nella directory corretta:

```
C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\
├── UBS CHF/
│   ├── UBS CHF 1.1-31.3.2024.csv     (Q1)
│   ├── UBS CHF 1.4-30.6.2024.csv     (Q2)
│   ├── UBS CHF 1.7-30.9.2024.csv     (Q3)
│   └── UBS CHF 1.10-31.12.2024.csv   (Q4)
└── UBS EUR/
    ├── UBS EUR 1.1-30.6.2024.csv     (H1)
    └── UBS EUR 1.7-31.12.2024.csv    (H2)
```

## Usage

### Test Parser (Quick Validation)

Prima di importare, testa che il parser funzioni:

```bash
cd C:\Users\lapa\Desktop\Claude Code\app-hub-platform
node scripts/test-ubs-parser.js
```

Output atteso:
```
✓ Parser test completed successfully!
✓ Parsed 756 transactions
Balance Match: YES
```

### Dry Run (No Import)

Verifica configurazione senza importare:

```bash
npx ts-node scripts/import-bank-statements-2024.ts --dry-run
```

### Import Completo

Importa TUTTI gli estratti conto 2024:

```bash
npx ts-node scripts/import-bank-statements-2024.ts
```

### Import Singolo Journal

Importa solo UBS CHF o solo UBS EUR:

```bash
npx ts-node scripts/import-bank-statements-2024.ts --journal="UBS CHF"
npx ts-node scripts/import-bank-statements-2024.ts --journal="UBS EUR"
```

## Import Process

### Step 1: Parsing

- Legge CSV UBS line-by-line
- Gestisce transazioni multi-riga (es. salary batch payments)
- Estrae: date, importi, partner, descrizioni, references

### Step 2: Validation

- **Balance Check**: Opening + Transactions = Closing (al centesimo)
- **Date Range**: Verifica che le date siano nel 2024
- **Currency**: Verifica che la valuta corrisponda

### Step 3: Deduplication

- Cerca statement esistenti per nome + journal
- Skip se già importato (con flag `skipIfExists`)
- Errore se esiste senza flag

### Step 4: Odoo Import

- Crea `account.bank.statement`
- Crea `account.bank.statement.line` per ogni transazione
- Imposta balances (opening, closing)

### Step 5: Final Verification

- Verifica saldo finale per ogni journal
- Confronta con saldi target (182,613.26 CHF, 128,860.70 EUR, etc.)
- Report balance mismatches

## Output

### Console

```
============================================================
BANK STATEMENT IMPORT 2024
============================================================

Importing UBS CHF (CHF)
  ✓ UBS CHF 1.1-31.3.2024: 756 transactions imported
  ✓ UBS CHF 1.4-30.6.2024: 698 transactions imported
  ✓ UBS CHF 1.7-30.9.2024: 742 transactions imported
  ✓ UBS CHF 1.10-31.12.2024: 823 transactions imported

Importing UBS EUR (EUR)
  ✓ UBS EUR 1.1-30.6.2024: 267 transactions imported
  ✓ UBS EUR 1.7-31.12.2024: 301 transactions imported

============================================================
FINAL BALANCE VERIFICATION
============================================================

UBS_CHF (CHF): Expected 182613.26, Actual 182613.26 ✓ MATCH
UBS_EUR (EUR): Expected 128860.70, Actual 128860.70 ✓ MATCH

✓ All imports completed successfully with matching balances!
```

### Report File

Viene generato un report dettagliato:

```
bank-import-report-2024-11-15.txt
```

Contiene:
- Dettagli per ogni file importato
- Transaction counts
- Balance verification
- Warnings/Errors

## Formato CSV UBS

### Header (Lines 1-9)

```csv
Kontonummer:;0278 00122087.01
IBAN:;CH02 0027 8278 1220 8701 J
Von:;01/01/2024
Bis:;30/03/2024
Anfangssaldo:;143739.47
Schlusssaldo:;108757.58
Bewertet in:;CHF
Anzahl Transaktionen:;756
```

### Column Headers (Line 10)

```
Abschlussdatum;Abschlusszeit;Buchungsdatum;Valutadatum;Währung;Belastung;Gutschrift;Einzelbetrag;Saldo;Transaktions-Nr.;Beschreibung1;Beschreibung2;Beschreibung3;Fussnoten
```

### Transaction Lines (Line 11+)

```csv
30/03/2024;;01/04/2024;31/03/2024;CHF;-568.35;;;108757.58;9978090EH2415266;COME DA ISTRUZIONI;Zinsuebertrag;...
```

**Note**:
- `Belastung` (debit) è **già negativo** nel CSV
- `Gutschrift` (credit) è positivo
- Alcune transazioni hanno righe multiple (detail lines)

## Troubleshooting

### Error: Journal not found

```
ERROR: Journal "UBS_CHF" not found in Odoo
```

**Fix**:
1. Vai in Odoo → Contabilità → Journals
2. Crea il journal con code "UBS_CHF"
3. Aggiorna `odooJournalCode` nello script

### Error: Statement already exists

```
ERROR: Statement "UBS CHF 01.01.2024 - 31.03.2024" already exists (ID: 123)
```

**Fix**:
- **Option A**: Elimina lo statement esistente in Odoo
- **Option B**: Usa flag `skipIfExists` (lo script lo fa già)

### Balance Mismatch

```
✗ MISMATCH: Expected 182613.26, Actual 180000.00
```

**Cause possibili**:
1. Non tutti i trimestri importati
2. Transazioni duplicate
3. Saldo iniziale errato

**Fix**:
1. Verifica che tutti i CSV siano stati importati
2. Controlla log per errori durante import
3. Verifica saldo opening del primo statement

### XML-RPC Connection Error

```
ERROR: Odoo authentication failed: ECONNREFUSED
```

**Fix**:
1. Verifica URL Odoo (https, non http)
2. Verifica credenziali
3. Controlla che Odoo sia accessibile

## API Reference

### UBS Parser

```typescript
import { parseUBSCSV, validateStatement } from 'lib/parsers/ubs-csv-parser';

// Parse CSV file
const statement = parseUBSCSV('path/to/file.csv');

// Validate balance
const validation = validateStatement(statement);
console.log(validation.valid); // true/false
```

### Odoo Bank Client

```typescript
import { OdooBankStatementClient } from 'lib/odoo/bank-statement-client';

const client = new OdooBankStatementClient({
  url: 'https://your-odoo.odoo.com',
  db: 'your-db',
  username: 'user@email.com',
  password: 'password'
});

await client.connect();

// Find journal
const journal = await client.findJournal('UBS_CHF');

// Import statement
const result = await client.importStatement({
  journalId: journal.id,
  name: 'UBS CHF Q1 2024',
  date: '2024-03-31',
  balanceStart: 143739.47,
  balanceEnd: 108757.58,
  lines: [...]
});
```

### Import Service

```typescript
import { BankStatementImportService } from 'lib/services/bank-statement-import-service';

const service = new BankStatementImportService({
  odooUrl: '...',
  odooDb: '...',
  odooUsername: '...',
  odooPassword: '...'
});

await service.connect();

// Import all 2024
const summary = await service.importAll2024(baseDir, journalMappings);

// Generate report
const report = service.generateReport(summary);
console.log(report);
```

## Next Steps

### Credit Suisse PDF Import (TODO)

Per importare i PDF Credit Suisse, serve:

1. **PDF Parser**: Estrarre testo/tabelle da PDF
2. **Data Extraction**: Identificare transazioni, dates, amounts
3. **Mapping**: Convertire formato Credit Suisse → formato standard
4. **Integration**: Usare stesso `BankStatementImportService`

Tecnologie possibili:
- `pdf-parse` per testo
- `pdf-lib` per metadata
- OCR (Tesseract) se PDF è scansionato
- Regex per estrarre amounts, dates, descriptions

### Auto-Reconciliation (TODO)

Dopo import, riconciliare automaticamente:

1. **Invoice Matching**: Match payment_ref con invoice number
2. **Partner Matching**: Match descriptions con partner names
3. **Amount Matching**: Match amounts con outstanding invoices
4. **Smart Rules**: Configurable reconciliation rules

API Odoo:
```python
# In Odoo
statement_line.reconcile_bank_line(
    counterpart_aml_dicts=[...],
    payment_aml_rec=...
)
```

## Support

Per problemi o domande:
1. Controlla i log di import
2. Verifica configurazione Odoo journals
3. Testa parser con `test-ubs-parser.js`
4. Controlla report file per dettagli errori

---

**Creato da**: Backend Specialist
**Data**: 2024-11-15
**Versione**: 1.0.0
