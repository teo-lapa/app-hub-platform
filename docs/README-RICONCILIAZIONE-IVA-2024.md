# RICONCILIAZIONE IVA 2024 - EXECUTIVE REPORT

**Data analisi:** 2024-11-16
**Report generato da:** Claude Code - Data Analyst
**Periodo:** 01/01/2024 - 31/12/2024

---

## RISULTATI CHIAVE

### QUADRATURA ANNUALE IVA

| Voce | Importo (CHF) | Note |
|------|---------------|------|
| **IVA Vendite (a debito)** | **141,495.28** | Da conti 2200-2299 |
| **IVA Acquisti (a credito)** | **165,492.98** | Da conti 1170-1179 |
| **SALDO IVA 2024** | **-23,997.70** | **IVA A CREDITO** |

**STATO:** Lapa ha un **CREDITO IVA** di **CHF 23,997.70** per l'anno 2024.

---

## ANALISI TRIMESTRALE

### Q1 2024 (Gen-Mar)
- IVA Vendite: CHF 22,775.35
- IVA Acquisti: CHF 23,683.45
- **Saldo: CHF -908.10 (A CREDITO)**

### Q2 2024 (Apr-Giu)
- IVA Vendite: CHF 48,461.50
- IVA Acquisti: CHF 42,340.47
- **Saldo: CHF 6,121.03 (A DEBITO)**

### Q3 2024 (Lug-Set)
- IVA Vendite: CHF 38,199.54
- IVA Acquisti: CHF 38,523.75
- **Saldo: CHF -324.21 (A CREDITO)**

### Q4 2024 (Ott-Dic)
- IVA Vendite: CHF 32,058.89
- IVA Acquisti: CHF 60,945.31
- **Saldo: CHF -28,886.42 (A CREDITO)**

**ATTENZIONE:** Q4 ha un credito IVA molto alto (CHF -28,886), da verificare se ci sono acquisti straordinari o errori.

---

## ERRORI IDENTIFICATI

**TOTALE ERRORI: 5,314**

### Breakdown per tipo:

1. **ALIQUOTA_NON_STANDARD (2,402 errori in vendite)**
   - Aliquote IVA vendite diverse da 7.7%, 2.5%, 3.7%, 0%
   - CAUSA: Importi IVA calcolati con aliquote 8.09%, 8.10%, 8.11%, ecc.
   - AZIONE: Verificare se sono errori di calcolo o arrotondamenti

2. **ALIQUOTA_NON_STANDARD_ACQUISTI (2,694 errori in acquisti)**
   - Aliquote IVA acquisti diverse dagli standard
   - CAUSA: Stessi problemi di calcolo
   - AZIONE: Controllare fatture fornitori

3. **IVA_SENZA_BASE_IMPONIBILE (155 errori)**
   - Movimenti con IVA ma base imponibile = 0
   - CAUSA: Errore di registrazione o movimento manuale
   - AZIONE: **CRITICO - Correggere immediatamente**

4. **POSSIBILE_DUPLICATO (63 casi)**
   - Fatture con stesso importo IVA nello stesso giorno
   - CAUSA: Possibili duplicazioni in contabilita
   - AZIONE: Verificare manualmente

---

## PROBLEMI CRITICI DA RISOLVERE

### 1. Aliquote IVA "strane" (8.09%, 8.10%, 8.11%)

**PROBLEMA:** La Svizzera ha aliquote IVA standard:
- 7.7% (normale)
- 2.5% (ridotta)
- 3.7% (alloggio)

Gli errori con aliquote 8.09%, 8.10%, 8.11% indicano che:
- L'IVA viene calcolata AL CONTRARIO (dal lordo invece che sul netto)
- Formula sbagliata: `IVA = Totale * 8.10%` invece di `IVA = Netto * 7.7%`

**CORREZIONE:**
```
IVA corretta = Imponibile * 7.7 / 100
NON: IVA = Totale * (7.7 / 107.7)
```

### 2. Q4 2024 con credito IVA enorme

**PROBLEMA:** Nel Q4 il credito IVA è CHF -28,886 (molto alto).

**POSSIBILI CAUSE:**
- Acquisti straordinari (macchinari, investimenti?)
- Fatture registrate in anticipo
- Errori di data (fatture 2025 in 2024?)

**AZIONE:** Verificare tutti gli acquisti di ottobre, novembre, dicembre 2024.

### 3. IVA senza base imponibile (155 casi)

**PROBLEMA:** 155 movimenti hanno IVA ma base imponibile = 0.

**AZIONE URGENTE:** Questi movimenti DEVONO essere corretti prima della dichiarazione IVA.

---

## DETTAGLI MENSILI - IVA VENDITE

| Mese | IVA Vendite (CHF) | Note |
|------|-------------------|------|
| Gen 2024 | 11,829.33 | |
| Feb 2024 | -4,727.15 | **NEGATIVO - Verificare!** |
| Mar 2024 | 15,673.17 | |
| Apr 2024 | 14,078.37 | |
| Mag 2024 | 19,962.20 | Mese piu alto |
| Giu 2024 | 14,420.93 | |
| Lug 2024 | 11,957.87 | |
| Ago 2024 | 13,146.37 | |
| Set 2024 | 13,095.30 | |
| Ott 2024 | 5,982.67 | Basso |
| Nov 2024 | 14,549.31 | |
| Dic 2024 | 11,526.91 | |

**ATTENZIONE:** Febbraio 2024 ha IVA vendite NEGATIVA (CHF -4,727). Questo indica:
- Note di credito molto alte
- Errore di registrazione
- DA VERIFICARE URGENTEMENTE

---

## DETTAGLI MENSILI - IVA ACQUISTI

| Mese | IVA Acquisti (CHF) | Note |
|------|---------------------|------|
| Gen 2024 | 8,311.59 | |
| Feb 2024 | 8,942.03 | |
| Mar 2024 | 6,429.83 | |
| Apr 2024 | 12,718.96 | |
| Mag 2024 | 18,137.48 | Alto |
| Giu 2024 | 11,484.03 | |
| Lug 2024 | 13,360.99 | |
| Ago 2024 | 9,466.56 | |
| Set 2024 | 15,696.20 | |
| Ott 2024 | 11,899.26 | |
| Nov 2024 | 15,028.58 | |
| Dic 2024 | 34,017.47 | **MOLTO ALTO - Verificare!** |

**ATTENZIONE:** Dicembre 2024 ha acquisti IVA DOPPI rispetto alla media (CHF 34,017).
- Media mensile: CHF 13,791
- Dicembre: CHF 34,017 (247% della media!)

**AZIONE:** Verificare tutti gli acquisti di dicembre 2024.

---

## FILE GENERATI

### 1. RICONCILIAZIONE-IVA-2024.xlsx (510 KB)

Fogli Excel:
1. **Riepilogo Generale** - Totali e KPI
2. **IVA Vendite Mensile** - Breakdown per mese e aliquota
3. **IVA Acquisti Mensile** - Breakdown per mese e aliquota
4. **Quadratura Trimestrale** - Saldi trimestrali
5. **ERRORI IVA** - Lista completa 5,314 errori (IMPORTANTE!)
6. **Dettaglio Vendite** - Tutti i movimenti vendite (3,857 righe)
7. **Dettaglio Acquisti** - Tutti i movimenti acquisti (3,104 righe)

### 2. riconciliazione-iva-2024.json (1.4 MB)

Dati JSON completi per analisi ulteriori.

---

## AZIONI IMMEDIATE

### PRIORITA 1 (URGENTE)
1. **Correggere i 155 movimenti con IVA ma base imponibile = 0**
   - Apri foglio "ERRORI IVA"
   - Filtra per tipo: "IVA_SENZA_BASE_IMPONIBILE"
   - Correggi in Odoo ogni movimento

2. **Verificare Febbraio 2024 (IVA vendite negativa)**
   - Controllare note di credito febbraio
   - Verificare se ci sono errori di registrazione

3. **Verificare Dicembre 2024 (acquisti doppi)**
   - Controllare tutti gli acquisti dicembre
   - Verificare se ci sono fatture duplicate

### PRIORITA 2 (IMPORTANTE)
4. **Correggere aliquote IVA sbagliate (5,096 errori)**
   - Verificare configurazione tasse in Odoo
   - Controllare formula calcolo IVA

5. **Verificare i 63 possibili duplicati**
   - Apri foglio "ERRORI IVA"
   - Filtra per tipo: "POSSIBILE_DUPLICATO"
   - Verifica manualmente

### PRIORITA 3 (CONTROLLO)
6. **Confrontare con dichiarazioni IVA trimestrali**
   - Controllare se i totali coincidono
   - Verificare versamenti effettuati

---

## CONCLUSIONI

### QUADRATURA GENERALE
- IVA 2024 quadrata a livello contabile
- **Saldo finale: CHF -23,997.70 (A CREDITO)**
- Lapa puo richiedere rimborso o compensare con trimestri futuri

### ERRORI DA CORREGGERE
- **5,314 errori identificati** (principalmente aliquote sbagliate)
- **155 errori CRITICI** (IVA senza base imponibile)
- **63 possibili duplicati**

### MESI ANOMALI
- **Febbraio 2024:** IVA vendite negativa (CHF -4,727)
- **Dicembre 2024:** Acquisti IVA doppi (CHF 34,017)

### PROSSIMI STEP
1. Correggere errori critici (Priorita 1)
2. Verificare mesi anomali
3. Ricalcolare dopo correzioni
4. Preparare dichiarazione IVA finale

---

**GENERATO DA:** Claude Code - Data Analyst
**SCRIPT:** `scripts/riconciliazione-iva-2024.py`
**CONNESSIONE ODOO:** lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com

**PER SUPPORTO:** Esegui `python scripts/riconciliazione-iva-2024.py` per rigenerare il report.
