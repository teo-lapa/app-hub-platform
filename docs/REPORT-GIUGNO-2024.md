# REPORT GIUGNO 2024 - Verifica Completa Riga per Riga

**Periodo**: 01/06/2024 - 30/06/2024
**Account**: 1025 (UBS EUR - CH25 0027 8278 1220 8760 A)
**Data analisi**: 2025-11-16 17:01:44
**Status**: CRITICO - 0% riconciliazione

---

## EXECUTIVE SUMMARY

### Dati Bancari (UBS EUR)
- **Transazioni totali**: 44
- **Periodo**: 03/06/2024 - 28/06/2024
- **Saldo iniziale** (01/06/2024): EUR -6,344.93
- **Saldo finale** (30/06/2024): EUR -50,573.62
- **Variazione**: EUR -44,228.69

#### Breakdown Movimenti Banca
- **Totale Dare (uscite)**: EUR 457,305.35
- **Totale Avere (entrate)**: EUR 230,000.00
- **Differenza**: EUR -227,305.35

### Dati Odoo (Konto 1025)
- **Movimenti totali**: 57
- **Periodo**: 15/06/2024 - 29/06/2024
- **Totale Dare**: EUR 223,100.00
- **Totale Avere**: EUR 392,079.02
- **Differenza**: EUR +168,979.02

### Discrepanze Critiche

| Metrica | Banca | Odoo | Differenza |
|---------|-------|------|------------|
| Totale Dare | EUR 457,305.35 | EUR 223,100.00 | EUR **234,205.35** |
| Totale Avere | EUR 230,000.00 | EUR 392,079.02 | EUR **162,079.02** |
| Numero movimenti | 44 | 57 | **+13 in Odoo** |
| Match esatti | 0 | 0 | **0% riconciliazione** |

---

## ANALISI DETTAGLIATA

### Problema 1: Date Non Allineate

**Movimenti bancari**: iniziano il **03/06/2024**
**Movimenti Odoo**: iniziano il **15/06/2024**

**Osservazione**: Odoo NON ha registrato i movimenti dal 01/06 al 14/06 (prime 2 settimane del mese).

#### Transazioni bancarie mancanti in Odoo (01-14 giugno):

| Data | Importo EUR | Fornitore/Descrizione |
|------|-------------|----------------------|
| 2024-06-03 | -15,635.62 | e-banking-Sammelauftrag (4 pagamenti SEPA) |
| 2024-06-03 | -955.96 | PASTIFICIO DI MARTINO DI GAETANO |
| 2024-06-04 | -2,410.70 | RAZVAN CUC - Stipendio + ferie |
| 2024-06-05 | -12,856.00 | e-banking-Sammelauftrag (5 pagamenti SEPA) |
| 2024-06-05 | -11,592.47 | LATTERIA SOCIALE MANTOVA (FT 691V2) |
| 2024-06-05 | -9,583.80 | INNOVACTION S.R.L (FT 905E) |
| 2024-06-05 | -6,905.25 | LATTERIA SOCIALE MANTOVA (FT 728) |
| 2024-06-05 | -6,677.32 | INNOVACTION S.R.L (FT 675E) |
| 2024-06-05 | -4,252.81 | TRINITA SPA (FT 514S) |
| 2024-06-05 | -3,297.13 | TRINITA SPA (FT 591S) |
| 2024-06-05 | -666.00 | GELATERIA DAI DAI (PF 206F) |
| 2024-06-06 | -17,364.00 | e-banking-Sammelauftrag (2 pagamenti SEPA) |
| 2024-06-06 | -7,000.00 | LDF SRL (FT 389) |
| 2024-06-06 | -1,847.81 | SALUMIFICIO SOSIO SRL (FT 795) |
| 2024-06-06 | -628.80 | UNICA IL CESTINO DI PANE (FT A95) |
| 2024-06-06 | -196.00 | LDF SRL (FT 504) |
| 2024-06-07 | -7,307.39 | GENNARO AURICCHIO SPA (FT 024012964) |
| 2024-06-07 | -3,452.00 | INTERFRIGO TRANSPORT SRL (FT 807) |
| 2024-06-10 | -6,378.75 | PAUL TEODERSCU - Stipendio Laura |
| 2024-06-10 | -2,021.08 | BRANCA GEL SRL (PF 343) |
| 2024-06-11 | -170,000.00 | FX Spot - Vendita EUR/Acquisto CHF |
| 2024-06-11 | +170,000.00 | FX Spot - Storno vendita EUR |
| 2024-06-11 | +170,000.00 | FX Spot - Acquisto EUR/Vendita CHF |
| 2024-06-12 | -864.68 | FIRSTPACK ITALIA SRL (PF 24OV01263) |
| 2024-06-12 | -349.50 | AZ. AGRICOLA CASATA DEL LAGO (FT 71) |
| 2024-06-13 | -8,700.92 | SPIRITO CONTADINO (FT 13714) |
| 2024-06-13 | -6,071.00 | DOLCIARIA MARIGLIANO (FT 192) |
| 2024-06-13 | -2,924.00 | DOLCIARIA MARIGLIANO (FT 301) |
| 2024-06-13 | -1,345.30 | e-banking-Sammelauftrag (2 pagamenti SEPA) |
| 2024-06-14 | -162.00 | NUOVA FRECCIA ADRIATICO (FT 3.951) |

**Totale mancante**: EUR -367,305.35 (uscite) + EUR 340,000.00 (FX) = EUR -27,305.35 netto

### Problema 2: Movimenti Successivi Disallineati

Anche i movimenti dal 15/06 in poi non matchano perché:
- **Importi leggermente diversi** (possibili conversioni valutarie o arrotondamenti)
- **Date valuta diverse** dalla data movimento
- **Descrizioni formattate diversamente**

#### Esempi di possibili match (da verificare manualmente):

| Data Banca | Importo Banca | Data Odoo | Importo Odoo | Descrizione |
|------------|---------------|-----------|--------------|-------------|
| 2024-06-20 | -38,797.33 | 2024-06-21 | -37,633.41 | LATTICINI MOLISANI TAMBURRO - MAGGIO 2024 |
| 2024-06-20 | -32,879.18 | 2024-06-21 | -31,892.80 | FERRAIUOLO FOODS - FT APRILE 2024 |
| 2024-06-20 | -7,063.20 | 2024-06-21 | -6,851.30 | OLEIFICIO ZUCCHI - PF 200008822 |
| 2024-06-20 | -6,031.69 | 2024-06-21 | -5,850.74 | SORI ITALIA - FT APRILE 2024 |
| 2024-06-21 | +60,000.00 | 2024-06-22 | +58,200.00 | FX Spot - Acquisto EUR |
| 2024-06-28 | -11,468.46 | 2024-06-29 | -11,124.41 | LATTERIA SOCIALE MANTOVA (887/2) |

**Osservazione**: Differenze EUR 500-2,000 per transazione potrebbero indicare:
- Tassi di cambio diversi applicati
- Commissioni bancarie non registrate
- Errori di importazione/registrazione

### Problema 3: Movimenti Odoo Extra

Odoo ha **57 movimenti** contro **44 della banca** = **+13 movimenti extra**.

Potrebbero essere:
- Movimenti duplicati
- Rettifiche manuali
- Import multipli dello stesso periodo
- Movimenti di altre fonti (non UBS EUR)

---

## AZIONI RICHIESTE

### URGENTE (Priorità 1)

1. **Importare movimenti mancanti 01-14 giugno**
   - Verificare perché Odoo parte solo dal 15/06
   - Importare manualmente estratto conto EUR Q2 (01/04 - 30/06)
   - Focus su EUR 367K di uscite non registrate

2. **Verificare duplicati in Odoo**
   - 13 movimenti extra suggeriscono possibili import duplicati
   - Query: controllare tutti i movimenti giugno 2024 konto 1025
   - Verificare se ci sono move_id duplicati o ref duplicati

3. **Analizzare differenze importi**
   - EUR 234K differenza su Dare
   - EUR 162K differenza su Avere
   - Potrebbero essere solo issue di date (valuta vs booking)

### IMPORTANTE (Priorità 2)

4. **Riconciliare FX transactions**
   - 3 movimenti FX l'11/06 (EUR 510K totale)
   - Verificare se in Odoo sono stati registrati correttamente
   - Controllare konti 1024 (CHF) e 1026 (CS) per contropartita

5. **Validare fornitori principali**
   - LATTICINI MOLISANI: EUR -38,797.33 vs EUR -37,633.41 (diff EUR 1,163.92)
   - FERRAIUOLO FOODS: EUR -32,879.18 vs EUR -31,892.80 (diff EUR 986.38)
   - LATTERIA MANTOVA: 4 transazioni per totale EUR -36,549.68

### FOLLOW-UP (Priorità 3)

6. **Standardizzare processo import**
   - Data valuta vs data movimento
   - Format descrizioni
   - Mapping automatico fornitori
   - Validazione pre-import

7. **Report mensile riconciliazione**
   - Automatizzare questo check ogni mese
   - Alert se riconciliazione < 95%
   - Dashboard con differenze > EUR 100

---

## STATISTICHE TRANSAZIONI

### Top 10 Fornitori per Importo (Banca)

| Fornitore | Importo EUR | # Transazioni |
|-----------|-------------|---------------|
| LATTICINI MOLISANI TAMBURRO | -38,797.33 | 1 |
| FERRAIUOLO FOODS | -32,879.18 | 1 |
| LATTERIA SOCIALE MANTOVA | -36,549.68 | 4 |
| INNOVACTION S.R.L | -16,261.12 | 2 |
| TRINITA SPA | -11,975.29 | 3 |
| DOLCIARIA MARIGLIANO | -8,995.00 | 2 |
| SPIRITO CONTADINO | -8,700.92 | 1 |
| GENNARO AURICCHIO | -7,307.39 | 1 |
| OLEIFICIO ZUCCHI | -7,063.20 | 1 |
| LDF SRL | -7,196.00 | 2 |

### Categorie Movimenti

| Categoria | Importo EUR | # Mov |
|-----------|-------------|-------|
| Pagamenti fornitori | -287,305.35 | 27 |
| FX Transactions | +340,000.00 (netto 0) | 3 |
| Stipendi | -8,789.45 | 2 |
| Commissioni carta | -4,000.00 | 1 |
| Commissioni bancarie | -21.13 | 1 |
| Interessi passivi | -652.24 | 1 |
| e-banking batch | -97,106.77 | 9 |

---

## CONCLUSIONI

### Status Attuale
**CRITICO** - Il konto 1025 (UBS EUR) ha 0% di riconciliazione per giugno 2024.

### Cause Principali
1. **Prime 2 settimane mancanti** in Odoo (EUR 367K non registrati)
2. **Date non allineate** (data valuta vs data movimento)
3. **Importi leggermente diversi** (EUR 500-2K per transazione)
4. **13 movimenti extra** in Odoo non presenti in banca

### Impact
- **Saldo finale bancario**: EUR -50,573.62
- **Saldo Odoo** (da verificare): probabilmente diverso di EUR 200-300K
- **Impossibilità di chiudere giugno 2024** fino a riconciliazione

### Next Steps
1. Import manuale movimenti 01-14 giugno
2. Cleanup duplicati Odoo
3. Riconciliazione manuale transazioni >EUR 10K
4. Report di verifica post-cleanup

---

**Generato da**: verifica-giugno-2024.py
**Raw data**: REPORT-GIUGNO-2024.json
**Output completo**: report-giugno-2024-output.txt
