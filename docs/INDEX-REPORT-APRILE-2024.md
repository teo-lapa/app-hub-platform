# INDEX - REPORT APRILE 2024

Quick reference per navigare l'analisi completa di Aprile 2024.

---

## FILES GENERATI

### Report Principali

1. **REPORT-APRILE-2024.md** - Report completo human-readable
   - Executive summary
   - Analisi dettagliata per conto
   - Raccomandazioni e prossimi passi
   - Appendice dati grezzi

2. **REPORT-APRILE-2024.json** - Report machine-readable
   - Summary section
   - Detailed reports per account
   - Metadata e data sources

3. **REPORT-APRILE-2024-SUMMARY.txt** - Quick reference
   - Saldi al 30/04/2024
   - Raccomandazioni immediate
   - Prossimi passi

---

## QUICK START

### Leggere il Report

```bash
# Human-readable (consigliato)
cat REPORT-APRILE-2024.md

# Quick summary
cat REPORT-APRILE-2024-SUMMARY.txt

# Machine-readable (per scripts)
cat REPORT-APRILE-2024.json | jq '.summary'
```

### Eseguire Analisi

```bash
# Offline Analysis (basato su estratti bancari)
npx tsx scripts/report-aprile-2024-offline.ts

# Odoo Integration (richiede credenziali)
npx tsx scripts/analizza-aprile-2024.ts
```

---

## SALDI AL 30/04/2024 - QUICK VIEW

| Konto | Nome | Valuta | Saldo 31/03 | Saldo 30/04 | Variazione | % |
|-------|------|--------|-------------|-------------|------------|---|
| 1024 | UBS CHF | CHF | 108,757.58 | 122,340.82 | +13,583.24 | +12.49% |
| 1025 | UBS EUR | EUR | -22,006.58 | -12,005.79 | +10,000.79 | +45.44% |
| 1026 | Credit Suisse | CHF | N/A | N/A | N/A | N/A |

**NOTE**:
- 1024 UBS CHF: Ripresa positiva
- 1025 UBS EUR: SCOPERTO persistente (migliorato)
- 1026 Credit Suisse: DATI NON DISPONIBILI

---

## AZIONI PRIORITARIE

### CRITICO

1. **UBS EUR Scoperto**: EUR 12,005.79
   - Investigare cause scoperto marzo 2024
   - Verificare grandi pagamenti

2. **Credit Suisse Dati Mancanti**
   - Richiedere estratti Q1-Q2 2024
   - Verificare PDF non processati

### ALTO

3. **Connessione Odoo**
   - Ottenere credenziali
   - Eseguire analisi completa riga per riga

4. **Riconciliazione Bancaria**
   - Verificare matching aprile 2024
   - Identificare movimenti non riconciliati

---

## STRUCTURE DEL REPORT

### REPORT-APRILE-2024.md

```
1. EXECUTIVE SUMMARY
   - Stato dati
   - Overview generale

2. SALDI AL 30/04/2024
   2.1 UBS CHF (1024)
   2.2 UBS EUR (1025)
   2.3 Credit Suisse (1026)

3. PROGRESSIONE MENSILE 2024
   - Gen-Apr per ogni conto
   - Trend analysis

4. RACCOMANDAZIONI
   - Priorita ALTA
   - Priorita MEDIA
   - Azioni dettagliate

5. PROSSIMI PASSI
   - Immediati
   - Breve termine
   - Medio termine

6. TECHNICAL DETAILS
   - Data sources
   - Scripts disponibili
   - Execution commands

7. APPENDICE
   - Dati grezzi JSON
   - Saldi mensili completi

8. CONCLUSIONI
   - Situazione generale
   - Azioni critiche
```

---

## DATA SOURCES

### Estratti Bancari

1. **UBS CHF**: `data-estratti/UBS-CHF-2024-CLEAN.json`
   - Completezza: 100%
   - Transazioni Q2: 850
   - Saldi mensili: Verificati

2. **UBS EUR**: `data-estratti/UBS-EUR-2024-CLEAN.json`
   - Completezza: 100%
   - Transazioni H1: 267
   - Saldi mensili: Verificati

3. **Credit Suisse**: `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`
   - Completezza: 0% (solo anno)
   - Transazioni aprile: N/A
   - Saldi mensili: NON disponibili

### Odoo Data

- Status: NON DISPONIBILE (auth richiesta)
- Script ready: `scripts/analizza-aprile-2024.ts`
- Modelli da fetch: `account.move.line`, `account.account`

---

## SCRIPTS DISPONIBILI

### 1. report-aprile-2024-offline.ts

**Scopo**: Analisi basata solo su estratti bancari

**Input**:
- `data-estratti/UBS-CHF-2024-CLEAN.json`
- `data-estratti/UBS-EUR-2024-CLEAN.json`
- `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`

**Output**:
- `REPORT-APRILE-2024.json`
- `REPORT-APRILE-2024-SUMMARY.txt`

**Status**: COMPLETATO

**Run**:
```bash
npx tsx scripts/report-aprile-2024-offline.ts
```

---

### 2. analizza-aprile-2024.ts

**Scopo**: Analisi completa con integrazione Odoo

**Input**:
- Estratti bancari (come script 1)
- Odoo account.move.line (fetch via API)

**Output**:
- `REPORT-APRILE-2024.json` (enhanced con dati Odoo)
- Confronto riga per riga Odoo vs. Banca

**Status**: READY (richiede auth Odoo)

**Prerequisiti**:
- `ODOO_USERNAME` e `ODOO_PASSWORD` in `.env.local`
- Connessione a Odoo instance

**Run**:
```bash
npx tsx scripts/analizza-aprile-2024.ts
```

---

## TROUBLESHOOTING

### Problema: Credit Suisse Dati Mancanti

**Cause**:
- Estratti mensili non forniti
- PDF troppo grandi (>100MB)

**Soluzioni**:
1. Richiedere estratti in formato CSV o Excel
2. Usare OCR per estrarre dati da PDF
3. Contattare banca per formato machine-readable

**Script**: `scripts/test-ubs-parser.ts` (adattabile per Credit Suisse)

---

### Problema: UBS EUR Scoperto

**Analisi Necessaria**:
1. Fetch movimenti marzo 2024 (quando è passato in negativo)
2. Identificare grandi pagamenti
3. Verificare se scoperto autorizzato
4. Controllare interesse passivo

**Query Odoo**:
```sql
SELECT date, name, ref, debit, credit, balance
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '1025')
  AND date >= '2024-03-01' AND date <= '2024-04-30'
ORDER BY date, id;
```

---

### Problema: Odoo Authentication Failed

**Cause**:
- Credenziali mancanti in `.env.local`
- URL Odoo errato
- Database name errato

**Fix**:
1. Verificare `.env.local`:
   ```bash
   grep ODOO .env.local
   ```

2. Controllare variabili richieste:
   - `ODOO_URL` o `NEXT_PUBLIC_ODOO_URL`
   - `ODOO_DB`
   - `ODOO_USERNAME`
   - `ODOO_PASSWORD`

3. Testare connessione:
   ```bash
   npx tsx scripts/test-odoo-connection.ts
   ```

---

## FAQ

### Q: Perche Credit Suisse non ha dati aprile?

**A**: Gli estratti conto mensili Credit Suisse non sono stati forniti. Solo il saldo finale anno (31/12/2024) e disponibile. Serve richiedere estratti Q1-Q2 2024 alla banca.

---

### Q: Cosa significa "Scoperto bancario" per UBS EUR?

**A**: Il conto UBS EUR ha saldo negativo (EUR -12,005.79 al 30/04/2024), significa che la banca ha prestato denaro. Questo genera interessi passivi e deve essere rientrato.

---

### Q: Come posso vedere i movimenti riga per riga?

**A**: Serve connessione Odoo. Esegui `npx tsx scripts/analizza-aprile-2024.ts` dopo aver configurato credenziali in `.env.local`. Lo script fetchera tutti i movimenti da `account.move.line`.

---

### Q: I dati sono affidabili?

**A**:
- UBS CHF: SI - Verificati da estratto conto
- UBS EUR: SI - Verificati da estratto conto
- Credit Suisse: NO - Dati mensili non disponibili

---

### Q: Come verifico riconciliazione bancaria?

**A**: Confronta:
1. Saldo banca (questo report)
2. Saldo Odoo konto 1024/1025/1026 (script con Odoo)
3. Differenze = movimenti non riconciliati

**Tool**: `scripts/validate-bank-reconciliation.py`

---

## NEXT STEPS SUMMARY

### Questa Settimana

- [ ] Richiedere estratti Credit Suisse Q1-Q2 2024
- [ ] Investigare scoperto UBS EUR marzo 2024
- [ ] Ottenere credenziali Odoo

### Prossime 2 Settimane

- [ ] Eseguire analisi Odoo completa
- [ ] Riconciliare movimenti aprile 2024
- [ ] Verificare movimenti non riconciliati

### Prossimo Mese

- [ ] Setup monitoring automatico
- [ ] Dashboard riconciliazione mensile
- [ ] Documentare procedure

---

## CONTATTI

**Backend Specialist**: Odoo Integration & Bank Reconciliation
**Commercialista**: Bank Statement Verification
**Amministrazione**: Bank Documents Collection

---

**Ultimo Aggiornamento**: 16/11/2025 17:02:31
**Versione Report**: 1.0
**Modalita**: Offline Analysis
