# Verifica Luglio 2024 - Documentazione Completa

Verifica contabile completa riga per riga dei movimenti bancari luglio 2024.

---

## Quick Start (5 secondi)

```bash
1. Apri: INDEX-VERIFICA-LUGLIO-2024.md
2. Leggi: SUMMARY-LUGLIO-2024.md
3. Segui: VERIFICA-LUGLIO-2024-README.md
4. Query: LUGLIO-2024-QUERY-ODOO.md
5. Dati: REPORT-LUGLIO-2024.json
```

---

## Struttura Documentazione

```
VERIFICA LUGLIO 2024/
│
├── README-VERIFICA-LUGLIO-2024.md          ← SEI QUI
│   └── Overview completo del progetto
│
├── INDEX-VERIFICA-LUGLIO-2024.md           ← START HERE
│   ├── Workflow consigliato
│   ├── Collegamenti a tutti i docs
│   └── Deliverable attesi
│
├── SUMMARY-LUGLIO-2024.md                  ← ONE PAGE SUMMARY
│   ├── Tabelle saldi
│   ├── Alert priorita
│   └── Quick actions
│
├── VERIFICA-LUGLIO-2024-README.md          ← PROCEDURA COMPLETA
│   ├── Executive summary
│   ├── 7 step procedure
│   ├── Checklist per account
│   └── Anomalie identificate
│
├── LUGLIO-2024-QUERY-ODOO.md               ← QUERY REFERENCE
│   ├── 5 query pronte
│   ├── Codice Python alternativo
│   └── Export instructions
│
├── REPORT-LUGLIO-2024.json                 ← DATI STRUTTURATI
│   ├── Expected balances
│   ├── Verification checklist
│   ├── Odoo queries
│   └── Analysis steps
│
└── scripts/
    ├── verifica-luglio-2024-completa.py   ← Auto script (richiede VPN)
    └── report-luglio-2024-manual.py       ← Report generator
```

---

## Scopo del Progetto

### Obiettivo
Verificare completezza e correttezza di tutti i movimenti contabili luglio 2024 per i conti bancari:
- **1024** - UBS CHF
- **1025** - UBS EUR
- **1026** - Credit Suisse CHF

### Deliverable
1. Saldi riconciliati al 100%
2. Excel con tutti i movimenti verificati
3. Lista anomalie e azioni correttive
4. Report firmato dal revisore

### Tempo Stimato
3-4 ore totali

---

## Flusso di Lavoro

### Fase 1: Comprensione (20 min)

**Documenti da leggere:**
1. `SUMMARY-LUGLIO-2024.md` - Quick overview
2. `INDEX-VERIFICA-LUGLIO-2024.md` - Mappa completa
3. `VERIFICA-LUGLIO-2024-README.md` - Procedura dettagliata

**Output:** Chiara comprensione di cosa fare

---

### Fase 2: Setup (10 min)

**Azioni:**
1. Login Odoo: https://erp.alpenpur.ch
2. Apri: Contabilita > Primanota
3. Prepara: Excel vuoto per risultati
4. Apri: `LUGLIO-2024-QUERY-ODOO.md` come reference

**Output:** Ambiente di lavoro pronto

---

### Fase 3: Verifica Saldi (40 min)

**Query da eseguire:**
- Query 1: Saldi apertura (01/07/2024)
- Query 3: Saldi chiusura (31/07/2024)

**Saldi attesi:**
- 1024: da CHF 142,785.59 a CHF 345,760.44
- 1025: da EUR -50,573.62 a EUR 14,702.54
- 1026: TBD (verificare in Odoo)

**Output:** Conferma match o lista differenze

---

### Fase 4: Estrazione Dati (30 min)

**Query da eseguire:**
- Query 2: Tutti movimenti luglio 2024

**Export:**
- File per ogni account (CSV/Excel)
- Colonne: ID, Data, Descrizione, Dare, Avere, Partner, etc.

**Output:** 3 files Excel con movimenti

---

### Fase 5: Controlli Qualita (60 min)

**Query da eseguire:**
- Query 4: Trova duplicati
- Query 5: Movimenti >50K

**Controlli manuali:**
- Partner mancanti
- Descrizioni vuote
- Importi zero
- Anomalie varie

**Output:** Lista issues da risolvere

---

### Fase 6: Riconciliazione (60 min)

**Per ogni movimento:**
1. Trova corrispondenza in estratto bancario
2. Verifica importo match
3. Verifica data match
4. Marca come riconciliato in Odoo

**Output:** Movimenti 100% riconciliati

---

### Fase 7: Report (30 min)

**Crea Excel riepilogativo con:**
- Tab 1: Saldi apertura/chiusura
- Tab 2: Movimenti per account
- Tab 3: Duplicati (se trovati)
- Tab 4: Movimenti grandi
- Tab 5: Summary e firma

**Output:** Report finale per revisore

---

## Saldi Attesi - Reference

### Account 1024 - UBS CHF

```
Fonte: data-estratti/UBS-CHF-2024-CLEAN.json
Campo: monthly_balances["2024-07"].ending_balance

30 Giugno 2024: CHF 142,785.59
31 Luglio 2024: CHF 345,760.44
Variazione:     CHF +202,974.85 (+142%)
```

### Account 1025 - UBS EUR

```
Fonte: data-estratti/UBS-EUR-2024-CLEAN.json
Campo: periods.H2_2024.monthly_balances["2024-07"].balance

30 Giugno 2024: EUR -50,573.62 (NEGATIVO!)
31 Luglio 2024: EUR 14,702.54
Variazione:     EUR +65,276.16 (+229%)
```

### Account 1026 - Credit Suisse CHF

```
Fonte: data-estratti/CREDIT-SUISSE-2024-CLEAN.json
Nota: Solo saldo finale anno disponibile

31 Dicembre 2024: CHF 24,897.72
Luglio 2024: N/A (da calcolare da movimenti Odoo)
```

---

## Anomalie Critiche da Investigare

### 1. UBS EUR Saldo Negativo

**Priority:** ALTA
**Account:** 1025
**Issue:** Saldo negativo EUR -50,573.62 al 30/06/2024

**Domande:**
- Esiste scoperto autorizzato?
- Qual e il limite del fido?
- Ci sono interessi passivi?
- Quando torna in positivo durante luglio?

**Azione:** Contattare UBS per conferma limite scoperto

---

### 2. Movimento Grande EUR +65K

**Priority:** ALTA
**Account:** 1025
**Issue:** Variazione +EUR 65,276.16 in un solo mese

**Domande:**
- E una singola transazione o multipla?
- Qual e la fonte di questo denaro?
- E legato a vendite, finanziamento, o altro?
- Data esatta del movimento principale?

**Azione:** Query 5 per identificare movimento specifico

---

### 3. Movimento Grande CHF +202K

**Priority:** ALTA
**Account:** 1024
**Issue:** Variazione +CHF 202,974.85 in un mese

**Domande:**
- Quali sono i flussi principali?
- E normale o straordinario?
- Corrispondenza con vendite?
- Pattern rispetto a mesi precedenti?

**Azione:** Analisi dettagliata flussi CHF luglio

---

## Tools e Script

### Script Python

**Script 1: Verifica Completa**
```bash
File: scripts/verifica-luglio-2024-completa.py
Uso: python scripts/verifica-luglio-2024-completa.py
Requisiti: Accesso XML-RPC Odoo (VPN o rete locale)
Status: Richiede connessione diretta Odoo
```

**Script 2: Report Generator**
```bash
File: scripts/report-luglio-2024-manual.py
Uso: python scripts/report-luglio-2024-manual.py
Output: REPORT-LUGLIO-2024.json
Status: FUNZIONANTE (usato per generare report)
```

### API Endpoint

```typescript
Endpoint: POST /api/odoo/accounting
File: app/api/odoo/accounting/route.ts
Uso: Query Odoo via HTTP API
Status: Creato ma non testato
```

---

## File Sorgente Dati

### Estratti Bancari JSON

1. **UBS CHF**
   - Path: `data-estratti/UBS-CHF-2024-CLEAN.json`
   - Contenuto: Saldi mensili 2024, quarterly data
   - Luglio: CHF 345,760.44

2. **UBS EUR**
   - Path: `data-estratti/UBS-EUR-2024-CLEAN.json`
   - Contenuto: Saldi mensili 2024, H1/H2 data
   - Luglio: EUR 14,702.54

3. **Credit Suisse**
   - Path: `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`
   - Contenuto: Saldo finale anno
   - Anno: CHF 24,897.72

---

## Output Finali Attesi

### Files Excel

```
luglio-2024-konto-1024-movimenti.xlsx  ← Movimenti UBS CHF
luglio-2024-konto-1025-movimenti.xlsx  ← Movimenti UBS EUR
luglio-2024-konto-1026-movimenti.xlsx  ← Movimenti Credit Suisse
luglio-2024-duplicati.xlsx             ← Duplicati trovati
luglio-2024-movimenti-grandi.xlsx      ← Movimenti >50K
luglio-2024-report-finale.xlsx         ← Master report
```

### Report di Verifica

**Contenuto:**
- Executive summary
- Tabella saldi (atteso vs calcolato)
- % riconciliazione per account
- Lista anomalie identificate
- Azioni correttive raccomandate
- Firma e data revisore

**Formato:** PDF o Excel

---

## Checklist Completamento

### Pre-requisiti
- [ ] Accesso Odoo funzionante
- [ ] Permessi accounting abilitati
- [ ] Excel/LibreOffice disponibile
- [ ] Estratti bancari accessibili
- [ ] Documentazione letta

### Verifica Dati
- [ ] Query 1 eseguita: saldi apertura
- [ ] Query 2 eseguita: movimenti luglio
- [ ] Query 3 eseguita: saldi chiusura
- [ ] Query 4 eseguita: duplicati
- [ ] Query 5 eseguita: movimenti grandi

### Controlli Qualita
- [ ] No partner mancanti
- [ ] No descrizioni vuote
- [ ] No importi zero anomali
- [ ] Duplicati risolti
- [ ] Movimenti grandi verificati

### Riconciliazione
- [ ] Konto 1024: 100% riconciliato
- [ ] Konto 1025: 100% riconciliato
- [ ] Konto 1026: 100% riconciliato

### Deliverable
- [ ] Excel exports completi
- [ ] Report riepilogativo generato
- [ ] Anomalie documentate
- [ ] Azioni correttive listate
- [ ] Review completata e firmata

---

## FAQ

### Q: Quanto tempo serve?
**A:** 3-4 ore totali, dipende da numero movimenti.

### Q: Serve accesso Odoo production?
**A:** Si, serve login https://erp.alpenpur.ch

### Q: Posso automatizzare tutto?
**A:** Parzialmente. Script Python funziona se hai accesso XML-RPC diretto.

### Q: Cosa faccio se saldi non corrispondono?
**A:** 1) Verifica filtri query 2) Controlla periodo esatto 3) Verifica stato "posted" 4) Investiga differenze specifiche

### Q: Come gestisco duplicati?
**A:** 1) Verifica se reali duplicati 2) Se si, marca uno per eliminazione 3) Se no, documenta perche legittimi

### Q: Credit Suisse non ha dati mensili?
**A:** Corretto. Usa movimenti Odoo per calcolare saldo luglio.

---

## Supporto

### Documentazione Odoo
https://www.odoo.com/documentation/17.0/applications/finance/accounting.html

### Contatti
- Backend Specialist: Odoo Integration Master
- Data creazione: 2025-11-16
- Versione: 1.0

### Issue Tracking
Per problemi o domande, documenta:
1. Query eseguita
2. Risultato atteso
3. Risultato ottenuto
4. Screenshot se possibile

---

## Version History

### v1.0 (2025-11-16)
- Prima release completa
- 5 documenti creati
- 2 script Python preparati
- 1 API endpoint creato
- Report JSON generato

---

## Prossimi Step

1. **ORA:** Leggi questa documentazione completa
2. **OGGI:** Esegui le 5 query in Odoo
3. **DOMANI:** Analisi movimenti e checklist
4. **DOPODOMANI:** Report finale e review

---

## Conclusione

Questa documentazione fornisce tutto il necessario per completare una verifica contabile professionale e completa di luglio 2024.

**Tempo stimato:** 3-4 ore
**Obiettivo:** Riconciliazione 100%
**Output:** Report verificato e firmato

**Buon lavoro!**

---

**Backend Specialist - Odoo Integration Master**
**Data:** 2025-11-16
**Status:** READY FOR EXECUTION
