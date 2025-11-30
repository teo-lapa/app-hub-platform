# REPORT GENNAIO 2024 - Verifica Completa Transazioni

**Data analisi**: 2025-11-16
**Periodo**: 01/01/2024 - 31/01/2024
**Odoo**: STAGING (lapadevadmin-lapa-v2-staging-2406-25408900)

---

## EXECUTIVE SUMMARY

### PROBLEMI CRITICI IDENTIFICATI

1. **UBS EUR (1025)**: ZERO transazioni matchate - Sistema completamente disallineato
2. **UBS CHF (1024)**: 129 DUPLICATI - Doppia registrazione massiva
3. **UBS EUR (1025)**: 37 transazioni mancanti in Odoo
4. **Totale discrepanze**: 517 transazioni in Odoo vs 37 in JSON

---

## DETTAGLIO PER KONTO

### 1. UBS EUR (Konto 1025)

**Status**: ❌ CRITICO - Zero matching

| Metrica | Valore |
|---------|--------|
| Transazioni JSON | 37 |
| Transazioni Odoo | 78 |
| Matched | **0** ❌ |
| Mancanti in Odoo | **37** ❌ |
| Extra in Odoo | **78** ❌ |
| Duplicati | 0 |

**Problema**:
- NESSUNA transazione JSON trovata in Odoo
- Possibili cause:
  - Date in formato diverso
  - Importi con arrotondamenti diversi
  - Transazioni registrate su altro konto
  - Import mai eseguito

**Transazioni mancanti (sample)**:
- 03/01/2024: -36,482.86 EUR (e-banking-Sammelauftrag)
- 03/01/2024: -23,317.89 EUR (LATTICINI MOLISANI TAMBURRO)
- 03/01/2024: -6,685.00 EUR (LDF SRL)
- 03/01/2024: -4,983.00 EUR (TRINITA SPA)
- 04/01/2024: -7,461.11 EUR (e-banking-Sammelauftrag)
- 04/01/2024: -5,000.00 EUR (LAURA TEODORESCU carta)

**Azione richiesta**:
1. Verificare se transazioni sono state importate su altro account
2. Controllare formato date/importi in Odoo
3. Eseguire import da estratto conto gennaio 2024

---

### 2. UBS CHF (Konto 1024)

**Status**: ❌ CRITICO - Duplicati massivi

| Metrica | Valore |
|---------|--------|
| Transazioni JSON | 0 (file non disponibile) |
| Transazioni Odoo | 439 |
| Matched | 0 |
| Mancanti in Odoo | 0 |
| Extra in Odoo | 439 |
| **Duplicati** | **129** ❌ |

**Problema**:
- 129 gruppi di transazioni duplicate (stessa data + importo)
- Ogni duplicato ha 2 occorrenze in Odoo
- Pattern: ID alti (541XXX) vs ID bassi (128XXX-171XXX)
- Causa probabile: **Doppio import dello stesso estratto conto**

**Esempi duplicati**:

| Data | Importo CHF | Partner | ID duplicati |
|------|-------------|---------|--------------|
| 03/01 | 38,830.93 | CAMILLA AG | 541464 + 265631 |
| 03/01 | 28,539.15 | CAMILLA AG OPFIKON | 541462 + 169297 |
| 03/01 | 14,939.63 | FILOMENO SA | 541460 + 171153 |
| 03/01 | 12,807.78 | ROSOLINO SA | 541458 + 171155 |
| 09/01 | 18,110.10 | ADALBIRO SA | 541562 + 129032 |
| 09/01 | 16,262.78 | ADALBIRO SA | 541560 + 129030 |
| 09/01 | 15,432.91 | AGINULFO SA | 541558 + 129028 |
| 25/01 | 20,000.00 | aMA PASTICCERIA AG | 541700 + 128760 |

**Pattern identificato**:
- Serie ID 541XXX: Import recente (probabilmente novembre 2024)
- Serie ID 128XXX-171XXX: Import precedente (probabilmente gennaio/febbraio 2024)
- **STESSO estratto conto importato 2 volte**

**Azione richiesta**:
1. **PRIORITÀ MASSIMA**: Eliminare tutti i duplicati con ID 541XXX (serie alta)
2. Verificare quale serie è corretta confrontando con estratto conto originale
3. Implementare controllo pre-import per evitare duplicati futuri
4. Riconciliare saldi dopo pulizia

---

## ANALISI QUANTITATIVA

### Totali gennaio 2024

| Metrica | UBS EUR | UBS CHF | TOTALE |
|---------|---------|---------|--------|
| Transazioni JSON | 37 | 0 | **37** |
| Transazioni Odoo | 78 | 439 | **517** |
| Matched | 0 | 0 | **0** |
| Mancanti | 37 | 0 | **37** |
| Extra | 78 | 439 | **517** |
| Duplicati | 0 | 129 | **129** |

**Ratio discrepanza**: 517 Odoo vs 37 JSON = **14x più transazioni in Odoo**

---

## IMPATTO FINANZIARIO

### UBS CHF duplicati (stima)

Considerando 129 duplicati × importo medio ~3,000 CHF:
- **Importo duplicato stimato**: ~387,000 CHF
- **Impatto su saldi**: Saldo gonfiato artificialmente

### UBS EUR mancanti

37 transazioni EUR mancanti:
- Impossibile calcolare impatto senza saldi apertura/chiusura
- Necessario confronto con estratto conto bancario

---

## RACCOMANDAZIONI IMMEDIATE

### STEP 1: Eliminazione duplicati CHF (URGENTE)

```sql
-- Query di identificazione duplicati (esempio)
SELECT
  date,
  debit - credit as amount,
  COUNT(*) as occurrences,
  STRING_AGG(id::text, ', ') as ids
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
  AND date >= '2024-01-01'
  AND date <= '2024-01-31'
  AND parent_state = 'posted'
GROUP BY date, amount
HAVING COUNT(*) > 1;

-- Eliminazione sicura (SOLO dopo verifica manuale)
-- DELETE FROM account_move_line WHERE id IN (541XXX, ...);
```

**ATTENZIONE**: Backup obbligatorio prima di eliminare

### STEP 2: Import transazioni EUR mancanti

1. Recuperare estratto conto UBS EUR gennaio 2024
2. Verificare formato CSV/PDF
3. Eseguire import con tool esistente
4. Verificare matching post-import

### STEP 3: Verifica saldi

Dopo pulizia duplicati e import mancanti:

| Konto | Saldo JSON 31/01 | Saldo Odoo 31/01 | Diff |
|-------|------------------|------------------|------|
| 1025 EUR | 6,749.58 | TBD | TBD |
| 1024 CHF | 373,948.51 | TBD | TBD |

### STEP 4: Prevenzione futura

1. Implementare hash/checksum per ogni transazione importata
2. Bloccare import se hash già esistente
3. Log completo di ogni import (data, file, record processati)
4. Alert automatico se saldo post-import diverge >5% dal previsto

---

## FILE E RISORSE

### File generati

- `REPORT-GENNAIO-2024.json` - Report dettagliato completo (337KB)
- `REPORT-GENNAIO-2024-SUMMARY.md` - Questo documento

### File sorgente utilizzati

- `data-estratti/UBS-EUR-2024-TRANSACTIONS.json` - Transazioni EUR complete
- `data-estratti/UBS-CHF-2024-CLEAN.json` - Solo metadata CHF (transazioni mancanti)

### File mancanti

- CSV originale UBS CHF Q1 2024
- Estratto conto PDF gennaio 2024

---

## NEXT STEPS

1. [ ] **CRITICO**: Backup database Odoo
2. [ ] Eliminare duplicati CHF (serie 541XXX)
3. [ ] Import transazioni EUR mancanti
4. [ ] Verifica saldi post-pulizia
5. [ ] Riconciliazione finale gennaio 2024
6. [ ] Implementare controlli anti-duplicati

---

## NOTE TECNICHE

**Script utilizzato**: `scripts/verifica-gennaio-2024.py`
**Algoritmo matching**:
- Match per data esatta (YYYY-MM-DD)
- Match per importo con tolleranza ±0.02 (arrotondamento)
- Non matching per descrizione (troppo variabile)

**Limitazioni**:
- File JSON CHF non disponibile (solo Odoo)
- Non analizzato Credit Suisse (file JSON incompleto)
- Matching basato solo su data+importo (no hash univoco)

---

**Generato da**: AGENTE GENNAIO 2024
**Data**: 2025-11-16
**Versione**: 1.0
