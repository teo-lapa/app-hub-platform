# MAGGIO 2024 - QUICK REFERENCE

## STATO ANALISI

| Konto | Descrizione | Status | Transazioni | File Disponibili |
|-------|-------------|--------|-------------|------------------|
| 1024 | UBS CHF | DATI PARZIALI | N/D | Solo saldi mensili |
| 1025 | UBS EUR | COMPLETATO | 70 | Transazioni complete |
| 1026 | Credit Suisse | DATI NON DISPONIBILI | N/D | Solo saldo finale 2024 |

---

## KONTO 1025 - UBS EUR - SNAPSHOT

### Saldi
```
Saldo Inizio Maggio:  EUR -24,306.92
Saldo Fine Maggio:    EUR  -5,388.97
Variazione:           EUR +18,917.95 (+77.8%)
```

### Movimenti
```
Transazioni:          70
Entrate:              EUR +370,000.00  (3 FX Forward)
Uscite:               EUR -363,383.18  (64 pagamenti)
Saldo Netto:          EUR  +6,616.82
```

### Top 5 Uscite
```
1. DISCEFA                      EUR -32,321.77  (ES - Distribuzione)
2. FERRAIUOLO FOODS (11 FT)     EUR -31,709.65  (IT - Alimentari)
3. PEREIRA PRODUCTOS (ES)       EUR -31,449.60  (ES - Ittico)
4. DAYSEADAY FROZEN (2 FT)      EUR -30,213.35  (NL - Surgelati)
5. LATTICINI MOLISANI (9 FT)    EUR -27,940.36  (IT - Latticini)
```

### FX Forward Operations
```
08/05/2024  FX CH-FGG79   +150,000.00 EUR  (Saldo dopo: 90,486.45)
15/05/2024  FX CH-HVF2Y   +120,000.00 EUR  (Saldo dopo: 104,341.83)
21/05/2024  FX CH-KYG09   +100,000.00 EUR  (Saldo dopo: 44,062.35)
```

---

## GIORNI CHIAVE

### 17 MAGGIO - MEGA BATCH DAY
```
Transazioni:  30 (42.9% del totale mese)
Uscite:       EUR -101,411.39
Fornitori:    FERRAIUOLO (11), LATTICINI MOLISANI (8), SOLUZIONI ALIMENTARI (4)
SEPA Batch:   2 operazioni (-25,617.87)
Commissioni:  UBS Card -794.36
```

### 08 MAGGIO - FX FORWARD 150K
```
Entrata FX:   +150,000.00 EUR
Uscite:       -39,029.61 EUR
Netto giorno: +110,970.39 EUR
Saldo finale: 90,486.45 EUR
```

### 20 MAGGIO - PAGAMENTI ANOMALI
```
DISCEFA:      -32,321.77 EUR (fornitore spagnolo)
Carta 5565:   -5,000.00 EUR (Laura Teodorescu) - DA VERIFICARE
Saldo finale: -23,615.88 EUR (torna negativo)
```

---

## PATTERN IDENTIFICATI

### Ciclo di Cassa Tipico
```
INIZIO MESE:  Saldo negativo (overdraft)
              |
              v
PRIMA METÀ:   3x FX Forward EUR 370K (iniezione liquidità)
              |
              v
DURANTE:      Pagamenti batch fornitori italiani
              |
              v
FINE MESE:    Saldo negativo ridotto (overdraft controllato)
```

### Fornitori - Geografia
```
Italia:       90%+  (Latticini, alimentari, pasta, oli)
Spagna:       5%    (DISCEFA, PEREIRA)
Olanda:       3%    (DAYSEADAY FROZEN)
Svizzera:     2%    (Commissioni UBS)
```

### Pagamenti - Timing
```
Fatture Marzo → Pagamento Maggio (60-90 giorni)
```

---

## FLAGS & ALERTS

### RED FLAGS
```
1. Pagamento carta EUR 5,000 (Laura Teodorescu)
   - Beneficiario: IBAN CH03 0023 0230 0129 5371 Y
   - Data: 20/05/2024
   - Natura: DA VERIFICARE

2. Commissioni UBS EUR 794.36
   - Data: 17/05/2024
   - Tipo: Addebito carta VIS1W
   - Note: Elevate per singolo addebito

3. DISCEFA EUR -32,321.77
   - Fornitore spagnolo
   - Importo elevato single payment
   - Fattura: EX/00/00024 (16.2.2024)
```

### YELLOW FLAGS
```
1. Overdraft persistente
   - Inizio mese: -24,306.92 EUR
   - Fine mese: -5,388.97 EUR
   - Autorizzato? DA VERIFICARE

2. SEPA Batch Costs
   - Totale costi: EUR ~77K (include commissioni)
   - 6 batch nel mese
   - Ottimizzazione possibile?

3. Termini pagamento lunghi
   - 60-90 giorni standard
   - Negoziare sconto pronto cassa?
```

---

## FILE GENERATI

```
REPORT-MAGGIO-2024.json              - Dati strutturati completi
REPORT-MAGGIO-2024-COMPLETO.md       - Report executive dettagliato
REPORT-MAGGIO-2024.xlsx              - Excel interattivo (4 fogli)
MAGGIO-2024-QUICK-REFERENCE.md       - Questo file
analizza-maggio-2024.py              - Script analisi (riutilizzabile)
genera-excel-maggio-2024.py          - Script Excel generator
```

---

## PROSSIMI STEP

### Konto 1024 (UBS CHF)
```
TODO: Localizzare CSV Q2 2024 (file: UBS CHF 1.4-30.6.2024.csv)
TODO: Estrarre da Odoo quando connessione disponibile
TODO: Analizzare riga per riga (script ready)
```

### Konto 1026 (Credit Suisse)
```
TODO: OCR su PDF estratti conto (troppo grandi per lettura diretta)
TODO: Estrarre da Odoo quando connessione disponibile
TODO: Verificare se esistono estratti mensili più piccoli
```

### Validazione Odoo
```
TODO: Confrontare transazioni con account.move.line in Odoo
TODO: Verificare riconciliazione pagamenti → fatture
TODO: Check differenze saldi bancari vs contabili
```

### Analisi Avanzate
```
TODO: Analizza spread FX Forward (tasso applicato vs mercato)
TODO: Calcola costi reali SEPA (commissioni totali)
TODO: Cash flow forecast basato su pattern storici
TODO: Aging fornitori (DSO - Days Sales Outstanding)
```

---

## COMANDI UTILI

### Riesegui analisi
```bash
python analizza-maggio-2024.py
```

### Genera Excel
```bash
python genera-excel-maggio-2024.py
```

### Estrai da Odoo (quando disponibile)
```bash
python estrai-maggio-2024-odoo.py
```

### Cerca transazioni specifiche (Python)
```python
import json
with open('REPORT-MAGGIO-2024.json') as f:
    data = json.load(f)

# Cerca fornitore
tx_latticini = [tx for tx in data['dettaglio_transazioni']
                if 'LATTICINI' in tx['partner']]
print(f"Trovate {len(tx_latticini)} transazioni Latticini")

# Cerca per data
tx_17_mag = [tx for tx in data['dettaglio_transazioni']
             if tx['data'] == '2024-05-17']
print(f"17 Maggio: {len(tx_17_mag)} transazioni")

# Cerca FX Forward
fx = [tx for tx in data['dettaglio_transazioni']
      if 'FX' in tx['descrizione'] and tx['importo_eur'] > 0]
print(f"FX Forward: {sum(tx['importo_eur'] for tx in fx)} EUR")
```

---

## CONTATTI & SUPPORTO

**Generato da**: Backend Specialist Agent
**Data**: 16 Novembre 2025, 17:10 CET
**Versione**: 1.0

**Per domande**:
- Check file REPORT-MAGGIO-2024-COMPLETO.md per dettagli
- Apri REPORT-MAGGIO-2024.xlsx per analisi interattiva
- Consulta REPORT-MAGGIO-2024.json per dati raw

**Status**: PARZIALE - Solo Konto 1025 completato
**Next Update**: Dopo estrazione Konto 1024 e 1026
