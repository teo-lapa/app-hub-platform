# SUMMARY LUGLIO 2024 - One Page

## Saldi Bancari

| Konto | Banca | Valuta | Saldo 30/06 | Saldo 31/07 | Variazione | % Change |
|-------|-------|--------|-------------|-------------|------------|----------|
| 1024 | UBS CHF | CHF | 142,785.59 | 345,760.44 | **+202,974.85** | +142% |
| 1025 | UBS EUR | EUR | **-50,573.62** | 14,702.54 | **+65,276.16** | +229% |
| 1026 | Credit Suisse | CHF | N/A | N/A | N/A | N/A |

## Alert Priorita Alta

| # | Tipo | Account | Descrizione | Azione |
|---|------|---------|-------------|--------|
| 1 | SALDO NEGATIVO | 1025 | EUR -50,573.62 al 30/06 | Verifica scoperto autorizzato |
| 2 | MOVIMENTO GRANDE | 1025 | +EUR 65K in 1 mese | Identifica transazione |
| 3 | MOVIMENTO GRANDE | 1024 | +CHF 202K in 1 mese | Analizza flussi |
| 4 | DATI MANCANTI | 1026 | No dettaglio mensile | Usa dati Odoo |

## Query da Eseguire

| # | Nome | Obiettivo | Tempo |
|---|------|-----------|-------|
| 1 | Saldi Apertura | Verifica CHF 142K, EUR -50K | 5 min |
| 2 | Movimenti Luglio | Estrai tutte le righe | 10 min |
| 3 | Saldi Chiusura | Verifica CHF 345K, EUR 14K | 5 min |
| 4 | Trova Duplicati | Identifica errori | 5 min |
| 5 | Movimenti Grandi | Controllo >50K | 5 min |

**Totale query:** 30 minuti

## Checklist Verifica

### Konto 1024 (UBS CHF)
- [ ] Saldo apertura match: 142,785.59
- [ ] Saldo chiusura match: 345,760.44
- [ ] Variazione match: +202,974.85
- [ ] No duplicati
- [ ] Riconciliazione 100%

### Konto 1025 (UBS EUR)
- [ ] Saldo apertura match: -50,573.62
- [ ] Saldo chiusura match: 14,702.54
- [ ] Variazione match: +65,276.16
- [ ] Movimento recovery identificato
- [ ] Riconciliazione 100%

### Konto 1026 (Credit Suisse)
- [ ] Movimenti estratti da Odoo
- [ ] Saldo calcolato
- [ ] Completezza verificata

## Files

### Input
- `data-estratti/UBS-CHF-2024-CLEAN.json`
- `data-estratti/UBS-EUR-2024-CLEAN.json`
- `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`

### Output
- `REPORT-LUGLIO-2024.json` (strutturato)
- `luglio-2024-konto-*-movimenti.xlsx` (dati)
- `luglio-2024-report-finale.xlsx` (summary)

### Docs
- `INDEX-VERIFICA-LUGLIO-2024.md` (start here)
- `VERIFICA-LUGLIO-2024-README.md` (procedura)
- `LUGLIO-2024-QUERY-ODOO.md` (query)

## Timeline

| Fase | Attivita | Tempo | Output |
|------|----------|-------|--------|
| 1 | Preparazione | 15 min | Setup completo |
| 2 | Connessione Odoo | 5 min | Login OK |
| 3 | Query saldi | 30 min | Verifica match |
| 4 | Estrazione movimenti | 30 min | Excel exports |
| 5 | Controlli qualita | 60 min | Issues list |
| 6 | Riconciliazione | 60 min | 100% match |
| 7 | Report finale | 30 min | Deliverable |

**Totale:** 3.5 - 4 ore

## Key Numbers

```
Accounts analyzed: 3 (1024, 1025, 1026)
Period: 01/07/2024 - 31/07/2024
Queries needed: 5
Expected movements: TBD (da contare in Odoo)
Target reconciliation: 100%
Critical anomalies: 3
```

## Quick Actions

1. Open: `INDEX-VERIFICA-LUGLIO-2024.md`
2. Login: https://erp.alpenpur.ch
3. Execute: 5 queries from query doc
4. Compare: Results vs expected
5. Report: Fill checklist + summary

## Status

```
[████████████████████████████░░] 90% READY

✓ Report JSON generated
✓ README completed
✓ Query reference created
✓ Index documented
✓ Scripts prepared
⏳ Waiting for Odoo execution
```

## Next Step

**ACTION:** Esegui Query 1 in Odoo e verifica saldo apertura
**Expected:** CHF 142,785.59 (1024), EUR -50,573.62 (1025)
**If match:** Procedi con Query 2
**If differ:** Investiga differenza prima di procedere

---

**Ready to start!**
**Data: 2025-11-16**
