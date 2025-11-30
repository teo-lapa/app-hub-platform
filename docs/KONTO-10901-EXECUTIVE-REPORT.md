# KONTO 10901 - EXECUTIVE REPORT
## Database Optimizer Specialist - Analisi Completa e Piano di Riclassificazione

**Generated:** 2025-11-15
**Analyst:** Database Optimizer Specialist
**Objective:** Riclassificare tutti i movimenti e portare saldo a CHF 0.00

---

## SITUAZIONE ATTUALE

### Dati Estratti
- **Account:** 10901 - Trasferimento di liquidità
- **Total movements:** 353 (non 219 come stimato inizialmente)
- **Saldo attuale:** CHF -375,615.65 (non -183,912.63 come stimato)
- **Tipo account:** asset_current

### Perché il saldo è diverso?
L'analisi completa ha rivelato 353 movimenti totali invece di 219. La differenza potrebbe essere dovuta a:
- Movimenti aggiuntivi non considerati nell'analisi iniziale
- Filtri diversi applicati nella prima ricognizione
- Movimenti registrati dopo la prima analisi

---

## CATEGORIZZAZIONE DETTAGLIATA

### Priority 1 - HIGH (Azione Immediata)

#### 1. CURRENCY_EXCHANGE_FX - Cambi Valuta EUR/CHF
- **Count:** 40 movimenti
- **Balance:** CHF -599,376.20
- **Pattern:** Transazioni FX con tasso di cambio esplicito
  - "Ihr Kauf EUR / Ihr Verkauf CHF"
  - "FX Spot" / "FX Forward"
  - "Bezahlter Kurs EUR/CHF"

**Azione:**
```sql
UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '2660')
WHERE id IN (527337, 527398, 500586, 502778, 485432, ...); -- 40 IDs
```

**Expected impact:** -599,376.20 CHF

---

#### 2. CREDIT_CARD_PAYMENT - Pagamenti Carte Credito
- **Count:** 15 movimenti
- **Balance:** CHF +44,144.51
- **Pattern:**
  - "UBS Switzerland AG/c/o UBS Card Center"
  - "Fattura della carta di credito"
  - "Kreditkarten-Abrechnung"

**Azione:**
```sql
UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '10803')
WHERE id IN (528523, 504841, 459202, ...); -- 15 IDs
```

**Expected impact:** +44,144.51 CHF

---

#### 3. BANK_TRANSFER_INTERNAL - Trasferimenti Interni
- **Count:** 29 movimenti
- **Balance:** CHF +3,000.00
- **Pattern:**
  - "Trasferimento da un conto all'altro"
  - "Zahlung an Karte" + IBAN
  - "Kontoübertrag"

**Azione:** MANUAL REVIEW REQUIRED
Ogni trasferimento richiede identificazione di:
- Conto sorgente
- Conto destinazione
- Verifica che non sia già registrato correttamente

**Esempi:**
- ID 526238/526249: Trasferimento CHF 600 (coppia debit/credit)
- ID 523352: Zahlung an Karte LAURA TEODORESCU CHF 3,000

---

### Priority 2 - MEDIUM (Revisione e Riclassificazione)

#### 4. CURRENCY_DIFF - Differenze Valuta
- **Count:** 39 movimenti
- **Balance:** CHF +372,214.97
- **Pattern:**
  - "Acquistato EUR; Venduto CHF"
  - Operazioni in EUR ma senza tasso esplicito

**Azione:** Verificare se vanno in 2660 (Utili/Perdite cambi) o se sono parte di altre operazioni

---

#### 5. INSTANT_PAYMENT - Pagamenti Istantanei
- **Count:** 69 movimenti
- **Balance:** CHF -470,000.00
- **Pattern:**
  - "Instant-Zahlung" + "carburante"
  - "Instant payment"
  - "Pagamento clearing"

**Azione:** ATTENZIONE - possibile doppia registrazione!
Verificare se questi pagamenti sono già registrati nei conti spese (6xxx).
Se sì, eliminare il movimento da 10901.
Se no, riclassificare al conto spese corretto.

---

#### 6. CASH_DEPOSIT - Depositi Contanti
- **Count:** 4 movimenti
- **Balance:** CHF -87,570.00
- **Pattern:**
  - "Einzahlung"
  - "Bareinzahlungs-Kommission"

**Azione:**
```sql
UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '1000')
WHERE id IN (527281, 502136, 471429, 425059);
```

---

### Priority 3 - LOW (Revisione Manuale)

#### 7. OTHER - Altri Movimenti
- **Count:** 157 movimenti
- **Balance:** CHF +361,971.07
- **Pattern:** Vari, require analisi case-by-case

**Azione:** Analisi manuale di ogni movimento per categorizzazione corretta

---

## PIANO DI AZIONE STEP-BY-STEP

### Step 1: IMMEDIATE ACTIONS (Priority 1)

#### 1.1 Riclassifica FX Transactions
```sql
-- Verify account exists
SELECT id, code, name FROM account_account WHERE code = '2660';

-- If not exists, create it or identify correct account code

-- Reclassify 40 FX movements
UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '2660')
WHERE id IN (527337, 527398, 500586, 502778, 485432, 486188, 473116, 486242, 459220, 486307, 437804, 454402, 432302, 454472, 413829, 416306, 393273, 394309, 389887, 394343, 371062, 371813, 359222, 371861, 344012, 371899, 332867, 332903, 329700, 331774, 324961, 312663, 324993, 309274, 312897, 300737, 312923, 298058, 298082, 298162);

-- Verify
SELECT COUNT(*), SUM(balance) FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '2660');
```

**Expected result:** 40 movements, Balance: -599,376.20 CHF

---

#### 1.2 Riclassifica Credit Card Payments
```sql
-- Verify account exists
SELECT id, code, name FROM account_account WHERE code = '10803';

-- Reclassify 15 credit card payments
UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '10803')
WHERE id IN (528523, 504841, 459202, 415080, 393269, 371068, 329712, 331776, 281762, 259603, 227974, 227978, 238297, 264824, 332068);

-- Verify
SELECT COUNT(*), SUM(balance) FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '10803');
```

**Expected result:** 15 movements, Balance: +44,144.51 CHF

---

#### 1.3 Review Internal Transfers (MANUAL)
**Action:** Use CSV file `konto-10901-v2-bank_transfer_internal.csv`

For each transfer:
1. Identify source and destination accounts from description/IBAN
2. Verify if already correctly posted
3. If not, create proper bank-to-bank entry
4. Delete entry from 10901

**Total:** 29 movements to review manually

---

### Step 2: MEDIUM PRIORITY ACTIONS

#### 2.1 Currency Differences
Review CSV: `konto-10901-v2-currency_diff.csv`

Determine if these should go to:
- 2660 (Utili/Perdite cambi) if they are real FX gains/losses
- Other account if they are part of different operations

**Count:** 39 movements, Balance: +372,214.97 CHF

---

#### 2.2 Instant Payments
**CRITICAL:** Review CSV: `konto-10901-v2-instant_payment.csv`

For each payment:
1. Check if already posted to expense account (6xxx)
2. If YES: Delete from 10901 (duplicate entry)
3. If NO: Reclassify to appropriate expense account

**Count:** 69 movements, Balance: -470,000.00 CHF

---

#### 2.3 Cash Deposits
```sql
-- Simple reclassification to cash account
UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '1000')
WHERE id IN (527281, 502136, 471429, 425059);
```

**Count:** 4 movements, Balance: -87,570.00 CHF

---

### Step 3: LOW PRIORITY (Manual Review)

Review CSV: `konto-10901-v2-other.csv`

Categorize each of 157 movements individually.

---

## EXPECTED RESULTS AFTER RECLASSIFICATION

### Immediate Actions (Step 1.1 + 1.2)
- **Movements reclassified:** 55 (40 FX + 15 Credit Card)
- **Balance impact:** -555,231.69 CHF (-599,376.20 + 44,144.51)
- **Remaining on 10901:** 298 movements

### After All Steps
- **Final balance on 10901:** CHF 0.00
- **All movements:** Correctly classified in proper accounts

---

## VERIFICATION QUERIES

### Check Current Status
```sql
SELECT
  SUM(debit) as total_debit,
  SUM(credit) as total_credit,
  SUM(balance) as current_balance,
  COUNT(*) as movement_count
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '10901');
```

**Current result:**
- Total Debit: CHF 6,848,766.68
- Total Credit: CHF 7,224,382.33
- Balance: CHF -375,615.65
- Count: 353

**Expected after full reclassification:**
- Balance: CHF 0.00
- Count: 0

---

### Check Distribution by Account
```sql
SELECT
  a.code,
  a.name,
  COUNT(*) as movements,
  SUM(aml.debit) as total_debit,
  SUM(aml.credit) as total_credit,
  SUM(aml.balance) as balance
FROM account_move_line aml
JOIN account_account a ON aml.account_id = a.id
WHERE aml.id IN (
  -- List of all 353 IDs originally in 10901
  SELECT id FROM account_move_line
  WHERE account_id = (SELECT id FROM account_account WHERE code = '10901')
)
GROUP BY a.code, a.name
ORDER BY a.code;
```

---

## FILES GENERATED

1. **konto-10901-full-analysis.json** - Full data extraction (353 movements)
2. **konto-10901-analysis-v2.json** - Improved categorization with all details
3. **konto-10901-reclassification-plan.sql** - Complete SQL script
4. **CSV Files (7 total):**
   - konto-10901-v2-currency_exchange_fx.csv (40 movements)
   - konto-10901-v2-credit_card_payment.csv (15 movements)
   - konto-10901-v2-bank_transfer_internal.csv (29 movements)
   - konto-10901-v2-currency_diff.csv (39 movements)
   - konto-10901-v2-instant_payment.csv (69 movements)
   - konto-10901-v2-cash_deposit.csv (4 movements)
   - konto-10901-v2-other.csv (157 movements)

---

## NEXT STEPS

### Immediate (Today)
1. Review and execute Step 1.1 (FX transactions)
2. Review and execute Step 1.2 (Credit card payments)
3. Start manual review of Step 1.3 (Internal transfers)

### Short Term (This Week)
4. Complete Step 2.1 (Currency differences)
5. Complete Step 2.2 (Instant payments) - CRITICAL
6. Execute Step 2.3 (Cash deposits)

### Medium Term (Next Week)
7. Manual categorization of OTHER movements (157)
8. Final verification
9. Close account 10901

---

## SUMMARY TABLE

| Category | Count | Balance CHF | Priority | Action |
|----------|-------|-------------|----------|--------|
| Currency Exchange FX | 40 | -599,376.20 | HIGH | Move to 2660 |
| Credit Card Payment | 15 | +44,144.51 | HIGH | Move to 10803 |
| Bank Transfer Internal | 29 | +3,000.00 | HIGH | Manual review |
| Currency Diff | 39 | +372,214.97 | MEDIUM | Review + classify |
| Instant Payment | 69 | -470,000.00 | MEDIUM | Check duplicates |
| Cash Deposit | 4 | -87,570.00 | MEDIUM | Move to 1000 |
| Other | 157 | +361,971.07 | LOW | Manual review |
| **TOTAL** | **353** | **-375,615.65** | | |

---

## CONTACT & SUPPORT

**Database Optimizer Specialist**
- All CSV files available for Excel analysis
- SQL scripts ready for execution
- Full JSON data for programmatic processing

**Odoo Instance:**
- URL: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
- DB: lapadevadmin-lapa-v2-staging-2406-25408900
- User: paul@lapa.ch

---

**Generated:** 2025-11-15
**Status:** Analysis complete, ready for reclassification
**Database Optimizer Specialist**
