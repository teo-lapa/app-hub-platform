# INDICE VERIFICA AGOSTO 2024

## File Generati

### Report Esecutivi

| File | Descrizione | Formato |
|------|-------------|---------|
| `REPORT-AGOSTO-2024-EXECUTIVE.md` | Report esecutivo completo con analisi | Markdown |
| `REPORT-AGOSTO-2024.json` | Report machine-readable completo | JSON |
| `AGOSTO-2024-DIFFERENZE-DETTAGLIATE.json` | Dettaglio transazioni mancanti in Odoo | JSON |

### File Import/Export

| File | Descrizione | Formato |
|------|-------------|---------|
| `AGOSTO-2024-UBS-EUR-IMPORT.csv` | 35 transazioni pronte per import | CSV |
| `AGOSTO-2024-UBS-EUR-ODOO-PAYLOAD.json` | Payload API Odoo per import automatico | JSON |

### Script

| File | Descrizione | Linguaggio |
|------|-------------|------------|
| `scripts/verifica-agosto-2024.py` | Script principale verifica riconciliazione | Python |
| `scripts/export-agosto-2024-csv.py` | Export transazioni in CSV | Python |
| `scripts/check-agosto-2024-odoo.sql` | Query SQL verifica dati Odoo | SQL |

---

## Quick Start

### 1. Leggere Report Esecutivo

```bash
cat REPORT-AGOSTO-2024-EXECUTIVE.md
```

**Summary rapido**:
- Konto 1025 (UBS EUR): **35 transazioni mancanti in Odoo**
- Valore totale: **39,392.56 EUR**
- Date: 02/08 - 30/08/2024

### 2. Verificare Stato Odoo

Eseguire query SQL su database Odoo:

```bash
psql -h <odoo-host> -U <odoo-user> -d hubdrate -f scripts/check-agosto-2024-odoo.sql
```

**Risultato atteso** se NON importato:
- Query 2: `total_moves = 0` (attualmente)
- Query 2: `total_moves = 35` (dopo import)

### 3. Importare Transazioni in Odoo

#### Opzione A: Import CSV Manuale

1. Aprire Odoo > Contabilita > Estratti Conto
2. Selezionare conto **1025 (UBS EUR - 0278 00122087.60)**
3. Import > Carica file `AGOSTO-2024-UBS-EUR-IMPORT.csv`
4. Mappare colonne:
   - Data → `date`
   - Importo → `amount`
   - Descrizione → `description`
   - Partner → `partner_name`

#### Opzione B: Import Automatico Python

```bash
# Configurare credenziali in .env.local
ODOO_URL=https://erp.hubdrate.com
ODOO_DB=hubdrate
ODOO_USERNAME=your_username
ODOO_PASSWORD=your_password

# Eseguire import
python scripts/import-agosto-2024-odoo.py
```

### 4. Validazione Post-Import

Ri-eseguire script verifica:

```bash
python scripts/verifica-agosto-2024.py
```

**Output atteso**:
```
Konto 1025:
  Transazioni banca: 35
  Movimenti Odoo:    35  ✓
  Differenza:        0.00 ✓
  Status: [OK] PERFETTO
```

---

## Struttura Transazioni

### Totale per Tipologia

| Tipologia | N. | Dare (EUR) | Avere (EUR) | Netto (EUR) |
|-----------|-----|------------|-------------|-------------|
| FX Forward (CHF→EUR) | 2 | 0.00 | 260,000.00 | +260,000.00 |
| Pagamenti Fornitori | 32 | 220,607.44 | 0.00 | -220,607.44 |
| Commissioni Bancarie | 3 | (incluse sopra) | 0.00 | -34,300.46 |
| Altri | 1 | 0.00 | 0.00 | 0.00 |
| **TOTALE** | **35** | **220,607.44** | **260,000.00** | **+39,392.56** |

### Saldi

- **Saldo 31/07/2024**: 14,702.54 EUR
- **Movimenti netti agosto**: +39,392.56 EUR
- **Saldo 31/08/2024**: **41,130.47 EUR**

---

## Transazioni Critiche da Verificare

### 1. FX Forward EUR 180K (06/08/2024)

- **Importo**: +180,000.00 EUR
- **Descrizione**: "Ihr Kauf EUR | Ihr Verkauf CHF | FX CJ-M5VH7"
- **Azione**: Verificare contropartita CHF su konto 1024
- **Status**: Da riconciliare con vendita CHF

### 2. FX Forward EUR 80K (28/08/2024)

- **Importo**: +80,000.00 EUR
- **Descrizione**: "Ihr Kauf EUR | Ihr Verkauf CHF | FX CJ-WYRQF"
- **Azione**: Verificare contropartita CHF su konto 1024
- **Status**: Da riconciliare con vendita CHF

### 3. Batch Payment Fornitori (15/08/2024)

- **N. transazioni**: 10
- **Totale**: -100,021.98 EUR
- **Azione**: Riconciliare con fatture fornitori giugno 2024
- **Fornitori principali**:
  - Latticini Molisani Tamburro: 36,022.88 EUR
  - Ferraiuolo Foods: 32,163.39 EUR
  - Ristoris: 14,643.00 EUR

### 4. Commissioni E-Banking (agosto 2024)

- **15/08**: 7,955.55 EUR (10 transazioni SEPA)
- **21/08**: 17,845.85 EUR (2 transazioni SEPA)
- **23/08**: 8,499.06 EUR (2 transazioni SEPA)
- **Totale**: 34,300.46 EUR
- **Azione**: Verificare se importo corretto o errore bancario

---

## Data Sources

### File Sorgenti

| File | Righe Totali | Righe Agosto | Formato |
|------|--------------|--------------|---------|
| `data-estratti/UBS-EUR-2024-TRANSACTIONS.json` | 487 | 35 | JSON |
| `data-estratti/UBS-CHF-2024-CLEAN.json` | N/A | N/A | Metadata only |
| `data-estratti/CREDIT-SUISSE-2024-CLEAN.json` | N/A | N/A | Metadata only |

### Limitazioni

- UBS CHF Q3 2024 CSV: **NON DISPONIBILE** (necessario per verifica completa)
- Credit Suisse agosto 2024: **NON DISPONIBILE** (PDF troppo grandi)
- Connessione Odoo: **FALLITA** durante analisi (credenziali da verificare)

---

## Prossimi Passi

### Priorita CRITICA

1. [ ] Importare 35 transazioni UBS EUR agosto 2024 in Odoo
2. [ ] Verificare match FX Forward con konto 1024 (CHF)
3. [ ] Riconciliare batch payments con fatture fornitori

### Priorita ALTA

4. [ ] Recuperare CSV UBS CHF Q3 2024
5. [ ] Verificare commissioni bancarie (34K EUR sembrano eccessive)
6. [ ] Recuperare estratti Credit Suisse agosto 2024

### Priorita MEDIA

7. [ ] Automatizzare import mensile estratti conto
8. [ ] Setup alert riconciliazione automatica
9. [ ] Dashboard riconciliazione real-time

---

## Contatti

**Script creato da**: Backend Specialist Agent
**Data**: 2025-11-16
**Versione**: 1.0

Per domande o problemi:
- Verificare log esecuzione script
- Consultare `REPORT-AGOSTO-2024-EXECUTIVE.md`
- Eseguire query SQL per debug: `check-agosto-2024-odoo.sql`
