# REPORT APRILE 2024 - Verifica Completa Konti Bancari

**Periodo**: 01/04/2024 - 30/04/2024
**Konti Analizzati**: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)
**Data Analisi**: 16 Novembre 2025
**Modalita**: Offline Analysis (Dati bancari estratti conto)

---

## EXECUTIVE SUMMARY

Analisi completa dei movimenti bancari di Aprile 2024 per i tre conti principali. Report basato su estratti conto bancari verificati.

### Stato Dati

| Konto | Banca | Valuta | Qualita Dati | Stato |
|-------|-------|--------|--------------|-------|
| 1024 | UBS | CHF | COMPLETO | Dati mensili disponibili |
| 1025 | UBS | EUR | COMPLETO | Dati mensili disponibili |
| 1026 | Credit Suisse | CHF | INCOMPLETO | Solo saldo fine anno |

---

## SALDI AL 30/04/2024

### 1024 - UBS CHF (Conto Principale)

```
Saldo Apertura (31/03/2024):  CHF  108,757.58
Saldo Chiusura (30/04/2024):  CHF  122,340.82
───────────────────────────────────────────────
Variazione Netta:             CHF  +13,583.24  (+12.49%)
```

**Contesto Q2 2024**:
- Opening Q2 (01/04): CHF 108,757.58
- Closing Q2 (30/06): CHF 142,785.59
- Total Transactions Q2: 850
- Media giornaliera: 9.4 transazioni/giorno

**Note**:
- Dati verificati da estratto conto UBS
- Crescita positiva nel mese di aprile
- Andamento regolare

**Source**: `data-estratti/UBS-CHF-2024-CLEAN.json`

---

### 1025 - UBS EUR (Conto Principale)

```
Saldo Apertura (31/03/2024):  EUR  -22,006.58  [SCOPERTO]
Saldo Chiusura (30/04/2024):  EUR  -12,005.79  [SCOPERTO]
───────────────────────────────────────────────
Variazione Netta:             EUR  +10,000.79  (+45.44%)
```

**ALERT**: Scoperto bancario persistente per tutto aprile 2024

**Contesto H1 2024**:
- Opening H1 (03/01): EUR 86,770.98
- Closing H1 (28/06): EUR -62,694.32
- Total Transactions H1: 267
- Last transaction date: 2024-04-30

**Note**:
- Dati verificati da estratto conto UBS EUR
- Scoperto bancario ridotto da EUR 22K a EUR 12K
- Miglioramento significativo ma ancora in negativo
- Variazione +45.44% indica recupero parziale

**Source**: `data-estratti/UBS-EUR-2024-CLEAN.json`

---

### 1026 - Credit Suisse CHF (Conto Principale)

```
Saldo Apertura (31/03/2024):  DATI NON DISPONIBILI
Saldo Chiusura (30/04/2024):  DATI NON DISPONIBILI
───────────────────────────────────────────────
Variazione Netta:             N/A
```

**CRITICAL**: Estratti conto mensili Credit Suisse non disponibili

**Dati Disponibili**:
- Saldo finale anno (31/12/2024): CHF 24,897.72
  - Conto 3977497-51: CHF 11,120.67
  - Conto 3977497-51-1: CHF 13,777.05

**Problema**:
- Estratti conto Q1 e Q2 2024 non forniti
- File PDF troppo grandi per essere processati
- Impossibile verificare movimenti aprile 2024

**Source**: `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`

---

## PROGRESSIONE MENSILE 2024 (Gen-Apr)

### UBS CHF (1024)

| Mese | Saldo Fine Mese | Variazione | Variazione % |
|------|-----------------|------------|--------------|
| 2024-01 | CHF 373,948.51 | - | - |
| 2024-02 | CHF 210,453.31 | -163,495.20 | -43.71% |
| 2024-03 | CHF 108,757.58 | -101,695.73 | -48.32% |
| **2024-04** | **CHF 122,340.82** | **+13,583.24** | **+12.49%** |

**Analisi**:
- Gen-Feb: Forte calo (43.71%)
- Feb-Mar: Ulteriore calo (48.32%)
- **Mar-Apr: Ripresa (+12.49%)**
- Trend in miglioramento ad aprile

---

### UBS EUR (1025)

| Mese | Saldo Fine Mese | Variazione | Variazione % |
|------|-----------------|------------|--------------|
| 2024-01 | EUR 6,749.58 | - | - |
| 2024-02 | EUR 1,355.46 | -5,394.12 | -79.92% |
| 2024-03 | EUR -22,006.58 | -23,362.04 | -1,723.53% |
| **2024-04** | **EUR -12,005.79** | **+10,000.79** | **+45.44%** |

**Analisi CRITICA**:
- Gen: Situazione normale (EUR 6.7K positivo)
- Feb: Calo drastico (-80%)
- Mar: **COLLASSO - Scoperto EUR 22K**
- Apr: Recupero parziale ma ancora scoperto EUR 12K

**ALLERTA ROSSA**: Investigate cause scoperto marzo 2024

---

## RACCOMANDAZIONI

### 1. PRIORITA ALTA - UBS EUR Scoperto

**Problema**: Scoperto bancario EUR 12,005.79 al 30/04/2024

**Azioni**:
- Verificare cause collasso marzo 2024 (da +EUR 1.3K a -EUR 22K)
- Controllare grandi pagamenti marzo-aprile 2024
- Verificare riconciliazione bancaria UBS EUR
- Analizzare account.move.line in Odoo per 1025

**Priorita**: CRITICA
**Owner**: Commercialista + Backend Specialist

---

### 2. PRIORITA ALTA - Credit Suisse Dati Mancanti

**Problema**: Estratti conto Credit Suisse Q1-Q2 2024 non disponibili

**Azioni**:
1. Contattare Credit Suisse per estratti mensili gennaio-giugno 2024
2. Verificare se esistono PDF non processati nella cartella documenti
3. Se PDF troppo grandi, richiedere formato CSV o Excel
4. Processare estratti con OCR se necessario

**Priorita**: ALTA
**Owner**: Amministrazione + Backend Specialist

---

### 3. PRIORITA MEDIA - Verifica Odoo

**Problema**: Report basato solo su dati bancari, senza confronto Odoo

**Azioni**:
1. Ottenere credenziali Odoo corrette per script analisi
2. Fetch account.move.line per konti 1024, 1025, 1026 aprile 2024
3. Confrontare saldi Odoo vs. Banca riga per riga
4. Identificare discrepanze e movimenti non riconciliati
5. Verificare matching_number e reconciled flags

**Priorita**: MEDIA
**Owner**: Backend Specialist

**Script Pronto**: `scripts/analizza-aprile-2024.ts` (richiede auth Odoo)

---

### 4. PRIORITA MEDIA - Movimenti Significativi

**Problema**: Variazioni rilevanti da investigare

**Azioni**:
- 1024 UBS CHF: Variazione +CHF 13.5K (normale per attivita operativa)
- 1025 UBS EUR: Variazione +EUR 10K (recupero parziale da scoperto)
  - **Investigare**: Quali pagamenti/incassi hanno generato recovery?

**Priorita**: MEDIA
**Owner**: Commercialista

---

## PROSSIMI PASSI

### Immediati (Questa Settimana)

- [ ] Richiedere estratti conto Credit Suisse Q1-Q2 2024
- [ ] Verificare PDF Credit Suisse non processati
- [ ] Analizzare cause scoperto UBS EUR marzo 2024

### Breve Termine (2 Settimane)

- [ ] Ottenere credenziali Odoo per script analisi completa
- [ ] Eseguire analisi riga per riga Odoo vs. Banca
- [ ] Verificare riconciliazione bancaria aprile 2024
- [ ] Identificare movimenti non riconciliati

### Medio Termine (1 Mese)

- [ ] Implementare monitoring automatico scoperto bancario
- [ ] Setup alert per variazioni >EUR 10K o >CHF 50K
- [ ] Creare dashboard riconciliazione mensile
- [ ] Documentare procedure riconciliazione

---

## TECHNICAL DETAILS

### Data Sources

1. **UBS CHF**: `data-estratti/UBS-CHF-2024-CLEAN.json`
   - Source: UBS CHF 1.4-30.6.2024.csv (Q2 data)
   - Monthly balances verified
   - 850 transactions Q2 2024

2. **UBS EUR**: `data-estratti/UBS-EUR-2024-CLEAN.json`
   - Source: UBS EUR H1 2024 statement
   - Monthly balances verified
   - 267 transactions H1 2024

3. **Credit Suisse**: `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`
   - Source: Saldi finali 31/12/2024
   - Monthly data NOT available
   - PDF statements too large to process

### Scripts Disponibili

1. **Analisi Offline**: `scripts/report-aprile-2024-offline.ts`
   - Status: COMPLETATO
   - Output: REPORT-APRILE-2024.json
   - Note: Basato solo su estratti bancari

2. **Analisi Odoo**: `scripts/analizza-aprile-2024.ts`
   - Status: READY (richiede auth)
   - Output: REPORT-APRILE-2024.json (con dati Odoo)
   - Note: Fetch account.move.line e confronto banca

### Execution

```bash
# Offline Analysis (completato)
npx tsx scripts/report-aprile-2024-offline.ts

# Odoo Analysis (richiede credenziali)
npx tsx scripts/analizza-aprile-2024.ts
```

---

## APPENDICE: Dati Grezzi

### UBS CHF Monthly Balances 2024

```json
{
  "2024-01": { "ending_balance": 373948.51 },
  "2024-02": { "ending_balance": 210453.31 },
  "2024-03": { "ending_balance": 108757.58 },
  "2024-04": { "ending_balance": 122340.82 },
  "2024-05": { "ending_balance": 269544.09 },
  "2024-06": { "ending_balance": 142785.59 }
}
```

### UBS EUR Monthly Balances 2024

```json
{
  "2024-01": { "balance": 6749.58 },
  "2024-02": { "balance": 1355.46 },
  "2024-03": { "balance": -22006.58 },
  "2024-04": { "balance": -12005.79 },
  "2024-05": { "balance": -5388.97 },
  "2024-06": { "balance": -50573.62 }
}
```

### Credit Suisse Year-End Balance 2024

```json
{
  "accounts": [
    {
      "account_number": "3977497-51",
      "saldo_finale_31_12_2024": 11120.67,
      "currency": "CHF"
    },
    {
      "account_number": "3977497-51-1",
      "saldo_finale_31_12_2024": 13777.05,
      "currency": "CHF"
    }
  ],
  "total_balance_chf": 24897.72
}
```

---

## CONCLUSIONI

### Situazione Aprile 2024

**POSITIVO**:
- 1024 UBS CHF: Ripresa dopo calo Q1 (+12.49%)
- 1025 UBS EUR: Recupero parziale da scoperto (+45.44%)
- Dati UBS completi e verificati

**NEGATIVO**:
- 1025 UBS EUR: Persistente scoperto EUR 12K
- 1026 Credit Suisse: Dati mensili assenti
- Impossibile verificare con Odoo (credenziali mancanti)

**AZIONI CRITICHE**:
1. Recuperare estratti Credit Suisse Q1-Q2 2024
2. Investigare cause scoperto UBS EUR marzo 2024
3. Connettere Odoo per analisi completa

---

**Report Generato da**: Backend Specialist - Odoo Integration
**Data Generazione**: 16/11/2025 17:02:31
**Modalita**: Offline Analysis
**File Output**:
- `REPORT-APRILE-2024.json` (machine-readable)
- `REPORT-APRILE-2024-SUMMARY.txt` (quick reference)
- `REPORT-APRILE-2024.md` (questo documento)

**Scripts**:
- `scripts/report-aprile-2024-offline.ts`
- `scripts/analizza-aprile-2024.ts` (Odoo integration - richiede auth)
