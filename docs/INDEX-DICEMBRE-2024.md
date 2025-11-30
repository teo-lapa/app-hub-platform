# INDEX DICEMBRE 2024 - VERIFICA COMPLETA

**Analisi**: Verifica riga per riga movimenti dicembre 2024
**Konti**: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)
**Data**: 16 Novembre 2025

---

## START HERE

**Per executive/management**:
- Leggi: `DICEMBRE-2024-EXECUTIVE-SUMMARY.md`

**Per contabile/commercialista**:
- Leggi: `REPORT-DICEMBRE-2024.md`
- Controlla: `REPORT-DICEMBRE-2024.json` (dettaglio 605 righe)

**Per tecnico/developer**:
- Script: `scripts/analizza-dicembre-2024-dettaglio.py`
- Script: `scripts/elimina-movimento-azzeramento-1026.py`

---

## DOCUMENTI GENERATI

### Report Executivi
1. **DICEMBRE-2024-EXECUTIVE-SUMMARY.md** (5 min read)
   - TL;DR con i punti chiave
   - Saldi al 31/12/2024
   - Problema critico konto 1026 identificato
   - Azioni immediate

2. **REPORT-DICEMBRE-2024.md** (15 min read)
   - Analisi dettagliata per account
   - Pattern anomali identificati
   - Azioni immediate richieste
   - Prossimi step

### Dati Raw
3. **REPORT-DICEMBRE-2024.json** (354 KB)
   - Dettaglio completo 605 righe dicembre 2024
   - Include: date, move_id, description, debit, credit, partner, journal
   - Formato: JSON strutturato

4. **DUPLICATI-1026-ANALISI.json** (3 KB)
   - Analisi duplicati konto 1026
   - Risultato: solo 4 righe duplicate (CHF 5,301)
   - Irrilevanti rispetto al problema principale

5. **MOVIMENTO-AZZERAMENTO-2023.json** (2 KB)
   - Dettaglio movimento errato BNK3/2024/00867
   - CHF 132,834.54 DARE su konto 1026
   - Da eliminare

---

## SCRIPT PYTHON

### Analisi
1. **scripts/analizza-dicembre-2024-dettaglio.py**
   - Estrae tutte le righe dicembre 2024 da Odoo
   - Calcola saldi apertura/chiusura
   - Confronta con estratti bancari
   - Output: REPORT-DICEMBRE-2024.json

2. **scripts/trova-duplicati-1026.py**
   - Trova duplicati su konto 1026 anno 2024
   - Raggruppa per (data, descrizione, importo)
   - Output: DUPLICATI-1026-ANALISI.json

3. **scripts/analizza-saldo-apertura-1026.py**
   - Analizza evoluzione saldo konto 1026 per tutto il 2024
   - Identifica movimenti > CHF 50,000
   - Output: stampa console + identificazione problema

4. **scripts/dettaglio-movimento-azzeramento.py**
   - Dettaglio completo movimento BNK3/2024/00867
   - Output: MOVIMENTO-AZZERAMENTO-2023.json

### Azioni Correttive
5. **scripts/elimina-movimento-azzeramento-1026.py**
   - **CRITICO**: Elimina movimento errato move_id 58103
   - Richiede doppia conferma
   - ATTENZIONE: Non reversibile!
   - Impatto: Corregge saldo di CHF 132,834.54

6. **scripts/elimina-duplicati-1026.py** (auto-generato)
   - Elimina 4 righe duplicate (CHF 5,301)
   - Richiede conferma manuale

---

## FONTI DATI

### Estratti Bancari
- `data-estratti/UBS-CHF-2024-CLEAN.json`
  - Saldo 31/12/2024: CHF 182,573.56

- `data-estratti/UBS-EUR-2024-CLEAN.json`
  - Saldo 31/12/2024: EUR 128,860.70

- `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`
  - Saldo 31/12/2024: CHF 24,897.72
  - (somma di due sottoconti: 11,120.67 + 13,777.05)

### Odoo
- Database: `lapadevadmin-lapa-v2-main-7268478`
- URL: `https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com`
- Credenziali: in `.env.local`

---

## QUICK REFERENCE

### Saldi al 31/12/2024

| Konto | Nome | ODOO | BANCA | Diff |
|-------|------|------|-------|------|
| 1024 | UBS CHF | 133,750 | 182,574 | **-48,824** |
| 1025 | UBS EUR | 108,268 EUR | 128,861 EUR | **-20,593** |
| 1026 | Credit Suisse | 371,454 | 24,898 | **+346,556** |

### Movimento Errato da Eliminare

```
Move ID: 58103
Nome: BNK3/2024/00867
Data: 03/06/2024
Importo: CHF 132,834.54 DARE (konto 1026)
Contropartita: CHF 132,834.54 AVERE (konto 1021 Bank Suspense)
Descrizione: "azzeramento 2023"
```

### Comandi Quick

```bash
# Riesegui analisi dicembre
cd /path/to/app-hub-platform
python scripts/analizza-dicembre-2024-dettaglio.py

# Trova duplicati
python scripts/trova-duplicati-1026.py

# Analizza saldo apertura
python scripts/analizza-saldo-apertura-1026.py

# CRITICO: Elimina movimento errato
python scripts/elimina-movimento-azzeramento-1026.py
```

---

## TIMELINE

### Completato (16 Nov 2025)
- [x] Estrazione 605 righe dicembre 2024
- [x] Confronto con estratti bancari
- [x] Identificazione differenze
- [x] Analisi duplicati konto 1026
- [x] Identificazione movimento errato CHF 132,834
- [x] Generazione script eliminazione

### Da Fare (Immediato)
- [ ] Approvazione commercialista per eliminazione movimento
- [ ] Backup database Odoo
- [ ] Eseguire eliminazione movimento errato
- [ ] Verificare nuovo saldo konto 1026

### Da Fare (Questa settimana)
- [ ] Investigare rettifica apertura gennaio (+CHF 50,903)
- [ ] Analizzare movimenti DARE feb-apr (CHF 160,000)
- [ ] Estrarre CSV dicembre da portali UBS
- [ ] Confrontare e importare movimenti mancanti
- [ ] Riconciliare 50% righe

### Da Fare (Questo mese)
- [ ] Implementare dashboard riconciliazione
- [ ] Formare team su riconciliazione bancaria
- [ ] Audit completo 2024 tutti i konti
- [ ] Documentare procedure

---

## CONTATTI

**Analisi tecnica**: Backend Specialist
**Approvazioni contabili**: Commercialista
**Esecuzione script**: Admin Odoo

---

**Ultimo aggiornamento**: 16 Novembre 2025
**Versione**: 1.0
**Status**: ANALISI COMPLETATA - IN ATTESA APPROVAZIONE ELIMINAZIONE
