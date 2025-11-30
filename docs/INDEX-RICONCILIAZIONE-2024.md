# INDICE COMPLETO - RICONCILIAZIONE CLIENTI E FORNITORI 2024

**Data Analisi:** 16 Novembre 2025
**Chiusura Analizzata:** 31 Dicembre 2024
**Generato da:** Customer Intelligence Agent

---

## COME USARE QUESTA DOCUMENTAZIONE

### 1. SE SEI IL CFO / MANAGEMENT
Leggi in questo ordine:
1. **EXECUTIVE-SUMMARY-RICONCILIAZIONE-2024.md** (5 min)
2. **RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx** - Sheet "Summary" (2 min)
3. Convoca meeting urgente con team
4. Assegna responsabile task force

### 2. SE SEI IL RESPONSABILE TASK FORCE
Leggi in questo ordine:
1. **START-HERE-RICONCILIAZIONE-CLIENTI-FORNITORI.md** (10 min)
2. **CHECKLIST-RICONCILIAZIONE-OPERATIVA.md** (15 min)
3. **ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx** (usa come working file)
4. Inizia da Fase 1 della checklist

### 3. SE SEI CONTABILITA' / OPERATIVO
Usa questi file quotidianamente:
1. **ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx** (aggiungi colonna STATUS)
2. **CHECKLIST-RICONCILIAZIONE-OPERATIVA.md** (stampa e compila)
3. **RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx** (reference)

### 4. SE SEI IL COMMERCIALISTA
Leggi in questo ordine:
1. **EXECUTIVE-SUMMARY-RICONCILIAZIONE-2024.md**
2. **REPORT-RICONCILIAZIONE-CLIENTI-FORNITORI-2024.md**
3. **fix-senza-partner-analysis.json** (per rettifiche 2023)

---

## FILE GENERATI

### DOCUMENTAZIONE ESECUTIVA

#### 1. EXECUTIVE-SUMMARY-RICONCILIAZIONE-2024.md
**Scopo:** Sintesi esecutiva per management
**Contenuto:**
- Numeri chiave (269 clienti, 145 fornitori, CHF 1.16M crediti)
- 3 Emergenze principali (603 anomalie fornitori, CHF 79K senza partner, CHF 349K scaduti)
- TOP 10 fornitori per anomalie
- Piano azione 7 giorni
- Impatto finanziario e ROI investimenti
- Metriche target

**Quando usarlo:** Prima lettura per capire situazione

**Tempo lettura:** 5-10 minuti

---

#### 2. START-HERE-RICONCILIAZIONE-CLIENTI-FORNITORI.md
**Scopo:** Guida rapida operativa
**Contenuto:**
- Situazione emergenziale spiegata
- File generati e loro utilizzo
- TOP 10 fornitori con dettagli
- Piano azione immediato (7 giorni)
- Workflow Odoo corretto vs sbagliato
- FAQ e troubleshooting

**Quando usarlo:** Dopo Executive Summary, prima di iniziare operatività

**Tempo lettura:** 10-15 minuti

---

#### 3. REPORT-RICONCILIAZIONE-CLIENTI-FORNITORI-2024.md
**Scopo:** Report analitico completo
**Contenuto:**
- Executive summary dettagliato
- Analisi crediti clienti (TOP 10 + aging + alert)
- Analisi debiti fornitori (TOP 10 + aging + discrepanze)
- Discrepanze dettagliate (604 anomalie)
- Piano azione completo (4 priorità)
- KPI e metriche (DSO, DPO, Collection Efficiency)
- Raccomandazioni strategiche
- Azioni chiusura 2024

**Quando usarlo:** Per analisi approfondita e strategia

**Tempo lettura:** 30-45 minuti

---

#### 4. CHECKLIST-RICONCILIAZIONE-OPERATIVA.md
**Scopo:** Checklist operativa task force
**Contenuto:**
- 5 Fasi operative (Emergenze, TOP 10, Completamento, Sistematizzazione, Chiusura)
- Checklist giorno per giorno
- Template email (richiesta estratti conto, solleciti, conferma saldi)
- Tracking progress per fornitore
- Metriche successo (7/30/90 giorni)
- Daily standup template
- Note e issues tracker

**Quando usarlo:** Quotidianamente durante riconciliazione

**Tempo lettura:** 15 minuti + compilazione continua

---

### FILE EXCEL OPERATIVI

#### 5. RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx
**Scopo:** Report master completo
**Sheet "Summary":**
- Riepilogo esecutivo
- Totali clienti/fornitori
- Discrepanze

**Sheet "Clienti - Saldi":**
- 269 clienti con saldo aperto
- Colonne: Partner ID, Nome, Saldo, Dare, Avere, Tot.Movimenti, Mov.Aperti
- Aging: Corrente, 30gg, 60gg, 90gg, >90gg
- Ordinati per saldo decrescente
- Totale: CHF 1,164,597.65

**Sheet "Fornitori - Saldi":**
- 145 fornitori con saldo aperto
- Stesse colonne dei clienti
- Totale: CHF 788,341.06

**Sheet "Discrepanze Clienti":**
- 1 anomalia cliente
- Dettaglio: Cliente, Tipo, Documento, Data, Importo, Residuo, Status

**Sheet "Discrepanze Fornitori":**
- 603 anomalie fornitori
- Stesse colonne discrepanze clienti
- DA RICONCILIARE TUTTE

**Sheet "Azioni Correttive":**
- Piano azioni strutturato
- Categoria, Azione, Priorità, Responsabile, Scadenza

**Quando usarlo:** Reference principale per numeri e saldi

**Dimensioni:** ~500 righe dati

---

#### 6. ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx
**Scopo:** Working file task force fornitori
**Sheet "Anomalie Fornitori":**
- 603 righe = 603 anomalie da risolvere
- Colonne: Fornitore ID, Nome, Saldo Fornitore, Tipo Anomalia, Documento, Data, Importo, Residuo, Status
- **AGGIUNGI COLONNA:** "STATUS RISOLUZIONE" (TODO/IN PROGRESS/RISOLTO)
- **AGGIUNGI COLONNA:** "NOTE"
- **USA COME CHECKLIST**

**Sheet "Statistiche":**
- Totale anomalie: 603
- Valore totale: CHF 2,702,982.31
- Distribuzione per tipo (99% = "Pagamento senza fattura")
- TOP 10 per numero anomalie
- TOP 10 per valore anomalie

**Sheet "Piano Azione":**
- 10 step operativi
- Da 7 giorni (emergenza) a 60 giorni (sistematizzazione)
- Step, Azione, Responsabile, Scadenza, Status

**Quando usarlo:** QUOTIDIANAMENTE per tracking riconciliazioni

**Dimensioni:** 603 righe anomalie

**IMPORTANTE:** Questo è il tuo file di lavoro principale!

---

### FILE JSON (DATI RAW)

#### 7. riconciliazione-clienti-fornitori-2024.json
**Scopo:** Dati completi in formato JSON
**Contenuto:**
- Data report: 2025-11-16T09:03:52
- Data chiusura: 2024-12-31
- Clienti: 269 oggetti con tutti i campi
- Fornitori: 145 oggetti con tutti i campi
- TOP 20 clienti analysis (fatture, pagamenti, discrepanze)
- TOP 20 fornitori analysis (fatture, pagamenti, discrepanze)

**Quando usarlo:**
- Per analisi avanzate (Python, Excel pivot, BI tools)
- Per integrazioni con altri sistemi
- Per query custom

**Dimensioni:** ~2MB JSON

---

#### 8. fix-senza-partner-analysis.json
**Scopo:** Dettaglio 4 movimenti SENZA PARTNER
**Contenuto:**
- Date analysis: timestamp
- Total moves: 4
- Total balance: CHF 78,995.42
- Suggestions: Array di 4 oggetti

**Per ogni movimento:**
- move_line_id
- move_id
- suggested_partner_id (se trovato)
- suggested_partner_name
- balance
- date
- name (descrizione)

**Quando usarlo:** Per fix urgente movimenti senza partner

**Dimensioni:** ~2KB JSON

---

### SCRIPT PYTHON

#### 9. scripts/riconciliazione-clienti-fornitori-2024.py
**Scopo:** Script analisi completa riconciliazione
**Funzionalità:**
- Connessione Odoo via XML-RPC
- Recupero account 1100 (clienti) e 2000 (fornitori)
- Calcolo saldi per partner
- Aging analysis (corrente, 30gg, 60gg, 90gg, >90gg)
- Analisi fatture vs pagamenti (TOP 20)
- Identificazione discrepanze
- Generazione Excel report
- Export JSON

**Come usare:**
```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/riconciliazione-clienti-fornitori-2024.py
```

**Output:**
- RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx
- riconciliazione-clienti-fornitori-2024.json

**Riutilizzabile:** SI (per future riconciliazioni mensili/trimestrali)

---

#### 10. scripts/analizza-anomalie-fornitori-dettaglio.py
**Scopo:** Analisi dettagliata 603 anomalie fornitori
**Funzionalità:**
- Carica riconciliazione-clienti-fornitori-2024.json
- Estrae tutte le discrepanze fornitori
- Statistiche (count, totale valore)
- TOP 10 per numero anomalie
- TOP 10 per valore anomalie
- Generazione Excel operativo
- Piano azione 10 step

**Come usare:**
```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/analizza-anomalie-fornitori-dettaglio.py
```

**Output:**
- ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx

---

#### 11. scripts/fix-senza-partner.py
**Scopo:** Analisi e fix movimenti senza partner
**Funzionalità:**
- Connessione Odoo
- Ricerca movimenti account 1100 senza partner
- Analisi movimento completo (tutte le righe)
- Suggerimento partner dalle altre righe
- Generazione SQL correzioni
- Export JSON analisi

**Come usare:**
```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/fix-senza-partner.py
```

**Output:**
- Console output con analisi dettagliata
- fix-senza-partner-analysis.json
- SQL queries per correzione

**IMPORTANTE:** Eseguire SQL SOLO dopo verifica con commercialista!

---

## RIEPILOGO SITUAZIONE

### I NUMERI

```
CLIENTI (Conto 1100):
├── Totale clienti con saldo:         269
├── Totale crediti:                   CHF 1,164,597.65
├── Crediti >90gg:                    CHF   349,681.37 (30%)
├── Discrepanze:                      1
└── Anomalia critica:                 "SENZA PARTNER" CHF 78,995

FORNITORI (Conto 2000):
├── Totale fornitori con saldo:       145
├── Totale debiti:                    CHF   788,341.06
├── Debiti >90gg:                     CHF    93,933.27 (12%)
├── Discrepanze:                      603 (CRITICO!)
└── Valore anomalie:                  CHF 2,702,982.31

POSIZIONE NETTA:
└── Crediti - Debiti:                 CHF   376,256.59 (POSITIVO)
```

### LE 3 EMERGENZE

**1. ANOMALIE FORNITORI (603 - CHF 2.7M)**
- 99% = "Pagamento senza fattura"
- Causa: Workflow Odoo non seguito
- Azione: Task force riconciliazione 30 giorni

**2. SENZA PARTNER (4 movimenti - CHF 79K)**
- Rettifiche bilancio 2023 senza partner
- Errore contabile critico
- Azione: Fix urgente giorno 1 (lunedì)

**3. CREDITI SCADUTI >90gg (CHF 349K)**
- 30% del totale crediti
- Include CHF 128K da cliente chiuso
- Azione: Solleciti + svalutazioni

---

## TIMELINE

### SETTIMANA 1 (Giorni 1-7)
- **Giorno 1:** Meeting + Fix SENZA PARTNER
- **Giorni 2-3:** Richiesta estratti conto TOP 5 + Solleciti clienti
- **Giorni 4-7:** Inizio riconciliazione SCHWEIZ TRANS + ALIGRO

**Target:** SENZA PARTNER risolto, 5 estratti conto ricevuti, 50+ anomalie risolte

### SETTIMANA 2-4 (Giorni 8-30)
- Riconciliazione TOP 10 fornitori (focus)
- Solleciti follow-up clienti
- Pagamenti fornitori >90gg
- Training team Odoo
- Implementazione controlli automatici

**Target:** 500+ anomalie risolte (83%), crediti >90gg <20%, controlli attivi

### MESE 2-3 (Giorni 31-90)
- Completamento riconciliazioni
- Conferma saldi (TOP 40)
- Svalutazioni e accantonamenti
- Documentazione commercialista
- Chiusura bilancio 2024

**Target:** 0 anomalie, bilancio chiuso e approvato

---

## COSTI E INVESTIMENTI

### COSTI RICONCILIAZIONE
```
Tempo contabilità (200h x CHF 50):    CHF 10,000
Commercialista (20h x CHF 150):       CHF  3,000
Management (40h x CHF 100):           CHF  4,000
─────────────────────────────────────────────────
TOTALE COSTI RICONCILIAZIONE:         CHF 17,000
```

### SVALUTAZIONI STIMATE
```
BS GASTRO SERVICES (chiuso):          CHF 128,144
Altri clienti >90gg (50% recovery):   CHF 110,768
Accantonamento fondo (3%):            CHF  27,770
─────────────────────────────────────────────────
TOTALE IMPATTO BILANCIO:              CHF 266,682
```

### INVESTIMENTI PREVENZIONE
```
Credit management software:           CHF  5,000/anno
Polizza assicurativa crediti:         CHF  8,000/anno
Controlli automatici Odoo:            CHF  2,000 (one-time)
Training team:                        CHF  1,500 (one-time)
─────────────────────────────────────────────────
TOTALE INVESTIMENTO ANNO 1:           CHF 16,500

ROI STIMATO:
- Riduzione DSO (20 giorni):          +CHF  64,000 cash flow
- Riduzione bad debts (50%):          +CHF 120,000/anno
─────────────────────────────────────────────────
ROI NETTO ANNO 1:                     +CHF 167,500
```

---

## METRICHE TARGET

| Metrica | Current | Target 30gg | Target 90gg |
|---------|---------|-------------|-------------|
| Anomalie fornitori | 603 | <100 (83%) | 0 (100%) |
| Crediti >90gg | 30% | <20% | <10% |
| Debiti >90gg | 12% | <5% | <5% |
| SENZA PARTNER | CHF 79K | 0 | 0 |
| Collection Efficiency | 70% | 80% | >90% |
| DSO (stimato) | 90gg | 75gg | 60gg |

---

## WORKFLOW CORRETTO ODOO

### FORNITORI (Evita future anomalie)

```
1. Ricevi fattura fornitore (email/posta)
   ↓
2. Registra fattura in Odoo
   (Acquisti > Fatture fornitori > Crea)
   ↓
3. Approva fattura
   (Verifica importo, prodotti, IVA)
   ↓
4. Crea pagamento DA FATTURA
   (Bottone "Registra pagamento" nella fattura)
   ↓
5. Esegui bonifico bancario
   (Da e-banking con riferimento)
   ↓
6. Import estratto conto in Odoo
   (Contabilità > Dashboard > Import)
   ↓
7. Riconciliazione AUTOMATICA
   (Odoo collega import a pagamento esistente)
```

**REGOLA D'ORO:** Mai registrare pagamento senza fattura in Odoo!

### CLIENTI

```
1. Emetti fattura in Odoo
   (Vendite > Ordini > Crea fattura)
   ↓
2. Invia fattura cliente
   ↓
3. Ricevi pagamento su conto bancario
   ↓
4. Import estratto conto in Odoo
   ↓
5. Riconciliazione AUTOMATICA
   (Odoo collega a fattura cliente)
```

**Se incasso senza fattura:**
- Verificare se è anticipo → Registrare come anticipo cliente
- Verificare se fattura mancante → Emettere fattura retroattiva
- Mai lasciare "sospeso"

---

## FAQ

**Q: Da dove inizio?**
A: Leggi EXECUTIVE-SUMMARY-RICONCILIAZIONE-2024.md (5 min), poi START-HERE (10 min), poi convoca meeting.

**Q: Quale file uso per lavorare quotidianamente?**
A: ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx + CHECKLIST-RICONCILIAZIONE-OPERATIVA.md

**Q: Come risolvo "SENZA PARTNER"?**
A: Esegui scripts/fix-senza-partner.py, analizza output, decidi partner con commercialista, correggi in Odoo.

**Q: Come faccio riconciliazione fornitore?**
A: 1) Richiedi estratto conto, 2) Confronta con pagamenti Odoo, 3) Cerca fatture mancanti, 4) Registra fatture, 5) Collega pagamenti.

**Q: Posso chiudere bilancio 2024 con queste anomalie?**
A: NO. Tutte le 604 anomalie devono essere risolte prima della chiusura.

**Q: Quanto tempo serve?**
A: Emergenze 7 giorni, riconciliazione completa 30 giorni, chiusura bilancio 90 giorni.

**Q: Cosa rischiamo finanziariamente?**
A: Svalutazioni CHF 266K (stimate). Nessun rischio cash flow (anomalie sono riconciliazioni, non errori di pagamento).

**Q: Come evitiamo in futuro?**
A: Training team + Workflow corretto + Controlli automatici + Review settimanale.

---

## CONTATTI E SUPPORTO

**Per domande su:**
- **Numeri e analisi:** Consultare Excel + JSON files
- **Operatività:** Usare START-HERE + CHECKLIST
- **Strategia:** Leggere REPORT + EXECUTIVE-SUMMARY
- **Fix tecnici:** Eseguire script Python

**Supporto tecnico Odoo:**
- Documentazione: https://www.odoo.com/documentation
- Community: https://www.odoo.com/forum

**Support Team:**
- Task force interna (da definire)
- Commercialista (per svalutazioni e chiusura)
- IT (per controlli automatici)

---

## PROSSIMI STEP

**OGGI:**
1. [ ] Leggi EXECUTIVE-SUMMARY (5 min)
2. [ ] Apri RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx
3. [ ] Convoca meeting urgente (CFO + Team)

**LUNEDI:**
1. [ ] Meeting kick-off (usa EXECUTIVE-SUMMARY come base)
2. [ ] Assegna responsabile task force
3. [ ] Fix SENZA PARTNER (usa script Python)
4. [ ] Distribuisci CHECKLIST-RICONCILIAZIONE-OPERATIVA.md

**QUESTA SETTIMANA:**
1. [ ] Richiedi estratti conto TOP 5 fornitori
2. [ ] Invia solleciti clienti >90gg
3. [ ] Inizia riconciliazione primi fornitori
4. [ ] Daily standup 15 min (9:00 AM)

---

## SUMMARY FILES

**File Totali Generati:** 11

**Documentazione:** 5 file MD
- EXECUTIVE-SUMMARY-RICONCILIAZIONE-2024.md
- START-HERE-RICONCILIAZIONE-CLIENTI-FORNITORI.md
- REPORT-RICONCILIAZIONE-CLIENTI-FORNITORI-2024.md
- CHECKLIST-RICONCILIAZIONE-OPERATIVA.md
- INDEX-RICONCILIAZIONE-2024.md (questo file)

**Excel Operativi:** 2 file
- RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx (master report)
- ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx (working file)

**JSON Dati:** 2 file
- riconciliazione-clienti-fornitori-2024.json (dati completi)
- fix-senza-partner-analysis.json (analisi 4 movimenti)

**Script Python:** 3 file
- scripts/riconciliazione-clienti-fornitori-2024.py (analisi completa)
- scripts/analizza-anomalie-fornitori-dettaglio.py (export anomalie)
- scripts/fix-senza-partner.py (fix movimenti senza partner)

**Dimensione Totale:** ~15MB (Excel) + ~2MB (JSON) + ~50KB (MD) + ~30KB (Python)

---

**HAI TUTTO IL NECESSARIO PER INIZIARE!**

**Percorso Consigliato:**
1. EXECUTIVE-SUMMARY (overview)
2. START-HERE (quick start)
3. CHECKLIST (operatività)
4. EXCEL (dati e tracking)

**BUON LAVORO!**

---

**Documentazione generata da:** Customer Intelligence Agent
**Data:** 16 Novembre 2025
**Versione:** 1.0 - Complete Package
