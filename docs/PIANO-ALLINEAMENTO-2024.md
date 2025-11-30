# PIANO ALLINEAMENTO COMPLETO CONTABILITÀ 2024

## SITUAZIONE AL 31/12/2024

### 1. DOCUMENTI BANCARI - SALDI FINALI

**CONTI PRINCIPALI:**
| Banca | Numero Conto | Valuta | Saldo Finale | Saldo in CHF |
|-------|--------------|--------|--------------|--------------|
| UBS CHF | 8701 J | CHF | 182,613.26 | 182,613.26 |
| UBS EUR | 8760 A | EUR | 128,860.70 | 119,840.45 |
| Credit Suisse | 3977497-51 | CHF | 11,120.67 | 11,120.67 |
| Credit Suisse | 3977497-51-1 | CHF | 13,777.05 | 13,777.05 |
| **TOTALE 3 CONTI PRINCIPALI** | | | | **327,351.43** |

**CONTI SECONDARI:**
| Banca | Tipo | Valuta | Saldo Finale |
|-------|------|--------|--------------|
| UBS Privatkonto | Paul/Laura privato | CHF | 23,783.88 |
| UBS SWISS-GOV | COVID | CHF | -116,500.00 |
| UBS Pagare | Altro | EUR | 76.59 |
| UBS | USD | USD | 92.63 |
| UBS Sparkonto | Risparmio | CHF | 0.00 |

**TRANSAZIONI TOTALI NEL 2024:**
- UBS CHF: 4,015 transazioni
- UBS EUR: 703 transazioni
- Credit Suisse: Da verificare PDF
- **TOTALE: ~5,000 transazioni**

---

### 2. ODOO - SALDI AL 31/12/2024

**DA VERIFICARE:**
| Konto Odoo | Descrizione | Saldo Odoo | Documento Corrispondente |
|------------|-------------|------------|--------------------------|
| 1024 | UBS CHF 278-122087.01J | 67,550.94 | UBS CHF 8701 J |
| 1025 | EUR-UBS 278-122087.60A | 108,267.67 | UBS EUR 8760 A |
| 1026 | CHF-CRS PRINCIPALE 3977497-51 | 461,453.70 | Credit Suisse |
| 1034 | UBS CHF 278-122087.02U | 94.26 | ? |
| 10230 | USD-UBS 278-122087.61V | 161.99 | UBS USD |
| 10224 | UBS CHF COVID-KONTO | -300,949.20 | SWISS-GOV |

**DISCREPANZE IDENTIFICATE:**
- UBS CHF: Documenti CHF 182,613 vs Odoo CHF 67,551 = **MANCANO CHF 115,062**
- UBS EUR: Documenti EUR 128,861 vs Odoo EUR 108,268 = **MANCANO EUR 20,593**
- Credit Suisse: Documenti CHF 24,898 vs Odoo CHF 461,454 = **ECCESSO CHF 436,556** ❓

---

## PIANO DI ALLINEAMENTO MESE PER MESE

### FASE 1: ANALISI COMPLETA (Agenti paralleli)

Lanciare **5 AGENTI IN PARALLELO** per analizzare:

**AGENTE 1 - UBS CHF Analyzer:**
- Analizzare tutti i 4 trimestri CSV (Q1, Q2, Q3, Q4)
- Estrarre saldo inizio e fine di OGNI MESE
- Confrontare con Odoo mese per mese
- Identificare transazioni mancanti

**AGENTE 2 - UBS EUR Analyzer:**
- Analizzare i 2 semestri CSV (H1, H2)
- Estrarre saldo inizio e fine di OGNI MESE
- Confrontare con Odoo mese per mese
- Identificare transazioni mancanti

**AGENTE 3 - Credit Suisse Analyzer:**
- Leggere PDF estratti conto H1 e H2
- Estrarre transazioni e saldi
- Verificare perché Odoo ha CHF 461K invece di CHF 25K
- Identificare errori di registrazione

**AGENTE 4 - Conti Secondari Analyzer:**
- COVID-KONTO: Verificare CHF -300K vs CHF -116K
- Privatkonto: Verificare se è in Odoo
- USD account: Verificare saldo
- Carte di credito: Analizzare PDF cauzioni

**AGENTE 5 - Outstanding Accounts Fixer:**
- Konto 1022: Chiudere CHF -165K
- Konto 1023: Chiudere CHF +568K
- Konto 10901: Chiudere CHF +256K
- Konto 1001: Allineare a CHF 90K

---

### FASE 2: ALLINEAMENTO MENSILE

Per OGNI MESE del 2024 (Gennaio → Dicembre):

**PASSO 1:** Verificare saldo iniziale mese
- Documento: Saldo fine mese precedente
- Odoo: Calcolare saldo al giorno X

**PASSO 2:** Importare/Verificare transazioni del mese
- Confrontare numero transazioni: Documento vs Odoo
- Identificare transazioni mancanti
- Importare transazioni mancanti

**PASSO 3:** Verificare saldo finale mese
- Documento: Schlusssaldo fine mese
- Odoo: Saldo calcolato dopo import
- DELTA deve essere < CHF 0.01

**PASSO 4:** Se delta > 0.01:
- Analizzare transazione per transazione
- Trovare discrepanze
- Correggere

---

### FASE 3: IMPORT AUTOMATICO (se possibile)

**PRE-REQUISITI:**
1. ✅ Fix suspense account (Konto 1021)
2. ❌ Testare import su 1 mese
3. ❌ Se funziona, importare tutti i mesi

**STRATEGIA IMPORT:**
- Gennaio: Import + riconcilia + verifica
- Se OK → Febbraio
- Se KO → Fix manuale + riprova
- Procedere mese per mese fino a Dicembre

---

### FASE 4: RICONCILIAZIONE FINALE

**OBIETTIVO: SALDO AL CENTESIMO**

Al 31/12/2024 i saldi devono essere:

| Conto | Target (dai documenti) | Odoo Attuale | Azione |
|-------|------------------------|--------------|---------|
| UBS CHF | CHF 182,613.26 | CHF 67,550.94 | +115,062 |
| UBS EUR | EUR 128,860.70 | EUR 108,267.67 | +20,593 EUR |
| Credit Suisse | CHF 24,897.72 | CHF 461,453.70 | -436,556 ❌ |
| COVID-KONTO | CHF -116,500.00 | CHF -300,949.20 | +184,449 |

---

## AZIONI IMMEDIATE

**OGGI:**
1. ✅ Analisi documenti completa
2. ⏳ Lanciare 5 agenti paralleli per analisi dettagliata
3. ⏳ Creare report Excel con saldi mese per mese

**DOMANI:**
1. Verificare Credit Suisse (discrepanza CHF 436K)
2. Iniziare allineamento Gennaio 2024
3. Test import automatico su 1 mese

**SETTIMANA PROSSIMA:**
1. Completare allineamento Q1 2024
2. Completare allineamento Q2 2024
3. Completare allineamento Q3 2024
4. Completare allineamento Q4 2024

---

## DELIVERABLE FINALI

1. **Report Excel:** Saldo mese per mese 2024 (Documenti vs Odoo)
2. **Lista movimenti mancanti:** Transazioni da aggiungere in Odoo
3. **Odoo allineato al centesimo:** Tutti i saldi = documenti
4. **Piano per production:** Replicare in ambiente production

---

## NOTE IMPORTANTI

- Le **carte di credito** NON sono conti separati, sono sotto-movimenti
- I **3 conti principali** sono: UBS CHF, UBS EUR, Credit Suisse
- Allineare **mese per mese**, NON tutto insieme
- Verificare **al centesimo** (delta < 0.01 CHF)
- **Staging first**, poi production
