# MARZO 2024 - TODO LIST

## DOCUMENTI MANCANTI

### UBS CHF (Konto 1024)
- [ ] Estratto conto marzo 2024 (PDF)
- [ ] Account: 278-122087.01J
- [ ] Periodo: 01/03/2024 - 31/03/2024
- [ ] Expected: ~367 movimenti, totale CHF 98,263.33

### UBS EUR (Konto 1025)
- [ ] Estratto conto marzo 2024 (PDF)
- [ ] Account: 278-122087.60A
- [ ] Periodo: 01/03/2024 - 31/03/2024
- [ ] Expected: ~51 movimenti, totale EUR 22,417.33

### Credit Suisse CHF (Konto 1026)
- [ ] Estratto conto marzo 2024 (PDF)
- [ ] Account: 3977497-51
- [ ] Periodo: 01/03/2024 - 31/03/2024
- [ ] Expected: ~176 movimenti, totale CHF -30,950.09

---

## COME PROCEDERE

### Step 1: Ottenere PDF Estratti Conto
```bash
# Posiziona i PDF in data-estratti/ con questi nomi:
data-estratti/UBS-CHF-2024-03-MARCH.pdf
data-estratti/UBS-EUR-2024-03-MARCH.pdf
data-estratti/CREDIT-SUISSE-2024-03-MARCH.pdf
```

### Step 2: Parser PDF -> JSON
```bash
# Usa Jetson OCR o parser esistente
npm run parse-bank-statements
# oppure
python scripts/parse-ubs-statement.py data-estratti/UBS-CHF-2024-03-MARCH.pdf
```

### Step 3: Ri-esegui Verifica
```bash
# Con i file JSON popolati, ri-lancia lo script
export ODOO_URL="https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
export ODOO_DB="lapadevadmin-lapa-v2-main-7268478"
export ODOO_USERNAME="apphubplatform@lapa.ch"
export ODOO_PASSWORD="apphubplatform2025"

python scripts/verifica-marzo-2024.py
```

### Step 4: Analizza Report
```bash
# Leggi il report generato
cat REPORT-MARZO-2024.json

# Oppure summary
cat REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md
```

---

## MOVIMENTI CRITICI DA VERIFICARE

### Cambio Valuta EUR 97k (21/03/2024)
```
Konto: 1025 (UBS EUR)
Data: 2024-03-21
Importo: -97,000.00 EUR
Descrizione: Acquistato EUR; Venduto CHF; FX CG-S176W
```

**Verifica necessaria**:
- [ ] Conferma transazione in estratto UBS EUR
- [ ] Verifica corrispondente movimento in UBS CHF
- [ ] Controlla tasso di cambio applicato
- [ ] Documenta spread bancario

### Stipendi Marzo 2024
```
Konto: 1024 (UBS CHF)
Data: 2024-03-29
Totale: ~13,453.90 CHF

Dettaglio:
- MIHAI NITA: CHF 4,499.55
- MARCO CALABRESE: CHF 6,017.00
- MARIUS NEGRUT: CHF 2,937.35
```

**Verifica necessaria**:
- [ ] Conferma pagamenti in estratto UBS CHF
- [ ] Verifica date valuta
- [ ] Cross-check con libro paga marzo

### Fornitori Italiani (Konto 1025)
```
SICA S.R.L.: EUR 24,054.06 (22/03)
FERRAIUOLO FOODS: EUR 27,829.37 (20/03)
OLEIFICIO ZUCCHI: EUR 7,912.87 (28/03)
```

**Verifica necessaria**:
- [ ] Match con fatture fornitori
- [ ] Conferma in estratto UBS EUR
- [ ] Verifica IVA applicata

---

## SCRIPT DISPONIBILI

### verifica-marzo-2024.py
```bash
python scripts/verifica-marzo-2024.py
```
- Connette a Odoo via XML-RPC
- Legge movimenti dai JSON estratti conto
- Match riga per riga
- Genera report completo

### Modificare periodo
Edita lo script per altri mesi:
```python
PERIODO_START = '2024-04-01'
PERIODO_END = '2024-04-30'
```

---

## OUTPUT GENERATI

### REPORT-MARZO-2024.json
- Report completo JSON
- Tutti i movimenti dettagliati
- Match/Unmatch status

### REPORT-MARZO-2024-EXECUTIVE-SUMMARY.md
- Summary esecutivo
- Analisi per konto
- Raccomandazioni

### verifica-marzo-2024.log
- Log esecuzione script
- Errori e warning
- Diagnostica

---

## NOTES

- **Odoo ha 594 movimenti** per marzo 2024
- **Estratti bancari mancanti** - file JSON vuoti
- **Impossibile verificare** senza estratti originali
- **Match rate attuale**: 0%

Una volta ottenuti i PDF degli estratti, il match rate dovrebbe essere >95%.
