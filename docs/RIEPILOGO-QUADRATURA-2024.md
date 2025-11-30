# VERIFICA QUADRATURA GENERALE CONTABILITA 2024

**Data verifica**: 16 novembre 2025
**File generato**: `VERIFICA-QUADRATURA-2024.xlsx`
**Script**: `scripts/verifica-quadratura-2024-fast.py`

---

## EXECUTIVE SUMMARY

### QUADRATURA GENERALE (DARE = AVERE)

| Metrica | Valore | Status |
|---------|--------|--------|
| **Totale DARE** | 53,348,393.70 CHF | OK |
| **Totale AVERE** | 53,348,393.70 CHF | OK |
| **Differenza** | 0.00 CHF | ✅ **OK** |
| **Severity** | OK | ✅ |

**RISULTATO**: La contabilità QUADRA perfettamente. L'equazione DARE = AVERE è soddisfatta al centesimo.

---

## DETTAGLI ANALISI

### 1. TRIAL BALANCE
- **Conti analizzati**: 112
- **Movimenti contabili 2024**: 131,392
- **Periodo**: 01.01.2024 - 31.12.2024
- **Stato registrazioni**: Solo registrazioni validate (posted)

### 2. QUADRATURA MENSILE

Tutti i mesi quadrano perfettamente:

| Mese | DARE (CHF) | AVERE (CHF) | Differenza | Status |
|------|------------|-------------|------------|--------|
| Gen 2024 | 9,259,311.86 | 9,259,311.86 | 0.00 | ✅ OK |
| Feb 2024 | 3,665,867.29 | 3,665,867.29 | 0.00 | ✅ OK |
| Mar 2024 | 3,610,571.96 | 3,610,571.96 | 0.00 | ✅ OK |
| Apr 2024 | 3,370,103.61 | 3,370,103.61 | 0.00 | ✅ OK |
| Mag 2024 | 4,255,155.62 | 4,255,155.62 | 0.00 | ✅ OK |
| Giu 2024 | 3,313,287.16 | 3,313,287.16 | 0.00 | ✅ OK |
| Lug 2024 | 3,260,997.13 | 3,260,997.13 | 0.00 | ✅ OK |
| Ago 2024 | 2,930,132.26 | 2,930,132.26 | 0.00 | ✅ OK |
| Set 2024 | 2,965,066.55 | 2,965,066.55 | 0.00 | ✅ OK |
| Ott 2024 | 3,142,054.46 | 3,142,054.46 | 0.00 | ✅ OK |
| Nov 2024 | 2,959,236.75 | 2,959,236.75 | 0.00 | ✅ OK |
| Dic 2024 | 10,616,609.05 | 10,616,609.05 | 0.00 | ✅ OK |

**RISULTATO**: Nessun disallineamento mensile rilevato.

---

## PROBLEMI RILEVATI

### 🔴 CRITICAL: CONTI SOSPESI NON CHIUSI

I seguenti conti sospesi/transitivi presentano saldi residui a fine anno:

| Codice | Nome | Saldo (CHF) | Severity | Status |
|--------|------|-------------|----------|--------|
| **1022** | Outstanding Receipts | 17,996.39 | 🔴 CRITICAL | NON CHIUSO |
| **1023** | Outstanding Payments | 102,969.34 | 🔴 CRITICAL | NON CHIUSO |
| **1024** | UBS-CHF, 278-122087.01J | -22,197.52 | 🔴 CRITICAL | NON CHIUSO |
| **10901** | Trasferimento di liquidità | 256,297.61 | 🔴 CRITICAL | NON CHIUSO |
| **1099** | Transfer account: miscellaneous | -0.00 | ✅ OK | CHIUSO |

**TOTALE CONTI SOSPESI NON CHIUSI**: 4

#### AZIONE RICHIESTA:
- **Conto 1022** (Outstanding Receipts): 17,996.39 CHF da riconciliare
- **Conto 1023** (Outstanding Payments): 102,969.34 CHF da riconciliare
- **Conto 1024** (UBS-CHF): -22,197.52 CHF da verificare
- **Conto 10901** (Trasferimento liquidità): 256,297.61 CHF da chiudere

---

### 🔴 CRITICAL: PATRIMONIO NETTO

| Metrica | Valore (CHF) |
|---------|--------------|
| **Ricavi totali** | 2,110,374.03 |
| **Costi totali** | 1,781,126.07 |
| **Utile/Perdita calcolato** | **329,247.96** |
| **Conto 2900 (Utile/Perdita esercizio)** | **0.00** |
| **Differenza** | **329,247.96** |
| **Severity** | 🔴 **CRITICAL** |

**PROBLEMA**: Il conto 2900 (Utile/Perdita esercizio) è a ZERO, mentre l'utile calcolato è 329,247.96 CHF.

#### POSSIBILI CAUSE:
1. Utile non ancora allocato al conto 2900
2. Scritture di chiusura esercizio mancanti
3. Allocazione utile a riserve non registrata

#### AZIONE RICHIESTA:
Verificare e registrare l'allocazione dell'utile d'esercizio:
```
DARE: Conto Economico (Ricavi - Costi)  329,247.96 CHF
AVERE: Conto 2900 (Utile esercizio)     329,247.96 CHF
```

---

### ⚠️  WARNING: CONTROPARTITE MANCANTI

**Movimenti con problemi rilevati**: 13 (su campione analizzato)

Alcuni movimenti contabili presentano anomalie:
- Righe contabili senza contropartita
- Registrazioni con solo DARE o solo AVERE

**AZIONE RICHIESTA**: Verificare nel dettaglio i movimenti segnalati nel foglio "CONTROPARTITE MANCANTI" del file Excel.

---

## FILE EXCEL GENERATO

Il file `VERIFICA-QUADRATURA-2024.xlsx` contiene:

1. **EXECUTIVE SUMMARY**: Riepilogo generale
2. **TRIAL BALANCE**: Bilancio di verifica completo (112 conti)
3. **QUADRATURA MENSILE**: Dettaglio mensile Gen-Dic 2024
4. **CONTI SOSPESI**: Analisi conti sospesi/transitivi
5. **CONTROPARTITE MANCANTI**: Sample movimenti con problemi

---

## CONCLUSIONI

### ✅ PUNTI POSITIVI:
1. **Quadratura generale PERFETTA**: DARE = AVERE al centesimo
2. **Quadratura mensile OK**: Tutti i 12 mesi quadrano
3. **Conto 1099 chiuso**: Unico conto sospeso correttamente a zero

### 🔴 PUNTI CRITICI DA RISOLVERE:
1. **4 conti sospesi non chiusi** per totale ~355,000 CHF
2. **Patrimonio Netto non allocato**: Utile 329,247.96 CHF non registrato in conto 2900
3. **13 movimenti con anomalie** da verificare

### PRIORITA' AZIONI:

**URGENTE**:
1. Chiudere conto 10901 (Trasferimento liquidità) - 256,297.61 CHF
2. Riconciliare conto 1023 (Outstanding Payments) - 102,969.34 CHF
3. Allocare utile d'esercizio a conto 2900 - 329,247.96 CHF

**IMPORTANTE**:
4. Riconciliare conto 1022 (Outstanding Receipts) - 17,996.39 CHF
5. Verificare conto 1024 (UBS-CHF) - -22,197.52 CHF
6. Analizzare movimenti con contropartite mancanti

---

## NOTE TECNICHE

### Script eseguito:
```bash
python scripts/verifica-quadratura-2024-fast.py
```

### Connessione Odoo:
- URL: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
- Database: lapadevadmin-lapa-v2-staging-2406-25408900
- User: paul@lapa.ch

### Criteri di verifica:
- Periodo: 01.01.2024 - 31.12.2024
- Solo registrazioni validate (state = 'posted')
- Limite movimenti analizzati: 150,000
- Tolleranza differenze: 0.01 CHF (1 centesimo)

---

**Report generato automaticamente il 16.11.2025**
