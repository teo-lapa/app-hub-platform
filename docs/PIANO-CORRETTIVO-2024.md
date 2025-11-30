# PIANO CORRETTIVO 2024 - START HERE

**Data Creazione**: 16 Novembre 2025
**Responsabile**: Process Automator - Master Consolidation Agent
**Status**: COMPLETATO - Pronto per Esecuzione
**Commercialista**: Patrick Angstmann (p.angstmann@pagg.ch)

---

## QUICK START - READ THIS FIRST

Questo è il **MASTER INDEX** del Piano Correttivo Completo per la Chiusura Contabile 2024.

### STATUS CONSOLIDAMENTO

Tutti gli agenti hanno completato le loro analisi. Il piano è pronto per esecuzione.

**DELIVERABLES GENERATI**:

1. MASTER-RICONCILIAZIONE-2024.md (Master Report - 200+ pagine)
2. MASTER-RICONCILIAZIONE-2024-[timestamp].xlsx (Dashboard Excel interattivo)
3. EMAIL-COMMERCIALISTA-RICONCILIAZIONE-2024.md (Email template pronta)
4. PIANO-CORRETTIVO-2024.md (questo file - indice navigazione)

---

## SITUAZIONE IN SINTESI

### DISCREPANZE TOTALI: CHF 1,109,916

| Categoria | Delta CHF | Severity | Status |
|-----------|-----------|----------|--------|
| Conti Tecnici (1022/1023/10901/1099) | 669,580 | CRITICAL | Da azzerare |
| Cash Rettifiche (1001) | 174,290 | CRITICAL | Attesa approval |
| Bank Reconciliation (8 accounts) | 345,458 | CRITICAL | Piano pronto |
| Cash Duplicati | 784 | HIGH | Da eliminare |
| Balance Sheet Error | 3,171,731 | CRITICAL | Da investigare |

### BLOCKERS CRITICI

1. Approvazione commercialista rettifiche Cash (CHF 174,290)
2. Spiegazione "merenda69" CHF 182,651 (blocca konto 1022)

### TIMELINE

**Start**: 16 Novembre 2025
**Target Completion**: 6 Dicembre 2025
**Duration**: 17 giorni lavorativi
**Total Effort**: 132 ore

---

## NAVIGAZIONE - DOVE TROVARE COSA

### PER IL COMMERCIALISTA

**START HERE**:
1. EMAIL-COMMERCIALISTA-RICONCILIAZIONE-2024.md (email pronta da inviare)
2. MASTER-RICONCILIAZIONE-2024.xlsx (Dashboard Excel - Tab "Executive Summary")
3. REPORT_FINALE_CONTO_1001_CASH.md (dettaglio rettifiche Cash da approvare)
4. REPORT_RICONCILIAZIONE_1022.md (dettaglio problema "merenda69")

**DOMANDE URGENTI PER COMMERCIALISTA**:
- Rettifiche Cash 31.12.2023 e 31.01.2024 (CHF 174,290): approvate o da stornare?
- "merenda69" CHF 182,651: cosa è e come risolvere?

---

### PER IL PROJECT MANAGER

**START HERE**:
1. MASTER-RICONCILIAZIONE-2024.md (Master Report completo)
2. MASTER-RICONCILIAZIONE-2024.xlsx (Tab "Action Plan")
3. MASTER-RICONCILIAZIONE-2024.xlsx (Tab "Tracking")

**AZIONI IMMEDIATE (OGGI 16 NOV)**:
- [ ] Inviare email a commercialista (template pronta)
- [ ] Assegnare team (Contabile senior full-time 3 settimane)
- [ ] Kickoff meeting (review Master Report)
- [ ] Richiedere estratti conto bancari (UBS + Credit Suisse)

**TIMELINE EXECUTIVE**:
- Week 1 (16-18 Nov): Quick Wins (12 ore)
- Week 2 (19-23 Nov): Riconciliazioni 1022/1023 (40 ore)
- Week 3-4 (26 Nov-6 Dic): Bank reconciliation + 10901 (64 ore)
- Final (5-6 Dic): Validation (16 ore)

---

### PER IL CONTABILE / ACCOUNTANT

**START HERE**:
1. INDEX_RICONCILIAZIONE_1022.md (Guida completa 1022)
2. README_RICONCILIAZIONE_1023.md (Guida completa 1023)
3. KONTO-10901-README.md (Quick reference 10901)
4. BANK-RECONCILIATION-1-PAGER.md (Executive summary bank reconciliation)

**TASKS ASSEGNATI** (in ordine di priority):

**WEEK 1 - Quick Wins**:
- QW-3: Chiusura Konto 1099 (2 ore) - DOPO fix script Developer

**WEEK 2 - Riconciliazioni Critical**:
- ME-1: Riconcilia 1022 Outstanding Receipts (24 ore) - BLOCKED: attesa commercialista
  - Tools: scripts/investigate-merenda69.py, scripts/manual-reconcile-top15.py
- ME-2: Riconcilia 1023 Outstanding Payments (16 ore) - DOPO fix script
  - Tools: scripts/riconcilia-konto-1023-advanced.py (fixed)

**WEEK 3-4 - Long Term**:
- LT-1: Bank Reconciliation 8 accounts (37 ore con Business Analyst)
  - Tools: BANK-RECONCILIATION-WORKBOOK.xlsx, scripts/validate-bank-reconciliation.py
- LT-3: Cash 1001 Rettifiche (8 ore) - BLOCKED: attesa approvazione commercialista
  - Tools: scripts/crea-rettifiche-1001.js, RETTIFICHE_1001_PREPARATE.json

---

### PER IL DEVELOPER

**START HERE**:
1. scripts/chiusura-konto-1099.py (DA FIXARE - company ID mismatch)
2. scripts/riconcilia-konto-1023-advanced.py (DA FIXARE - XML-RPC errors)
3. scripts/import-bank-statements-2024.ts (DA FIXARE - path resolution)

**TASKS ASSEGNATI**:

**QW-1: Fix Technical Scripts (4 ore - PRIORITY P0)**:
1. Fix chiusura-konto-1099.py
   - Problema: Company ID mismatch
   - Fix: Correct company matching logic
   - Test: Run in staging, verify saldo 1099 = 0.00

2. Fix riconcilia-konto-1023-advanced.py
   - Problema: XML-RPC marshalling errors
   - Fix: Proper data serialization
   - Test: Run on sample 10 righe, verify no errors

3. Fix import-bank-statements-2024.ts
   - Problema: Module path resolution
   - Fix: Correct import paths
   - Test: Import 10 sample transactions

**DELIVERABLE**: 3 scripts funzionanti, pronti per production use

---

### PER IL DATABASE OPTIMIZER

**START HERE**:
1. KONTO-10901-EXECUTIVE-REPORT.md (Analisi completa)
2. KONTO-10901-QUICK-ACTIONS.sql (SQL queries pronte)
3. konto-10901-analysis-v2.json (Dati categorizzati)
4. 7x CSV files (per categoria)

**TASKS ASSEGNATI**:

**QW-2: Execute SQL Riclassificazioni (4 ore - PRIORITY P0)**:
1. Verify accounts exist (2660, 10803)
2. Execute: 40 FX transactions → Konto 2660
   - SQL ready in KONTO-10901-QUICK-ACTIONS.sql
   - Expected: CHF -599,376 riclassificati
3. Execute: 15 Credit Card → Konto 10803
   - SQL ready in KONTO-10901-QUICK-ACTIONS.sql
   - Expected: CHF +44,145 riclassificati
4. Verify balance change on 10901

**LT-2: Complete 10901 Riclassificazione (27 ore)**:
1. Review Currency Diff (39 mov): 6 ore
2. CRITICAL: Verify Instant Payments duplicates (69 mov): 12 ore
   - Se duplicati: CHF -470K di impact su P&L!
3. Manual review Bank Transfers (29 mov): 3 ore
4. Categorize "Other" (157 mov): 8 ore
5. Final verification: 2 ore

**DELIVERABLE**: Konto 10901 completamente azzerato

---

### PER IL BUSINESS ANALYST

**START HERE**:
1. BANK-RECONCILIATION-EXECUTIVE-REPORT.md (Report 45 pagine)
2. bank-reconciliation-dashboard.xlsx (Dashboard interattivo)
3. BANK-RECONCILIATION-WORKBOOK.xlsx (Template lavoro)

**TASKS ASSEGNATI**:

**QW-4: FX Conversion (2 ore - PRIORITY P0)**:
1. Get SNB rates 31.12.2024 (EUR/CHF, USD/CHF)
2. Convert:
   - EUR 128,860.70 → CHF
   - USD 92.63 → CHF
3. Calculate real deltas
4. Update report

**LT-1: Bank Reconciliation Completa (37 ore)**:

**Phase 1 - Immediate (7 ore)**:
- ACT-001: Verify Account Mapping (IBAN-based) - 4 ore
- ACT-002: FX Conversion (già fatto in QW-4) - skip
- ACT-003: Identify Account 1034 - 1 ore

**Phase 2 - Reconciliation (26 ore)**:
- ACT-004: Reconcile 1026 (UBS CHF) - CHF 188,840 delta - 8 ore
- ACT-005: Reconcile 1024 (UBS Privat) - CHF 97,771 delta - 6 ore
- ACT-006: Reconcile 1025 (CS Haupt) - CHF 97,147 delta - 6 ore
- ACT-007: Reconcile 1021 (UBS COVID) - CHF 37,650 delta - 4 ore
- ACT-008: Reconcile 1027 (CS Zweit) - CHF 745 delta - 2 ore

**Phase 3 - Validation (4 ore)**:
- ACT-009: Final Validation (delta < CHF 0.01 per account)

**DELIVERABLE**: 8/8 bank accounts aligned al centesimo

---

## FILES PRINCIPALI PER CATEGORIA

### MASTER REPORTS (TOP LEVEL)
- MASTER-RICONCILIAZIONE-2024.md (questo è il MAIN REPORT)
- PIANO-CORRETTIVO-2024.md (questo file - indice)
- REPORT-FINALE-CHIUSURA-CONTABILE-2024.md (report precedente)
- REPORT-CHIUSURA-2024-ERRORI-CRITICI.md (analisi errori)

### EXCEL DASHBOARDS
- MASTER-RICONCILIAZIONE-2024-[timestamp].xlsx (MASTER DASHBOARD)
- REPORT-CHIUSURA-2024.xlsx (Report commercialista)
- bank-reconciliation-dashboard.xlsx (Bank reconciliation)
- BANK-RECONCILIATION-WORKBOOK.xlsx (Template lavoro)
- reconciliation-report.xlsx (Riconciliazioni 1022/1023)

### ACCOUNT-SPECIFIC REPORTS
- REPORT_RICONCILIAZIONE_1022.md (Outstanding Receipts)
- RICONCILIAZIONE_1023_EXECUTIVE_SUMMARY.md (Outstanding Payments)
- KONTO-10901-EXECUTIVE-REPORT.md (Liquiditätstransfer)
- REPORT_FINALE_CONTO_1001_CASH.md (Cash)
- BANK-RECONCILIATION-EXECUTIVE-REPORT.md (Bank Accounts)

### QUICK REFERENCES
- INDEX_RICONCILIAZIONE_1022.md
- SUMMARY_RICONCILIAZIONE_1022.md
- README_RICONCILIAZIONE_1023.md
- KONTO-10901-README.md
- BANK-RECONCILIATION-1-PAGER.md
- QUICK-START-CHIUSURA-KONTO-1099.md

### SCRIPTS (scripts/)
**Python**:
- odoo-reconcile-1022.py
- riconcilia-konto-1023-advanced.py
- chiusura-konto-1099.py
- validate-bank-reconciliation.py
- genera-master-dashboard.py (genera Excel dashboard)

**TypeScript/JavaScript**:
- import-bank-statements-2024.ts
- crea-rettifiche-1001.js
- analisi-conto-1001-cash.js

**SQL**:
- KONTO-10901-QUICK-ACTIONS.sql
- konto-10901-reclassification-plan.sql

### DATA FILES
- konto-10901-analysis-v2.json (353 movimenti categorizzati)
- report-conto-1001-cash.json (1,062 movimenti Cash)
- RETTIFICHE_1001_PREPARATE.json (5 rettifiche pronte)
- scripts/riconciliazione-bancaria-2024-[timestamp].json
- 7x CSV files (konto-10901-v2-*.csv)

### EMAIL TEMPLATES
- EMAIL-COMMERCIALISTA-RICONCILIAZIONE-2024.md (PRONTA PER INVIO)
- EMAIL-DRAFT-COMMERCIALISTA-CHIUSURA-2024.md (versione precedente)

---

## KPI DASHBOARD - AT A GLANCE

### CONTI TECNICI DA AZZERARE

| Account | Saldo Attuale | Target | Status | Owner |
|---------|---------------|--------|--------|-------|
| 1022 | CHF 148,549 | CHF 0.00 | RED BLOCKED | Accountant |
| 1023 | CHF -84,573 | CHF 0.00 | RED TODO | Accountant |
| 10901 | CHF -375,616 | CHF 0.00 | RED IN PROGRESS | DB Optimizer |
| 1099 | CHF -60,842 | CHF 0.00 | RED TODO | Developer |
| **TOTAL** | **CHF 669,580** | **CHF 0.00** | **0/4 (0%)** | |

### BANK ACCOUNTS ALIGNMENT

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Accounts Aligned | 0/8 (0%) | 8/8 (100%) | RED TODO |
| Total Variance | 300.93% | <0.1% | RED CRITICAL |
| Max Delta | CHF 188,840 | <CHF 1.00 | RED CRITICAL |
| Accounts with FX Errors | 2/8 (1028, 1029) | 0/8 | RED CRITICAL |

### OVERALL PROGRESS

| Metric | Current | Target | % Complete |
|--------|---------|--------|------------|
| Tasks Completed | 0/9 | 9/9 | 0% |
| Hours Logged | 0 | 132 | 0% |
| Amount Corrected | CHF 0 | CHF 1,190,112 | 0% |
| Approvals Received | 0/2 | 2/2 | 0% BLOCKED |

---

## RISKS & ISSUES

### CRITICAL RISKS

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | Commercialista non approva rettifiche | MEDIUM | HIGH | Documentazione dettagliata, alternatives |
| R2 | merenda69 non risolvibile | MEDIUM | CRITICAL | Escalation Odoo support |
| R5 | Balance Sheet non bilanciato | MEDIUM | CRITICAL | Audit completo post-correzioni |

### OPEN ISSUES

| ID | Issue | Severity | Owner | Status |
|----|-------|----------|-------|--------|
| ISS-001 | Commercialista approval needed - Cash rettifiche | CRITICAL | PM | OPEN |
| ISS-002 | merenda69 CHF 182K unknown | CRITICAL | Commercialista | OPEN |
| ISS-003 | Bank statements missing | HIGH | Accountant | OPEN |

---

## NEXT STEPS - IMMEDIATE ACTIONS

### TODAY (16 November 2025)

**1. PROJECT MANAGER** (30 min):
- [ ] Inviare EMAIL-COMMERCIALISTA-RICONCILIAZIONE-2024.md
- [ ] Allegati: Master Report + Excel + Reports specifici
- [ ] Richiedere call meeting entro 48 ore

**2. PROJECT MANAGER** (1 ora):
- [ ] Assegnare team (Contabile senior full-time)
- [ ] Kickoff meeting (review Master Report)
- [ ] Setup daily standup (15 min/giorno)

**3. ACCOUNTANT** (30 min):
- [ ] Richiedere estratti conto UBS (1021, 1024, 1026, 1028, 1029)
- [ ] Richiedere estratti conto Credit Suisse (1025, 1027)
- [ ] Urgenza: entro 3 giorni

### MONDAY (18 November 2025)

**4. DEVELOPER** (4 ore):
- [ ] QW-1: Fix 3 scripts tecnici
- [ ] Test in staging
- [ ] Deploy to production

**5. DATABASE OPTIMIZER** (4 ore):
- [ ] QW-2: Execute SQL riclassificazioni 10901
- [ ] Verify balance changes

**6. BUSINESS ANALYST** (2 ore):
- [ ] QW-4: FX conversion EUR/USD

### TUESDAY (19 November 2025)

**7. ACCOUNTANT** (2 ore):
- [ ] QW-3: Chiusura Konto 1099 (after script fix)

**IF COMMERCIALISTA APPROVAL RECEIVED**:
- [ ] ME-1: Start riconciliazione 1022 (investigation merenda69)

---

## SUCCESS CRITERIA

**IL PIANO SARÀ CONSIDERATO COMPLETATO QUANDO**:

1. Conti Tecnici Azzerati:
   - [ ] Konto 1022 = CHF 0.00
   - [ ] Konto 1023 = CHF 0.00
   - [ ] Konto 10901 = CHF 0.00
   - [ ] Konto 1099 = CHF 0.00

2. Bank Accounts Aligned:
   - [ ] 8/8 accounts delta < CHF 0.01
   - [ ] FX conversions corrette
   - [ ] Account 1034 identificato o chiuso

3. Cash Account Corretto:
   - [ ] Rettifiche approvate e eseguite
   - [ ] Duplicati eliminati
   - [ ] Saldo ~CHF 90,000 (realistico)

4. Balance Sheet:
   - [ ] Balance Check = CHF 0.00
   - [ ] Assets = Liabilities + Equity
   - [ ] No errori critici

5. Documentation:
   - [ ] Tutte correzioni documentate
   - [ ] Commercialista sign-off
   - [ ] Audit trail completo

---

## SUPPORT & CONTACTS

**Commercialista**:
Patrick Angstmann
PAGG Treuhand AG
p.angstmann@pagg.ch
Tel: 056 437 19 90

**Database Odoo**:
URL: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
User: paul@lapa.ch

**Team Roles**:
- Project Manager: Coordination, communications
- Contabile Senior: Riconciliazioni, registrazioni
- Developer: Fix scripts tecnici
- Business Analyst: Bank reconciliation, validation
- Database Optimizer: Riclassificazioni 10901

---

## VERSION HISTORY

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 16.11.2025 | 1.0 | Initial Piano Correttivo | Process Automator |

---

**PREPARED BY**: Process Automator - Master Consolidation Agent
**DATE**: 16 Novembre 2025
**STATUS**: COMPLETATO - Pronto per Esecuzione

---

**SUMMARY**: Analisi completa, piano dettagliato, tools pronti. Serve solo esecuzione disciplinata e approvazione commercialista su 2 punti critici (Cash rettifiche + merenda69). Con le risorse giuste, chiusura 2024 raggiungibile entro 6 Dicembre.

---

END OF PIANO CORRETTIVO
