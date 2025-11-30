# Script Analisi PRE-ORDINE per Fornitore

Due script equivalenti per analizzare i prodotti PRE-ORDINE raggruppati per fornitore.

---

## Script Disponibili

### 1. analizza-preordine-fornitori.py (Python)
Script Python che usa xmlrpc per connettersi a Odoo

### 2. analizza-preordine-fornitori.js (Node.js)
Stesso identico output, scritto in JavaScript

---

## Prerequisiti

### Python Version

**Requisiti**:
- Python 3.7 o superiore
- Modulo `xmlrpc` (incluso in Python standard library)

**Installazione**: Nessuna! Python ha già tutto.

**Verifica versione**:
```bash
python --version
```

---

### Node.js Version

**Requisiti**:
- Node.js 14 o superiore
- Modulo `xmlrpc`

**Installazione modulo**:
```bash
npm install xmlrpc
```

**Verifica versione**:
```bash
node --version
```

---

## Configurazione

### Prima di eseguire gli script, configura le credenziali Odoo:

#### Python (analizza-preordine-fornitori.py)

Apri il file e modifica le righe 10-13:

```python
ODOO_URL = 'https://tuodominio.odoo.com'  # ← Cambia qui
ODOO_DB = 'tuo_database'                   # ← Cambia qui
ODOO_USERNAME = 'admin'                     # ← Cambia qui
ODOO_PASSWORD = 'tua_password'             # ← Cambia qui
```

**Esempio Lapa**:
```python
ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859'
ODOO_USERNAME = 'admin'
ODOO_PASSWORD = 'admin'
```

---

#### Node.js (analizza-preordine-fornitori.js)

Apri il file e modifica le righe 11-14:

```javascript
const ODOO_URL = 'tuodominio.odoo.com';    // ← Cambia qui (SENZA https://)
const ODOO_DB = 'tuo_database';             // ← Cambia qui
const ODOO_USERNAME = 'admin';              // ← Cambia qui
const ODOO_PASSWORD = 'tua_password';      // ← Cambia qui
```

**Esempio Lapa**:
```javascript
const ODOO_URL = 'lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';
const ODOO_USERNAME = 'admin';
const ODOO_PASSWORD = 'admin';
```

**IMPORTANTE**: Nel file JS, l'URL è **SENZA** `https://`

---

## Esecuzione

### Python

```bash
# Dalla root del progetto
python scripts/analizza-preordine-fornitori.py

# Oppure dalla cartella scripts
cd scripts
python analizza-preordine-fornitori.py
```

---

### Node.js

```bash
# Prima volta: installa dipendenze
npm install xmlrpc

# Esegui script dalla root
node scripts/analizza-preordine-fornitori.js

# Oppure dalla cartella scripts
cd scripts
node analizza-preordine-fornitori.js
```

---

## Output

### 1. Report Console

Lo script stampa a console:

```
================================================================================
        REPORT PRODOTTI PRE-ORDINE PER FORNITORE
================================================================================
Data: 2025-11-09 14:30:45
Totale fornitori: 45
Prodotti senza fornitore: 78
================================================================================

--------------------------------------------------------------------------------
                 TOP 10 FORNITORI PER NUMERO PRODOTTI
--------------------------------------------------------------------------------

1. ALIGRO Demaurex & Cie SA
   Prodotti:      342
   Prezzo medio:  CHF 12.50
   Valore stock:  CHF 45,890.00
   ...
```

---

### 2. File JSON

**Nome file**: `preordine_fornitori_YYYY-MM-DDTHH-MM-SS.json`

**Esempio**: `preordine_fornitori_2025-11-09T14-30-45.json`

**Struttura**:
```json
{
  "timestamp": "2025-11-09T14:30:45.123Z",
  "total_suppliers": 45,
  "total_products_without_supplier": 78,
  "suppliers": {
    "ALIGRO Demaurex & Cie SA": {
      "supplier_id": 123,
      "total_products": 342,
      "avg_price": 12.50,
      "total_value": 45890.00,
      "total_stock": 3671,
      "products": [...]
    }
  },
  "products_without_supplier": [...]
}
```

---

### 3. File CSV

**Nome file**: `preordine_fornitori_YYYY-MM-DDTHH-MM-SS.csv`

**Esempio**: `preordine_fornitori_2025-11-09T14-30-45.csv`

**Colonne**:
- Fornitore
- SKU
- Nome Prodotto
- Prezzo Listino
- Prezzo Fornitore
- Costo Standard
- Stock Disponibile
- Stock Virtuale
- UdM
- Qty Minima
- Lead Time (giorni)
- Codice Fornitore

**Encoding**: UTF-8 con BOM (compatibile Excel)

---

## Personalizzazione

### Cambia ID Tag PRE-ORDINE

Se il tuo tag PRE-ORDINE ha un ID diverso da 314:

**Python** (riga 16):
```python
PRE_ORDINE_TAG_ID = 314  # ← Cambia qui
```

**Node.js** (riga 17):
```javascript
const PRE_ORDINE_TAG_ID = 314;  // ← Cambia qui
```

---

### Aumenta Limite Prodotti

Di default, gli script scaricano fino a 2000 prodotti. Se ne hai di più:

**Python** (riga 42, dentro `get_preordine_products`):
```python
'limit': 2000  # ← Aumenta questo valore
```

**Node.js** (riga 85, dentro `getPreordineProducts`):
```javascript
limit: 2000  // ← Aumenta questo valore
```

---

### Filtra Solo Fornitori Specifici

Vuoi analizzare solo alcuni fornitori? Aggiungi dopo il raggruppamento:

**Python** (dopo riga 193):
```python
# Filtra solo ALIGRO e RISTORIS
suppliers_map = {
    name: data for name, data in suppliers_map.items()
    if 'ALIGRO' in name or 'RISTORIS' in name
}
```

**Node.js** (dopo riga 93):
```javascript
// Filtra solo ALIGRO e RISTORIS
const filteredSuppliers = {};
Object.entries(suppliersMap).forEach(([name, data]) => {
  if (name.includes('ALIGRO') || name.includes('RISTORIS')) {
    filteredSuppliers[name] = data;
  }
});
suppliersMap = filteredSuppliers;
```

---

## Troubleshooting

### Errore: "Authentication failed"

**Causa**: Credenziali errate

**Soluzione**:
1. Verifica username e password
2. Verifica URL Odoo (deve essere accessibile)
3. Verifica nome database

**Test connessione Odoo**:
```bash
curl https://tuodominio.odoo.com
```

---

### Errore: "No module named 'xmlrpc'" (Python)

**Causa**: Python non standard o installazione corrotta

**Soluzione**:
```bash
# Reinstalla Python o usa python3
python3 scripts/analizza-preordine-fornitori.py
```

---

### Errore: "Cannot find module 'xmlrpc'" (Node.js)

**Causa**: Modulo non installato

**Soluzione**:
```bash
npm install xmlrpc
```

---

### Errore: "Trovati 0 prodotti PRE-ORDINE"

**Causa**: ID tag errato

**Soluzione**:
1. Verifica ID tag in Odoo: Inventario > Configurazione > Product Tags
2. Cerca "PRE-ORDINE"
3. Annota l'ID
4. Modifica `PRE_ORDINE_TAG_ID` nello script

---

### Script lento o si blocca

**Causa**: Troppi prodotti o connessione lenta

**Soluzioni**:

1. **Riduci limite prodotti** (per test):
   ```python
   'limit': 100  # Testa con 100 prodotti
   ```

2. **Aumenta timeout** (Python):
   ```python
   import socket
   socket.setdefaulttimeout(60)  # 60 secondi
   ```

3. **Aumenta timeout** (Node.js):
   ```javascript
   objectClient.options.timeout = 60000; // 60 secondi
   ```

---

### File CSV non si apre correttamente in Excel

**Causa**: Encoding o separatori

**Soluzione Python**:
```python
# Cambia encoding in riga 350
with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
```

**Soluzione Node.js**:
```javascript
// File già configurato con BOM (\uFEFF)
// Se ancora problemi, usa separatore ;
.join(';')  // invece di .join(',')
```

---

## Esempi Avanzati

### 1. Esporta Solo Top 10 Fornitori

**Python**:
```python
# Dopo riga 193
sorted_suppliers = sorted(
    suppliers_map.items(),
    key=lambda x: x[1]['total_products'],
    reverse=True
)[:10]  # Solo top 10

suppliers_map = dict(sorted_suppliers)
```

**Node.js**:
```javascript
// Dopo riga 93
const top10 = Object.entries(suppliersMap)
  .sort((a, b) => b[1].total_products - a[1].total_products)
  .slice(0, 10);

suppliersMap = Object.fromEntries(top10);
```

---

### 2. Filtra Per Valore Stock Minimo

Esporta solo fornitori con valore stock > 10,000 CHF

**Python**:
```python
suppliers_map = {
    name: data for name, data in suppliers_map.items()
    if data['total_value'] > 10000
}
```

**Node.js**:
```javascript
suppliersMap = Object.fromEntries(
  Object.entries(suppliersMap)
    .filter(([name, data]) => data.total_value > 10000)
);
```

---

### 3. Genera Report Solo Prodotti Senza Fornitore

**Python**:
```python
# Commenta righe 219-264 (report fornitori)
# Lascia solo righe 266-282 (prodotti senza fornitore)
```

**Node.js**:
```javascript
// Commenta righe che stampano fornitori
// Lascia solo parte products_without_supplier
```

---

## Automazione

### Cron Job (Linux/Mac)

Esegui automaticamente ogni lunedì alle 9:00:

```bash
# Apri crontab
crontab -e

# Aggiungi questa riga
0 9 * * 1 /usr/bin/python3 /path/to/scripts/analizza-preordine-fornitori.py > /var/log/preordine.log 2>&1
```

---

### Task Scheduler (Windows)

1. Apri **Task Scheduler**
2. **Crea attività di base**
3. Nome: "Analisi PRE-ORDINE Mensile"
4. Trigger: Mensile, primo lunedì, ore 9:00
5. Azione: **Avvia programma**
   - Programma: `python`
   - Argomenti: `C:\path\to\scripts\analizza-preordine-fornitori.py`
6. **Fine**

---

## Integrazione con Altri Sistemi

### Carica CSV in Google Sheets

```python
# Aggiungi dopo export CSV
import gspread
from oauth2client.service_account import ServiceAccountCredentials

scope = ['https://spreadsheets.google.com/feeds']
creds = ServiceAccountCredentials.from_json_keyfile_name('credentials.json', scope)
client = gspread.authorize(creds)

sheet = client.open('Analisi PRE-ORDINE').sheet1
with open(filename, 'r') as f:
    content = f.read()
    sheet.import_csv(content)
```

---

### Invia Email con Report

**Python**:
```python
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

msg = MIMEMultipart()
msg['From'] = 'noreply@lapa.com'
msg['To'] = 'manager@lapa.com'
msg['Subject'] = 'Report PRE-ORDINE Mensile'

# Allega CSV
with open(filename, 'rb') as f:
    part = MIMEBase('application', 'octet-stream')
    part.set_payload(f.read())
    encoders.encode_base64(part)
    part.add_header('Content-Disposition', f'attachment; filename={filename}')
    msg.attach(part)

server = smtplib.SMTP('smtp.gmail.com', 587)
server.starttls()
server.login('user@gmail.com', 'password')
server.send_message(msg)
server.quit()
```

---

## Performance Tips

1. **Cache risultati**: Salva JSON e riusa invece di ri-scaricare ogni volta
2. **Batch processing**: Se hai 10,000+ prodotti, processa in lotti
3. **Parallel requests**: Usa threading per scaricare supplier info in parallelo
4. **Database locale**: Importa in SQLite per query più veloci

---

## FAQ

### Posso eseguire lo script senza modificare il codice?

No, devi almeno configurare le credenziali Odoo nelle prime righe.

### Quale script è più veloce?

Prestazioni identiche. Usa quello che preferisci (Python o Node.js).

### Posso eseguire su Windows?

Sì, entrambi gli script funzionano su Windows, Mac e Linux.

### Lo script modifica dati in Odoo?

No, è read-only. Scarica solo dati, non modifica nulla.

### Posso eseguire in background?

Sì, usa:
```bash
# Python
python scripts/analizza-preordine-fornitori.py > output.log 2>&1 &

# Node.js
node scripts/analizza-preordine-fornitori.js > output.log 2>&1 &
```

---

**Script pronti all'uso! Configura le credenziali ed esegui.**

Per altri dettagli consulta: `../README_FILTRI_PREORDINE.md`
