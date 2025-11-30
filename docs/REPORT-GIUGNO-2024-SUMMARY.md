# GIUGNO 2024 - EXECUTIVE SUMMARY

## STATUS: CRITICO - 0% RICONCILIAZIONE

**Account**: Konto 1025 (UBS EUR - CH25 0027 8278 1220 8760 A)
**Periodo analizzato**: 01/06/2024 - 30/06/2024
**Data verifica**: 16 novembre 2025

---

## IL PROBLEMA IN 3 NUMERI

| Metrica | Valore | Descrizione |
|---------|--------|-------------|
| **0%** | Tasso riconciliazione | Nessuna transazione matcha tra banca e Odoo |
| **EUR 234K** | Differenza Dare | Movimenti bancari NON in Odoo |
| **+13** | Movimenti extra | Odoo ha più movimenti della banca |

---

## COSA È SUCCESSO

### 1. Prime 2 Settimane Mancanti (01-14 giugno)

**Odoo NON ha registrato EUR 367,305 di pagamenti** effettuati dal 01 al 14 giugno.

**Impact**:
- 30 transazioni bancarie non in Odoo
- Include pagamenti critici a fornitori chiave:
  - LATTICINI MOLISANI: EUR 38,797
  - FERRAIUOLO FOODS: EUR 32,879
  - LATTERIA MANTOVA: EUR 36,550 (4 pagamenti)

**Root cause**: Import incompleto o mancato import Q2 2024

### 2. Date Non Allineate (15-30 giugno)

Anche i movimenti dal 15/06 in poi non matchano perché:
- **Data banca**: usa data movimento
- **Data Odoo**: usa data valuta (solitamente 1-2 giorni dopo)

**Esempio**:
```
Banca:  20/06/2024 | -EUR 38,797.33 | LATTICINI MOLISANI
Odoo:   21/06/2024 | -EUR 37,633.41 | LATTICINI MOLISANI
Diff:   1 giorno    | EUR 1,163.92   | Stessa transazione!
```

### 3. Importi Diversi

**Differenze sistematiche EUR 500-2,000** per transazione.

**Possibili cause**:
- Tassi di cambio diversi (EUR/CHF)
- Commissioni bancarie non registrate
- Arrotondamenti contabili

---

## I NUMERI NEL DETTAGLIO

### Estratto Conto Bancario (UBS EUR)

| Metrica | Valore |
|---------|--------|
| **Saldo iniziale** (01/06) | EUR -6,344.93 |
| **Totale uscite** | EUR -457,305.35 |
| **Totale entrate** | EUR +230,000.00 |
| **Saldo finale** (30/06) | EUR -50,573.62 |
| **Variazione netta** | EUR -44,228.69 |
| **Numero transazioni** | 44 |

### Contabilità Odoo (Konto 1025)

| Metrica | Valore |
|---------|--------|
| **Totale Dare** | EUR -223,100.00 |
| **Totale Avere** | EUR +392,079.02 |
| **Variazione netta** | EUR +168,979.02 |
| **Numero movimenti** | 57 |
| **Prima data** | 15/06/2024 |
| **Ultima data** | 29/06/2024 |

### Gap Analysis

| Tipo | Importo Differenza | Causa Probabile |
|------|-------------------|-----------------|
| **Dare (uscite)** | EUR 234,205.35 | Movimenti 01-14/06 non importati |
| **Avere (entrate)** | EUR 162,079.02 | Possibili duplicati FX in Odoo |
| **Saldo finale** | EUR 219,552.64 | Cumulo di tutte le discrepanze |

---

## TOP 10 TRANSAZIONI MANCANTI

Queste transazioni sono in banca ma **NON in Odoo**:

| Data | Importo EUR | Fornitore/Descrizione |
|------|-------------|----------------------|
| 11/06 | -170,000.00 | FX Spot - Vendita EUR/Acquisto CHF |
| 11/06 | +170,000.00 | FX Spot - Acquisto EUR/Vendita CHF |
| 03/06 | -15,635.62 | Batch pagamenti SEPA (4 fornitori) |
| 05/06 | -12,856.00 | Batch pagamenti SEPA (5 fornitori) |
| 05/06 | -11,592.47 | LATTERIA SOCIALE MANTOVA (FT 691V2) |
| 05/06 | -9,583.80 | INNOVACTION S.R.L (FT 905E) |
| 05/06 | -6,905.25 | LATTERIA SOCIALE MANTOVA (FT 728) |
| 05/06 | -6,677.32 | INNOVACTION S.R.L (FT 675E) |
| 06/06 | -17,364.00 | Batch pagamenti SEPA (2 fornitori) |
| 06/06 | -7,000.00 | LDF SRL (FT 389) |

**Totale EUR 332,000** da importare/riconciliare

---

## AZIONI IMMEDIATE (Entro 48h)

### 1. Import Movimenti Mancanti
```bash
# Importa movimenti 01-14 giugno 2024
python scripts/import-ubs-eur-june-first-half.py
```

**Checklist**:
- [ ] Scaricare estratto conto UBS EUR Q2 2024 (01/04-30/06)
- [ ] Filtrare solo movimenti 01-14 giugno
- [ ] Importare in Odoo konto 1025
- [ ] Verificare saldo intermedio al 14/06

### 2. Cleanup Duplicati Odoo
```sql
-- Esegui query per trovare duplicati
\i scripts/verifica-konto-1025-giugno.sql
```

**Checklist**:
- [ ] Identificare 13 movimenti extra in Odoo
- [ ] Verificare se sono duplicati (stessa data/importo)
- [ ] Cancellare duplicati (se presenti)
- [ ] Ricalcolare saldo

### 3. Riconciliazione Manuale Top 10
```python
# Match manuale transazioni >EUR 10K
python scripts/reconcile-giugno-2024-manual.py
```

**Priorità riconciliazione**:
1. FX transactions (EUR 340K)
2. LATTICINI MOLISANI (EUR 38K)
3. FERRAIUOLO FOODS (EUR 32K)
4. LATTERIA MANTOVA (EUR 36K)
5. Altri fornitori >EUR 10K

---

## METRICHE DI SUCCESSO

| KPI | Target | Come Misurare |
|-----|--------|---------------|
| **Tasso riconciliazione** | ≥95% | Script verifica-giugno-2024.py |
| **Differenza saldo** | ≤EUR 100 | Banca vs Odoo al 30/06 |
| **Movimenti non matchati** | ≤3 | Count transazioni senza match |
| **Tempo chiusura** | <2 giorni | Timestamp completamento |

---

## FILE DELIVERABLE

### Report Generati
1. **REPORT-GIUGNO-2024.md** - Analisi dettagliata completa
2. **REPORT-GIUGNO-2024.json** - Dati raw per processing
3. **report-giugno-2024-output.txt** - Output console completo

### Script Disponibili
1. **scripts/verifica-giugno-2024.py** - Verifica automatica banca vs Odoo
2. **scripts/verifica-konto-1025-giugno.sql** - Query SQL analisi Odoo
3. **scripts/import-ubs-eur-june-first-half.py** - Import movimenti mancanti (da creare)

### Data Sources
1. **data-estratti/UBS-EUR-2024-TRANSACTIONS.json** - Tutte transazioni 2024
2. **data-estratti/UBS-EUR-2024-CLEAN.json** - Summary mensili
3. **Odoo konto 1025** - Movimenti contabili via XML-RPC

---

## TIMELINE PROPOSTA

| Fase | Durata | Responsabile | Output |
|------|--------|--------------|--------|
| **1. Import mancanti** | 4h | Backend | EUR 367K importati |
| **2. Cleanup duplicati** | 2h | Backend | -13 movimenti extra |
| **3. Riconciliazione top 10** | 3h | Accounting | 10 match confermati |
| **4. Riconciliazione restanti** | 4h | Accounting | 34 match automatici |
| **5. Verifica finale** | 1h | Backend | Report ≥95% |
| **TOTALE** | **14h** | | **Giugno chiuso** |

---

## CONTATTI & SUPPORT

**Per domande tecniche**:
- Script Python: Backend Specialist
- Query SQL: Database Optimizer
- Odoo integration: API Architect

**Per verifica contabile**:
- Commercialista
- CFO

**Escalation**:
- CEO (se non risolvibile in 48h)

---

**Generato**: 2025-11-16 17:03:00
**Versione**: 1.0
**Status**: DRAFT - In attesa approvazione
