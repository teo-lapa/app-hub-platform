# AUTOMAZIONE CHIUSURA KONTO 1099 TRANSFERKONTO

## Process Automator - Istruzioni Operative

Data: 15.11.2025
Eseguito da: Process Automator

---

## 1. SITUAZIONE INIZIALE

**Conto:** 1099 - Transferkonto
**Saldo attuale:** CHF -60,842.41 (CREDITO)

**Movimenti del 31.01.2024:** 7 movimenti
**Origine:** Correzioni post-migrazione software 2023

**Istruzione Commercialista:**
> "Transferkonto, muss ausgebucht werden, da dieses Konto auf 0 sein muss."

---

## 2. REGISTRAZIONE CONTABILE DA CREARE

### Dati Registrazione

- **Data:** 15.11.2025 (data odierna)
- **Journal:** Miscellaneous Operations / Saldi di apertura (tipo: General)
- **Riferimento:** Chiusura Konto 1099 Transferkonto - Correzioni post-migrazione 2023

### Movimenti Contabili

| Conto | Descrizione | Dare (CHF) | Avere (CHF) |
|-------|-------------|------------|-------------|
| 1099 | Chiusura Transferkonto su Patrimonio Netto | 60,842.41 | 0.00 |
| 29XX | Chiusura Transferkonto da conto 1099 | 0.00 | 60,842.41 |

**Note:**
- Il saldo del conto 1099 è CHF -60,842.41 (credito)
- Per chiudere a 0.00, dobbiamo DARE il conto 1099
- Il conto 29XX può essere:
  - **2979** - Eröffnungsdifferenzen (preferito)
  - **2980** - Altri conti di apertura
  - Altro conto di Patrimonio Netto (Equity)

---

## 3. PROCEDURA MANUALE IN ODOO

### Step 1: Login

1. Vai a: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
2. Login con:
   - **User:** paul@lapa.ch
   - **Password:** lapa201180

### Step 2: Crea Registrazione Contabile

1. **Menu:** Contabilità → Contabilità → Registrazioni Contabili
2. Click su **[Crea]**

### Step 3: Compila Registrazione

**Testata:**
- **Journal:** Seleziona journal di tipo "General" (es. "Miscellaneous Operations")
- **Data:** 15.11.2025
- **Riferimento:** Chiusura Konto 1099 Transferkonto - Correzioni post-migrazione 2023

**Righe:**

**Riga 1:**
- **Conto:** 1099 - Transferkonto
- **Etichetta:** Chiusura Transferkonto su Patrimonio Netto
- **Dare:** 60,842.41
- **Avere:** (lascia vuoto / 0.00)

**Riga 2:**
- **Conto:** 2979 (o altro conto Equity disponibile - vedi Step 4)
- **Etichetta:** Chiusura Transferkonto da conto 1099
- **Dare:** (lascia vuoto / 0.00)
- **Avere:** 60,842.41

### Step 4: Identifica Conto Patrimonio Netto

Se il conto **2979** non esiste:

1. **Menu:** Contabilità → Configurazione → Piano dei Conti
2. **Cerca:** "Eröffnung" oppure "Equity" oppure "Patrimonio"
3. **Identifica** un conto con tipo:
   - `equity` (Patrimonio Netto)
   - `equity_unaffected` (Utili non distribuiti)
4. **Usa** quel codice conto nella Riga 2

Conti possibili:
- **2979** - Eröffnungsdifferenzen
- **2980** - Altri conti di apertura
- **2970** - Vorjahresgewinn/-verlust (Utili/Perdite esercizi precedenti)

### Step 5: Salva e Valida

1. Click su **[Salva]** (icona dischetto)
2. **Verifica** che:
   - Totale Dare = 60,842.41
   - Totale Avere = 60,842.41
   - Differenza = 0.00
3. Click su **[Valida]** (Validate/Post)

### Step 6: Verifica Saldo

1. **Menu:** Contabilità → Contabilità → Piano dei Conti
2. **Cerca:** conto 1099
3. **Verifica:** Saldo = CHF 0.00 ✅

---

## 4. SCRIPT DI AUTOMAZIONE ALTERNATIVO

Se preferisci automatizzare, puoi usare questo script Python (richiede `odoorpc`):

```bash
# Installa odoorpc
pip install odoorpc

# Esegui script
python scripts/chiusura-konto-1099-python.py
```

**Script:** `scripts/chiusura-konto-1099-python.py`

```python
import odoorpc

# Configurazione
ODOO_HOST = 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USER = 'paul@lapa.ch'
ODOO_PASS = 'lapa201180'

# Connessione
odoo = odoorpc.ODOO(ODOO_HOST, protocol='jsonrpc+ssl', port=443)
odoo.login(ODOO_DB, ODOO_USER, ODOO_PASS)

# Trova conto 1099
Account = odoo.env['account.account']
accounts = Account.search([('code', '=', '1099')])
konto1099 = Account.browse(accounts)[0]

print(f"Conto: {konto1099.code} - {konto1099.name}")
print(f"Saldo: CHF {konto1099.current_balance:.2f}")

# Trova conto Equity
equity_accounts = Account.search([('account_type', 'in', ['equity', 'equity_unaffected'])])
konto_equity = Account.browse(equity_accounts)[0]

print(f"Conto Equity: {konto_equity.code} - {konto_equity.name}")

# Trova Journal
Journal = odoo.env['account.journal']
journals = Journal.search([('type', '=', 'general')], limit=1)
journal = Journal.browse(journals)[0]

# Crea registrazione
Move = odoo.env['account.move']
importo = abs(konto1099.current_balance)

move_data = {
    'journal_id': journal.id,
    'date': '2025-11-15',
    'ref': 'Chiusura Konto 1099 Transferkonto - Correzioni post-migrazione 2023',
    'line_ids': [
        (0, 0, {
            'account_id': konto1099.id,
            'name': 'Chiusura Transferkonto su Patrimonio Netto',
            'debit': importo,
            'credit': 0
        }),
        (0, 0, {
            'account_id': konto_equity.id,
            'name': 'Chiusura Transferkonto da conto 1099',
            'debit': 0,
            'credit': importo
        })
    ]
}

move_id = Move.create(move_data)
print(f"✅ Registrazione creata: ID {move_id}")

# Valida (opzionale - meglio farlo manualmente)
# move = Move.browse(move_id)
# move.action_post()
```

---

## 5. VERIFICA FINALE

Dopo aver creato e validato la registrazione:

1. **Verifica Saldo Konto 1099:**
   - Menu: Contabilità → Piano dei Conti
   - Conto: 1099
   - **Saldo atteso:** CHF 0.00 ✅

2. **Verifica Registrazione:**
   - Menu: Contabilità → Registrazioni Contabili
   - Cerca: ultima registrazione creata
   - **Stato:** Posted (Validata)

3. **Export Report (opzionale):**
   - Menu: Contabilità → Report → Piano dei Conti
   - Filtra: Conto 1099
   - Export → Excel/PDF

---

## 6. DOCUMENTI DI RIFERIMENTO

- **URL Odoo:** https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
- **Database:** lapadevadmin-lapa-v2-staging-2406-25408900
- **User:** paul@lapa.ch

**Conto da chiudere:**
- ID: (da verificare in Odoo)
- Codice: 1099
- Nome: Transferkonto
- Saldo: CHF -60,842.41

**Conto di destinazione:**
- Tipo: Equity (Patrimonio Netto)
- Codice: 2979 o simile
- Nome: Eröffnungsdifferenzen (o equivalente)

---

## 7. SUPPORTO

Per domande o problemi:

1. **Errore "Unbalanced entry":**
   - Verifica che Dare totale = Avere totale = 60,842.41

2. **Conto Equity non trovato:**
   - Usa qualsiasi conto di tipo "equity" disponibile
   - Consulta commercialista per conferma

3. **Saldo non zero dopo validazione:**
   - Verifica che la registrazione sia stata validata (stato = Posted)
   - Aggiorna la vista del Piano dei Conti (F5)

---

**Automazione preparata da Process Automator**
**Data:** 15.11.2025
**Task:** Chiusura Konto 1099 Transferkonto su Patrimonio Netto

✅ **Deliverable completato:**
- ✅ Analisi movimenti (7 movimenti del 31.01.2024)
- ✅ Identificazione conto Patrimonio Netto (2979 o simile)
- ✅ Istruzioni registrazione contabile
- ✅ Script alternativi (Python)
- ✅ Documentazione completa
