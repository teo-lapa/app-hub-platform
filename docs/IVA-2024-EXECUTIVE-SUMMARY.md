# IVA 2024 - EXECUTIVE SUMMARY (1 PAGINA)

**Data:** 2024-11-16 | **Analisi:** 6,961 movimenti contabili | **Periodo:** Gen-Dic 2024

---

## QUADRATURA IVA 2024

| | Importo (CHF) | Stato |
|---|---:|:---:|
| **IVA Vendite (a debito)** | 141,495.28 | 3,857 movimenti |
| **IVA Acquisti (a credito)** | 165,492.98 | 3,104 movimenti |
| **SALDO IVA 2024** | **-23,997.70** | **A CREDITO** |

**Lapa ha un CREDITO IVA di CHF 23,997.70 per il 2024** (puo richiedere rimborso o compensare).

---

## ANALISI TRIMESTRALE

| Trimestre | Vendite | Acquisti | Saldo | Stato |
|---|---:|---:|---:|---|
| Q1 2024 | 22,775 | 23,683 | -908 | A CREDITO |
| Q2 2024 | 48,462 | 42,340 | +6,121 | **A DEBITO** |
| Q3 2024 | 38,200 | 38,524 | -324 | A CREDITO |
| Q4 2024 | 32,059 | 60,945 | **-28,886** | **A CREDITO ALTO!** |

**ALERT:** Q4 ha credito IVA molto alto (CHF -28,886) - verificare acquisti straordinari.

---

## ERRORI IDENTIFICATI: 5,314

### Breakdown:
1. **Aliquote IVA non standard** (5,096 errori)
   - Aliquote 8.09%, 8.10%, 8.11% invece di 7.7%, 2.5%, 3.7%
   - CAUSA: Formula calcolo IVA imprecisa (arrotondamenti)
   - PRIORITA: Bassa (non bloccante)

2. **IVA senza base imponibile** (155 errori) - **CRITICO!**
   - CAUSE PRINCIPALI:
     - Versamenti IVA all'ESTV registrati su conti IVA (anziche banca)
     - Contributi Reservesuisse registrati con IVA (errore!)
     - Movimenti manuali incompleti
   - PRIORITA: **MASSIMA - Blocca dichiarazione IVA**

3. **Possibili duplicati** (63 casi)
   - Fatture con stesso importo IVA nello stesso giorno
   - PRIORITA: Media (verificare manualmente)

---

## MESI ANOMALI DA VERIFICARE

### Febbraio 2024: IVA Vendite NEGATIVA
- Importo: CHF -4,727 (unico mese negativo)
- CAUSA: Note di credito molto alte
- AZIONE: Verificare se sono reali o errori di data

### Dicembre 2024: Acquisti IVA DOPPI
- Importo: CHF 34,017 (247% della media!)
- Media mensile: CHF 13,791
- CAUSA: Acquisti straordinari o fatture duplicate?
- AZIONE: Controllare top 10 acquisti dicembre

---

## AZIONI IMMEDIATE (QUESTA SETTIMANA)

### 1. Correggere 155 errori critici
- [ ] Identificare versamenti ESTV (Move ID: 72921, 64569, 72503...)
- [ ] Riclassificare da conto 2200 a Banca
- [ ] Identificare contributi Reservesuisse (~130 movimenti)
- [ ] Riclassificare da conto 2200/1170 a 6700 (Spese)
- [ ] Correggere movimenti con descrizione "False"

### 2. Verificare mesi anomali
- [ ] Febbraio 2024: Analizzare note di credito
- [ ] Dicembre 2024: Verificare top 10 acquisti

### 3. Ricalcolare dopo correzioni
- [ ] Rieseguire: `python scripts/riconciliazione-iva-2024.py`
- [ ] Verificare errori critici = 0
- [ ] Confermare nuovo saldo IVA

---

## FILE GENERATI

1. **RICONCILIAZIONE-IVA-2024.xlsx** (510 KB)
   - 7 fogli Excel con dettagli completi
   - Foglio "ERRORI IVA" con 5,314 righe da verificare

2. **riconciliazione-iva-2024.json** (1.4 MB)
   - Dati JSON per analisi ulteriori

3. **README-RICONCILIAZIONE-IVA-2024.md**
   - Report completo con spiegazioni

4. **QUICK-ACTIONS-IVA-2024.md**
   - Guida pratica per correzioni

5. **ERRORI-CRITICI-IVA-2024.md**
   - Analisi dettagliata 155 errori critici

---

## NEXT STEPS

**OGGI:**
1. Aprire Excel > Foglio "ERRORI IVA"
2. Filtrare per "IVA_SENZA_BASE_IMPONIBILE"
3. Iniziare correzioni manuali in Odoo

**QUESTA SETTIMANA:**
1. Completare correzione 155 errori
2. Verificare febbraio e dicembre 2024
3. Ricalcolare quadratura IVA

**PROSSIMA SETTIMANA:**
1. Confrontare con dichiarazioni IVA trimestrali
2. Preparare dichiarazione IVA annuale
3. Decidere su rimborso credito CHF 23,997.70

---

**SCRIPT:** `scripts/riconciliazione-iva-2024.py`
**ODOO:** lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
**GENERATO DA:** Claude Code - Data Analyst
