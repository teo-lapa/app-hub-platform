# Bank Import - Quick Start Guide

Import 2024 bank statements in 5 minutes.

## Prerequisites

- [ ] Node.js installed
- [ ] Access to Odoo (credentials ready)
- [ ] CSV files in correct location

## Step 1: Configure Odoo Journals (2 min)

1. Login to Odoo: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
2. Go to **Accounting → Configuration → Journals**
3. Create/find these journals:

   **UBS CHF Journal**:
   - Name: `UBS CHF`
   - Code: `UBS_CHF` (or note your code)
   - Type: `Bank`
   - Currency: `CHF`

   **UBS EUR Journal**:
   - Name: `UBS EUR`
   - Code: `UBS_EUR` (or note your code)
   - Type: `Bank`
   - Currency: `EUR`

4. Note the journal codes (you'll need them in Step 3)

## Step 2: Update Script Configuration (1 min)

Open: `scripts/import-bank-statements-2024.ts`

Update lines 34-50:

```typescript
const JOURNAL_MAPPINGS: JournalMapping[] = [
  {
    ubsCode: 'UBS CHF',
    odooJournalCode: 'UBS_CHF', // <-- PUT YOUR CODE HERE
    currency: 'CHF',
    targetBalance: 182613.26
  },
  {
    ubsCode: 'UBS EUR',
    odooJournalCode: 'UBS_EUR', // <-- PUT YOUR CODE HERE
    currency: 'EUR',
    targetBalance: 128860.70
  }
];
```

## Step 3: Test Parser (30 sec)

```bash
cd C:\Users\lapa\Desktop\Claude Code\app-hub-platform
node scripts/test-ubs-parser.js
```

Expected output:
```
✓ Parsed 756 transactions
Balance Match: YES
```

If you see errors, check that the CSV file path is correct in the script.

## Step 4: Dry Run (30 sec)

Test without importing:

```bash
npx ts-node scripts/import-bank-statements-2024.ts --dry-run
```

Expected output:
```
✓ UBS CHF: 4 CSV files
✓ UBS EUR: 2 CSV files
DRY RUN MODE - No data will be imported
```

If you see "Missing directories", verify the BASE_DIR path in the script.

## Step 5: Import! (2 min)

Run the full import:

```bash
npx ts-node scripts/import-bank-statements-2024.ts
```

Watch the progress:
```
Connecting to Odoo...
✓ Connected

Importing UBS CHF (CHF)
Parsing UBS CHF 1.1-31.3.2024.csv...
Importing 756 transactions to Odoo...
✓ Statement imported successfully (ID: 123)

Parsing UBS CHF 1.4-30.6.2024.csv...
...
```

Wait for completion (~2-3 minutes for 3000 transactions)

## Step 6: Verify Results (1 min)

Check console for final summary:

```
============================================================
FINAL BALANCE VERIFICATION
============================================================

UBS_CHF (CHF): Expected 182613.26, Actual 182613.26 ✓ MATCH
UBS_EUR (EUR): Expected 128860.70, Actual 128860.70 ✓ MATCH

✓ All imports completed successfully!
```

**If balances match**: SUCCESS! You're done.

**If balances don't match**: See Troubleshooting below.

## Step 7: Verify in Odoo (1 min)

1. Go to **Accounting → Bank → Statements**
2. Find your statements:
   - `UBS CHF 01.01.2024 - 31.03.2024`
   - `UBS CHF 01.04.2024 - 30.06.2024`
   - ... (6 statements total)
3. Click to view transactions
4. Verify counts and balances

## Done!

You've successfully imported all 2024 bank statements. Next steps:

- [ ] Reconcile transactions with invoices
- [ ] Review unmatched transactions
- [ ] Generate accounting reports

---

## Troubleshooting

### "Journal not found"

**Problem**: Odoo journal doesn't exist or code is wrong

**Fix**:
1. Check journal code in Odoo (Accounting → Journals)
2. Update `odooJournalCode` in script to match
3. Retry import

### "Statement already exists"

**Problem**: You ran the import twice

**Fix**:
- **Option A**: Delete old statements in Odoo, re-run
- **Option B**: It's safe to ignore (script skips existing)

### "Balance mismatch"

**Problem**: Computed balance ≠ expected balance

**Possible causes**:
1. CSV file corrupted
2. Not all quarters imported
3. Duplicate transactions

**Fix**:
1. Check `bank-import-report-*.txt` for details
2. Verify all 6 files imported successfully
3. Check individual statement balances in Odoo

### "Authentication failed"

**Problem**: Wrong Odoo credentials

**Fix**:
1. Verify URL, DB, username, password in script
2. Test login manually in browser
3. Update credentials in script

### "Connection timeout"

**Problem**: Odoo is slow or unreachable

**Fix**:
1. Check internet connection
2. Try again later
3. Increase timeout in xmlrpc-client.ts (advanced)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `node scripts/test-ubs-parser.js` | Test parser |
| `npx ts-node scripts/import-bank-statements-2024.ts --dry-run` | Dry run |
| `npx ts-node scripts/import-bank-statements-2024.ts` | Full import |
| `npx ts-node scripts/import-bank-statements-2024.ts --journal="UBS CHF"` | Import single journal |

| File | Purpose |
|------|---------|
| `BANK_IMPORT_README.md` | Full documentation |
| `BANK_IMPORT_DELIVERABLES.md` | Technical details |
| `bank-import-report-*.txt` | Import results |

---

## Expected Timeline

| Step | Time |
|------|------|
| Configure Odoo Journals | 2 min |
| Update Script | 1 min |
| Test Parser | 30 sec |
| Dry Run | 30 sec |
| Full Import | 2-3 min |
| Verify Results | 1 min |
| **TOTAL** | **~7 minutes** |

---

## Support

Need help?
1. Read error messages carefully
2. Check `bank-import-report-*.txt`
3. Review full docs: `BANK_IMPORT_README.md`
4. Contact Backend Specialist

---

**Ready? Let's import!** 🚀
