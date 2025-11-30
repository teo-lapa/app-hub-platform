# INDEX - VERIFICA LUGLIO 2024

Documentazione completa per verifica contabile luglio 2024

---

## START HERE

**Obiettivo:** Verifica completa riga per riga dei movimenti bancari luglio 2024 per konti 1024, 1025, 1026.

**Status:** PRONTO PER ESECUZIONE

**Tempo stimato:** 2-4 ore (dipende da numero movimenti)

---

## DOCUMENTI PRINCIPALI

### 1. README Esecutivo
**File:** `VERIFICA-LUGLIO-2024-README.md`

**Contenuto:**
- Executive summary con saldi attesi
- Procedura step-by-step completa
- Checklist di verifica per ogni account
- Controlli qualita
- Anomalie priorita alta
- Output atteso

**Chi lo usa:** Project manager, revisore contabile

---

### 2. Query Odoo Quick Reference
**File:** `LUGLIO-2024-QUERY-ODOO.md`

**Contenuto:**
- 5 query pronte per Odoo Web UI
- Codice Python XML-RPC alternativo
- Istruzioni export Excel
- Formule verifica
- Troubleshooting

**Chi lo usa:** Operatore Odoo, contabile

---

### 3. Report Strutturato JSON
**File:** `REPORT-LUGLIO-2024.json`

**Contenuto:**
- Metadata completo
- Expected balances con fonte
- Verification checklist dettagliata
- Odoo queries in formato strutturato
- Analysis steps (7 passi)
- Expected results
- Anomalies to check
- Next steps

**Chi lo usa:** Developer, automation, analisi dati

---

## DATI SORGENTE

### Estratti Bancari

1. **UBS CHF 2024**
   - File: `data-estratti/UBS-CHF-2024-CLEAN.json`
   - Account: 0278 00122087.01
   - IBAN: CH02 0027 8278 1220 8701 J
   - Saldo luglio: CHF 345,760.44

2. **UBS EUR 2024**
   - File: `data-estratti/UBS-EUR-2024-CLEAN.json`
   - Account: 0278 00122087.60
   - IBAN: CH25 0027 8278 1220 8760 A
   - Saldo luglio: EUR 14,702.54

3. **Credit Suisse 2024**
   - File: `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`
   - Accounts: 3977497-51, 3977497-51-1
   - Saldo anno: CHF 24,897.72
   - **NOTA:** Dettaglio mensile non disponibile

---

## SCRIPT E TOOLS

### Script Python

1. **Verifica Completa (tentativo connessione diretta)**
   - File: `scripts/verifica-luglio-2024-completa.py`
   - Status: Richiede VPN o accesso rete Odoo
   - Usa: Solo se hai accesso diretto XML-RPC

2. **Report Generator (funzionante)**
   - File: `scripts/report-luglio-2024-manual.py`
   - Status: FUNZIONANTE
   - Output: `REPORT-LUGLIO-2024.json`
   - Uso: `python scripts/report-luglio-2024-manual.py`

### API Endpoint

- **Odoo Accounting API**
  - File: `app/api/odoo/accounting/route.ts`
  - Endpoint: `/api/odoo/accounting`
  - Methods: POST (query), GET (test)
  - Status: Creato ma non testato

---

## WORKFLOW CONSIGLIATO

### Fase 1: Preparazione (15 min)

1. Leggi `VERIFICA-LUGLIO-2024-README.md` completo
2. Apri `LUGLIO-2024-QUERY-ODOO.md` per reference
3. Apri `REPORT-LUGLIO-2024.json` in editor JSON
4. Prepara foglio Excel vuoto per risultati

### Fase 2: Connessione Odoo (5 min)

1. Login: https://erp.alpenpur.ch
2. Database: alpenpur
3. User: apphubplatform@lapa.ch
4. Menu: Contabilita > Primanota

### Fase 3: Query Saldi (30 min)

1. Esegui Query 1: Saldi apertura
2. Verifica match con expected_balances
3. Esegui Query 3: Saldi chiusura
4. Verifica match con expected_balances
5. Documenta eventuali differenze

### Fase 4: Estrazione Movimenti (30 min)

1. Esegui Query 2: Movimenti luglio
2. Esporta in Excel (3 files, uno per account)
3. Calcola totali DARE e AVERE
4. Verifica variazioni

### Fase 5: Controlli Qualita (60 min)

1. Esegui Query 4: Duplicati
2. Esegui Query 5: Movimenti grandi
3. Controlla partner mancanti
4. Controlla descrizioni vuote
5. Verifica importi zero

### Fase 6: Riconciliazione (60 min)

1. Per ogni movimento, trova corrispondenza in estratto
2. Marca riconciliato in Odoo
3. Lista movimenti non riconciliati
4. Investiga differenze

### Fase 7: Report Finale (30 min)

1. Compila Excel riepilogativo
2. Calcola % riconciliazione
3. Lista anomalie e azioni
4. Review e firma

**Totale:** 3.5 - 4 ore

---

## SALDI ATTESI - QUICK REFERENCE

### 1024 - UBS CHF
```
Apertura: CHF 142,785.59
Chiusura: CHF 345,760.44
Variazione: +CHF 202,974.85
```

### 1025 - UBS EUR
```
Apertura: EUR -50,573.62 (NEGATIVO!)
Chiusura: EUR 14,702.54
Variazione: +EUR 65,276.16
```

### 1026 - Credit Suisse CHF
```
Apertura: N/A
Chiusura: N/A (verificare in Odoo)
Anno 2024: CHF 24,897.72
```

---

## ANOMALIE CRITICHE

### 1. Saldo Negativo UBS EUR

**Account:** 1025
**Data:** 30/06/2024
**Importo:** EUR -50,573.62

**Azioni:**
- Verifica se scoperto autorizzato
- Controlla limite fido
- Verifica interessi passivi
- Identifica quando tornato positivo

### 2. Movimento Grande EUR +65K

**Account:** 1025
**Periodo:** Luglio 2024
**Importo:** EUR +65,276.16

**Azioni:**
- Identifica transazione specifica
- Verifica fonte denaro
- Controlla se legato a vendite
- Documenta causale

### 3. Movimento Grande CHF +202K

**Account:** 1024
**Periodo:** Luglio 2024
**Importo:** CHF +202,974.85

**Azioni:**
- Analizza flussi principali
- Verifica se normale o straordinario
- Confronta con mesi precedenti
- Documenta pattern

---

## DELIVERABLE FINALI

Al termine, dovresti avere:

### Files Excel
- `luglio-2024-konto-1024-movimenti.xlsx`
- `luglio-2024-konto-1025-movimenti.xlsx`
- `luglio-2024-konto-1026-movimenti.xlsx`
- `luglio-2024-duplicati.xlsx`
- `luglio-2024-movimenti-grandi.xlsx`
- `luglio-2024-report-riepilogativo.xlsx` (master)

### Report Verifica
- Executive summary
- Saldi riconciliati (si/no)
- % riconciliazione per account
- Lista anomalie trovate
- Azioni correttive necessarie
- Firma e data

### Checklist Completate
- [ ] Konto 1024: tutti i check OK
- [ ] Konto 1025: tutti i check OK
- [ ] Konto 1026: tutti i check OK

---

## SUPPORTO E RISORSE

### Documentazione
- Odoo accounting: https://www.odoo.com/documentation/17.0/applications/finance/accounting.html
- Report JSON: vedi `REPORT-LUGLIO-2024.json`

### Script
- Python: `scripts/verifica-luglio-2024-completa.py`
- Report gen: `scripts/report-luglio-2024-manual.py`

### Query
- Odoo UI: vedi `LUGLIO-2024-QUERY-ODOO.md`
- XML-RPC: vedi esempi in scripts

### Contatti
- Backend Specialist: Odoo Integration Master
- Data verifica: 2025-11-16

---

## VERSION HISTORY

- **v1.0** (2025-11-16): Prima release
  - Report JSON generato
  - README completo
  - Query reference
  - Index creato

---

## QUICK START (TL;DR)

1. Apri `VERIFICA-LUGLIO-2024-README.md`
2. Login Odoo: https://erp.alpenpur.ch
3. Esegui 5 query da `LUGLIO-2024-QUERY-ODOO.md`
4. Confronta con saldi in `REPORT-LUGLIO-2024.json`
5. Segui checklist per ogni account
6. Genera report finale

**Tempo:** 3-4 ore
**Obiettivo:** Riconciliazione 100% luglio 2024
**Output:** Excel + Report verifica firmato

---

**Fine documentazione**
**Backend Specialist - Odoo Integration Master**
**Data: 2025-11-16**
