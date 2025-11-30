# res.partner - Analisi Completa Odoo 17

## Riepilogo Esecutivo

**Modello analizzato:** `res.partner`
**Totale campi:** 249
**Campi obbligatori:** 2 (auto-assegnati da Odoo)
**Test eseguito:** Partner creato con successo (ID: 10791)

---

## 1. CAMPI OBBLIGATORI

Solo **2 campi obbligatori**, ma **Odoo li assegna automaticamente**:

```python
{
    'property_account_receivable_id': <auto>,  # Conto crediti
    'property_account_payable_id': <auto>,     # Conto debiti
}
```

**In pratica:** Puoi creare un partner anche solo con `{'name': 'Test'}`.

---

## 2. DATI AZIENDALI (36 campi rilevanti)

### Identificazione
```python
{
    'name': 'Azienda SA',              # Nome (unico campo veramente necessario)
    'ref': 'CLI-001',                  # Codice cliente interno
    'company_registry': 'CHE-123...',  # Numero registro imprese
}
```

### Dati Fiscali
```python
{
    'vat': 'CHE-123.456.788 TVA',           # P.IVA (VALIDATA da Odoo!)
    'l10n_it_codice_fiscale': 'RSSMRA...',  # Codice Fiscale (solo Italia)
}
```

**IMPORTANTE:** Odoo **valida il formato P.IVA**! Deve essere:
- `CHE-XXX.XXX.XXX TVA` (francese)
- `CHE-XXX.XXX.XXX MWST` (tedesco)
- `CHE-XXX.XXX.XXX IVA` (italiano)

### Indirizzo
```python
{
    'street': 'Via Test 123',
    'street2': 'Edificio A',      # Secondo rigo (opzionale)
    'city': 'Lugano',
    'zip': '6900',
    'state_id': 1596,              # ID cantone (many2one → res.country.state)
    'country_id': 43,              # ID paese (many2one → res.country)
}
```

### Tipo Partner
```python
{
    'is_company': True,            # True = azienda, False = persona
    'company_type': 'company',     # 'company' o 'person'
    'type': 'contact',             # 'contact', 'invoice', 'delivery', 'other'
}
```

---

## 3. CONTATTI (25 campi)

```python
{
    'phone': '+41 91 123 45 67',
    'mobile': '+41 79 987 65 43',
    'email': 'info@esempio.ch',
    'website': 'https://www.esempio.ch',
}
```

**Campi derivati auto-generati:**
- `email_normalized` - Email normalizzata
- `email_formatted` - Email formattata
- `phone_sanitized` - Telefono sanitizzato

---

## 4. LOGO/IMMAGINE (11 campi)

### Campo Principale
```python
import base64

# Carica logo
with open('logo.png', 'rb') as f:
    logo_base64 = base64.b64encode(f.read()).decode('ascii')

partner_data = {
    'image_1920': logo_base64  # Immagine base64 (max 1920x1920px)
}
```

### Campi Auto-Generati da Odoo
- `image_1024` - 1024x1024px
- `image_512` - 512x512px
- `image_256` - 256x256px
- `image_128` - 128x128px (thumbnail)

**Formato:** Stringa base64 ASCII
**Dimensione max:** 1920x1920px

---

## 5. SITO WEB

```python
{
    'website': 'https://www.esempio.ch'  # URL sito web
}
```

**Altri campi web disponibili:**
- `website_description` (html) - Descrizione completa per web
- `website_short_description` (text) - Descrizione breve
- `website_meta_title` - SEO meta title
- `website_meta_description` - SEO meta description
- `website_meta_keywords` - SEO keywords
- `website_published` (boolean) - Visibile su sito

---

## 6. DATI AGGIUNTIVI UTILI

### Classificazione Cliente/Fornitore
```python
{
    'customer_rank': 1,  # >0 = è cliente (conta numero ordini)
    'supplier_rank': 0,  # >0 = è fornitore
}
```

### Assegnazioni
```python
{
    'user_id': 7,   # ID venditore assegnato (many2one → res.users)
    'team_id': 1,   # ID team vendite (many2one → crm.team)
}
```

### Tag/Categorie
```python
{
    'category_id': [(6, 0, [1, 2, 3])]  # Many2many → res.partner.category
}
```

**Comandi Many2many:**
- `(6, 0, [ids])` - Sostituisci tutti
- `(4, id)` - Aggiungi
- `(3, id)` - Rimuovi
- `(5,)` - Rimuovi tutti

### Condizioni Pagamento
```python
{
    'property_payment_term_id': 4,          # Vendita (many2one → account.payment.term)
    'property_supplier_payment_term_id': 4, # Acquisto
}
```

### Localizzazione
```python
{
    'lang': 'it_IT',           # Lingua: it_IT, en_US, de_DE, fr_FR
    'tz': 'Europe/Zurich',     # Timezone
}
```

### Note
```python
{
    'comment': 'Cliente VIP - Consegna urgente'  # HTML/text
}
```

---

## 7. PAYLOAD ESEMPIO COMPLETO

```python
import xmlrpc.client
import base64

# Credenziali
ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USERNAME = 'paul@lapa.ch'
ODOO_PASSWORD = 'lapa201180'

# Autenticazione
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Recupera dati relazionali
country_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.country', 'search',
    [[['code', '=', 'CH']]]
)
country_id = country_ids[0]

state_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.country.state', 'search',
    [[['code', '=', 'TI'], ['country_id', '=', country_id]]]
)
state_id = state_ids[0]

payment_term_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'account.payment.term', 'search',
    [[['name', 'ilike', '30']]]
)
payment_term_id = payment_term_ids[0]

# Logo (opzionale)
with open('logo.png', 'rb') as f:
    logo_base64 = base64.b64encode(f.read()).decode('ascii')

# Crea partner
partner_data = {
    # Identificazione
    'name': 'Azienda Esempio SA',
    'ref': 'CLI-001',

    # Tipo
    'is_company': True,
    'company_type': 'company',
    'type': 'contact',

    # Dati fiscali (ATTENZIONE: P.IVA validata!)
    'vat': 'CHE-123.456.788 TVA',
    'company_registry': 'CHE-123.456.788',

    # Indirizzo
    'street': 'Via Test 123',
    'street2': 'Edificio A',
    'city': 'Lugano',
    'zip': '6900',
    'state_id': state_id,
    'country_id': country_id,

    # Contatti
    'phone': '+41 91 123 45 67',
    'mobile': '+41 79 987 65 43',
    'email': 'info@esempio.ch',
    'website': 'https://www.esempio.ch',

    # Logo
    'image_1920': logo_base64,

    # Classificazione
    'customer_rank': 1,
    'supplier_rank': 0,

    # Assegnazioni
    'user_id': uid,

    # Condizioni pagamento
    'property_payment_term_id': payment_term_id,

    # Localizzazione
    'lang': 'it_IT',
    'tz': 'Europe/Zurich',

    # Note
    'comment': 'Partner creato via API',
}

# Crea
partner_id = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'create',
    [partner_data]
)

print(f"Partner creato: {partner_id}")
```

---

## 8. INDIRIZZI SECONDARI

### Indirizzo di Consegna
```python
delivery_data = {
    'name': 'Magazzino',
    'type': 'delivery',
    'parent_id': partner_id,  # Collega al partner principale
    'street': 'Via Magazzino 45',
    'city': 'Bellinzona',
    'zip': '6500',
    'country_id': country_id,
}

delivery_id = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'create',
    [delivery_data]
)
```

### Indirizzo di Fatturazione
```python
invoice_data = {
    'name': 'Amministrazione',
    'type': 'invoice',
    'parent_id': partner_id,
    'street': 'Via Admin 99',
    'city': 'Lugano',
    'zip': '6900',
    'country_id': country_id,
    'email': 'fatture@esempio.ch',
}

invoice_id = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'create',
    [invoice_data]
)
```

---

## 9. TEST ESEGUITI

### Test 1: Creazione Partner Completo
**Risultato:** ✅ SUCCESSO

```
Partner ID: 10791
  - Nome: Test Partner Completo SA
  - P.IVA: CHE-123.456.788 TVA
  - Indirizzo: Via Test 123, Lugano 6900
  - Email: test@partner-completo.ch
  - Website: https://www.partner-completo.ch
  - Logo: Caricato (base64)
```

### Test 2: Indirizzi Secondari
**Risultato:** ✅ SUCCESSO

```
Indirizzo consegna ID: 10792
  - Nome: Magazzino Principale
  - Tipo: delivery
  - Indirizzo: Via Magazzino 45, Bellinzona 6500

Indirizzo fatturazione ID: 10793
  - Nome: Ufficio Amministrazione
  - Tipo: invoice
  - Indirizzo: Via Amministrazione 99, Lugano 6900
```

---

## 10. PUNTI CHIAVE

1. **Solo 'name' è veramente necessario** - Odoo gestisce tutto il resto
2. **P.IVA è VALIDATA** - Usa formato `CHE-XXX.XXX.XXX TVA/MWST/IVA`
3. **Logo in base64** - Max 1920x1920, Odoo genera thumbnail automaticamente
4. **Many2one usa ID** - Passa l'ID, non il codice (es. `country_id: 43`, non `'CH'`)
5. **Many2many usa comandi** - `[(6, 0, [ids])]` per sostituire
6. **Indirizzi secondari** - Usa `parent_id` per collegare al partner principale
7. **Conti contabili auto-assegnati** - Non serve specificare `property_account_*_id`

---

## 11. FILE GENERATI

| File | Descrizione |
|------|-------------|
| `res-partner-analysis.json` | Dati completi modello (tutti i 249 campi) |
| `res-partner-report.txt` | Report leggibile categorizzato |
| `RES-PARTNER-QUICK-REFERENCE.md` | Guida rapida di riferimento |
| `RES-PARTNER-SUMMARY.md` | Questo riepilogo |
| `scripts/analyze-res-partner-simple.py` | Script analisi modello |
| `scripts/create-partner-example.py` | Script esempio funzionante |

---

## 12. COMANDI UTILI

### Analizza modello
```bash
python scripts/analyze-res-partner-simple.py
```

### Crea partner di test
```bash
python scripts/create-partner-example.py
```

### Cerca partner per P.IVA
```python
partner_ids = models.execute_kw(
    db, uid, pwd,
    'res.partner', 'search',
    [[['vat', 'ilike', 'CHE-123']]]
)
```

### Aggiorna partner
```python
models.execute_kw(
    db, uid, pwd,
    'res.partner', 'write',
    [[partner_id], {'phone': '+41 91 999 88 77'}]
)
```

---

**Autore:** Odoo Integration Master
**Data:** 2025-11-17
**Odoo Version:** 17
**Database:** lapadevadmin-lapa-v2-staging-2406-25408900
