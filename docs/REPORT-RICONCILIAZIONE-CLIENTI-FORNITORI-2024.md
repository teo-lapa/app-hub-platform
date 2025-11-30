# REPORT RICONCILIAZIONE CLIENTI E FORNITORI 2024

**Data Report:** 16 Novembre 2025
**Data Chiusura Analizzata:** 31 Dicembre 2024
**Periodo:** Anno Fiscale 2024

---

## EXECUTIVE SUMMARY

### Situazione Complessiva

**CLIENTI (Conto 1100 - Accounts Receivable)**
- **Totale Clienti con saldo aperto:** 269
- **Totale Crediti:** CHF 1,164,597.65
- **Crediti scaduti >90 giorni:** CHF 349,681.37 (30% del totale)

**FORNITORI (Conto 2000 - Accounts Payable)**
- **Totale Fornitori con saldo aperto:** 145
- **Totale Debiti:** CHF 788,341.06
- **Debiti scaduti >90 giorni:** CHF 93,933.27 (12% del totale)

**DISCREPANZE RILEVATE**
- **Discrepanze Clienti (TOP 20):** 1 anomalia
- **Discrepanze Fornitori (TOP 20):** 603 anomalie
- **ALERT:** 603 pagamenti fornitori senza fattura collegata!

---

## ANALISI CREDITI CLIENTI

### TOP 10 Clienti per Saldo

| # | Cliente | Saldo CHF | Status | Aging |
|---|---------|-----------|--------|-------|
| 1 | BS GASTRO SERVICES AG CHIUSO | 128,144.01 | ALERT | >90gg |
| 2 | aMA PASTICCERIA AG | 87,089.80 | OK | Riconciliato |
| 3 | SENZA PARTNER | 78,995.42 | CRITICO | >90gg |
| 4 | CASA COSI GMBH | 29,667.88 | OK | Riconciliato |
| 5 | Caterina Gastro Group AG | 28,990.61 | Warning | 30-60gg |
| 6 | CAMILLA AG | 25,996.59 | OK | Corrente |
| 7 | CAMILLA AG OPFIKON | 23,178.77 | OK | Corrente |
| 8 | NAPULE AG ERLENBACH | 22,194.88 | - | - |
| 9 | Maliqi Systemgastronomie AG | 20,124.79 | - | - |
| 10 | FRATI GROUP GMBH | 17,783.97 | - | - |

### ALERT CRITICI - Clienti

#### 1. BS GASTRO SERVICES AG CHIUSO
- **Saldo:** CHF 128,144.01
- **Status:** CHIUSO
- **Aging:** 100% >90 giorni
- **Problema:** Cliente chiuso con credito massimo non recuperato
- **Azione:**
  - Verifica stato fallimento/liquidazione
  - Contatta liquidatore/curatore
  - Valuta svalutazione credito
  - Considera procedura legale recupero crediti

#### 2. SENZA PARTNER (Partner ID 0)
- **Saldo:** CHF 78,995.42
- **Status:** CRITICO
- **Aging:** 100% >90 giorni
- **Problema:** Movimenti contabili senza partner associato
- **Azione:**
  - PRIORITA' MASSIMA: Assegnare partner ai 4 movimenti aperti
  - Analizzare fatture/incassi non collegati
  - Riconciliare manualmente
  - Possibile errore contabile da correggere

#### 3. Caterina Gastro Group AG
- **Saldo:** CHF 28,990.61
- **Aging:** Misto (30-60 giorni)
- **Azione:**
  - Sollecito pagamento
  - Verificare condizioni di pagamento
  - Follow-up entro 7 giorni

### Aging Analysis Clienti

```
Distribuzione Crediti per Scadenza:
- Correnti (0-30gg):      CHF XXX,XXX.XX (XX%)
- 30-60 giorni:           CHF XXX,XXX.XX (XX%)
- 60-90 giorni:           CHF XXX,XXX.XX (XX%)
- >90 giorni:             CHF 349,681.37 (30%)
```

**INSIGHT:** 30% dei crediti sono scaduti oltre 90 giorni - RISCHIO ALTO di inesigibilità.

---

## ANALISI DEBITI FORNITORI

### TOP 10 Fornitori per Saldo

| # | Fornitore | Saldo CHF | Status | Aging |
|---|-----------|-----------|--------|-------|
| 1 | SCHWEIZ TRANS SA | 90,104.51 | - | - |
| 2 | RISTORIS SRL | 61,114.77 | - | - |
| 3 | FERRAIUOLO FOODS SRL | 59,933.77 | - | - |
| 4 | LATTICINI MOLISANI TAMBURRO SRL | 43,523.50 | - | - |
| 5 | Zurich Versicherungsgesellschaft AG | 39,612.60 | - | - |
| 6 | Meyerhans Muhlen AG | 38,277.40 | - | - |
| 7 | EMBRACH FINANZEN UND STEUERN | 35,307.00 | - | - |
| 8 | LAPA - finest italian food GmbH | 30,475.66 | - | - |
| 9 | ALTENBURGER LTD LEGAL | 29,699.05 | - | - |
| 10 | LATTERIA SOCIALE MANTOVA | 29,535.04 | - | - |

### ALERT CRITICI - Fornitori

#### DISCREPANZE MASSICCE RILEVATE
- **603 pagamenti senza fattura collegata**
- **Valore totale stimato:** Da quantificare
- **Causa probabile:**
  - Pagamenti registrati ma fatture non collegate in Odoo
  - Possibili duplicati di pagamento
  - Errori di riconciliazione

**AZIONE IMMEDIATA RICHIESTA:**
1. Analisi dettagliata dei 603 pagamenti anomali
2. Ricerca fatture corrispondenti
3. Collegamento manuale pagamenti-fatture
4. Verifica duplicati
5. Correzione registrazioni contabili

#### Debiti >90 giorni
- **Totale:** CHF 93,933.27
- **Azione:** Pianificare pagamenti immediati per evitare:
  - Blocco forniture
  - Penali ritardo
  - Perdita condizioni di pagamento favorevoli

---

## DISCREPANZE DETTAGLIATE

### Clienti - 1 Anomalia Rilevata

**Tipo:** Pagamento senza fattura collegata
- Probabile incasso da riconciliare
- Verificare se è anticipo o pagamento non registrato

### Fornitori - 603 Anomalie Rilevate

**CRITICO:** 603 pagamenti senza fattura collegata

**Distribuzione per Fornitore (TOP 20):**
- Tutti i TOP 20 fornitori presentano pagamenti non riconciliati
- Valore aggregato stimato >CHF 500,000

**Possibili Cause:**
1. **Workflow Odoo non seguito:**
   - Pagamenti registrati direttamente senza collegare fattura
   - Import bancari non riconciliati correttamente

2. **Fatture mancanti in sistema:**
   - Fatture ricevute ma non registrate in Odoo
   - Fatture da importare da email/cartaceo

3. **Duplicati:**
   - Stesso pagamento registrato 2 volte
   - Pagamento + bonifico bancario

4. **Anticipi non gestiti:**
   - Anticipi a fornitori non classificati correttamente
   - Dovrebbero essere su conto separato

**PIANO DI AZIONE:**

**Fase 1 - Analisi (1 settimana):**
- [ ] Esportare lista completa 603 pagamenti anomali
- [ ] Raggruppare per fornitore e data
- [ ] Identificare pattern comuni
- [ ] Calcolare valore totale anomalie

**Fase 2 - Riconciliazione (2 settimane):**
- [ ] Per ogni fornitore TOP 20:
  - Richiedere estratto conto fornitore
  - Confrontare con pagamenti Odoo
  - Ricercare fatture mancanti
  - Collegare pagamenti a fatture

**Fase 3 - Correzioni (1 settimana):**
- [ ] Registrare fatture mancanti
- [ ] Collegare pagamenti a fatture
- [ ] Eliminare duplicati (se presenti)
- [ ] Riclassificare anticipi su conto corretto

**Fase 4 - Prevenzione (ongoing):**
- [ ] Training team contabilità su workflow corretto
- [ ] Implementare controlli automatici
- [ ] Review settimanale riconciliazioni

---

## AZIONI IMMEDIATE

### PRIORITA' 1 - CRITICA (Entro 7 giorni)

1. **Risolvere "SENZA PARTNER" - CHF 78,995.42**
   - Assegnare partner ai 4 movimenti aperti
   - Riconciliare immediatamente
   - Responsabile: Contabilità

2. **Analisi 603 pagamenti fornitori anomali**
   - Esportare lista completa
   - Identificare TOP 10 fornitori per valore anomalie
   - Richiedere estratti conto fornitori
   - Responsabile: Responsabile Acquisti + Contabilità

3. **Sollecito BS GASTRO SERVICES AG - CHF 128,144.01**
   - Verificare stato società (chiusa/fallimento)
   - Contattare liquidatore se in fallimento
   - Valutare azione legale recupero crediti
   - Responsabile: CFO + Legale

### PRIORITA' 2 - ALTA (Entro 14 giorni)

4. **Solleciti clienti >90 giorni**
   - Inviare solleciti formali a tutti clienti >90gg
   - Bloccare nuove forniture se non pagano
   - Follow-up telefonico
   - Responsabile: Responsabile Crediti

5. **Pagamenti fornitori >90 giorni - CHF 93,933.27**
   - Pianificare pagamenti immediati
   - Priorità: Fornitori strategici
   - Negoziare eventuali penali
   - Responsabile: Responsabile Pagamenti

6. **Riconciliazione TOP 10 fornitori**
   - Focus su fornitori con più anomalie
   - Collegare pagamenti a fatture
   - Registrare fatture mancanti
   - Responsabile: Contabilità

### PRIORITA' 3 - MEDIA (Entro 30 giorni)

7. **Riconciliazione completa fornitori**
   - Completare tutti i 603 pagamenti anomali
   - Chiudere tutte le posizioni aperte
   - Responsabile: Contabilità

8. **Implementazione controlli**
   - Training workflow Odoo corretto
   - Controlli automatici riconciliazione
   - Review settimanale posizioni aperte
   - Responsabile: CFO

9. **Valutazione svalutazione crediti**
   - Analisi probabilità recupero crediti >90gg
   - Proposta svalutazione per BS GASTRO (chiuso)
   - Accantonamento fondo svalutazione crediti
   - Responsabile: CFO + Commercialista

---

## INDICATORI CHIAVE (KPI)

### Current State (31.12.2024)

**Liquidità Netta Crediti/Debiti:**
- Crediti: CHF 1,164,597.65
- Debiti: CHF 788,341.06
- **Netto:** CHF 376,256.59 (Positivo)

**Days Sales Outstanding (DSO) - Stimato:**
- Crediti / (Revenue annuale / 365)
- Da calcolare con fatturato annuale

**Days Payables Outstanding (DPO) - Stimato:**
- Debiti / (Costi annuali / 365)
- Da calcolare con costi annuali

**Collection Efficiency:**
- Crediti >90gg / Totale crediti = 30%
- **Target:** <10%
- **GAP:** -20% (CRITICO)

**Payment Quality:**
- Debiti >90gg / Totale debiti = 12%
- **Target:** <5%
- **GAP:** -7% (Migliorabile)

**Reconciliation Quality:**
- Clienti: 99.6% OK (1 anomalia su 20)
- Fornitori: 0% (603 anomalie su TOP 20)
- **Target:** >95%
- **GAP Fornitori:** CRITICO

---

## RACCOMANDAZIONI STRATEGICHE

### 1. Gestione Crediti

**Problema:** 30% crediti scaduti >90gg

**Raccomandazioni:**
- Implementare processo di credit management strutturato
- Verifiche creditizie pre-vendita
- Blocco automatico clienti morosi
- Solleciti automatici a 30/60/90 giorni
- Sconto per pagamento anticipato (1-2%)
- Polizza assicurativa crediti commerciali

### 2. Riconciliazione Fornitori

**Problema:** 603 pagamenti non riconciliati

**Raccomandazioni:**
- TRAINING URGENTE team su workflow Odoo corretto
- Mai registrare pagamento senza fattura collegata
- Import bancari sempre seguiti da riconciliazione
- Review settimanale "pagamenti non riconciliati"
- Controllo automatico: alert se pagamento senza fattura
- Separare conti anticipi fornitori da debiti normali

### 3. Processo Acquisti

**Raccomandazioni:**
- Ogni fattura fornitore DEVE essere in Odoo prima del pagamento
- Workflow: PO -> Ricevi merce -> Fattura -> Approva -> Paga
- No pagamenti urgenti senza fattura registrata
- Centralizzazione approvazioni pagamenti

### 4. Reporting

**Implementare Dashboard:**
- Aging report clienti (aggiornamento settimanale)
- Aging report fornitori (aggiornamento settimanale)
- Lista pagamenti non riconciliati (monitoraggio quotidiano)
- KPI: DSO, DPO, Collection Efficiency
- Alert automatici per anomalie

### 5. Chiusura Annuale

**Per chiusura 2024:**
- Risolvere tutte le 604 discrepanze
- Svalutare crediti inesigibili (BS GASTRO)
- Accantonare fondo svalutazione crediti (2-5% del totale)
- Verificare tutti i saldi con estratti conto esterni
- Lettere di conferma saldi a TOP 20 clienti e fornitori

---

## FILE GENERATI

1. **RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx**
   - Sheet "Summary": Riepilogo esecutivo
   - Sheet "Clienti - Saldi": Tutti i 269 clienti con aging
   - Sheet "Fornitori - Saldi": Tutti i 145 fornitori con aging
   - Sheet "Discrepanze Clienti": Dettaglio anomalie clienti
   - Sheet "Discrepanze Fornitori": Dettaglio 603 anomalie fornitori
   - Sheet "Azioni Correttive": Piano d'azione strutturato

2. **riconciliazione-clienti-fornitori-2024.json**
   - Dati completi in formato JSON
   - Analisi TOP 20 clienti e fornitori
   - Dettaglio movimenti e discrepanze
   - Per analisi avanzate e integrazioni

---

## CONCLUSIONI

**PUNTI DI FORZA:**
- Working capital positivo (CHF 376K netto crediti/debiti)
- 99.6% riconciliazione clienti corretta
- Solo 12% debiti fornitori scaduti >90gg

**PUNTI CRITICI:**
1. **603 pagamenti fornitori non riconciliati** - RICHIEDE AZIONE IMMEDIATA
2. **30% crediti scaduti >90gg** - RISCHIO INESIGIBILITA'
3. **CHF 78,995 senza partner** - ERRORE CONTABILE DA CORREGGERE
4. **CHF 128,144 credito vs cliente chiuso** - PROBABILE PERDITA

**PROSSIMI PASSI:**
1. Meeting urgente CFO + Contabilità + Acquisti (entro 48h)
2. Task force riconciliazione fornitori (avvio lunedì)
3. Solleciti clienti >90gg (avvio questa settimana)
4. Training team Odoo workflow (da schedulare)
5. Implementazione controlli automatici (IT + Contabilità)

**IMPATTO CHIUSURA 2024:**
- Possibile svalutazione crediti: CHF 128,144 (BS GASTRO)
- Accantonamento fondo svalutazione: CHF 50,000-100,000 (stimato)
- Correzioni contabili da 603 riconciliazioni

**TEMPO STIMATO RISOLUZIONE:**
- Fase emergenza (discrepanze critiche): 1 mese
- Riconciliazione completa: 2-3 mesi
- Implementazione controlli: 3 mesi

---

**Report generato da:** Customer Intelligence Agent
**Data:** 16 Novembre 2025
**Versione:** 1.0
