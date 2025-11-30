# Riconciliazione Konto 1023 - Outstanding Payments

## Situazione Critica

- **Conto**: 1023 Outstanding Payments
- **Saldo**: CHF -84,573.31
- **Righe non riconciliate**: 691
- **Urgenza**: CRITICA - blocca chiusura bilancio

## Scripts Disponibili

### 1. `riconcilia-konto-1023.py` (BASE)

**Strategia semplice**: Riconciliazione 1:1 (payment -> invoice)

**Algoritmo**:
- Cerca fatture con stesso partner + stesso importo
- Riconcilia direttamente
- Report errori e non trovate

**Usa quando**: La maggior parte dei pagamenti ha corrispondenza diretta 1:1 con fatture

### 2. `riconcilia-konto-1023-advanced.py` (ADVANCED)

**Strategia multi-step** con 3 algoritmi:

1. **EXACT MATCH**: Payment = Invoice (stesso importo ±1 centesimo)
2. **PARTIAL PAYMENTS**: Un payment copre più invoices
3. **DATE MATCH**: Riconcilia per data ±7 giorni + importo simile ±5%

**Usa quando**: Ci sono pagamenti parziali, multipli, o importi con piccole differenze

## Installazione

### Requisiti

```bash
pip install xmlrpc pandas openpyxl
```

### Verifica Connessione

Testa prima la connessione con questo script rapido:

```python
# test-odoo-connection.py
import xmlrpc.client
import ssl

url = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
db = 'lapadevadmin-lapa-v2-staging-2406-25408900'
username = 'paul@lapa.ch'
password = 'lapa201180'

ssl_context = ssl._create_unverified_context()
common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common', context=ssl_context)

uid = common.authenticate(db, username, password, {})
print(f"✓ Connessione OK - UID: {uid}")
```

## Esecuzione

### Step 1: Test Connessione

```bash
cd c:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts
python test-odoo-connection.py
```

**Output atteso**:
```
✓ Connessione OK - UID: 2
```

### Step 2: Esecuzione Riconciliazione BASE

```bash
python riconcilia-konto-1023.py
```

**Output**:
```
╔════════════════════════════════════════════════════════════════════╗
║  ODOO INTEGRATION MASTER - Riconciliazione Konto 1023             ║
╚════════════════════════════════════════════════════════════════════╝

Connessione Odoo...
✓ Autenticato (UID: 2)

Ricerca conto 1023...
✓ Trovato: 1023 - Outstanding Payments

Estrazione righe non riconciliate...
Trovate 691 righe

ANALISI:
  Totale righe: 691
  Dare: CHF 120,450.00
  Avere: CHF 204,950.00
  Saldo: CHF -84,500.00

⚠ Procedere? (yes/no):
```

Digita **yes** per continuare.

### Step 3: Esecuzione ADVANCED (Opzionale)

Se il base non risolve tutto:

```bash
python riconcilia-konto-1023-advanced.py
```

**Output**:
```
STRATEGIA 1: EXACT MATCH
✓ Match: 450/691 (65%)

STRATEGIA 2: PARTIAL PAYMENTS
✓ Match: 120/241 (50%)

STRATEGIA 3: DATE MATCH
✓ Match: 80/121 (66%)

TOTALE RICONCILIATE: 650/691 (94%)
MANUAL REVIEW: 41 righe
```

## Output

### Report Excel

Entrambi gli script generano un Excel:

**File**: `riconciliazione_konto_1023_YYYYMMDD_HHMMSS.xlsx`

**Sheet 1 - Riconciliazioni**:
| line_id | partner | amount | date | invoice_id | status |
|---------|---------|--------|------|------------|--------|
| 12345 | Fornitore A | 1500.00 | 2025-01-15 | INV/2025/001 | RECONCILED |

**Sheet 2 - Statistiche**:
| Metrica | Valore |
|---------|--------|
| Totale righe | 691 |
| Riconciliate | 650 |
| Non trovate | 25 |
| Errori | 16 |
| Importo riconciliato | CHF 80,000.00 |
| Tasso successo | 94.1% |

### Report ADVANCED (Multi-Sheet)

**Sheet 1 - Summary**: Statistiche aggregate
**Sheet 2 - Exact**: Riconciliazioni exact match
**Sheet 3 - Partial**: Pagamenti parziali
**Sheet 4 - Date Match**: Match per data
**Sheet 5 - Manual**: Righe da revisione manuale

## Verifica Risultato

Dopo l'esecuzione, verifica il saldo:

```python
# verifica-saldo-1023.py
import xmlrpc.client
import ssl

# ... connessione ...

# Cerca conto
account_ids = models.execute_kw(db, uid, password,
    'account.account', 'search', [[['code', '=', '1023']]])

# Righe non riconciliate rimanenti
remaining = models.execute_kw(db, uid, password,
    'account.move.line', 'search_count',
    [[['account_id', '=', account_ids[0]], ['reconciled', '=', False]]])

print(f"Righe non riconciliate rimanenti: {remaining}")
```

**Target**: `0` righe rimanenti

## Edge Cases Gestiti

### 1. Pagamento Multiplo

**Scenario**: Un pagamento di CHF 5000 copre 3 fatture (CHF 2000 + 1500 + 1500)

**Gestito da**: ADVANCED script (Strategia 2)

### 2. Fatture Multiple per un Pagamento

**Scenario**: Fattura di CHF 10000 pagata con 2 payments (CHF 6000 + 4000)

**Gestito da**: ADVANCED script (Strategia 3)

### 3. Importi con Arrotondamenti

**Scenario**: Payment CHF 1500.00, Invoice CHF 1500.05

**Gestito da**: Tolleranza ±1 centesimo in entrambi gli script

### 4. Date Sfasate

**Scenario**: Invoice 01/01/2025, Payment 05/01/2025 (stesso partner)

**Gestito da**: ADVANCED script (Strategia 3) - match ±7 giorni

### 5. Partner Mancante

**Scenario**: Riga senza partner_id

**Gestito da**: Skip + report in "Manual Review"

## Troubleshooting

### Errore: "Access Denied"

**Causa**: User paul@lapa.ch non ha permessi su account.move.line

**Soluzione**:
1. Vai in Odoo: Settings > Users > paul@lapa.ch
2. Assicurati abbia ruolo "Accounting / Adviser" o "Accounting / Manager"

### Errore: "Conto 1023 non trovato"

**Causa**: Il conto potrebbe avere codice diverso

**Soluzione**: Verifica in Odoo > Accounting > Configuration > Chart of Accounts

### Errore: "Cannot reconcile different partners"

**Causa**: Tentativo di riconciliare righe con partner diversi

**Soluzione**: Normale, script skippa automaticamente e mette in "Manual Review"

### Errore: "Lines already reconciled"

**Causa**: Le righe sono già state riconciliate (magari da run precedente)

**Soluzione**: Ri-estrai righe non riconciliate (script lo fa automaticamente)

## Best Practices

1. **BACKUP**: Fai backup del database prima di eseguire riconciliazioni massive
2. **TEST**: Esegui prima su 10-20 righe modificando il limit in `get_unreconciled_lines()`
3. **REVIEW**: Controlla sempre il report Excel prima di validare
4. **STEP BY STEP**: Usa BASE prima, poi ADVANCED solo se necessario
5. **MANUAL**: Le righe in "Manual Review" vanno gestite manualmente in Odoo

## Prossimi Step

Dopo la riconciliazione:

1. Verifica saldo Konto 1023 in Odoo
2. Esegui report "Aged Payables" per conferma
3. Chiudi periodo contabile
4. Backup database post-riconciliazione

## Support

Per problemi contatta: **Odoo Integration Master** (questo prompt)

## Note Tecniche

### API Odoo Usate

- `account.account.search()`: Trova conto 1023
- `account.move.line.search()`: Trova righe non riconciliate
- `account.move.line.read()`: Leggi dettagli righe
- `account.move.line.reconcile()`: Riconcilia righe

### Performance

- **691 righe**: ~5-10 minuti (dipende da rete)
- **Batch size**: 50 righe per volta (modificabile)
- **Rate limiting**: Nessuno per XML-RPC interno

### Logs

Gli script loggano su console in real-time:
- Ogni riconciliazione eseguita
- Ogni errore incontrato
- Progress ogni 50 righe

---

**IMPORTANTE**: Questo è un task CRITICO. Verifica sempre i risultati prima di chiudere il bilancio!
