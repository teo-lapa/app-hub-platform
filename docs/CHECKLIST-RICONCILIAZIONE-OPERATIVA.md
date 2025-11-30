# CHECKLIST RICONCILIAZIONE OPERATIVA - TASK FORCE

**Data Inizio:** __________________
**Responsabile Task Force:** __________________
**Team:** __________________

---

## FASE 1 - EMERGENZE (Giorni 1-3)

### Giorno 1 - Lunedì

**Mattina:**
- [ ] 09:00 - Meeting kick-off CFO + Contabilità + Acquisti
- [ ] 10:00 - Review Executive Summary e numeri chiave
- [ ] 11:00 - Assegnazione task e responsabilità

**Pomeriggio:**
- [ ] 14:00 - Fix "SENZA PARTNER" (CHF 78,995)
  - [ ] Chiamare commercialista per verificare rettifiche 2023
  - [ ] Decidere partner da assegnare
  - [ ] Opzione A: Assegnare partner specifico
  - [ ] Opzione B: Creare partner fittizio "Rettifiche Bilancio"
  - [ ] Correggere 4 movimenti in Odoo
  - [ ] Verificare saldo corretto post-correzione

- [ ] 16:00 - Preparare lista TOP 10 fornitori da contattare

### Giorno 2 - Martedì

**Mattina - Richiesta Estratti Conto:**
- [ ] Email/chiamata SCHWEIZ TRANS SA (76 anomalie, CHF 555K)
- [ ] Email/chiamata FERRAIUOLO FOODS (72 anomalie, CHF 382K)
- [ ] Email/chiamata LATTICINI MOLISANI (56 anomalie, CHF 368K)
- [ ] Email/chiamata RISTORIS SRL (28 anomalie, CHF 227K)
- [ ] Email/chiamata LATTERIA MANTOVA (CHF 197K)

**Template Email:**
```
Oggetto: Richiesta Estratto Conto 2024 - Riconciliazione Fine Anno

Gentili,

In vista della chiusura del bilancio 2024, vi chiediamo cortesemente
di inviarci un estratto conto completo della vostra contabilità fornitori
relativo al periodo 01.01.2024 - 31.12.2024.

L'estratto dovrebbe includere:
- Fatture emesse
- Pagamenti ricevuti
- Saldo al 31.12.2024

Scadenza: [Data tra 5 giorni]

Grazie per la collaborazione.

Cordiali saluti,
[Nome]
LAPA - Contabilità
```

**Pomeriggio:**
- [ ] Aprire ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx
- [ ] Aggiungere colonna "STATUS" (TODO/IN PROGRESS/RISOLTO)
- [ ] Iniziare ricerca fatture ALIGRO (154 anomalie)

### Giorno 3 - Mercoledì

**Mattina - Solleciti Clienti:**
- [ ] Identificare TOP 20 clienti >90gg
- [ ] Preparare template sollecito formale
- [ ] Inviare solleciti via email
- [ ] Follow-up telefonico clienti TOP 5

**Template Sollecito:**
```
Oggetto: Sollecito Pagamento - Fatture Scadute

Gentile Cliente,

Con la presente desideriamo ricordarvi che risultano ancora non
saldate le seguenti fatture:

[Lista fatture con data e importo]

Totale dovuto: CHF [Importo]
Scadenza più vecchia: [Data] ([N] giorni fa)

Vi preghiamo di provvedere al pagamento entro 7 giorni dalla
ricezione di questa comunicazione.

In caso di contestazioni o necessità di dilazioni di pagamento,
vi preghiamo di contattarci urgentemente.

Cordiali saluti,
[Nome]
LAPA - Amministrazione
```

**Pomeriggio:**
- [ ] BS GASTRO SERVICES AG - Verifica stato società
  - [ ] Ricerca registro imprese (chiusa/fallimento?)
  - [ ] Contatto liquidatore se in fallimento
  - [ ] Valutare azione legale recupero crediti
  - [ ] Preparare documentazione per svalutazione

---

## FASE 2 - RICONCILIAZIONE FORNITORI TOP 10 (Giorni 4-14)

### SCHWEIZ TRANS SA (555K - 76 anomalie)

**Quando arriva estratto conto:**
- [ ] Confrontare estratto con pagamenti Odoo
- [ ] Per ogni pagamento Odoo senza fattura:
  - [ ] Cercare fattura corrispondente in estratto fornitore
  - [ ] Verificare se fattura esiste in email/archivio
  - [ ] Se SI: Registrare fattura in Odoo
  - [ ] Se NO: Richiedere copia fattura a fornitore
  - [ ] Collegare pagamento a fattura
  - [ ] Flaggare come RISOLTO in Excel

**Tracking Progress:**
```
Anomalie totali: 76
Risolte: _____ / 76 (____%)
Valore risolto: CHF _____ / 555,376.81
```

### FERRAIUOLO FOODS (382K - 72 anomalie)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / 72
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / 72

### LATTICINI MOLISANI (368K - 56 anomalie)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / 56
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / 56

### RISTORIS SRL (227K - 28 anomalie)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / 28
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / 28

### LATTERIA MANTOVA (197K)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / _____
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / _____

### ALIGRO (160K - 154 anomalie)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / 154
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / 154

### GENNARO AURICCHIO (134K - 21 anomalie)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / 21
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / 21

### LDF SRL (102K - 23 anomalie)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / 23
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / 23

### Zurich Versicherung (93K - 29 anomalie)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / 29
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / 29

### INNOVACTION (90K)

- [ ] Ricevuto estratto conto: SI / NO - Data: _______
- [ ] Confronto estratto vs Odoo completato
- [ ] Fatture trovate e registrate: _____ / _____
- [ ] Fatture da richiedere: _____ (lista: _______)
- [ ] Anomalie risolte: _____ / _____

**Progress TOP 10:**
```
Anomalie totali TOP 10: ~600
Risolte: _____ / 600 (____%)
Valore risolto: CHF _____ / 2,313,390.37
```

---

## FASE 3 - COMPLETAMENTO RICONCILIAZIONE (Giorni 15-30)

### Fornitori Rimanenti (145 totali - 135 da completare)

**Strategia:**
- [ ] Raggruppare per numero anomalie
- [ ] Priorità: >10 anomalie prima
- [ ] Fornitori con 1-2 anomalie: batch processing

**Checklist Giornaliera (15 fornitori/giorno):**
```
Giorno _____ - Data: _______

Fornitori processati oggi:
1. [Nome fornitore] - Anomalie: ___ - Risolte: ___ / ___
2. [Nome fornitore] - Anomalie: ___ - Risolte: ___ / ___
3. [Nome fornitore] - Anomalie: ___ - Risolte: ___ / ___
...
15. [Nome fornitore] - Anomalie: ___ - Risolte: ___ / ___

Totale risolto oggi: _____
Rimanenti: _____
```

### Gestione Crediti Clienti

**Solleciti Follow-up (Settimanale):**

**Settimana 1:**
- [ ] Solleciti inviati: _____ clienti
- [ ] Risposte ricevute: _____
- [ ] Pagamenti ricevuti: CHF _____
- [ ] Contestazioni: _____ (lista: _______)

**Settimana 2:**
- [ ] Follow-up telefonico: _____ clienti
- [ ] Accordi dilazioni: _____
- [ ] Clienti morosi da bloccare: _____
- [ ] Pagamenti ricevuti: CHF _____

**Settimana 3:**
- [ ] Secondo sollecito formale: _____ clienti
- [ ] Clienti bloccati: _____
- [ ] Azioni legali da valutare: _____
- [ ] Pagamenti ricevuti: CHF _____

**Settimana 4:**
- [ ] Valutazione svalutazioni crediti
- [ ] Proposta commercialista
- [ ] Accantonamento fondo svalutazione
- [ ] Pagamenti ricevuti: CHF _____

### Pagamenti Fornitori Scaduti

**Debiti >90gg (CHF 93,933):**
- [ ] Lista completa fornitori da pagare
- [ ] Prioritizzazione (fornitori strategici prima)
- [ ] Verifica budget disponibile
- [ ] Pianificazione pagamenti

**Calendario Pagamenti:**
```
Settimana 1: CHF _____
Settimana 2: CHF _____
Settimana 3: CHF _____
Settimana 4: CHF _____

Totale pianificato: CHF _____ / 93,933
```

---

## FASE 4 - SISTEMATIZZAZIONE (Giorni 21-30)

### Training Team Odoo

- [ ] Preparare materiale formazione
- [ ] Session 1: Workflow corretto fatture fornitori (2h)
  - [ ] Come registrare fattura
  - [ ] Come creare pagamento DA fattura
  - [ ] Come riconciliare import bancario
- [ ] Session 2: Workflow clienti e riconciliazioni (2h)
  - [ ] Emissione fatture
  - [ ] Riconciliazione incassi
  - [ ] Gestione solleciti
- [ ] Session 3: Controlli e best practices (1h)
  - [ ] Check settimanali
  - [ ] Report aging
  - [ ] Red flags

**Partecipanti formati:** _____ / _____ (target: 100%)

### Controlli Automatici

**Da Implementare:**
- [ ] Alert automatico: Pagamento senza fattura
- [ ] Report settimanale: "Pagamenti non riconciliati"
- [ ] Dashboard real-time: Aging clienti/fornitori
- [ ] Alert: Clienti che superano limite credito
- [ ] Alert: Fornitori con debiti >60gg

**Testing:**
- [ ] Test alert pagamento senza fattura
- [ ] Test report settimanale
- [ ] Test dashboard aging
- [ ] Correzione bug/issues
- [ ] Deploy in produzione

### Dashboard e Report

- [ ] Dashboard Aging Clienti (Odoo/Excel)
- [ ] Dashboard Aging Fornitori (Odoo/Excel)
- [ ] Report settimanale riconciliazioni
- [ ] KPI: DSO, DPO, Collection Efficiency
- [ ] Automatizzare invio report a CFO (lunedì mattina)

---

## FASE 5 - CHIUSURA BILANCIO (Giorni 31-90)

### Conferma Saldi (Giorno 31-45)

**TOP 20 Clienti:**
- [ ] Preparare lettere conferma saldi
- [ ] Inviare a TOP 20 clienti
- [ ] Follow-up conferme non ricevute
- [ ] Riconciliare discrepanze segnalate
- [ ] Conferme ricevute: _____ / 20

**TOP 20 Fornitori:**
- [ ] Preparare lettere conferma saldi
- [ ] Inviare a TOP 20 fornitori
- [ ] Follow-up conferme non ricevute
- [ ] Riconciliare discrepanze segnalate
- [ ] Conferme ricevute: _____ / 20

**Template Lettera Conferma Saldi:**
```
Gentile [Cliente/Fornitore],

In vista della chiusura del nostro bilancio 2024, vi chiediamo
cortesemente di confermare il saldo del vostro conto alla data
del 31.12.2024.

Secondo la nostra contabilità, il saldo risulta:
- Dare (nostro credito): CHF _____
- Avere (nostro debito): CHF _____

Saldo finale: CHF _____ [a nostro favore / a vostro favore]

Vi preghiamo di confermare tale saldo o segnalare eventuali
discrepanze entro 10 giorni.

Grazie per la collaborazione.
```

### Svalutazioni e Accantonamenti (Giorno 46-60)

**Svalutazione Crediti Inesigibili:**
- [ ] BS GASTRO SERVICES AG: CHF 128,144 (cliente chiuso)
- [ ] Altri crediti inesigibili: CHF _____ (lista: _______)
- [ ] Totale svalutazione diretta: CHF _____
- [ ] Approvazione CFO
- [ ] Registrazione contabile

**Accantonamento Fondo Svalutazione:**
- [ ] Calcolo 3% su crediti rimanenti
- [ ] Analisi rischio per cliente
- [ ] Proposta accantonamento: CHF _____
- [ ] Review con commercialista
- [ ] Approvazione CFO
- [ ] Registrazione contabile

### Documentazione Commercialista (Giorno 61-90)

**Documenti da Preparare:**
- [ ] Report completo riconciliazione clienti
- [ ] Report completo riconciliazione fornitori
- [ ] Lista crediti svalutati con motivazioni
- [ ] Calcolo accantonamento fondo svalutazione
- [ ] Lettere conferma saldi (TOP 20+20)
- [ ] Aging report finale al 31.12.2024
- [ ] Spiegazione movimenti "SENZA PARTNER" corretti
- [ ] Documentazione 603 anomalie risolte

**Meeting Commercialista:**
- [ ] Data meeting: _______
- [ ] Review documenti
- [ ] Validazione svalutazioni
- [ ] Validazione accantonamenti
- [ ] Approvazione chiusura bilancio

---

## METRICHE DI SUCCESSO

### Target 7 Giorni

- [ ] SENZA PARTNER risolto: 0 anomalie (target: 0)
- [ ] Estratti conto TOP 5 ricevuti: _____ / 5
- [ ] Solleciti clienti inviati: _____ / _____

### Target 30 Giorni

- [ ] Anomalie fornitori: _____ / 603 risolte (target: >500, 83%)
- [ ] Crediti >90gg: ____% (target: <20%)
- [ ] Debiti >90gg: ____% (target: <5%)
- [ ] Training completato: _____ / _____ persone (target: 100%)
- [ ] Controlli automatici attivi: _____ / 5 (target: 5)

### Target 90 Giorni

- [ ] Anomalie fornitori: 0 / 603 (target: 0)
- [ ] Conferme saldi: _____ / 40 (target: >35, 87%)
- [ ] Svalutazioni registrate: CHF _____
- [ ] Accantonamenti registrati: CHF _____
- [ ] Bilancio 2024 chiuso: SI / NO
- [ ] Approvazione commercialista: SI / NO

---

## TRACKING GIORNALIERO

**Daily Standup (15 min - ore 09:00):**

```
Data: _______

Ieri abbiamo:
- Risolto _____ anomalie fornitori
- Ricevuto _____ estratti conto
- Sollecitato _____ clienti
- Incassato CHF _____

Oggi faremo:
- Riconciliare [fornitore]: _____ anomalie
- Follow-up [clienti]: _____
- Altro: _____

Blocchi/Problemi:
- _____________________
- _____________________

Anomalie rimanenti: _____ / 603 (____%)
Giorni rimanenti fase: _____ / 30
```

---

## CONTATTI URGENTI

**Team Task Force:**
- Responsabile: _________________ - Tel: _____________
- Contabilità 1: ________________ - Tel: _____________
- Contabilità 2: ________________ - Tel: _____________
- Acquisti: ____________________ - Tel: _____________

**Escalation:**
- CFO: _________________________ - Tel: _____________
- Commercialista: ______________ - Tel: _____________

**Supporto:**
- IT Odoo: ____________________ - Tel: _____________
- Amministratore sistema: _______ - Tel: _____________

---

## NOTE E ISSUES

**Issues Aperti:**

| Data | Issue | Responsabile | Status | Note |
|------|-------|--------------|--------|------|
| ____ | _____ | ____________ | ______ | ____ |
| ____ | _____ | ____________ | ______ | ____ |
| ____ | _____ | ____________ | ______ | ____ |

**Decisioni Prese:**

| Data | Decisione | Chi ha deciso | Impatto |
|------|-----------|---------------|---------|
| ____ | _________ | _____________ | _______ |
| ____ | _________ | _____________ | _______ |

**Lessons Learned:**

| Data | Lesson | Azione Preventiva |
|------|--------|-------------------|
| ____ | ______ | _________________ |
| ____ | ______ | _________________ |

---

**INIZIA ADESSO!**

Stampa questa checklist e usala come guida operativa quotidiana.
Ogni sera aggiorna i progress, ogni mattina review priorità.

**BUON LAVORO!**

Data stampa: _______
Firma responsabile: ______________
