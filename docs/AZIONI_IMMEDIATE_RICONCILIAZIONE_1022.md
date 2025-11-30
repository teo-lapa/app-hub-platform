# AZIONI IMMEDIATE - Riconciliazione Account 1022

**Data:** 2025-11-15 19:40
**Urgenza:** CRITICA
**Obiettivo:** Portare saldo Account 1022 a CHF 0.00

---

## SITUAZIONE CORRENTE

### Saldo Account 1022 - Outstanding Receipts
- **Totale Debit:** CHF 441,254.51
- **Totale Credit:** CHF 187,518.92
- **Balance:** CHF 253,735.59
- **Righe non riconciliate:** 204

### Distribuzione per Importo
| Categoria | Righe | Descrizione |
|-----------|-------|-------------|
| Piccoli (< CHF 1,000) | 136 | Pagamenti clienti normali |
| Medi (CHF 1,000-10,000) | 52 | Pagamenti clienti rilevanti |
| Grandi (> CHF 10,000) | 16 | Pagamenti clienti grandi |
| **CRITICO** | 1 | **Ricorrente merenda69: CHF 182,651.03** |

---

## PROBLEMA CRITICO: "Ricorrente merenda69"

### Dettagli
- **ID:** 526672
- **Move:** Ricorrente merenda69
- **Data:** 2023-12-31
- **Credit:** CHF 182,651.03
- **Partner:** N/A
- **Rappresenta:** 72% del saldo totale in Credit!

### Natura del Movimento
Questo è chiaramente un **movimento ricorrente automatico di fine anno 2023**.

Il nome "merenda69" suggerisce:
- Script/automazione con nome interno
- Possibile adjustment automatico di fine anno
- Potrebbe essere un accantonamento o provisioning

### AZIONE IMMEDIATA RICHIESTA
Questo movimento DEVE essere analizzato dal commercialista OGGI perché:
1. Blocca la chiusura del bilancio
2. Rappresenta 72% del problema
3. Non ha partner associato (anomalia)
4. Data fine anno 2023 (possibile closing entry)

---

## TOP 15 MOVIMENTI PIÙ RILEVANTI (da riconciliare manualmente)

| Rank | ID | Move | Date | Partner | Amount CHF | Tipo |
|------|----|----|------|---------|------------|------|
| 1 | 526672 | Ricorrente merenda69 | 2023-12-31 | N/A | 182,651.03 | CREDIT |
| 2 | 88413 | PBNK1/2023/00666 | 2023-11-09 | CASA COSI GMBH | 37,606.31 | DEBIT |
| 3 | 105090 | PBNK1/2023/00913 | 2023-12-11 | HALTEN GASTRO GMBH | 26,159.47 | DEBIT |
| 4 | 157216 | PBNK1/2024/01025 | 2024-04-15 | HALTEN GASTRO GMBH | 24,807.77 | DEBIT |
| 5 | 155563 | PBNK1/2024/00896 | 2024-04-05 | CAMILLA AG | 24,277.51 | DEBIT |
| 6 | 167842 | PBNK1/2024/01318 | 2024-05-13 | HALTEN GASTRO GMBH | 18,337.43 | DEBIT |
| 7 | 154982 | PBNK1/2024/00875 | 2024-04-02 | CAMILLA AG OPFIKON | 16,743.54 | DEBIT |
| 8 | 166836 | PBNK1/2024/01198 | 2024-05-03 | CUMANO SA | 16,582.35 | DEBIT |
| 9 | 61976 | PBNK1/2023/00377 | 2023-10-03 | ADALBIRO SA | 16,383.73 | DEBIT |
| 10 | 61433 | PBNK1/2023/00363 | 2023-10-03 | BMW Finanzdienstleistungen | 15,000.00 | DEBIT |
| 11 | 155016 | PBNK1/2024/00892 | 2024-04-02 | TREBELLICO SA | 14,724.18 | DEBIT |
| 12 | 147253 | PBNK1/2024/00820 | 2024-03-22 | CUMANO SA | 12,967.02 | DEBIT |
| 13 | 154974 | PBNK1/2024/00872 | 2024-04-02 | AGINULFO SA | 12,683.66 | DEBIT |
| 14 | 154962 | PBNK1/2024/00866 | 2024-04-02 | ADALBIRO SA | 12,096.60 | DEBIT |
| 15 | 154970 | PBNK1/2024/00870 | 2024-04-02 | FILOMENO SA | 11,906.44 | DEBIT |

**Totale Top 15:** CHF 432,527 (96% del problema!)

---

## PIANO D'AZIONE STEP-BY-STEP

### FASE 1: OGGI (15 Nov 2025) - URGENTE

#### Azione 1.1: Investigare "Ricorrente merenda69"

**Chi:** Commercialista + Paul (paul@lapa.ch)

**Come:**
```python
# Eseguire script già creato
python scripts/investigate-merenda69.py

# Oppure query Odoo diretta
# Trovare il movimento completo e tutte le contropartite
```

**Decisione richiesta:**
- [ ] È un movimento legittimo? → Riconciliare con contropartita corretta
- [ ] È un errore di migrazione? → Stornare e ricreare
- [ ] È un adjustment fine anno? → Validare e riconciliare con fatture 2023

#### Azione 1.2: Analizzare i Top 15 Clienti

**Chi:** Team accounting

**Come:**
1. Per ogni cliente nei Top 15, eseguire:

```python
# Script semi-automatico
from odoo_client import OdooClient

client = OdooClient(...)
client.authenticate()

# Esempio: CASA COSI GMBH (CHF 37,606.31)
partner_id = client.search_read('res.partner', [('name', '=', 'CASA COSI GMBH')], ['id'])[0]['id']

# Trova tutte le fatture aperte
invoices = client.search_read('account.move',
    [('partner_id', '=', partner_id),
     ('state', '=', 'posted'),
     ('payment_state', 'in', ['not_paid', 'partial'])],
    ['name', 'invoice_date', 'amount_total', 'amount_residual'])

print(f"CASA COSI GMBH - {len(invoices)} fatture aperte")
for inv in invoices:
    print(f"  {inv['name']}: CHF {inv['amount_residual']:,.2f}")
```

2. Match manuale payment → invoice
3. Riconciliare in Odoo manualmente o via script

---

### FASE 2: DOMANI (16 Nov 2025)

#### Azione 2.1: Riconciliazione Batch dei Top 15

**Obiettivo:** Riconciliare i 15 movimenti più grandi (96% del problema)

**Processo:**
1. Per ogni payment nei Top 15:
   - Identificare fattura/e corrispondenti
   - Verificare importi
   - Eseguire riconciliazione manuale in Odoo

2. Usare script assistito:

```python
# Script: manual-reconcile-top15.py (da creare)
python scripts/manual-reconcile-top15.py --interactive
```

**Output atteso:**
- 15 riconciliazioni completate
- Saldo ridotto di ~CHF 432,000
- Saldo rimanente: ~CHF 9,000 (righe piccole)

#### Azione 2.2: Cleanup Righe Micro (<CHF 1)

Ci sono 43 righe con importi < CHF 1.00 (arrotondamenti).

**Decisione:**
- [ ] Riconciliare con write-off account
- [ ] Ignorare (non materiali)
- [ ] Stornare se errori

---

### FASE 3: FINE SETTIMANA (18 Nov 2025)

#### Azione 3.1: Riconciliazione Finale Righe Rimanenti

Dopo aver risolto Top 15 + merenda69, rimarranno ~50-60 righe piccole.

**Processo batch:**

```python
# Script: reconcile-remaining.py
python scripts/reconcile-remaining.py --auto-match --threshold 0.99
```

Parametri:
- `--auto-match`: Riconcilia automaticamente match confidence >99%
- `--threshold 0.99`: Tolleranza 1% su importi

**Revisione manuale:**
- Righe con confidence <99%
- Pagamenti senza fattura corrispondente
- Clienti chiusi/inattivi

#### Azione 3.2: Verifica Finale e Chiusura

```python
# Verifica saldo finale
python scripts/find-large-movements-1022.py

# Output atteso:
# Balance: CHF 0.00
# Remaining lines: 0
```

**Documentazione:**
- Screenshot saldo = 0
- Export Excel righe riconciliate
- Report per commercialista

---

## SCRIPTS DISPONIBILI

### 1. odoo-reconcile-1022.py
**Funzione:** Riconciliazione automatica completa
**Uso:** Completato - ha generato report iniziale
**Output:** reconciliation-report-YYYYMMDD-HHMMSS.xlsx

### 2. analyze-reconciliation-report.py
**Funzione:** Analizza report Excel riconciliazione
**Uso:** Completato - ha identificato problemi
**Output:** Console output con statistiche

### 3. find-large-movements-1022.py
**Funzione:** Trova movimenti grandi non riconciliati
**Uso:** Completato - ha trovato Top 15 + merenda69
**Output:** Lista movimenti ordinati per importo

### 4. cleanup-zero-payments.py
**Funzione:** Elimina righe con amount=0 (PERICOLOSO)
**Uso:** NON ESEGUITO - richiede approvazione commercialista
**Parametri:** `--dry-run` o `--execute`

### 5. investigate-merenda69.py
**Funzione:** Analisi dettagliata movimento critico
**Uso:** DA ESEGUIRE OGGI
**Output:** Dettagli movimento + raccomandazioni

---

## SCRIPT DA CREARE (OPZIONALI)

### manual-reconcile-top15.py
Assistente interattivo per riconciliare i Top 15 movimenti.

```python
# Pseudocodice
for payment in top_15_payments:
    print(f"Payment: {payment.name} - CHF {payment.amount}")

    # Trova fatture candidate
    invoices = find_matching_invoices(payment.partner, payment.amount)

    print("Possible matches:")
    for i, inv in enumerate(invoices):
        print(f"  {i+1}. {inv.name} - CHF {inv.amount_residual}")

    choice = input("Select invoice (1-N, 0 to skip): ")

    if choice != '0':
        reconcile(payment, invoices[int(choice)-1])
        print("✓ Reconciled!")
```

### reconcile-remaining.py
Riconciliazione batch automatica righe rimanenti dopo Top 15.

### generate-final-report.py
Report finale per commercialista con tutte le riconciliazioni eseguite.

---

## COMUNICAZIONI RICHIESTE

### Email al Commercialista (URGENTE - OGGI)

```
A: commercialista@...
Cc: paul@lapa.ch
Oggetto: URGENTE - Movimento "Ricorrente merenda69" CHF 182,651

Gentile Commercialista,

Durante la riconciliazione del conto 1022 (Outstanding Receipts) abbiamo
identificato un movimento critico che blocca la chiusura:

- ID: 526672
- Nome: "Ricorrente merenda69"
- Data: 31/12/2023
- Importo: CHF 182,651.03 (Credit)
- Partner: Non specificato

Questo movimento rappresenta il 72% del saldo non riconciliato totale.

RICHIESTA:
Può verificare la natura di questo movimento e indicarci come procedere?

Opzioni possibili:
1. Riconciliazione con contropartite specifiche
2. Storno e riallocazione
3. Altro (sua raccomandazione)

Allegato: Report dettagliato analisi conto 1022

Disponibili per chiamata urgente se necessario.

Cordiali saluti,
Team Lapa
```

---

## TIMELINE REALISTICA

| Data | Azione | Responsabile | Tempo |
|------|--------|--------------|-------|
| 15 Nov (OGGI) | Email commercialista | Paul | 30 min |
| 15 Nov (OGGI) | Investigare merenda69 | IT + Accounting | 2 ore |
| 15 Nov (OGGI) | Decisione su merenda69 | Commercialista | - |
| 16 Nov | Riconciliare Top 15 | Accounting | 4 ore |
| 16 Nov | Cleanup micro-importi | Accounting | 1 ora |
| 18 Nov | Riconciliare remaining | IT + Accounting | 3 ore |
| 18 Nov | Verifica finale | Accounting | 1 ora |
| **18 Nov** | **SALDO 1022 = CHF 0.00** | **✅ OBIETTIVO** | - |

---

## RISCHI E MITIGATION

### Rischio 1: Merenda69 non risolvibile rapidamente
**Probabilità:** Media
**Impatto:** Alto
**Mitigation:**
- Contattare supporto Odoo
- Verificare audit log del movimento
- Opzione: Storno temporaneo per chiudere bilancio

### Rischio 2: Fatture corrispondenti non trovate
**Probabilità:** Bassa
**Impatto:** Medio
**Mitigation:**
- Allargare ricerca a fatture già pagate
- Verificare credit notes
- Riconciliare con write-off account se importi immateriali

### Rischio 3: Tempo insufficiente per riconciliazione manuale
**Probabilità:** Media
**Impatto:** Alto
**Mitigation:**
- Focus su Top 15 (96% del problema)
- Accettare small balance temporaneo su righe micro
- Estendere deadline a 20 Nov se necessario

---

## METRICHE DI SUCCESSO

### Obiettivi Primari
- [ ] Saldo Account 1022 = CHF 0.00
- [ ] 100% righe riconciliate (o giustificate)
- [ ] Commercialista può chiudere bilancio

### Obiettivi Secondari
- [ ] Documentazione completa riconciliazioni
- [ ] Processo automatizzato per futuro
- [ ] Training team su riconciliazione

---

## FILES GENERATI

1. **REPORT_RICONCILIAZIONE_1022.md** - Report completo analisi
2. **AZIONI_IMMEDIATE_RICONCILIAZIONE_1022.md** - Questo documento
3. **reconciliation-report-20251115-193023.xlsx** - Report Excel riconciliazioni
4. **Scripts Python:**
   - odoo-reconcile-1022.py
   - analyze-reconciliation-report.py
   - find-large-movements-1022.py
   - cleanup-zero-payments.py
   - investigate-merenda69.py

---

## CONTATTI

**Supporto Tecnico:** Odoo Integration Master
**Approvazioni:** paul@lapa.ch
**Commercialista:** [da specificare]
**Supporto Odoo:** lapadevadmin-lapa-v2-staging

---

**Documento creato:** 2025-11-15 19:40
**Prossimo update:** Dopo risoluzione merenda69
**Status:** 🔴 CRITICO - AZIONE RICHIESTA
