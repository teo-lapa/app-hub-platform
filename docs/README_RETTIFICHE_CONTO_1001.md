# RETTIFICHE CONTO 1001 CASH - GUIDA COMPLETA

## STATO ATTUALE

- **Analisi completata:** 15 Novembre 2025
- **Saldo attuale Odoo:** CHF 386,336.67
- **Saldo corretto stimato:** CHF 211,262.69
- **Differenza da correggere:** CHF 175,073.98

## FILE GENERATI

### 1. Analisi e Dati
- `report-conto-1001-cash.json` - Report completo con tutti i 1,062 movimenti
- `movimenti-1001-cash.csv` - Export CSV per analisi Excel
- `REPORT_COMMERCIALISTA_CONTO_1001.json` - Report strutturato
- `REPORT_FINALE_CONTO_1001_CASH.md` - Documento completo per commercialista

### 2. Rettifiche
- `RETTIFICHE_1001_PREPARATE.json` - Registrazioni pronte per esecuzione
- `CHECKLIST_COMMERCIALISTA_1001.txt` - Checklist approvazione

### 3. Script
- `scripts/analisi-conto-1001-cash.js` - Script analisi iniziale
- `scripts/analisi-approfondita-1001.js` - Analisi dettagliata
- `scripts/crea-rettifiche-1001.js` - Creazione rettifiche
- `scripts/verifica-pre-rettifica-1001.js` - Verifica pre-esecuzione

## PROBLEMI IDENTIFICATI

### 1. Rettifiche Sospette (CHF 174,290.26)

#### Rettifica A: 31.12.2023
- **Importo:** CHF 87,884.43
- **ID:** 525905
- **Descrizione:** "Rettifica Cash da 21.396,03 a 109.280,46"
- **Giornale:** Miscellaneous Operations
- **Problema:** Rettifica manuale senza documentazione chiara

#### Rettifica B: 31.01.2024
- **Importo:** CHF 86,405.83
- **ID:** 525812
- **Descrizione:** "Rettifica in aumento saldo 1000 - Cash"
- **Giornale:** Rettifiche Chiusura 2023
- **Problema:** Altra rettifica manuale senza giustificazione

### 2. Duplicati (CHF 783.72)

- Deposito Nuraghets 01.10.2025: CHF 400.00
- Ordine DL Services 13.02.2024: CHF 174.25
- Ordine Emma's Cafe 13.01.2024: CHF 209.47

## PROCEDURA DI ESECUZIONE

### FASE 1: VERIFICA (COMPLETATA)

```bash
node scripts/verifica-pre-rettifica-1001.js
```

Risultato:
- Movimenti originali: OK
- Saldo attuale: OK
- Conti destinazione: OK
- Giornale: OK
- Simulazione saldo: OK

### FASE 2: APPROVAZIONE COMMERCIALISTA (IN CORSO)

1. Inviare i seguenti documenti al commercialista:
   - `REPORT_FINALE_CONTO_1001_CASH.md`
   - `CHECKLIST_COMMERCIALISTA_1001.txt`
   - `movimenti-1001-cash.csv`

2. Il commercialista deve verificare:
   - Esistenza documenti giustificativi per le due rettifiche
   - Conferma conto di contropartita (3900)
   - Verifica manuale duplicati
   - Approvazione saldo finale

3. Ottenere approvazione scritta firmata

### FASE 3: ESECUZIONE RETTIFICHE (DOPO APPROVAZIONE)

**IMPORTANTE: Eseguire solo dopo approvazione scritta del commercialista!**

```bash
node scripts/crea-rettifiche-1001.js execute
```

Questo script creerà 5 registrazioni contabili:
1. Storno rettifica 31.12.2023 (CHF 87,884.43)
2. Storno rettifica 31.01.2024 (CHF 86,405.83)
3. Storno duplicato Nuraghets (CHF 400.00)
4. Storno duplicato DL Services (CHF 174.25)
5. Storno duplicato Emma's Cafe (CHF 209.47)

### FASE 4: VERIFICA POST-RETTIFICA

Dopo l'esecuzione:

1. Verificare il nuovo saldo del conto 1001 in Odoo
2. Dovrebbe essere: CHF 211,262.69
3. Generare report per commercialista
4. Riconciliare con cassa fisica

## REGISTRAZIONI CONTABILI

Ogni rettifica avrà questa struttura:

```
Data: 15.11.2025
Giornale: Miscellaneous Operations (MISC)

Dare:  3900 (Changes in inventories)  CHF XXX.XX
Avere: 1001 (Cash)                    CHF XXX.XX

Descrizione: [Specifica per ogni rettifica]
```

## SICUREZZA

### Protezioni Implementate

1. **Modalità preparazione:** Le rettifiche vengono prima preparate e salvate in JSON
2. **Verifica pre-esecuzione:** Script di validazione obbligatorio
3. **Approvazione manuale:** Esecuzione disabilitata senza decommentare codice
4. **Checklist commercialista:** Documento formale di approvazione
5. **Backup dati:** Tutti i movimenti originali salvati in CSV/JSON

### Rollback

Se necessario fare rollback dopo l'esecuzione:

1. Identificare gli IDs delle registrazioni create
2. Creare registrazioni di storno inverse
3. Contattare supporto Odoo se necessario

## DOMANDE FREQUENTI

### Q: Posso eseguire solo alcune rettifiche?

A: Sì, è possibile modificare il file `RETTIFICHE_1001_PREPARATE.json` per includere solo le rettifiche approvate.

### Q: Il conto di contropartita 3900 è corretto?

A: Deve essere confermato dal commercialista. Potrebbe essere necessario usare un altro conto (es. 6900 Financial expenses).

### Q: Cosa succede se il saldo finale non è corretto?

A: Significa che ci sono altri errori non identificati. Sarà necessaria un'analisi aggiuntiva.

### Q: Le rettifiche possono essere annullate?

A: Sì, ma richiederà la creazione di nuove registrazioni di storno. È importante quindi essere sicuri prima di eseguire.

## CONTATTI

Per domande o supporto:
- **Odoo Data Modeler:** [email]
- **Commercialista:** [email/telefono]
- **Supporto tecnico Odoo:** [contatto]

## TIMELINE

- **15.11.2025:** Analisi completata
- **15.11.2025:** Verifica pre-rettifica OK
- **[TBD]:** Approvazione commercialista
- **[TBD]:** Esecuzione rettifiche
- **[TBD]:** Verifica post-rettifica

## NOTE TECNICHE

### Struttura Dati Odoo

- **Model:** `account.move.line`
- **Conto Cash ID:** [ottenibile da account.account con code='1001']
- **Giornale:** `Miscellaneous Operations` (MISC)
- **Contropartita:** Conto 3900

### Campi Utilizzati

- `date`: Data registrazione
- `name`: Descrizione movimento
- `debit`: Importo dare
- `credit`: Importo avere
- `account_id`: Riferimento conto
- `journal_id`: Riferimento giornale
- `move_id`: Riferimento testata movimento

### Credenziali Odoo

- **URL:** https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
- **DB:** lapadevadmin-lapa-v2-staging-2406-25408900
- **User:** paul@lapa.ch

---

**IMPORTANTE: Non procedere con l'esecuzione delle rettifiche senza approvazione scritta del commercialista!**
