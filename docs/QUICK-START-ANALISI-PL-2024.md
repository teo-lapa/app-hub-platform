# QUICK START: Analisi P&L 2024

## FILE GENERATI

1. **RICONCILIAZIONE-PL-2024.xlsx** (64 KB)
   - Report Excel completo con 4 fogli

2. **REPORT-PL-2024-EXECUTIVE-SUMMARY.md**
   - Executive summary in Markdown

3. **Script Python**:
   - `scripts/riconcilia-pl-2024-fast.py` - Script veloce (1 min)
   - `scripts/riconcilia-pl-2024.py` - Script dettagliato con anomalie (lento, 20+ min)

---

## COME USARE IL REPORT EXCEL

### Foglio 1: SUMMARY

**Cosa contiene**: Tutti i 168 conti economici con totali 2024

**Colonne**:
- Categoria (Ricavi, COGS, Spese Operative, etc.)
- Codice conto
- Nome conto
- Tipo
- Dare (totale 2024)
- Avere (totale 2024)
- Saldo (Avere - Dare)
- N. Movimenti

**Come usarlo**:
1. Ordina per Categoria per vedere tutti i ricavi insieme
2. Ordina per Saldo per trovare conti con valori più alti
3. Filtra per N. Movimenti = 0 per trovare conti inutilizzati

### Foglio 2: MENSILE

**Cosa contiene**: Saldi mensili per ogni conto (Gen-Dic 2024)

**Colonne**:
- Categoria
- Codice conto
- Nome conto
- Mese (2024-01, 2024-02, ...)
- Dare (mese)
- Avere (mese)
- Saldo (mese)

**Come usarlo**:
1. Filtra per Codice conto per vedere trend mensile di un conto specifico
2. Crea grafico saldo nel tempo per visualizzare stagionalità
3. Identifica picchi anomali (es. storni di fine anno)

### Foglio 3: KPI

**Cosa contiene**: KPI aggregati per categoria

**Metriche**:
- Dare Totale per categoria
- Avere Totale per categoria
- Saldo per categoria
- Gross Margin
- Gross Margin %

**Come usarlo**:
- Vista a colpo d'occhio della P&L
- Benchmark vs budget/anno precedente
- Calcola ratios (OPEX/Revenue, etc.)

### Foglio 4: PIVOT MENSILE

**Cosa contiene**: Pivot table Mese x Categoria (saldi)

**Come usarlo**:
- Vedere trend mensile per categoria
- Identificare stagionalità
- Creare grafici trend

---

## ANALISI SUGGERITE

### 1. Analisi Gross Margin

**PROBLEMA**: GM negativo -2.1M EUR (35.3%)

**Steps**:
1. Apri foglio SUMMARY
2. Filtra Categoria = "Ricavi"
3. Ordina per Saldo (decrescente) per vedere top revenue accounts
4. Filtra Categoria = "Costo del Venduto"
5. Ordina per Saldo (crescente) per vedere top cost accounts
6. Identifica:
   - Quali prodotti/servizi generano più ricavi?
   - Quali costi sono più alti?
   - Ci sono storni anomali?

**Query Excel**:
```
=SUMIF(Categoria,"Ricavi",Saldo)  → Ricavi totali
=SUMIF(Categoria,"Costo del Venduto",Saldo)  → COGS totali
=Ricavi + COGS  → Gross Margin
```

### 2. Analisi Stagionalità

**Steps**:
1. Apri foglio PIVOT MENSILE
2. Crea grafico lineare con:
   - X-axis: Mesi
   - Y-axis: Saldo
   - Serie: Ricavi, COGS
3. Identifica:
   - Mesi migliori/peggiori per ricavi
   - Correlazione costi/ricavi
   - Picchi anomali

### 3. Trova Conti Inutilizzati

**Steps**:
1. Apri foglio SUMMARY
2. Filtra "N. Movimenti" = 0
3. Identifica conti da eliminare/consolidare

**Esempio**:
- Conti con saldo = 0 e movimenti = 0 → Eliminare
- Conti "annullati" → Chiudere

### 4. Analisi Anomalie

**Conti da verificare**:

**Ricavi con Dare alto** (possibili storni):
```
Filtra: Categoria = Ricavi AND Dare > 10,000
```

**COGS con Avere alto** (possibili rettifiche):
```
Filtra: Categoria = Costo del Venduto AND Avere > 100,000
```

**Conti a zero sospetti**:
```
Filtra: Categoria = Proventi/Oneri Finanziari AND Saldo = 0
```

### 5. Analisi Trend Mensile per Conto

**Esempio: Analizzare conto 310100 - Merci c/vendite**

**Steps**:
1. Apri foglio MENSILE
2. Filtra Codice = "310100"
3. Crea pivot table:
   - Righe: Mese
   - Valori: Saldo
4. Crea grafico lineare
5. Identifica:
   - Trend crescente/decrescente?
   - Picchi anomali?
   - Stagionalità?

---

## CONFRONTO CON ALTRI DATI

### vs Fatture Emesse

**Ricavi contabili (310100, 3000, 3200)**:
```
Filtra SUMMARY: Codice IN (310100, 3000, 3200)
Somma Saldo (dovrebbe essere ~5.9M EUR)
```

**Confronta con**:
- Totale fatture emesse 2024 (da Odoo Sales)
- Delta = Fatture non registrate o errori

### vs Fatture Ricevute

**COGS contabili (410100, 4000, 4200)**:
```
Filtra SUMMARY: Codice IN (410100, 4000, 4200)
Somma Saldo (dovrebbe essere ~3.8M EUR)
```

**Confronta con**:
- Totale fatture ricevute 2024 (da Odoo Purchase)
- Delta = Fatture non registrate

### vs Budget

Se hai un budget 2024, aggiungi colonna in Excel:

```
SUMMARY:
- Colonna "Budget"
- Colonna "Variance" = Saldo - Budget
- Colonna "Variance %" = Variance / Budget * 100
```

---

## RIESECUZIONE SCRIPT

### Script Veloce (Raccomandato)

```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/riconcilia-pl-2024-fast.py
```

**Tempo**: ~1 minuto
**Output**: RICONCILIAZIONE-PL-2024.xlsx (sovrascritto)

### Script Dettagliato (con Anomalie)

```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/riconcilia-pl-2024.py
```

**Tempo**: ~20 minuti
**Output**: RICONCILIAZIONE-PL-2024.xlsx con foglio ANOMALIE extra

**Attenzione**: Molto più lento perché verifica partita doppia per ogni movimento!

---

## PROSSIMI PASSI

1. **Revisione con CFO/Commercialista**
   - Portare report Excel
   - Discutere GM negativo
   - Verificare classificazione conti

2. **Deep Dive Anomalie**
   - Eseguire script dettagliato (20 min)
   - Analizzare foglio ANOMALIE
   - Correggere errori contabili

3. **Implementare Monitoraggio Mensile**
   - Eseguire script ogni mese
   - Confrontare trend
   - Alert automatici su KPI critici

4. **Migliorare Piano Conti**
   - Eliminare conti duplicati
   - Standardizzare nomenclatura
   - Aggiungere centri di costo

---

## FAQ

**Q: Il Gross Margin è davvero negativo?**
A: I dati mostrano GM -2.1M EUR. Verificare con commercialista:
   - Classificazione conti corretta?
   - Tutti i ricavi registrati?
   - Storni legittimi o errori?

**Q: Perché conti finanziari a zero?**
A: Possibile che:
   - Interessi registrati in altri conti (5xxx)
   - Movimenti non ancora contabilizzati
   - Da verificare estratti conto bancari

**Q: Come calcolo EBITDA?**
A:
```
EBITDA = Ricavi - COGS - OPEX + Ammortamenti
EBITDA stimato = -5.9M - 3.8M - 1.8M + Amm = ~-3.9M EUR
(Negativo!)
```

**Q: Posso modificare i range di conti?**
A: Sì, edita script Python:
```python
ACCOUNT_RANGES = {
    'Ricavi': (3000, 3999),
    'COGS': (4000, 4999),
    # Modifica qui
}
```

---

**Supporto**: Per domande, contattare Business Analyst Agent
**Ultima esecuzione**: 2025-11-16 09:42 CET
