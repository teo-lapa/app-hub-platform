# AZIONI IMMEDIATE - RICONCILIAZIONE BANCARIA 2024

**QUICK START per sistemare le discrepanze bancarie**

---

## SITUAZIONE

- **2,828 transazioni bancarie NON registrate in Odoo**
- **8,208 transazioni Odoo NON esistenti in banca**
- **Match rate: solo 25%**

---

## AZIONE 1: Analizza le Transazioni Mancanti (30 min)

### Apri il Report Excel

**File:**
```
C:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts\riconciliazione-bancaria-2024-20251116_085552.xlsx
```

### Controlla Sheet "Summary 2024"

Identifica i mesi peggiori:
- Giugno: 266 trans banca NON in Odoo (100%)
- Luglio: 276 trans banca NON in Odoo (99.6%)
- Dicembre: 326 trans banca NON in Odoo (100%)

### Apri Sheet "2024-06 1022" (Giugno CHF)

**Sezione: TRANSAZIONI BANCA NON IN ODOO**

Esempio transazioni mancanti:
```
Data       | Importo  | Descrizione
-----------|----------|------------------------------------------
2024-06-28 | +187.58  | Le Vere Delizie - Ordine 03456-001-0001
2024-06-28 | -5200.00 | Stipendio Marco Calabrese
2024-06-27 | -14321.15| Pagamento fornitori (batch)
...
```

**Cosa fare:**
1. Prendi le prime 10 transazioni con importo piu alto
2. Verifica in Odoo se esistono
3. Se NON esistono → vanno importate

---

## AZIONE 2: Import Manuale Prima Transazione Test (15 min)

### Scegli una transazione cliente (incasso)

Esempio:
```
Data: 2024-06-28
Importo: CHF +187.58
Cliente: Le Vere Delizie
Ordine: 03456-001-0001
```

### In Odoo:

1. **Vai a:** Contabilita → Banca → UBS CHF (1022)
2. **Crea movimento manuale:**
   - Data: 28/06/2024
   - Partner: Le Vere Delizie GmbH
   - Dare: 187.58
   - Label: "Pagamento cliente - Ordine 03456-001-0001"
3. **Riconcilia** con fattura cliente se esiste
4. **Conferma**

### Verifica:

- Saldo conto 1022 aumentato di CHF 187.58?
- Movimento visibile in estratto conto Odoo?

Se SI → puoi procedere con import massivo
Se NO → c'e un problema di configurazione

---

## AZIONE 3: Identifica Transazioni Odoo Fantasma (30 min)

### Apri Sheet "2024-01 1022" (Gennaio CHF)

**Sezione: TRANSAZIONI ODOO NON IN BANCA**

Esempio:
```
Data       | Dare    | Avere   | Descrizione                    | Move ID
-----------|---------|---------|--------------------------------|----------
2024-01-15 | 0.00    | 300.00  | Pagamento fornitore ABC        | 12345
2024-01-15 | 0.00    | 300.00  | Pagamento fornitore ABC        | 12346
```

**NOTA:** Stessa data, stesso importo, stesso fornitore = DUPLICATO!

### In Odoo:

1. **Vai a:** Contabilita → Registrazioni Contabili
2. **Filtra:**
   - Conto: 1022 (UBS CHF)
   - Data: 01/01/2024 - 31/01/2024
3. **Cerca:** Move ID 12345 e 12346
4. **Verifica:** Sono duplicati?
5. **Azione:**
   - Se duplicato → Elimina uno dei due (o annulla)
   - Se non duplicato → Cerca transazione bancaria corrispondente

---

## AZIONE 4: Import Batch Estratti Conto Mancanti (2h)

### File da importare:

**UBS CHF Giugno 2024:**
```
C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.4-30.6.2024.csv
```

**UBS CHF Luglio-Settembre 2024:**
```
C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.7-30.9.2024.csv
```

**UBS CHF Ottobre-Dicembre 2024:**
```
C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.10-31.12.2024.csv
```

### In Odoo (se disponibile import CSV):

1. **Vai a:** Contabilita → Banca → UBS CHF (1022)
2. **Import Statement:**
   - File: `UBS CHF 1.4-30.6.2024.csv`
   - Formato: UBS CSV
   - Encoding: UTF-8
3. **Map Columns:**
   - Data → Abschlussdatum
   - Importo → Einzelbetrag (credit - debit)
   - Descrizione → Beschreibung1 + Beschreibung2
4. **Preview** → Verifica che le transazioni siano corrette
5. **Import**
6. **Riconciliazione automatica** (Odoo prova a matchare con fatture)
7. **Riconciliazione manuale** per il resto

**Ripeti per gli altri file CSV**

### Se import CSV non funziona:

Usa script Python per convertire CSV in formato Odoo:
```bash
cd "C:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts"
python convert-ubs-csv-to-odoo.py
```

(Script da creare se necessario)

---

## AZIONE 5: Verifica Saldi dopo Import (15 min)

### In Odoo:

1. **Vai a:** Contabilita → Reporting → Bilancio di Verifica
2. **Filtra:**
   - Data: 31/12/2024
   - Conti: 1022 (UBS CHF), 1023 (UBS EUR)
3. **Saldo Odoo:**
   - 1022 UBS CHF: CHF ???
   - 1023 UBS EUR: EUR ???

### Confronta con Estratto Conto Banca:

**UBS CHF al 31/12/2024:**
```
Saldo finale: CHF 182,573.56
(da file UBS CHF 1.10-31.12.2024.csv)
```

**UBS EUR al 31/12/2024:**
```
Saldo finale: EUR 128,536.57
(da file UBS EUR 1.7-31.12.2024.csv)
```

### Calcola Differenza:

```
Diff CHF = Saldo Odoo - Saldo Banca
Diff EUR = Saldo Odoo - Saldo Banca
```

**Target:** Diff < CHF/EUR 100 (tolleranza)

Se diff > 100 → Ri-esegui riconciliazione:
```bash
python riconciliazione-bancaria-completa-2024.py
```

---

## AZIONE 6: Crea Lista Prioritaria Correzioni (30 min)

### Template Excel:

| Priorita | Tipo | Data | Conto | Importo | Descrizione | Azione | Status |
|----------|------|------|-------|---------|-------------|--------|--------|
| 1 | Mancante | 2024-12-15 | 1022 | -15,000 | Stipendi Dicembre | Import CSV | TODO |
| 2 | Duplicato | 2024-01-15 | 1022 | -300 | Fornitore ABC | Elimina Move 12346 | TODO |
| 3 | Mancante | 2024-11-20 | 1022 | +5,000 | Cliente XYZ | Import CSV | TODO |

**Criteri Priorita:**
1. Importo alto (> CHF 1,000)
2. Fine anno (Dicembre 2024)
3. Transazioni cliente (incassi)
4. Transazioni fornitore (pagamenti)

**Azioni possibili:**
- Import CSV
- Crea movimento manuale
- Elimina duplicato
- Riconcilia con fattura

---

## AZIONE 7: Comunicazione Commercialista (15 min)

### Email Draft:

```
Oggetto: Riconciliazione Bancaria 2024 - Discrepanze Trovate

Gentile Commercialista,

Abbiamo completato la riconciliazione bancaria 2024 RIGA PER RIGA confrontando
gli estratti conto UBS con Odoo.

RISULTATI:
- Totale transazioni bancarie: 3,777
- Totale transazioni Odoo: 9,157
- Match: 949 (25%)
- NON in Odoo: 2,828 transazioni bancarie
- NON in Banca: 8,208 transazioni Odoo

PROBLEMI IDENTIFICATI:
1. Import estratti conto interrotto da Giugno 2024
2. Possibili duplicati in Odoo (Gen-Mag 2024)
3. Conto EUR completamente sballato

REPORT DETTAGLIATO:
- Excel con tutte le discrepanze: [allegato]
- Report esecutivo: [allegato]

PROSSIMI PASSI:
1. Import estratti conto Giu-Dic 2024 (2,263 trans)
2. Pulizia duplicati Gen-Mag 2024 (1,324 trans)
3. Reset e re-import conto EUR 2024

TIMELINE:
2-3 settimane per sistemare tutto

Quando possiamo organizzare un call per discutere?

Cordiali saluti,
[Nome]
```

**Allegati:**
1. `riconciliazione-bancaria-2024-20251116_085552.xlsx`
2. `REPORT-RICONCILIAZIONE-BANCARIA-2024-EXECUTIVE.md`

---

## CHECKLIST FINALE

- [ ] Aperto report Excel e identificati mesi peggiori
- [ ] Testato import manuale 1 transazione
- [ ] Identificati 5 duplicati Odoo da eliminare
- [ ] Importato estratto conto Giugno 2024
- [ ] Verificato saldo post-import
- [ ] Creata lista prioritaria correzioni (Top 20)
- [ ] Inviata email a commercialista con report

---

## SUPPORTO

**Script disponibili:**
- `riconciliazione-bancaria-completa-2024.py` - Riconciliazione completa
- (Da creare) `convert-ubs-csv-to-odoo.py` - Convertitore CSV
- (Da creare) `find-duplicates-odoo.py` - Trova duplicati

**File estratti conto:**
```
C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\
C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS EUR\
```

**Report generati:**
```
C:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts\
  - riconciliazione-bancaria-2024-20251116_085552.xlsx
  - riconciliazione-bancaria-2024-20251116_085552.json
  - REPORT-RICONCILIAZIONE-BANCARIA-2024-EXECUTIVE.md
```

---

**TIP:** Inizia dalle azioni 1-3 (1h totale) per capire la situazione. Poi valuta con commercialista se procedere con import massivo (Azioni 4-6).

**ATTENZIONE:** Fai SEMPRE backup Odoo prima di modifiche massive!
