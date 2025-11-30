# KONTO 1026 - NEXT STEPS

**Status Attuale**: Analisi completata, soluzione pronta
**Data**: 16 Novembre 2025

---

## QUICK START

```bash
# 1. Leggi executive summary
cat KONTO-1026-EXECUTIVE-SUMMARY.md

# 2. Esegui eliminazione movimenti errati
python scripts/elimina-moves-errati-1026.py

# 3. Verifica nuovo saldo
python scripts/analizza-konto-1026-creditsuisse.py
```

---

## COSA ABBIAMO FATTO

✅ **Analizzato 3,325 movimenti** del conto 1026
✅ **Identificato gap di CHF 466,983**
✅ **Trovato causa**: 3-4 movimenti errati di "azzeramento"
✅ **Preparato script** di correzione automatica
✅ **Documentato tutto** in 4 file report

---

## COSA FARE ORA

### STEP 1: Eliminare Movimenti Errati (5 minuti)

```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts\elimina-moves-errati-1026.py
```

**Conferma richiesta**: Devi scrivere "SI ELIMINA"

**Risultato atteso**:
- Saldo prima: CHF 491,880.73
- Saldo dopo: CHF 298,142.32
- Gap ridotto da 467K a 273K

---

### STEP 2: Verificare Rettifica 31.12.2023 (1 ora)

**Richiedere al commercialista**:
- Estratto conto Credit Suisse 31.12.2023
- Saldo esatto a fine 2023

**Confrontare con Odoo**:
```
Saldo Odoo 31.12.2023: CHF 100,903.87
Saldo estratto conto: CHF ????????
```

**Se saldi NON corrispondono**:
- Potrebbe servire eliminare anche Move 95447
- O correggere l'importo della rettifica

---

### STEP 3: Riconciliazione Bancaria 2024 (2-3 ore)

**Scaricare estratti conto Credit Suisse**:
- Gennaio 2024
- Febbraio-Dicembre 2024
- Ultima chiusura disponibile

**Importare in Odoo**:
- Usare funzione "Import Bank Statements"
- Riconciliare automaticamente dove possibile
- Riconciliare manualmente le partite aperte

**Identificare discrepanze**:
- Transazioni mancanti in Odoo
- Duplicati (es. i molti "Pagamento clearing" da CHF 20K)
- Differenze cambio
- Commissioni non registrate

---

### STEP 4: Analisi Movimenti Clearing (1 ora)

**Pattern sospetto trovato**:
- Molti "Pagamento clearing" da CHF 20,000 esatti
- Da gennaio a luglio 2024
- Potrebbero essere trasferimenti interni LAPA

**Verificare**:
```bash
python scripts/analizza-clearing-1026.py
```

**Domande**:
1. Ogni clearing ha una contropartita su altro conto?
2. Ci sono duplicati?
3. Sono tutti reali?

---

## FILE DISPONIBILI

### Report
- `KONTO-1026-EXECUTIVE-SUMMARY.md` - Summary 1 pagina
- `SOLUZIONE-KONTO-1026-DEFINITIVA.md` - Analisi completa
- `REPORT-KONTO-1026-GAP-ANALYSIS.md` - Report tecnico dettagliato
- `KONTO-1026-NEXT-STEPS.md` - Questo file

### Dati JSON
- `analisi-konto-1026-report.json` - Tutti i movimenti analizzati
- `apertura-2024-konto-1026.json` - Movimenti gennaio 2024

### Script Python
- `scripts/analizza-konto-1026-creditsuisse.py` - Analisi completa
- `scripts/trova-apertura-2024-konto-1026.py` - Analisi apertura
- `scripts/analizza-moves-azzeramento.py` - Dettaglio moves
- `scripts/elimina-moves-errati-1026.py` - CORREZIONE (PRONTO)

---

## DOMANDE APERTE

### Per il Commercialista

1. **Saldo Credit Suisse al 31.12.2023**: Qual è il saldo reale?

2. **Saldo atteso CHF 24,897.72**: Da dove viene?
   - È il saldo attuale da estratto conto?
   - È un saldo target/budget?

3. **Movimenti clearing**: Sono tutti legittimi?

4. **Rettifica 31.12.2023 (Move 95447)**: È corretta?

### Per Analisi Tecnica

5. **Gap residuo CHF 273K**: Serve ulteriore indagine su:
   - Saldo apertura 2024
   - Duplicati clearing
   - Differenze cambio
   - Commissioni

---

## TIMELINE CONSIGLIATA

| Giorno | Attività | Tempo | Output |
|--------|----------|-------|--------|
| **Oggi** | Eliminare 3 moves errati | 10 min | Saldo corretto a ~298K |
| **Domani** | Richiedere estratti conto | 30 min | Email a banca |
| **+2 gg** | Ricevere estratti + verificare | 2 ore | Conferma saldi |
| **+3 gg** | Riconciliazione bancaria completa | 3 ore | Movimenti allineati |
| **+4 gg** | Eliminare ulteriori errori se trovati | 1 ora | Gap residuo <10K |
| **+5 gg** | Chiusura e verifica finale | 1 ora | Saldo corretto ✓ |

---

## RISCHI

⚠️ **Eliminazione irreversibile**: Lo script elimina definitivamente i movimenti. Backup consigliato.

⚠️ **Gap residuo**: Anche dopo correzione, resta gap di ~273K da analizzare.

⚠️ **Movimenti 2023**: 16 movimenti datati 2023 potrebbero contenere altri errori.

⚠️ **Duplicati clearing**: Pattern sospetto da verificare manualmente.

---

## SUPPORT

**Analisi tecnica**: Backend Specialist
**Script**: Tutti in `scripts/`
**Dati**: Tutti in JSON nella root

**Per domande**: Consulta i file report o riesegui gli script di analisi.

---

## CHECKLIST FINALE

Prima di considerare il problema risolto:

- [ ] Eliminati 3 movimenti errati (58103, 58101, 95413)
- [ ] Verificato saldo 31.12.2023 con estratto conto
- [ ] Deciso su Move 95447 (mantenere o eliminare)
- [ ] Importati estratti conto 2024 in Odoo
- [ ] Riconciliazione bancaria completata
- [ ] Verificati movimenti clearing (no duplicati)
- [ ] Gap residuo <CHF 1,000
- [ ] Saldo Odoo = Saldo estratto conto
- [ ] Commercialista approva il saldo finale

---

**READY TO GO!**

Inizia con:
```bash
python scripts\elimina-moves-errati-1026.py
```
