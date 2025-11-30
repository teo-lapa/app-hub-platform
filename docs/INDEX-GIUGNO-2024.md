# INDICE COMPLETO - VERIFICA GIUGNO 2024

**Agente**: Backend Specialist
**Data analisi**: 16 novembre 2025, ore 17:03
**Konto**: 1025 (UBS EUR - CH25 0027 8278 1220 8760 A)
**Periodo**: 01/06/2024 - 30/06/2024
**Status**: CRITICO - 0% riconciliazione

---

## QUICK NAVIGATION

| Livello | File | Descrizione | Tempo Lettura |
|---------|------|-------------|---------------|
| **⚡ START HERE** | [GIUGNO-2024-QUICK-START.md](GIUGNO-2024-QUICK-START.md) | Guida step-by-step per risolvere | 10 min |
| **📊 EXECUTIVE** | [REPORT-GIUGNO-2024-SUMMARY.md](REPORT-GIUGNO-2024-SUMMARY.md) | Summary per management | 5 min |
| **📋 DETTAGLIO** | [REPORT-GIUGNO-2024.md](REPORT-GIUGNO-2024.md) | Analisi completa riga per riga | 30 min |
| **💾 RAW DATA** | [REPORT-GIUGNO-2024.json](REPORT-GIUGNO-2024.json) | Dati strutturati per processing | - |

---

## DOCUMENTAZIONE

### 1. Quick Start Guide
**File**: `GIUGNO-2024-QUICK-START.md`
**Scopo**: Guida operativa per riconciliare giugno 2024
**Contiene**:
- Step 1: Verifica situazione (5 min)
- Step 2: Analisi SQL Odoo (15 min)
- Step 3: Import movimenti mancanti (4h)
- Step 4: Cleanup duplicati (2h)
- Step 5: Riconciliazione manuale (7h)
- Step 6: Verifica finale (1h)
- Troubleshooting comune
- Checklist finale

**Usa quando**: Devi eseguire la riconciliazione

---

### 2. Executive Summary
**File**: `REPORT-GIUGNO-2024-SUMMARY.md`
**Scopo**: Report per CEO/CFO/Management
**Contiene**:
- Il problema in 3 numeri
- Cosa è successo (executive level)
- Top 10 transazioni mancanti
- Azioni immediate (entro 48h)
- Metriche di successo
- Timeline proposta (14h)

**Usa quando**: Devi presentare situazione a non-tecnici

---

### 3. Report Dettagliato
**File**: `REPORT-GIUGNO-2024.md`
**Scopo**: Analisi tecnica completa
**Contiene**:
- Executive summary con numeri
- Analisi dettagliata problemi:
  - Problema 1: Date non allineate
  - Problema 2: Movimenti successivi disallineati
  - Problema 3: Movimenti Odoo extra
- Lista completa 30 transazioni mancanti
- Esempi match possibili
- Statistiche transazioni
- Top 10 fornitori
- Categorie movimenti
- Conclusioni e next steps

**Usa quando**: Devi capire nel dettaglio cosa non va

---

### 4. Dati Strutturati
**File**: `REPORT-GIUGNO-2024.json`
**Scopo**: Dati machine-readable per script/analisi
**Struttura**:
```json
{
  "analysis_date": "2025-11-16T17:00:56",
  "period": {"from": "2024-06-01", "to": "2024-06-30"},
  "accounts_analyzed": 1,
  "results": [
    {
      "account": "UBS EUR",
      "code": "1025",
      "bank_transactions": 44,
      "odoo_moves": 57,
      "matched": 0,
      "unmatched_bank": 44,
      "unmatched_odoo": 57,
      "reconciliation_rate": 0.0,
      "bank_opening": -6344.93,
      "bank_closing": -50573.62,
      "unmatched_bank_details": [...],
      "unmatched_odoo_details": [...]
    }
  ],
  "summary": {...}
}
```

**Usa quando**: Devi processare dati con script Python/Excel

---

## SCRIPT & TOOL

### Scripts Python

#### 1. Verifica Automatica
**File**: `scripts/verifica-giugno-2024.py`
**Scopo**: Analizza discrepanze banca vs Odoo
**Uso**:
```bash
python scripts/verifica-giugno-2024.py
```
**Output**:
- Console: analisi riga per riga
- `REPORT-GIUGNO-2024.json`: dati completi
- `report-giugno-2024-output.txt`: log completo

**Features**:
- Connessione XML-RPC a Odoo
- Parsing transazioni da JSON
- Matching automatico per data/importo
- Report dettagliato discrepanze
- Supporto multi-account (estendibile a 1024, 1026)

---

#### 2. Import UBS EUR (da creare)
**File**: `scripts/import-ubs-eur-june.py`
**Scopo**: Importare transazioni mancanti in Odoo
**Uso**:
```bash
python scripts/import-ubs-eur-june.py \
    --file data-estratti/UBS-EUR-2024-TRANSACTIONS.json \
    --from 2024-06-01 \
    --to 2024-06-14 \
    --account 1025 \
    --dry-run
```

**TODO**: Da implementare

---

### Query SQL

#### 1. Verifica Completa Konto 1025
**File**: `scripts/verifica-konto-1025-giugno.sql`
**Scopo**: 11 query per analisi completa Odoo
**Queries incluse**:
1. Overview: Tutti movimenti giugno
2. Riepilogo: Totali dare/avere
3. Saldi: Apertura/chiusura
4. Duplicati: Cerca per data/importo
5. Fornitori: Top 20
6. Movimenti senza partner
7. FX transactions
8. Distribuzione per data
9. Movimenti >EUR 10K
10. Stato riconciliazione
11. Movimenti per journal

**Uso**:
```bash
psql -h odoo-host -U odoo -d odoo-db
\i scripts/verifica-konto-1025-giugno.sql
```

**Output**: Tabelle in console (copia in Excel per analisi)

---

## DATA SOURCES

### File Transazioni

#### 1. UBS EUR 2024 - Transactions Complete
**File**: `data-estratti/UBS-EUR-2024-TRANSACTIONS.json`
**Contenuto**: Tutte le 487 transazioni UBS EUR 2024
**Formato**:
```json
{
  "bank": "UBS",
  "account_number": "0278 00122087.60",
  "iban": "CH25 0027 8278 1220 8760 A",
  "currency": "EUR",
  "year": 2024,
  "transactions": [
    {
      "date": "2024-06-03",
      "value_date": "2024-06-03",
      "description": "...",
      "partner_name": "...",
      "amount": -15635.62,
      "debit": -15635.62,
      "credit": 0.0,
      "balance": -21980.55,
      "currency": "EUR",
      "line_number": 69
    },
    ...
  ]
}
```

**Periodo giugno**: Righe filtrate da questo file (44 transazioni)

---

#### 2. UBS EUR 2024 - Summary
**File**: `data-estratti/UBS-EUR-2024-CLEAN.json`
**Contenuto**: Saldi mensili 2024
**Formato**:
```json
{
  "monthly_balances_2024": {
    "2024-06": {
      "balance": -50573.62,
      "last_transaction_date": "2024-06-28"
    }
  }
}
```

**Uso**: Verifica saldo finale mese

---

#### 3. UBS CHF 2024 - Summary
**File**: `data-estratti/UBS-CHF-2024-CLEAN.json`
**Contenuto**: Quarterly balances konto 1024
**Note**: File transazioni dettagliate NON disponibile (solo summary)

---

#### 4. Credit Suisse 2024
**File**: `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`
**Contenuto**: Summary konto 1026
**Note**: PDF troppo grandi, usare MCP browser se serve dettaglio

---

### Database Odoo

**Connessione**:
```bash
Host: lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
DB: lapadevadmin-lapa-v2-main-7268478
User: apphubplatform@lapa.ch
Pass: apphubplatform2025
```

**Konto 1025**:
- Account code: `1025`
- Name: `EUR-UBS, 278-122087.60A`
- Type: Bank
- Currency: EUR

**Access via**:
- XML-RPC: Port 80/443
- PostgreSQL: (se abilitato direct access)

---

## METRICHE CHIAVE

### Situazione Attuale

| Metrica | Valore | Status |
|---------|--------|--------|
| **Tasso riconciliazione** | 0% | 🔴 CRITICO |
| **Movimenti bancari** | 44 | ✓ |
| **Movimenti Odoo** | 57 | ⚠️ (+13 extra) |
| **Match esatti** | 0 | 🔴 |
| **Saldo banca** | EUR -50,573.62 | ✓ |
| **Saldo Odoo** | Da verificare | ❓ |
| **Gap Dare** | EUR 234,205.35 | 🔴 |
| **Gap Avere** | EUR 162,079.02 | 🔴 |

### Target Post-Riconciliazione

| Metrica | Target | Come Verificare |
|---------|--------|-----------------|
| **Tasso riconciliazione** | ≥95% | Script verifica-giugno-2024.py |
| **Match esatti** | ≥42/44 | JSON report |
| **Differenza saldo** | <EUR 100 | Banca vs Odoo al 30/06 |
| **Movimenti non matchati** | ≤2 | Count unmatched |
| **Duplicati Odoo** | 0 | SQL query #4 |

---

## WORKFLOW CONSIGLIATO

### Prima Volta (Analisi)
1. Leggi `REPORT-GIUGNO-2024-SUMMARY.md` (5 min)
2. Leggi `REPORT-GIUGNO-2024.md` sezione "Cosa è successo" (10 min)
3. Esamina `REPORT-GIUGNO-2024.json` in JSON viewer (5 min)
4. Esegui `scripts/verifica-giugno-2024.py` per verificare (2 min)

**Tempo totale**: 22 minuti per capire la situazione

### Esecuzione (Riconciliazione)
1. Segui `GIUGNO-2024-QUICK-START.md` step by step
2. Esegui query SQL da `verifica-konto-1025-giugno.sql`
3. Importa movimenti mancanti
4. Cleanup duplicati
5. Riconcilia manualmente top 10
6. Verifica finale

**Tempo totale**: 14 ore distribuite su 2 giorni

### Follow-up (Verifica)
1. Re-run `scripts/verifica-giugno-2024.py`
2. Verifica tasso ≥95%
3. Genera report finale Excel
4. Approval commercialista
5. Archivia documentazione

**Tempo totale**: 2 ore

---

## CHANGELOG

| Data | Versione | Modifiche |
|------|----------|-----------|
| 2025-11-16 | 1.0 | Analisi iniziale giugno 2024 |
|  |  | - Creato report MD completo |
|  |  | - Generato JSON dati |
|  |  | - Script Python verifica |
|  |  | - Query SQL analisi |
|  |  | - Quick start guide |

---

## SUPPORT & CONTATTI

### Domande Tecniche
- **Script Python**: Backend Specialist
- **Query SQL**: Database Optimizer
- **Odoo Integration**: API Architect

### Domande Business
- **Contabilità**: Commercialista
- **Strategia**: CFO
- **Escalation**: CEO

### File Issues
```bash
# Se trovi bug negli script
git issue create \
  --title "Bug verifica-giugno-2024.py: ..." \
  --label bug,accounting

# Se serve feature
git issue create \
  --title "Feature: import automatico giugno" \
  --label enhancement,accounting
```

---

## PROSSIMI PASSI

### Short-term (Questa settimana)
- [ ] Riconciliare giugno 2024
- [ ] Raggiungere 95% match rate
- [ ] Documentare differenze residue

### Medium-term (Questo mese)
- [ ] Ripetere per luglio 2024
- [ ] Ripetere per agosto 2024
- [ ] Identificare pattern ricorrenti

### Long-term (Prossimo trimestre)
- [ ] Automatizzare import mensile UBS EUR
- [ ] Dashboard riconciliazione real-time
- [ ] Alert automatici se <95%
- [ ] Integration test su staging

---

**Ultima modifica**: 2025-11-16 17:03:00
**Versione documento**: 1.0
**Mantainer**: Backend Specialist
