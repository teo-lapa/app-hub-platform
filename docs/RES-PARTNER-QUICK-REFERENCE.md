# res.partner - Quick Reference Guide

## Odoo 17 - Modello res.partner

**Totale campi:** 249

---

## Campi OBBLIGATORI

Solo 2 campi sono obbligatori, ma **Odoo li assegna automaticamente**:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `property_account_receivable_id` | many2one | Conto contabile crediti (auto-assegnato) |
| `property_account_payable_id` | many2one | Conto contabile debiti (auto-assegnato) |

**Nota:** In pratica, puoi creare un partner anche solo con `{'name': 'Nome Cliente'}` e Odoo gestisce il resto.

---

## Campi DATI AZIENDALI

### Identificazione
- **`name`** (char) - Nome partner
- **`ref`** (char) - Codice cliente interno
- **`company_registry`** (char) - Numero registro imprese

### Dati Fiscali
- **`vat`** (char) - Partita IVA (es. `CHE123456789`)
- **`l10n_it_codice_fiscale`** (char) - Codice Fiscale (solo Italia)

### Indirizzo
- **`street`** (char) - Via e numero
- **`street2`** (char) - Secondo rigo indirizzo
- **`city`** (char) - Città
- **`zip`** (char) - CAP
- **`state_id`** (many2one) - Cantone/Stato → `res.country.state`
- **`country_id`** (many2one) - Paese → `res.country`

### Tipo Partner
- **`is_company`** (boolean) - `True` = azienda, `False` = persona
- **`company_type`** (selection) - `'company'` o `'person'`
- **`type`** (selection) - `'contact'` (principale), `'invoice'`, `'delivery'`, `'other'`

---

## Campi CONTATTI

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `phone` | char | Telefono fisso |
| `mobile` | char | Telefono cellulare |
| `email` | char | Email |
| `website` | char | Sito web |

---

## Campi IMMAGINE/LOGO

**Campo principale:** `image_1920` (binary)

```python
import base64

# Carica logo da file
with open('logo.png', 'rb') as f:
    logo_base64 = base64.b64encode(f.read()).decode('ascii')

partner_data = {
    'image_1920': logo_base64  # Immagine max 1920x1920px
}
```

**Campi generati automaticamente da Odoo:**
- `image_1024` - Dimensione 1024x1024
- `image_512` - Dimensione 512x512
- `image_256` - Dimensione 256x256
- `image_128` - Dimensione 128x128

---

## Campi CLASSIFICAZIONE

- **`customer_rank`** (integer) - Numero ordini come cliente (`> 0` = è cliente)
- **`supplier_rank`** (integer) - Numero ordini come fornitore (`> 0` = è fornitore)
- **`user_id`** (many2one) - Venditore assegnato → `res.users`
- **`team_id`** (many2one) - Team vendite → `crm.team`

---

## Campi TAG/CATEGORIE

**`category_id`** (many2many) - Tag partner → `res.partner.category`

```python
# Formato Many2Many
partner_data = {
    'category_id': [(6, 0, [1, 2, 3])]  # Sostituisci tutti con IDs 1, 2, 3
}

# Comandi Many2Many:
# (6, 0, [ids]) = Sostituisci tutti
# (4, id)       = Aggiungi ID
# (3, id)       = Rimuovi ID
# (5,)          = Rimuovi tutti
```

---

## Campi CONDIZIONI PAGAMENTO

- **`property_payment_term_id`** (many2one) - Termini pagamento **VENDITA** → `account.payment.term`
- **`property_supplier_payment_term_id`** (many2one) - Termini pagamento **ACQUISTO** → `account.payment.term`

---

## Campi LOCALIZZAZIONE

| Campo | Tipo | Valori |
|-------|------|--------|
| `lang` | selection | `it_IT`, `en_US`, `de_DE`, `fr_FR`, etc. |
| `tz` | selection | `Europe/Zurich`, `Europe/Rome`, etc. |

---

## Campi NOTE

**`comment`** (text/html) - Note interne sul partner

---

## ESEMPIO COMPLETO

```python
import xmlrpc.client
import base64

# Credenziali
ODOO_URL = 'https://...'
ODOO_DB = '...'
ODOO_USERNAME = '...'
ODOO_PASSWORD = '...'

# Autenticazione
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Cerca dati relazionali
country_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.country', 'search',
    [[['code', '=', 'CH']]]
)
country_id = country_ids[0] if country_ids else False

state_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.country.state', 'search',
    [[['code', '=', 'TI'], ['country_id', '=', country_id]]]
)
state_id = state_ids[0] if state_ids else False

payment_term_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'account.payment.term', 'search',
    [[['name', 'ilike', '30']]]
)
payment_term_id = payment_term_ids[0] if payment_term_ids else False

# Logo (opzionale)
logo_base64 = None
try:
    with open('logo.png', 'rb') as f:
        logo_base64 = base64.b64encode(f.read()).decode('ascii')
except:
    pass

# Crea partner
partner_data = {
    # Identificazione
    'name': 'Azienda Esempio SA',
    'ref': 'CLI-001',

    # Tipo
    'is_company': True,
    'company_type': 'company',
    'type': 'contact',

    # Dati fiscali
    'vat': 'CHE123456789',
    'company_registry': 'CHE-123.456.789',

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
    'customer_rank': 1,  # È cliente
    'supplier_rank': 0,  # Non è fornitore

    # Assegnazioni
    'user_id': uid,  # Venditore

    # Condizioni pagamento
    'property_payment_term_id': payment_term_id,

    # Localizzazione
    'lang': 'it_IT',
    'tz': 'Europe/Zurich',

    # Note
    'comment': 'Cliente VIP',
}

# Crea
partner_id = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'create',
    [partner_data]
)

print(f"Partner creato con ID: {partner_id}")
```

---

## ESEMPIO MINIMO

```python
# Solo campi essenziali
partner_data = {
    'name': 'Partner Minimo',
    'email': 'test@example.com',
    'phone': '+41 91 111 22 33',
}

partner_id = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'create',
    [partner_data]
)
```

**Nota:** Odoo assegna automaticamente tutti i campi obbligatori.

---

## INDIRIZZI SECONDARI

Puoi creare indirizzi di **consegna** e **fatturazione** separati:

```python
# Indirizzo di consegna
delivery_address = {
    'name': 'Magazzino Principale',
    'type': 'delivery',
    'parent_id': partner_id,  # Collega al partner principale
    'street': 'Via Magazzino 45',
    'city': 'Bellinzona',
    'zip': '6500',
    'country_id': country_id,
    'phone': '+41 91 888 77 66',
}

delivery_id = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'create',
    [delivery_address]
)

# Indirizzo di fatturazione
invoice_address = {
    'name': 'Ufficio Amministrazione',
    'type': 'invoice',
    'parent_id': partner_id,
    'street': 'Via Amministrazione 99',
    'city': 'Lugano',
    'zip': '6900',
    'country_id': country_id,
    'email': 'fatture@esempio.ch',
}

invoice_id = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'create',
    [invoice_address]
)
```

---

## OPERAZIONI COMUNI

### Cerca partner per P.IVA
```python
partner_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'search',
    [[['vat', '=', 'CHE123456789']]]
)
```

### Cerca clienti (customer_rank > 0)
```python
customer_ids = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'search',
    [[['customer_rank', '>', 0]]]
)
```

### Aggiorna partner esistente
```python
models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'write',
    [[partner_id], {
        'phone': '+41 91 999 88 77',
        'email': 'new@example.com'
    }]
)
```

### Leggi partner con campi specifici
```python
partner = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'read',
    [[partner_id]],
    {
        'fields': [
            'name', 'vat', 'email', 'phone',
            'street', 'city', 'country_id'
        ]
    }
)[0]
```

---

## TROUBLESHOOTING

### Errore: "Missing required fields"
**Soluzione:** Odoo assegna automaticamente `property_account_receivable_id` e `property_account_payable_id`. Se l'errore persiste, verifica che la company abbia configurato i conti di default.

### Errore: "Invalid field value" per country_id
**Soluzione:** Assicurati di passare l'**ID** del paese, non il codice:
```python
# ❌ SBAGLIATO
'country_id': 'CH'

# ✅ CORRETTO
country_ids = models.execute_kw(..., 'res.country', 'search', [[['code', '=', 'CH']]])
'country_id': country_ids[0]
```

### Logo non visualizzato
**Soluzione:** Verifica che:
1. L'immagine sia in formato base64 **stringa** (non bytes)
2. Usi `base64.b64encode(bytes).decode('ascii')`
3. L'immagine non superi 1920x1920px

---

## FILE UTILI GENERATI

- **`res-partner-analysis.json`** - Dati completi modello (tutti i 249 campi)
- **`res-partner-report.txt`** - Report leggibile categorizzato
- **`scripts/create-partner-example.py`** - Script esempio funzionante

---

## RIFERIMENTI

- **Script analisi:** `scripts/analyze-res-partner-simple.py`
- **Script esempio:** `scripts/create-partner-example.py`
- **Documentazione Odoo:** https://www.odoo.com/documentation/17.0/developer/reference/backend/orm.html
