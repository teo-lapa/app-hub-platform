# ANALISI CONTO 1001 CASH - REPORT FINALE

**Data Analisi:** 15 Novembre 2025
**Analista:** Odoo Data Modeler
**Cliente:** LAPA GmbH
**Database Odoo:** lapadevadmin-lapa-v2-staging-2406-25408900

---

## EXECUTIVE SUMMARY

### Situazione Attuale
- **Saldo Conto 1001 Cash in Odoo:** CHF 386,336.67
- **Numero movimenti:** 1,062 (non 498 come inizialmente comunicato)
- **Periodo:** 2023-2025

### Problema Identificato
Il saldo del conto Cash risulta **eccessivamente elevato** a causa di:

1. **Due rettifiche manuali non documentate** per un totale di **CHF 174,290.26**
2. **Tre gruppi di movimenti duplicati** per un totale di **CHF 783.72**

### Saldo Corretto Stimato
Dopo le rettifiche proposte: **CHF 211,262.69**

---

## ANALISI DETTAGLIATA

### 1. RETTIFICHE SOSPETTE (PROBLEMA PRINCIPALE)

#### Rettifica 1: 31 Dicembre 2023
- **ID Movimento:** 525905
- **Descrizione:** "Rettifica Cash da 21.396,03 a 109.280,46"
- **Importo:** CHF 87,884.43
- **Giornale:** Miscellaneous Operations
- **Tipo:** Movimento Dare (aumenta il saldo Cash)

**Osservazioni:**
- Rettifica manuale significativa effettuata a fine anno
- Nessuna documentazione giustificativa visibile
- Potrebbe essere un errore di migrazione dati 2023

#### Rettifica 2: 31 Gennaio 2024
- **ID Movimento:** 525812
- **Descrizione:** "Rettifica in aumento saldo 1000 - Cash"
- **Importo:** CHF 86,405.83
- **Giornale:** Rettifiche Chiusura 2023
- **Tipo:** Movimento Dare (aumenta il saldo Cash)

**Osservazioni:**
- Seconda rettifica di importo elevato nel mese successivo
- Descrizione generica senza riferimenti
- Conferma con commercialista necessaria per: "Ein so hoher Bargeldbestand ist surreal"

**TOTALE RETTIFICHE:** CHF 174,290.26 (45.1% del saldo attuale!)

---

### 2. MOVIMENTI DUPLICATI

#### Duplicato 1: Deposito Nuraghets (01.10.2025)
- **IDs:** 523317, 522654
- **Descrizione:** "Deposito - Rusu stefan → Nuraghets"
- **Partner:** NURAGHES PIZZA & CATERING EMANUELE CROBE
- **Importo:** CHF 400.00
- **Occorrenze:** 2 volte
- **Impatto:** CHF 400.00 da stornare

#### Duplicato 2: Ordine DL Services (13.02.2024)
- **IDs:** 234764, 234762
- **Descrizione:** "Ordine 02030-003-0006"
- **Partner:** DL SERVICES GMBH
- **Importo:** CHF 174.25
- **Occorrenze:** 2 volte
- **Impatto:** CHF 174.25 da stornare

#### Duplicato 3: Ordine Emma's Cafe (13.01.2024)
- **IDs:** 503096, 115978
- **Descrizione:** "Ordine 02611-001-0001"
- **Partner:** EMMA'S CAFE' GMBH
- **Importo:** CHF 209.47
- **Occorrenze:** 2 volte
- **Impatto:** CHF 209.47 da stornare

**TOTALE DUPLICATI:** CHF 783.72

---

### 3. MOVIMENTI SU GIORNALI NON-CASSA

Alcuni movimenti sono stati registrati su giornali inappropriati per un conto Cash:

| Giornale | Movimenti | Saldo |
|----------|-----------|-------|
| Miscellaneous Operations | 1 | CHF 87,884.43 |
| Rettifiche Chiusura 2023 | 1 | CHF 86,405.83 |
| UBS EUR 08760A (EUR) | 2 | CHF -0.20 |

**Nota:** Le prime due righe coincidono con le rettifiche sospette identificate.

---

### 4. ANALISI TEMPORALE

| Anno | Movimenti | Saldo |
|------|-----------|-------|
| 2023 | 114 | CHF 109,280.46 |
| 2024 | 384 | CHF 177,300.05 |
| 2025 | 564 | CHF 99,756.16 |

**Osservazione:** Il 2023 mostra un saldo insolitamente alto (109K) dovuto principalmente alla rettifica del 31.12.2023.

---

## PROPOSTE DI RETTIFICA

### Rettifica 1: Storno Rettifica 31.12.2023
```
Data: 15.11.2025
Descrizione: Storno Rettifica Cash 31.12.2023
Giustificazione: Storno rettifica manuale non documentata

Dare:  3900 (Changes in inventories)  CHF 87,884.43
Avere: 1001 (Cash)                    CHF 87,884.43
```

### Rettifica 2: Storno Rettifica 31.01.2024
```
Data: 15.11.2025
Descrizione: Storno Rettifica Cash 31.01.2024
Giustificazione: Storno rettifica manuale non documentata

Dare:  3900 (Changes in inventories)  CHF 86,405.83
Avere: 1001 (Cash)                    CHF 86,405.83
```

### Rettifiche 3-5: Storno Duplicati
```
Data: 15.11.2025
Descrizione: Storno movimenti duplicati (3 gruppi)
Giustificazione: Eliminazione doppi inserimenti

Totale da stornare: CHF 783.72
```

---

## CALCOLO SALDO CORRETTO

```
Saldo attuale Odoo:           CHF 386,336.67
Correzione duplicati:         CHF    -783.72
Correzione rettifiche:        CHF -174,290.26
─────────────────────────────────────────────
SALDO CORRETTO STIMATO:       CHF 211,262.69
```

---

## RACCOMANDAZIONI

### IMMEDIATE (Prima di procedere)

1. **Verificare con commercialista:**
   - Esistono documenti giustificativi per le rettifiche del 31.12.2023 e 31.01.2024?
   - Le rettifiche erano realmente necessarie?
   - Qual è il conto di contropartita corretto per gli storni?

2. **Analizzare la migrazione 2023:**
   - Rivedere il processo di migrazione dati
   - Verificare se altre rettifiche simili sono presenti in altri conti

3. **Confermare i duplicati:**
   - Verificare manualmente i 3 gruppi di movimenti duplicati
   - Controllare i documenti fonte (fatture, ricevute)

### MEDIO TERMINE (Dopo rettifiche)

4. **Implementare controlli:**
   - Bloccare creazione rettifiche manuali senza workflow approvativo
   - Implementare alert per movimenti Cash > CHF 10,000
   - Creare report mensile anomalie Cash

5. **Riconciliazione Cash:**
   - Dopo le rettifiche, riconciliare il saldo con la cassa fisica
   - Implementare conteggi cassa giornalieri

6. **Documentazione:**
   - Ogni rettifica futura deve avere documento giustificativo allegato
   - Implementare campo obbligatorio "Motivo rettifica"

---

## FILE GENERATI

1. **report-conto-1001-cash.json**
   Report completo con tutti i 1,062 movimenti

2. **movimenti-1001-cash.csv**
   Export CSV per analisi in Excel

3. **REPORT_COMMERCIALISTA_CONTO_1001.json**
   Report strutturato per commercialista

4. **RETTIFICHE_1001_PREPARATE.json**
   Registrazioni di rettifica pronte per esecuzione (dopo approvazione)

---

## ISTRUZIONI PER IL COMMERCIALISTA

### Revisione
1. Aprire il file `RETTIFICHE_1001_PREPARATE.json`
2. Verificare le rettifiche proposte
3. Confermare o modificare il conto di contropartita (attualmente: 3900)
4. Verificare che le date siano corrette

### Approvazione
Se le rettifiche sono approvate:
1. Comunicare l'approvazione scritta
2. Specificare eventuali modifiche necessarie
3. Il team tecnico procederà con l'esecuzione

### Esecuzione
```bash
# Dopo approvazione del commercialista:
node scripts/crea-rettifiche-1001.js execute
```

**ATTENZIONE:** Non eseguire senza approvazione esplicita!

---

## CONTATTI

**Odoo Data Modeler**
Email: [da specificare]
Data Report: 15 Novembre 2025

---

## APPENDICE: QUERY SQL EQUIVALENTI

Per verificare i dati direttamente nel database:

```sql
-- Saldo attuale conto 1001
SELECT
    aa.code,
    aa.name,
    SUM(aml.debit) as total_debit,
    SUM(aml.credit) as total_credit,
    SUM(aml.debit) - SUM(aml.credit) as balance
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code = '1001'
GROUP BY aa.code, aa.name;

-- Movimenti con importo > 50,000
SELECT
    aml.id,
    aml.date,
    aml.name,
    aml.debit,
    aml.credit,
    aj.name as journal
FROM account_move_line aml
JOIN account_journal aj ON aml.journal_id = aj.id
WHERE aml.account_id = (SELECT id FROM account_account WHERE code = '1001')
AND (aml.debit > 50000 OR aml.credit > 50000)
ORDER BY aml.date DESC;

-- Possibili duplicati
SELECT
    date,
    partner_id,
    debit,
    credit,
    COUNT(*) as occorrenze,
    STRING_AGG(id::text, ', ') as ids
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '1001')
GROUP BY date, partner_id, debit, credit
HAVING COUNT(*) > 1;
```

---

**FINE REPORT**
