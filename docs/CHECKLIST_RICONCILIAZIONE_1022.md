# CHECKLIST OPERATIVA - Riconciliazione Account 1022

**Obiettivo:** Portare saldo Account 1022 a CHF 0.00 entro 18 Nov 2025
**Status Corrente:** Saldo CHF 253,735.59 - 204 righe non riconciliate

---

## FASE 1: PREPARAZIONE (15 Nov - Mattina) ✅

### Analisi Tecnica
- [x] Connessione Odoo XML-RPC funzionante
- [x] Scripts Python creati (6 scripts)
- [x] Report Excel generato
- [x] Analisi movimenti grandi completata
- [x] Documentazione completa creata

### Identificazione Problema
- [x] Movimento critico identificato: "Ricorrente merenda69" (CHF 182,651)
- [x] Top 15 movimenti identificati (96% del problema)
- [x] Root cause analysis completata
- [x] Strategia 80/20 definita

---

## FASE 2: DECISIONI (15 Nov - Pomeriggio) ⏳

### Comunicazioni Richieste

#### 1. Email Commercialista ⏳
- [ ] Inviata email con finding merenda69
- [ ] Allegato: SUMMARY_RICONCILIAZIONE_1022.md
- [ ] Allegato: reconciliation-report Excel
- [ ] Richiesta: Decisione entro EOD 15 Nov

**Template Email:**
```
Subject: URGENTE - Account 1022 Riconciliazione - Blocco Critico

Gentile Commercialista,

Abbiamo completato l'analisi della riconciliazione Account 1022.

SITUAZIONE:
- Saldo non riconciliato: CHF 253,735.59
- Righe da riconciliare: 204

PROBLEMA CRITICO IDENTIFICATO:
Movimento "Ricorrente merenda69"
- Data: 31/12/2023
- Importo: CHF 182,651.03 (72% del totale!)
- Partner: Nessuno
- Natura: Ricorrente automatico

Questo movimento blocca la chiusura bilancio.

RICHIESTA URGENTE:
Può indicarci come procedere entro oggi?

Opzioni:
1. Riconciliazione con contropartite specifiche
2. Storno e riallocazione
3. Altro (sua raccomandazione)

Allegati: Documentazione completa analisi

Disponibili per call urgente.

Cordiali saluti,
Team Lapa
```

#### 2. Meeting Interno Team ⏳
- [ ] Schedulato meeting 1 ora
- [ ] Partecipanti: Accounting + IT + Paul
- [ ] Agenda preparata
- [ ] Responsabilità assegnate

**Agenda Meeting:**
```
1. Review SUMMARY (10 min)
2. Spiegazione movimento merenda69 (10 min)
3. Demo scripts funzionamento (15 min)
4. Assignment tasks (15 min)
5. Q&A (10 min)
```

### Decisioni da Prendere

#### Decisione A: Movimento merenda69
- [ ] Riconciliare con contropartite?
- [ ] Stornare?
- [ ] Mantenere e spiegare?
- [ ] Altro?

**Responsabile:** Commercialista
**Deadline:** 15 Nov EOD

#### Decisione B: Righe con amount < CHF 1
- [ ] Riconciliare con write-off?
- [ ] Ignorare (non materiali)?
- [ ] Eliminare?

**Responsabile:** CFO/Paul
**Deadline:** 16 Nov

#### Decisione C: Cleanup righe zero (194 righe)
- [ ] Approvata eliminazione?
- [ ] Richiedono correzione?
- [ ] Lasciare come sono?

**Responsabile:** Commercialista
**Deadline:** 16 Nov

---

## FASE 3: ESECUZIONE TOP 15 (16 Nov) ⏳

### Pre-requisiti
- [ ] Movimento merenda69 risolto
- [ ] Decisioni approvate
- [ ] Team Accounting disponibile (4-5 ore)

### Azioni Operative

#### 1. Risoluzione Merenda69 ⏳
Metodo dipende da decisione commercialista.

**Opzione A: Riconciliazione Manuale**
- [ ] Identificate contropartite
- [ ] Create riconciliazioni in Odoo
- [ ] Verificato saldo

**Opzione B: Storno**
- [ ] Move set to draft
- [ ] Move deleted
- [ ] Verificato impatto su balance

**Opzione C: Altro**
- [ ] [Da definire basato su decisione]

**Tempo stimato:** 1-2 ore
**Responsabile:** Accounting Team + IT support

#### 2. Riconciliazione Top 15 (escl. merenda69) ⏳

**Setup:**
```bash
cd C:\Users\lapa\Desktop\Claude Code\app-hub-platform
python scripts/manual-reconcile-top15.py
```

**Per ogni payment (14 payments):**
- [ ] #2 - CASA COSI GMBH (CHF 37,606.31)
- [ ] #3 - HALTEN GASTRO GMBH (CHF 26,159.47)
- [ ] #4 - HALTEN GASTRO GMBH (CHF 24,807.77)
- [ ] #5 - CAMILLA AG (CHF 24,277.51)
- [ ] #6 - HALTEN GASTRO GMBH (CHF 18,337.43)
- [ ] #7 - CAMILLA AG OPFIKON (CHF 16,743.54)
- [ ] #8 - CUMANO SA (CHF 16,582.35)
- [ ] #9 - ADALBIRO SA (CHF 16,383.73)
- [ ] #10 - BMW Finanzdienstleistungen (CHF 15,000.00)
- [ ] #11 - TREBELLICO SA (CHF 14,724.18)
- [ ] #12 - CUMANO SA (CHF 12,967.02)
- [ ] #13 - AGINULFO SA (CHF 12,683.66)
- [ ] #14 - ADALBIRO SA (CHF 12,096.60)
- [ ] #15 - FILOMENO SA (CHF 11,906.44)

**Tempo stimato:** 15-20 min per payment = 4-5 ore totale
**Responsabile:** Accounting Team

#### 3. Verifica Parziale ⏳
```bash
python scripts/find-large-movements-1022.py
```

- [ ] Verificato che Top 15 sono riconciliati
- [ ] Verificato saldo rimanente
- [ ] Documentato eventuali problemi

**Saldo atteso dopo questa fase:** ~CHF 4,000
**Responsabile:** Accounting Team

---

## FASE 4: CLEANUP FINALE (18 Nov) ⏳

### Righe Rimanenti (~50-60 righe piccole)

#### 1. Riconciliazione Batch Automatica ⏳

**Condizioni:**
- Amount match >99%
- Partner match esatto
- Invoice residual match

```bash
# Se implementato script batch
python scripts/reconcile-remaining.py --auto-match --threshold 0.99
```

**Stima righe auto-riconciliate:** 20-30
**Tempo:** 30 min
**Responsabile:** IT + Accounting

#### 2. Riconciliazione Manuale Rimanenti ⏳

Per righe che non matchano automaticamente:

- [ ] Verifica partner
- [ ] Cerca invoice manualmente in Odoo
- [ ] Riconcilia in UI Odoo
- [ ] Documenta se non trovato match

**Tempo stimato:** 2-3 ore
**Responsabile:** Accounting Team

#### 3. Gestione Casi Speciali ⏳

**Micro-importi (<CHF 1) - 43 righe**
- [ ] Decisione: Write-off / Ignore / Reconcile
- [ ] Eseguita azione scelta
- [ ] Documentato

**Pagamenti senza partner - ~10 righe**
- [ ] Investigate manualmente
- [ ] Identifica partner corretto
- [ ] Riconcilia o write-off

**Clienti chiusi/inattivi - ~5 righe**
- [ ] Verifica stato cliente
- [ ] Write-off se non recuperabile
- [ ] Documenta per audit

---

## FASE 5: VERIFICA FINALE (18 Nov EOD) ⏳

### Controlli Finali

#### 1. Verifica Saldo ⏳
```bash
python scripts/find-large-movements-1022.py
```

**Checklist:**
- [ ] Balance = CHF 0.00 (o <CHF 1 se micro-diff)
- [ ] Remaining unreconciled lines = 0 (o solo immateriali)
- [ ] Nessun movimento anomalo rimasto

#### 2. Documentazione ⏳
- [ ] Excel report finale generato
- [ ] Lista riconciliazioni eseguite
- [ ] Screenshot saldo finale = 0
- [ ] Note per commercialista su eccezioni

#### 3. Review Finale ⏳
- [ ] Review da Accounting Manager
- [ ] Review da CFO/Paul
- [ ] Approvazione commercialista

#### 4. Comunicazione Completamento ⏳
```
Subject: COMPLETATO - Account 1022 Riconciliato

Gentile Commercialista,

Riconciliazione Account 1022 completata con successo.

RISULTATI:
- Saldo finale: CHF 0.00
- Righe riconciliate: 204/204
- Movimento merenda69: [Risolto con metodo X]

DETTAGLI:
- Riconciliazioni automatiche: X
- Riconciliazioni manuali: Y
- Write-offs approvati: Z (totale CHF...)

DOCUMENTAZIONE ALLEGATA:
- Excel report finale
- Screenshot saldo
- Note su eccezioni

Può procedere con chiusura bilancio.

Cordiali saluti,
Team Lapa
```

---

## BACKUP E SICUREZZA

### Prima di Ogni Operazione Critica

#### Backup Manuale Odoo
- [ ] Snapshot database pre-riconciliazione
- [ ] Export account.move.line per Account 1022
- [ ] Salvato in location sicura

#### Script Backups Automatici
Gli script creano backup automatici:
- [ ] cleanup-zero-payments.py → backup-zero-payments-*.json
- [ ] Tutti i backup salvati e verificati

### Rollback Plan

Se qualcosa va male:

**Rollback Singola Riconciliazione:**
1. Trova righe riconciliate in Odoo
2. Click "Remove matching"
3. Verifica saldo ripristinato

**Rollback Completo:**
1. Restore database snapshot
2. Re-execute solo operazioni verificate
3. Document lesson learned

---

## TROUBLESHOOTING COMMON ISSUES

### Issue: Script timeout
**Soluzione:** Aumentare timeout parameter a 600000 (10 min)

### Issue: "No matching invoice found"
**Soluzione:** Search manualmente in Odoo, potrebbe essere:
- Invoice già pagata e riconciliata
- Invoice in stato draft
- Amount mismatch per arrotondamenti
- Partner errato

### Issue: "Reconciliation failed - lines already reconciled"
**Soluzione:** Refresh dati, qualcun altro potrebbe aver già riconciliato

### Issue: Script dice "Authentication failed"
**Soluzione:** Verifica credenziali, potrebbe essere password scaduta

---

## METRICHE DI SUCCESSO

### KPI Principali
- [ ] Saldo Account 1022 = CHF 0.00
- [ ] 100% righe riconciliate o giustificate
- [ ] Commercialista approva chiusura

### KPI Secondari
- [ ] Tempo totale <8 ore
- [ ] Nessun errore critico
- [ ] Documentazione completa
- [ ] Team training completato

---

## LESSONS LEARNED (da completare post-execution)

### Cosa ha funzionato bene
- [ ] [Da documentare]

### Cosa migliorare
- [ ] [Da documentare]

### Azioni preventive future
- [ ] Setup riconciliazione automatica periodica
- [ ] Monitoring dashboard Account 1022
- [ ] Training team su import bancari
- [ ] Review configurazione payment journals

---

## FIRME APPROVAZIONI

| Ruolo | Nome | Data | Firma |
|-------|------|------|-------|
| Commercialista | | | |
| CFO | Paul | | |
| Accounting Manager | | | |
| IT Manager | | | |

---

## TIMELINE SUMMARY

```
15 Nov AM:  ✅ Analisi + Scripts + Reports
15 Nov PM:  ⏳ Email commercialista + Decisioni
16 Nov:     ⏳ Risolvi merenda69 + Top 15 (6-7 ore)
18 Nov AM:  ⏳ Cleanup finale (3 ore)
18 Nov PM:  ⏳ Verifica + Documentazione (2 ore)
18 Nov EOD: 🎯 SALDO = CHF 0.00
```

---

**STATO CORRENTE:** ✅ READY FOR EXECUTION
**NEXT ACTION:** Email commercialista + Meeting team
**DEADLINE:** 18 Nov 2025 EOD

---

**Document:** CHECKLIST_RICONCILIAZIONE_1022.md
**Version:** 1.0
**Created:** 2025-11-15 20:00
**Author:** Odoo Integration Master
