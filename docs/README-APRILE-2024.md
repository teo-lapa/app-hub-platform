# APRILE 2024 - Analisi Konti Bancari

Verifica completa movimenti bancari Aprile 2024 per konti 1024, 1025, 1026.

---

## START HERE

**Leggi il report completo**: [REPORT-APRILE-2024.md](./REPORT-APRILE-2024.md)

**Quick view**: [REPORT-APRILE-2024-SUMMARY.txt](./REPORT-APRILE-2024-SUMMARY.txt)

**Indice navigazione**: [INDEX-REPORT-APRILE-2024.md](./INDEX-REPORT-APRILE-2024.md)

---

## RISULTATI PRINCIPALI

### 1024 - UBS CHF

```
Saldo 31/03/2024:  CHF  108,757.58
Saldo 30/04/2024:  CHF  122,340.82
Variazione:        CHF  +13,583.24  (+12.49%)
```

Status: OK - Ripresa positiva

---

### 1025 - UBS EUR

```
Saldo 31/03/2024:  EUR  -22,006.58  [SCOPERTO]
Saldo 30/04/2024:  EUR  -12,005.79  [SCOPERTO]
Variazione:        EUR  +10,000.79  (+45.44%)
```

Status: ALERT - Scoperto persistente (migliorato)

**AZIONE RICHIESTA**: Investigare cause scoperto marzo 2024

---

### 1026 - Credit Suisse CHF

```
Dati Aprile 2024:  NON DISPONIBILI
```

Status: CRITICO - Estratti mensili mancanti

**AZIONE RICHIESTA**: Richiedere estratti Q1-Q2 2024 a Credit Suisse

---

## FILES DISPONIBILI

### Report

- `REPORT-APRILE-2024.md` - Report completo
- `REPORT-APRILE-2024.json` - Dati machine-readable
- `REPORT-APRILE-2024-SUMMARY.txt` - Quick summary
- `INDEX-REPORT-APRILE-2024.md` - Indice navigazione
- `README-APRILE-2024.md` - Questo file

### Scripts

- `scripts/report-aprile-2024-offline.ts` - Analisi offline (COMPLETATO)
- `scripts/analizza-aprile-2024.ts` - Analisi con Odoo (richiede auth)
- `scripts/analizza-aprile-2024.js` - Versione JS (deprecata)

### Data Sources

- `data-estratti/UBS-CHF-2024-CLEAN.json` - Dati UBS CHF
- `data-estratti/UBS-EUR-2024-CLEAN.json` - Dati UBS EUR
- `data-estratti/CREDIT-SUISSE-2024-CLEAN.json` - Dati Credit Suisse

---

## QUICK COMMANDS

### Leggere Report

```bash
# Report completo
cat REPORT-APRILE-2024.md

# Quick summary
cat REPORT-APRILE-2024-SUMMARY.txt

# JSON summary
cat REPORT-APRILE-2024.json | jq '.summary'

# Saldi specifici
cat REPORT-APRILE-2024.json | jq '.summary.accounts_analyzed[] | {code, name, closing_balance_30_04, net_change}'
```

### Eseguire Analisi

```bash
# Offline analysis (basato su estratti bancari)
npx tsx scripts/report-aprile-2024-offline.ts

# Analisi completa con Odoo (richiede credenziali)
npx tsx scripts/analizza-aprile-2024.ts
```

---

## AZIONI RICHIESTE

### PRIORITA CRITICA

1. **Credit Suisse**
   - Richiedere estratti conto Q1-Q2 2024
   - Verificare PDF non processati
   - Se PDF troppo grandi, richiedere CSV/Excel

2. **UBS EUR Scoperto**
   - Investigare cause scoperto marzo 2024 (da +EUR 1.3K a -EUR 22K)
   - Verificare grandi pagamenti marzo
   - Controllare autorizzazione scoperto

### PRIORITA ALTA

3. **Connessione Odoo**
   - Ottenere credenziali per script analisi
   - Eseguire confronto Odoo vs. Banca
   - Verificare riconciliazione

4. **Riconciliazione Bancaria**
   - Verificare matching aprile 2024
   - Identificare movimenti non riconciliati

---

## NEXT STEPS

### Immediati (Questa Settimana)

- [ ] Richiedere estratti Credit Suisse
- [ ] Investigare scoperto UBS EUR
- [ ] Ottenere credenziali Odoo

### Breve Termine (2 Settimane)

- [ ] Eseguire analisi Odoo completa
- [ ] Riconciliare movimenti aprile
- [ ] Verificare movimenti non riconciliati

### Medio Termine (1 Mese)

- [ ] Setup monitoring automatico
- [ ] Dashboard riconciliazione mensile
- [ ] Documentare procedure

---

## STRUTTURA REPORT

Il report completo (`REPORT-APRILE-2024.md`) contiene:

1. **Executive Summary** - Overview generale
2. **Saldi al 30/04/2024** - Dettaglio per ogni conto
3. **Progressione Mensile** - Trend Gen-Apr 2024
4. **Raccomandazioni** - Azioni prioritarie
5. **Prossimi Passi** - Timeline azioni
6. **Technical Details** - Scripts e data sources
7. **Appendice** - Dati grezzi JSON
8. **Conclusioni** - Situazione finale

---

## TECHNICAL INFO

### Script Offline Analysis

**File**: `scripts/report-aprile-2024-offline.ts`

**Funzionalita**:
- Carica estratti bancari da JSON
- Analizza saldi mensili aprile 2024
- Calcola variazioni e percentuali
- Genera report completi

**Output**:
- `REPORT-APRILE-2024.json` (machine-readable)
- `REPORT-APRILE-2024-SUMMARY.txt` (human-readable)

**Status**: COMPLETATO

---

### Script Odoo Analysis

**File**: `scripts/analizza-aprile-2024.ts`

**Funzionalita**:
- Autenticazione Odoo via JSON-RPC
- Fetch account.move.line per konti 1024, 1025, 1026
- Confronto riga per riga Odoo vs. Banca
- Identificazione discrepanze

**Prerequisiti**:
- Credenziali Odoo in `.env.local`
- Connessione Odoo instance

**Status**: READY (richiede auth)

---

## DATA QUALITY

| Konto | Completezza | Transazioni | Verificato |
|-------|-------------|-------------|------------|
| 1024 UBS CHF | 100% | 850 (Q2) | SI |
| 1025 UBS EUR | 100% | 267 (H1) | SI |
| 1026 Credit Suisse | 0% | N/A | NO |

---

## CONTATTI

**Backend Specialist**: Odoo Integration, Scripts, Analisi
**Commercialista**: Verifica Saldi, Riconciliazione
**Amministrazione**: Documenti Bancari

---

## FAQ RAPIDE

**Q: Dati affidabili?**
A: SI per UBS (CHF e EUR), NO per Credit Suisse (dati mancanti)

**Q: Perche Credit Suisse non ha dati?**
A: Estratti mensili non forniti, solo saldo fine anno

**Q: Cosa fare per scoperto UBS EUR?**
A: Investigare marzo 2024, verificare autorizzazione banca

**Q: Come vedere movimenti riga per riga?**
A: Serve connessione Odoo, eseguire `scripts/analizza-aprile-2024.ts`

---

**Data Generazione**: 16/11/2025
**Versione**: 1.0
**Modalita**: Offline Analysis
