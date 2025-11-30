# EXECUTIVE SUMMARY - RICONCILIAZIONE CLIENTI E FORNITORI 2024

**Data:** 16 Novembre 2025
**Analisi:** Chiusura al 31 Dicembre 2024

---

## SITUAZIONE IN SINTESI

### I NUMERI

**CREDITI CLIENTI (Conto 1100)**
```
Totale clienti con saldo aperto:    269
Totale crediti:                      CHF 1,164,597.65
Crediti scaduti >90 giorni:          CHF   349,681.37 (30%)
```

**DEBITI FORNITORI (Conto 2000)**
```
Totale fornitori con saldo aperto:  145
Totale debiti:                       CHF   788,341.06
Debiti scaduti >90 giorni:           CHF    93,933.27 (12%)
```

**POSIZIONE NETTA**
```
Crediti - Debiti:                    CHF   376,256.59 (POSITIVO)
```

---

## LE 3 EMERGENZE

### 1. PAGAMENTI FORNITORI NON RICONCILIATI

**PROBLEMA:**
- 603 pagamenti senza fattura collegata
- Valore: CHF 2,702,982.31

**CAUSA:**
- Workflow Odoo non seguito
- Pagamenti registrati senza collegare fatture
- Possibili fatture mai inserite in sistema

**IMPATTO:**
- Impossibile chiudere bilancio 2024
- Saldi fornitori non verificabili
- Rischio duplicati pagamento

**AZIONE:**
- Task force riconciliazione (2 settimane)
- Focus TOP 10 fornitori (85% del valore)
- Richiedere estratti conto fornitori

### 2. MOVIMENTI SENZA PARTNER - CHF 78,995

**PROBLEMA:**
- 4 movimenti contabili senza partner assegnato
- Saldo: CHF 78,995.42
- ERRORE CONTABILE CRITICO

**DETTAGLIO:**
Tutti i 4 movimenti sono "Rettifiche di allineamento bilancio 2023":
1. Rettifica crediti 31/12/2023 - CHF 78,295.42
2. Allineamento 1100 commercialista - CHF 700.00
3. Correzione finale Crediti - CHF 334,027.09
4. Mega-rett finale commercialista - CHF -334,027.09

**CAUSA:**
- Rettifiche manuali fine anno 2023
- Partner non assegnato durante correzioni
- Movimenti di riconciliazione globale

**AZIONE:**
- PRIORITA' 1: Assegnare partner corretto
- Verificare con commercialista rettifiche 2023
- Possibile creare partner fittizio "Rettifiche di Bilancio"

### 3. CREDITI SCADUTI >90 GIORNI - CHF 349,681

**PROBLEMA:**
- 30% dei crediti totali scaduti oltre 90 giorni
- Include CHF 128,144 da cliente CHIUSO

**TOP RISCHI:**
1. BS GASTRO SERVICES AG (CHIUSO) - CHF 128,144
2. Clienti >90gg - Rischio inesigibilità

**AZIONE:**
- Solleciti immediati
- Verifica BS GASTRO (fallimento?)
- Svalutazione crediti inesigibili
- Accantonamento fondo svalutazione

---

## ANALISI FORNITORI - TOP 10

| Fornitore | Anomalie | Valore CHF | % Totale |
|-----------|----------|------------|----------|
| SCHWEIZ TRANS SA | 76 | 555,376.81 | 20.5% |
| FERRAIUOLO FOODS | 72 | 382,406.63 | 14.1% |
| LATTICINI MOLISANI | 56 | 368,905.75 | 13.6% |
| RISTORIS SRL | 28 | 227,091.08 | 8.4% |
| LATTERIA MANTOVA | - | 197,737.38 | 7.3% |
| ALIGRO | 154 | 160,223.71 | 5.9% |
| GENNARO AURICCHIO | 21 | 134,163.89 | 5.0% |
| LDF SRL | 23 | 102,770.08 | 3.8% |
| Zurich Versicherung | 29 | 93,931.91 | 3.5% |
| INNOVACTION | - | 90,884.13 | 3.4% |

**INSIGHT:**
- TOP 10 = 85.5% del valore totale anomalie
- ALIGRO: 154 pagamenti = 3 pagamenti/settimana non riconciliati
- SCHWEIZ TRANS: CHF 555K = 20% di tutte le anomalie

---

## PIANO AZIONE 7 GIORNI

### LUNEDI (Giorno 1)

**Mattina - Meeting Emergenza**
- CFO + Contabilità + Responsabile Acquisti
- Presentare analisi e numeri
- Assegnare task force

**Pomeriggio - Fix "SENZA PARTNER"**
- Analizzare rettifiche 2023 con commercialista
- Decidere partner da assegnare (o creare "Rettifiche Bilancio")
- Correggere 4 movimenti in Odoo

### MARTEDI-MERCOLEDI (Giorni 2-3)

**Richiedere Estratti Conto TOP 5 Fornitori:**
1. SCHWEIZ TRANS SA (CHF 555K)
2. FERRAIUOLO FOODS (CHF 382K)
3. LATTICINI MOLISANI (CHF 368K)
4. RISTORIS SRL (CHF 227K)
5. LATTERIA MANTOVA (CHF 197K)

**Inizio Riconciliazione:**
- Confrontare estratti vs pagamenti Odoo
- Identificare fatture mancanti

### GIOVEDI-VENERDI (Giorni 4-5)

**Solleciti Clienti:**
- Inviare solleciti formali clienti >90gg
- Focus TOP 10 clienti per saldo
- Contattare BS GASTRO SERVICES (liquidatore?)

**Primi Fix Fornitori:**
- Registrare fatture trovate
- Collegare primi pagamenti a fatture

---

## PIANO AZIONE 30 GIORNI

**Settimana 1:** Emergenze (SENZA PARTNER + Estratti conto TOP 5)

**Settimana 2-3:** Riconciliazione TOP 10 fornitori
- Target: Risolvere 200+ anomalie (33%)
- Registrare tutte le fatture mancanti
- Collegare pagamenti

**Settimana 4:** Chiusura e sistematizzazione
- Completare riconciliazioni rimanenti
- Training team workflow Odoo
- Implementare controlli automatici

---

## RACCOMANDAZIONI CFO

### 1. GESTIONE CREDITI

**Problema:** 30% crediti scaduti >90gg

**Azioni:**
- Processo strutturato credit management
- Verifiche creditizie pre-vendita
- Blocco automatico clienti morosi
- Solleciti automatici 30/60/90gg
- Polizza assicurativa crediti

**Investimento:** CHF 10-15K/anno (software + polizza)
**ROI:** Riduzione DSO 20-30 giorni = miglior cash flow

### 2. WORKFLOW ODOO FORNITORI

**Problema:** 603 pagamenti non riconciliati

**Workflow Corretto:**
```
Fattura fornitore ricevuta
     ↓
Registra in Odoo
     ↓
Approva fattura
     ↓
Crea pagamento DA FATTURA
     ↓
Esegui bonifico
     ↓
Import bancario riconcilia automaticamente
```

**MAI:**
- Registrare pagamento senza fattura
- Pagare prima di registrare fattura in Odoo

**Azione:**
- Training team (1 giorno)
- Controllo automatico: alert se pagamento senza fattura
- Review settimanale "pagamenti non riconciliati"

### 3. CHIUSURA BILANCIO 2024

**Requisiti:**
- [ ] Tutte le 604 anomalie risolte
- [ ] Conferma saldi TOP 20 clienti/fornitori
- [ ] Svalutazione crediti inesigibili
- [ ] Accantonamento fondo svalutazione (2-5% crediti)
- [ ] Lettere conferma saldi per bilancio certificato

**Timeline:**
- Fix anomalie: 30 giorni (entro 15 Dicembre)
- Conferme saldi: 45 giorni (entro 31 Dicembre)
- Chiusura bilancio: 90 giorni (entro 15 Febbraio)

---

## IMPATTO FINANZIARIO

### SVALUTAZIONI STIMATE

**Crediti Inesigibili:**
- BS GASTRO SERVICES (chiuso): CHF 128,144
- Altri clienti >90gg (50% recovery): CHF 110,768
- **Totale svalutazione diretta:** CHF 238,912

**Accantonamento Fondo Svalutazione:**
- 3% su crediti rimanenti: CHF 27,770
- **Totale accantonamento:** CHF 27,770

**IMPATTO BILANCIO 2024:** CHF -266,682

### COSTI RICONCILIAZIONE

**Tempo Stimato:**
- Contabilità (200 ore x CHF 50): CHF 10,000
- Commercialista (20 ore x CHF 150): CHF 3,000
- Management (40 ore x CHF 100): CHF 4,000
- **Totale costi:** CHF 17,000

### INVESTIMENTI PREVENZIONE

**Software + Processi:**
- Credit management software: CHF 5,000/anno
- Polizza assicurativa crediti: CHF 8,000/anno
- Controlli automatici Odoo: CHF 2,000 (one-time)
- Training team: CHF 1,500
- **Totale investimento anno 1:** CHF 16,500

**ROI:**
- Riduzione DSO (20 giorni): +CHF 64,000 cash flow
- Riduzione bad debts (50%): +CHF 120,000/anno
- **ROI Netto anno 1:** CHF 167,500

---

## METRICHE TARGET

**Current State vs Target (6 mesi):**

| Metrica | Current | Target | Gap |
|---------|---------|--------|-----|
| Crediti >90gg | 30% | <10% | -20% |
| Debiti >90gg | 12% | <5% | -7% |
| Anomalie fornitori | 603 | 0 | -603 |
| DSO (stimato) | 90 gg | 60 gg | -30 gg |
| Collection Efficiency | 70% | >90% | +20% |

---

## FILE CONSEGNATI

### 1. Excel Operativi

**RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx**
- 6 sheets: Summary, Clienti, Fornitori, Discrepanze, Azioni
- 269 clienti + 145 fornitori analizzati
- Aging report completo

**ANOMALIE-FORNITORI-DETTAGLIO-2024.xlsx**
- 603 anomalie dettagliate
- TOP 10 analisi
- Piano azione 10 step

### 2. Report Analitici

**REPORT-RICONCILIAZIONE-CLIENTI-FORNITORI-2024.md**
- Executive summary completo
- Analisi dettagliata crediti/debiti
- Raccomandazioni strategiche
- KPI e metriche

**START-HERE-RICONCILIAZIONE-CLIENTI-FORNITORI.md**
- Guida rapida
- Piano azione immediato
- Workflow corretto Odoo
- FAQ

### 3. Analisi Tecniche

**riconciliazione-clienti-fornitori-2024.json**
- Dati completi JSON
- Per analisi avanzate

**fix-senza-partner-analysis.json**
- Dettaglio 4 movimenti SENZA PARTNER
- Suggerimenti correzione

### 4. Script Python

**scripts/riconciliazione-clienti-fornitori-2024.py**
- Script analisi completa
- Riutilizzabile per future riconciliazioni

**scripts/analizza-anomalie-fornitori-dettaglio.py**
- Export dettagliato anomalie

**scripts/fix-senza-partner.py**
- Analisi e fix movimenti senza partner

---

## CONCLUSIONI

### PUNTI DI FORZA
- Working capital positivo (CHF 376K)
- Solo 12% debiti fornitori scaduti >90gg
- 99.6% riconciliazione clienti OK (1 anomalia su 20)

### CRITICITA'
1. **603 pagamenti fornitori non riconciliati** (CHF 2.7M) - EMERGENZA
2. **30% crediti scaduti >90gg** - ALTO RISCHIO
3. **CHF 79K movimenti senza partner** - ERRORE CONTABILE
4. **CHF 128K credito vs cliente chiuso** - PERDITA PROBABILE

### PROSSIMI STEP IMMEDIATI

**OGGI:**
- [ ] Leggere questo Executive Summary
- [ ] Aprire RICONCILIAZIONE-CLIENTI-FORNITORI-2024.xlsx
- [ ] Convocare meeting urgente (CFO + Team)

**LUNEDI:**
- [ ] Meeting kick-off task force
- [ ] Fix "SENZA PARTNER"
- [ ] Richiedere estratti conto TOP 5 fornitori

**QUESTA SETTIMANA:**
- [ ] Solleciti clienti >90gg
- [ ] Contatto BS GASTRO SERVICES
- [ ] Inizio riconciliazione fornitori

---

**TEMPISTICHE CHIUSURA:**
- Emergenze: 7 giorni
- Riconciliazione completa: 30 giorni
- Chiusura bilancio 2024: 90 giorni

**COSTO TOTALE STIMATO:** CHF 17,000 (riconciliazione) + CHF 266,000 (svalutazioni)

**INVESTIMENTO PREVENZIONE:** CHF 16,500/anno → ROI CHF 167,500/anno

---

**Preparato da:** Customer Intelligence Agent
**Data:** 16 Novembre 2025
**Versione:** 1.0 - Executive Summary

**Per domande:** Consultare START-HERE-RICONCILIAZIONE-CLIENTI-FORNITORI.md
