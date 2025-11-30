# AGOSTO 2024 - RICONCILIAZIONE BANCARIA

## TL;DR

**Status**: 35 transazioni UBS EUR (konto 1025) NON registrate in Odoo
**Valore**: 39,392.56 EUR
**Periodo**: 01/08/2024 - 31/08/2024

## Azione Immediata

```bash
# 1. Leggere report esecutivo
cat REPORT-AGOSTO-2024-EXECUTIVE.md

# 2. Importare transazioni in Odoo
python scripts/import-agosto-2024-odoo.py

# 3. Validare import
python scripts/verifica-agosto-2024.py
```

## File Principali

- `REPORT-AGOSTO-2024-EXECUTIVE.md` - Report completo
- `AGOSTO-2024-UBS-EUR-IMPORT.csv` - 35 transazioni pronte per import
- `INDEX-AGOSTO-2024.md` - Indice completo con tutti i dettagli

## Transazioni Mancanti

| Data | Tipo | Importo | Descrizione |
|------|------|---------|-------------|
| 06/08 | FX Forward | +180,000.00 EUR | Acquisto EUR vs CHF |
| 28/08 | FX Forward | +80,000.00 EUR | Acquisto EUR vs CHF |
| 15/08 | Batch Payment | -100,021.98 EUR | 10 fornitori italiani |
| Varie | Pagamenti | -120,585.46 EUR | Altri fornitori |
| Varie | Commissioni | -34,300.46 EUR | E-Banking fees |

**TOTALE NETTO**: +39,392.56 EUR

## Saldi

- Saldo 31/07: 14,702.54 EUR
- Movimenti: +39,392.56 EUR
- **Saldo 31/08: 41,130.47 EUR** (da verificare in Odoo)

## Alert

1. Commissioni bancarie agosto (34K EUR) sembrano eccessive - DA VERIFICARE
2. FX Forward da riconciliare con konto 1024 (UBS CHF)
3. CSV UBS CHF Q3 2024 mancante (necessario per verifica completa)

## Script Eseguiti

- `scripts/verifica-agosto-2024.py` - Analisi e confronto banca vs Odoo
- `scripts/export-agosto-2024-csv.py` - Export CSV per import

## Query SQL Utili

```sql
-- Verifica importazione
SELECT COUNT(*) FROM account_move_line
WHERE account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND date >= '2024-08-01' AND date <= '2024-08-31';
-- Expected: 35 dopo import

-- Verifica saldo
SELECT SUM(debit - credit) FROM account_move_line
WHERE account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND date <= '2024-08-31';
-- Expected: 41,130.47 EUR
```

---

**Creato**: 2025-11-16 17:00
**Agent**: Backend Specialist
