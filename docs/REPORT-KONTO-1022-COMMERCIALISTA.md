# REPORT RICONCILIAZIONE KONTO 1022 - OUTSTANDING RECEIPTS
## Analisi Commercialista - 16 Novembre 2025

---

## EXECUTIVE SUMMARY

**Konto:** 1022 Outstanding Receipts
**Righe non riconciliate:** 219
**Saldo:** CHF -44,248.51

**Status:** CRITICO - Richiede intervento immediato

---

## SALDO ATTUALE

| Tipo | Importo CHF |
|------|-------------|
| Dare (Entrate) | 639,780.91 |
| Avere (Uscite) | 684,029.42 |
| **SALDO** | **-44,248.51** |

**Interpretazione:**
Il saldo negativo indica che ci sono più uscite che entrate registrate in Outstanding Receipts. Questo è anomalo per un conto transitorio che dovrebbe normalmente avere saldo zero.

---

## CLASSIFICAZIONE RIGHE

| Categoria | Righe | Importo CHF | % |
|-----------|-------|-------------|---|
| **Pagamenti Clienti** | 203 | 449,253.37 | 92.7% |
| **Chiusure Contabili** | 4 | -495,854.91 | - |
| **Rimborsi Fornitori** | 12 | 2,353.03 | 5.5% |
| **TOTALE** | **219** | **-44,248.51** | **100%** |

---

## ANALISI DETTAGLIATA

### 1. PAGAMENTI CLIENTI (203 righe - CHF 449,253.37)

**Problema:**
Pagamenti clienti registrati in Outstanding Receipts ma NON riconciliati con fatture.

**Cause possibili:**
- Pagamenti incassati ma non allocati a fatture
- Fatture pagate prima dell'emissione (anticipi)
- Errori di registrazione contabile
- Pagamenti parziali non riconciliati

**Esempi:**

| ID | Partner | Data | Importo CHF |
|----|---------|------|-------------|
| 539152 | CLIENTI PRIVATI | 2025-11-04 | 160.31 |
| 238991 | CUMANO SA (CAPOCACCIA) | 2024-06-25 | 2,199.06 |
| 238989 | CUMANO SA (CAPOCACCIA) | 2024-06-25 | 2,391.81 |
| 167842 | HALTEN GASTRO GMBH | 2024-05-13 | 18,337.43 |
| 155002 | Cherli De Cocinis Party Service | 2024-04-02 | 51.32 |

**Nota:** Molte righe sono di importo centesimale (0.01-0.05 CHF), probabilmente differenze di arrotondamento.

---

### 2. CHIUSURE CONTABILI (4 righe - CHF -495,854.91)

**Dettaglio:**

| ID | Move | Data | Dare CHF | Avere CHF |
|----|------|------|----------|-----------|
| 540935 | Unificazione veicoli da 1616 | 2024-12-31 | 0.00 | 130,552.85 |
| 541030 | SLR/2024/12/0015 | 2024-12-31 | 183,395.49 | 0.00 |
| 541027 | SLR/2024/12/0013 | 2024-12-31 | 0.00 | 366,046.52 |

**Totale Dare:** CHF 183,395.49
**Totale Avere:** CHF 679,250.40
**Bilancio:** CHF -495,854.91

**Problema:**
Queste sono chiusure contabili di fine anno 2024. Tentativo di riconciliarle automaticamente ha fallito perché coinvolgono conti diversi (1022 vs 3900).

**Raccomandazione:**
Verificare con commercialista se queste chiusure sono corrette. Potrebbero richiedere:
- Storno e ri-registrazione corretta
- Riconciliazione manuale multi-conto
- Nota esplicativa per revisore

---

### 3. RIMBORSI FORNITORI (12 righe - CHF 2,353.03)

**Dettaglio:**

| ID | Partner | Data | Importo CHF |
|----|---------|------|-------------|
| 358949 | MUSATI SAGL | 2025-01-30 | 0.02 |
| 339983 | ALIGRO Demaurex & Cie SA | 2024-12-30 | 260.72 |
| 312769 | CA.FORM S.R.L. | 2024-11-18 | 31.20 |
| 167680 | PROSCIUTTIFICIO MONTEVECCHIO S.R.L. | 2024-05-13 | 0.02 |
| 157762 | PRODEGA MARKT TRANSGOURMET SCHWEIZ AG | 2024-04-08 | 1,061.10 |

**Problema:**
Rimborsi fornitori registrati in 1022 (Outstanding Receipts) invece che in 2000 (Accounts Payable).

**Raccomandazione:**
**RICLASSIFICARE** da Konto 1022 a Konto 2000 con registrazione di storno e riapertura.

---

## PROBLEMI IDENTIFICATI

### 1. Saldo Negativo Anomalo
Un conto Outstanding Receipts dovrebbe normalmente avere saldo zero. Il saldo negativo di CHF -44,248.51 indica:
- Uscite superiori alle entrate
- Possibili errori di classificazione
- Chiusure contabili non riconciliate

### 2. Chiusure 31/12/2024 Non Riconciliate
Le chiusure contabili di fine anno coinvolgono controparti in Konto 3900 (Changes in inventories). L'API standard di riconciliazione Odoo non può gestirle perché richiede stesso conto.

### 3. Rimborsi Fornitori Misclassificati
12 rimborsi fornitori (CHF 2,353.03) sono erroneamente in 1022 invece che in 2000.

### 4. 203 Pagamenti Non Allocati
Pagamenti clienti incassati ma non riconciliati con fatture. Questo crea:
- Saldo inflazionato in Outstanding Receipts
- Difficoltà nel tracking crediti clienti
- Problemi per revisione contabile

---

## RACCOMANDAZIONI IMMEDIATE

### PRIORITA 1: Gestire Chiusure 31/12/2024

**Azioni:**
1. Verificare con commercialista la correttezza delle chiusure
2. Se corrette: creare riconciliazione manuale multi-conto in Odoo
3. Se errate: stornare e ri-registrare correttamente

**Impatto:** Risolverebbe CHF -495,854.91 del saldo

---

### PRIORITA 2: Riclassificare Rimborsi Fornitori

**Azioni:**
1. Identificare tutte le 12 righe di rimborsi fornitori
2. Creare registrazione di storno in 1022
3. Riaprire in 2000 (Accounts Payable)
4. Riconciliare con fatture fornitori

**Impatto:** Risolverebbe CHF 2,353.03

---

### PRIORITA 3: Riconciliare Pagamenti Clienti

**Azioni:**
1. Per importi > CHF 100: riconciliazione manuale con fatture
2. Per importi centesimali (< CHF 1): valutare write-off
3. Utilizzare funzione "Automatic Reconciliation" di Odoo per batch

**Impatto:** Risolverebbe CHF 449,253.37

---

## STIMA TEMPO RICHIESTO

| Attività | Tempo | Chi |
|----------|-------|-----|
| Verificare chiusure 31/12 | 2 ore | Commercialista |
| Riclassificare rimborsi | 1 ora | Contabile |
| Riconciliare pagamenti (batch) | 4 ore | Contabile |
| Write-off centesimi | 30 min | Contabile |
| Verifica finale | 1 ora | Commercialista |
| **TOTALE** | **8.5 ore** | |

---

## NEXT STEPS

1. **OGGI:** Condividere report con commercialista
2. **LUNEDI:** Decisione su chiusure 31/12
3. **MARTEDI:** Riclassificazione rimborsi fornitori
4. **MERCOLEDI:** Batch riconciliazione pagamenti
5. **GIOVEDI:** Write-off centesimi
6. **VENERDI:** Verifica finale e chiusura

**Target:** Saldo Konto 1022 = CHF 0.00 entro Venerdi 22 Novembre 2025

---

## FILES GENERATI

1. `report_1022_riconciliazione_20251116_174809.json` - Analisi completa riga per riga
2. `report_1022_analisi_commercialista_20251116_174937.json` - Classificazione e raccomandazioni
3. `REPORT-KONTO-1022-COMMERCIALISTA.md` - Questo report esecutivo

---

## CONTATTI

**Analisi eseguita da:** Claude Code (Backend Specialist)
**Data:** 16 Novembre 2025
**Odoo Instance:** lapadevadmin-lapa-v2-staging-2406-25408900
**Konto analizzato:** 1022 Outstanding Receipts

**Per domande:** paul@lapa.ch

---

*Report generato automaticamente con script Python + Odoo XML-RPC API*
