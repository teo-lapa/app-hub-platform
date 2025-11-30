# REPORT ANALISI KONTO 1024 UBS CHF
## Commercialista Svizzero - Verifica Riga per Riga

**Data Analisi**: 2025-11-16
**Account**: 1024 UBS CHF (ID: 176)
**Odoo Environment**: Staging

---

## EXECUTIVE SUMMARY

### Gap Critico Identificato

```
Saldo Atteso (Odoo):      CHF  182,573.56
Saldo Calcolato (Actual): CHF  138,711.90
----------------------------------------------
GAP:                      CHF  -43,861.66 (-24.02%)
```

**ALERT CRITICO**: Mancano CHF 43,861.66 nel konto 1024 UBS CHF.
Il saldo contabile non corrisponde alla realtà.

---

## STATISTICHE ANALISI

### Volume Dati Analizzati
- **Totale Righe Analizzate**: 8,177 righe
- **Periodo**: 2023-07-01 → 2025-11-10
- **Righe Posted**: 8,122 (99.33%)
- **Righe Draft**: 51 (0.62%)

### Anomalie Rilevate
- **Totale Anomalie**: 610
  - **CRITICHE**: 0
  - **ALTE**: 112 (18.36%)
  - **MEDIE**: 495 (81.15%)
  - **BASSE**: 3 (0.49%)

- **Righe con Anomalie**: 545/8,177 (6.67%)

---

## ANOMALIE PRINCIPALI

### 1. RIGHE DUPLICATE (61 gruppi)

**Severità**: ALTA
**Impatto**: Possibili doppi inserimenti che gonfiano importi

**Esempi Critici**:
- **2024-07-11**: 4 righe duplicate - CHF 603.30 (credit) ciascuna
  - Possibile quadruplo inserimento: CHF 2,413.20 in eccesso

- **2024-08-03**: 5 righe duplicate - CHF 120.66 (debit) ciascuna
  - Possibile quintuplo inserimento: CHF 603.30 in eccesso

- **2023-12-27**: 4 righe duplicate - CHF 42.11 (debit) ciascuna
  - Possibile quadruplo inserimento: CHF 168.44 in eccesso

**Totale gruppi duplicati**: 61
- Maggior parte: 2 righe duplicate
- Casi estremi: fino a 5 righe con stessi valori

**Azione Richiesta**: Verificare ogni gruppo e eliminare duplicati veri.

---

### 2. PARTNER MANCANTE SU IMPORTI ALTI (495 righe)

**Severità**: MEDIA
**Impatto**: Impossibile tracciare controparte su transazioni significative

**Esempi più Critici**:

| Riga ID | Data       | Importo (CHF) | Tipo   | Descrizione |
|---------|------------|---------------|--------|-------------|
| 172809  | 2023-08-31 | 144,564.00    | Credit | Partner mancante |
| 172813  | 2023-10-31 | 145,471.50    | Credit | Partner mancante |
| 172815  | 2023-11-30 | 143,124.75    | Credit | Partner mancante |
| 172811  | 2023-09-30 | 144,805.50    | Credit | Partner mancante |
| 172804  | 2023-07-31 | 96,734.60     | Credit | Partner mancante |

**Totale importi senza partner > CHF 1,000**: Oltre CHF 1,500,000

**Pattern Identificato**:
- Molte righe con importi > CHF 100,000 senza partner
- Principalmente su CREDIT (uscite di cassa)
- Date concentrate su fine mese (31/30)

**Azione Richiesta**: Assegnare partner a tutte le transazioni > CHF 1,000.

---

### 3. RIGHE IN STATO DRAFT (51 righe)

**Severità**: ALTA
**Impatto**: Righe non contabilizzate ufficialmente

**Problema**:
- 51 righe (0.62%) sono ancora in stato DRAFT
- Le righe draft NON dovrebbero esistere in contabilità chiusa
- Possono contribuire al gap di CHF 43,861.66

**Azione Richiesta**:
1. Verificare ogni riga draft
2. POSTARE se valide
3. ELIMINARE se errori

---

### 4. RIGHE CON IMPORTO ZERO (4 righe)

**Severità**: MEDIA (bassa priorità)
**Impatto**: Sporcano i report ma non influenzano saldo

**Righe Identificate**:
- Riga ID 308583
- (altre 3 righe)

**Azione Richiesta**: Eliminare per pulizia contabile.

---

### 5. DESCRIZIONI VUOTE (2 righe)

**Severità**: BASSA
**Impatto**: Difficoltà tracciabilità

**Righe Identificate**:
- Riga ID 28300
- Riga ID 9817

**Azione Richiesta**: Aggiungere descrizione sensata.

---

## ANALISI GAP: CHF -43,861.66

### Possibili Cause del Gap

1. **Righe Draft Non Posted (51 righe)**
   - Se queste righe non sono contabilizzate, possono spiegare parte del gap
   - Necessario verificare importo totale righe draft

2. **Duplicati Non Risolti (61 gruppi)**
   - Doppi/tripli/quadrupli inserimenti gonf iano artificialmente il saldo
   - Stima impatto: CHF 5,000-10,000 potenziali

3. **Transazioni Mancanti**
   - Possibili transazioni bancarie non registrate in Odoo
   - Necessario confronto con estratto conto UBS reale

4. **Errori di Data Entry**
   - Importi inseriti male (es. 1,000 invece di 10,000)
   - Partner mancanti potrebbero nascondere errori più gravi

### Verifica Necessaria

Per risolvere il gap, serve:

1. **Confronto con Estratto Conto UBS**
   - Saldo effettivo UBS al 2025-11-16
   - Riconciliazione bancaria completa

2. **Analisi Righe Draft**
   - Sommare importi righe draft
   - Verificare se posting risolverebbe gap

3. **Eliminazione Duplicati**
   - Identificare duplicati veri
   - Calcolare impatto sulla differenza

---

## RACCOMANDAZIONI PRIORITÀ

### PRIORITÀ 1 - CRITICA (Immediata)

**1. Risolvere Gap CHF -43,861.66**
- Confrontare con estratto conto UBS reale
- Identificare transazioni mancanti o in eccesso
- Verificare se righe draft (51) contribuiscono al gap

**2. Postare o Eliminare 51 Righe Draft**
- Ogni riga draft deve essere posted O eliminata
- NON possono rimanere draft in contabilità chiusa
- Verificare autorizzazione per ogni riga

**3. Risolvere Duplicati Critici**
- Priorità: gruppi con 3+ righe duplicate
- Focus su importi > CHF 100
- Verificare move_id e data per confermare duplicazione

### PRIORITÀ 2 - ALTA (Entro 7 giorni)

**4. Assegnare Partner a Transazioni > CHF 10,000**
- 495 righe senza partner
- Focus su importi > CHF 10,000 (circa 50 righe)
- Migliorare tracciabilità finanziaria

**5. Verificare Tutti i Duplicati (61 gruppi)**
- Anche duplicati di CHF 40-50 vanno verificati
- Potrebbero sommarsi a importo significativo

### PRIORITÀ 3 - MEDIA (Entro 30 giorni)

**6. Pulizia Contabile**
- Eliminare 4 righe con importo zero
- Aggiungere descrizioni alle 2 righe vuote
- Assegnare partner a tutte le righe > CHF 1,000

### PRIORITÀ 4 - BASSA (Maintenance)

**7. Ri-eseguire Analisi Post-Correzioni**
- Dopo ogni correzione, ri-verificare saldo
- Monitorare chiusura gap
- Documentare ogni azione correttiva

---

## ISTRUZIONI OPERATIVE

### Come Risolvere i Duplicati

```sql
-- Esempio: Trovare duplicati per una data specifica
SELECT id, date, debit, credit, name, move_id
FROM account_move_line
WHERE account_id = 176
  AND date = '2024-07-11'
  AND credit = 603.30
ORDER BY id;

-- Verificare move_id: se stesso move_id = duplicato vero
-- Se move_id diversi = transazioni distinte (OK)
```

### Come Postare Righe Draft

1. Aprire Odoo → Accounting → Journal Entries
2. Filtrare: `Account = 1024` AND `State = Draft`
3. Per ogni riga:
   - Verificare correttezza dati
   - Se OK: Click "Post"
   - Se KO: Click "Delete"

### Come Assegnare Partner

1. Aprire riga contabile
2. Campo "Partner": selezionare controparte corretta
3. Salvare

---

## FILE GENERATI

- **Report JSON Completo**: `report-konto-1024-20251116-174925.json`
  - Contiene TUTTE le 610 anomalie
  - Sample saldo progressivo (prime 10 + ultime 10 righe)

- **Report Esecutivo**: `REPORT-KONTO-1024-UBS-CHF-ANALISI.md` (questo file)

---

## PROSSIMI PASSI

1. **Immediato (Oggi)**:
   - Condividere questo report con team contabilità
   - Richiedere estratto conto UBS aggiornato
   - Verificare saldo reale vs. CHF 182,573.56

2. **Settimana 1**:
   - Postare/eliminare 51 righe draft
   - Risolvere top 10 gruppi duplicati
   - Assegnare partner a top 20 transazioni senza partner

3. **Settimana 2-4**:
   - Completare risoluzione duplicati
   - Assegnare tutti i partner mancanti
   - Pulizia contabile (righe zero, descrizioni)

4. **Follow-up**:
   - Ri-eseguire questo script di analisi
   - Verificare gap risolto
   - Documentare cause gap per prevenzione futura

---

## CONTATTI

Per domande su questo report:
- **Backend Specialist** - Analisi tecnica Odoo
- **Team Contabilità** - Correzioni contabili
- **Commercialista** - Validazione fiscale

---

**Report Generato da**: Backend Specialist
**Tool**: Python XML-RPC Odoo Analysis
**Versione Script**: `analisi-konto-1024-ubs-chf.py`
**Data**: 2025-11-16 17:49:25

---

## DISCLAIMER

Questo report si basa sui dati presenti in Odoo Staging al momento dell'analisi.
Per decisioni fiscali o legali, consultare sempre il commercialista ufficiale.

**IMPORTANTE**: Il gap di CHF -43,861.66 richiede IMMEDIATA attenzione e riconciliazione con banca.
