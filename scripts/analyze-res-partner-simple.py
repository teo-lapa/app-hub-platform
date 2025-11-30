#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analizza res.partner Odoo 17 - Versione semplificata
Output su file per evitare problemi encoding console
"""

import xmlrpc.client
import json

# Credenziali Odoo Staging
ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USERNAME = 'paul@lapa.ch'
ODOO_PASSWORD = 'lapa201180'

def main():
    print("Connessione a Odoo...")

    # Autenticazione
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        print("ERRORE: Autenticazione fallita")
        return

    print(f"OK - UID: {uid}")

    # Connessione modello
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

    # Ottieni tutti i campi
    print("Recupero campi res.partner...")
    fields_info = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'fields_get',
        [],
        {
            'attributes': [
                'string', 'type', 'required', 'readonly',
                'help', 'relation', 'selection', 'store'
            ]
        }
    )

    print(f"Trovati {len(fields_info)} campi")

    # Categorizza
    required = {k: v for k, v in fields_info.items() if v.get('required')}
    business = {k: v for k, v in fields_info.items() if any(
        x in k.lower() for x in ['name', 'company', 'vat', 'fiscal', 'ref',
                                  'street', 'city', 'zip', 'country', 'state']
    )}
    contact = {k: v for k, v in fields_info.items() if any(
        x in k.lower() for x in ['phone', 'mobile', 'email', 'website']
    )}
    image = {k: v for k, v in fields_info.items() if any(
        x in k.lower() for x in ['image', 'avatar', 'logo']
    )}

    # Recupera esempi reali
    print("Recupero partner esempio...")
    partner_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'search',
        [[['is_company', '=', True], ['vat', '!=', False]]],
        {'limit': 2}
    )

    examples = []
    if partner_ids:
        important_fields = [
            'name', 'ref', 'vat', 'company_registry',
            'street', 'street2', 'city', 'zip', 'state_id', 'country_id',
            'phone', 'mobile', 'email', 'website',
            'is_company', 'company_type', 'type',
            'customer_rank', 'supplier_rank',
            'user_id', 'team_id', 'title',
            'category_id', 'comment',
            'image_1920', 'image_128',
            'parent_id', 'child_ids',
            'property_payment_term_id', 'property_supplier_payment_term_id',
            'lang', 'tz'
        ]

        examples = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'res.partner', 'read',
            [partner_ids],
            {'fields': important_fields}
        )

    # Salva tutto
    output = {
        'total_fields': len(fields_info),
        'required_fields': required,
        'business_fields': business,
        'contact_fields': contact,
        'image_fields': image,
        'examples': examples,
        'all_fields': fields_info
    }

    with open('res-partner-analysis.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)

    print("OK - Dati salvati in res-partner-analysis.json")

    # Genera report leggibile
    report_lines = []
    report_lines.append("=" * 80)
    report_lines.append("ANALISI RES.PARTNER - ODOO 17")
    report_lines.append("=" * 80)
    report_lines.append("")

    report_lines.append(f"Totale campi: {len(fields_info)}")
    report_lines.append("")

    report_lines.append(f"CAMPI OBBLIGATORI ({len(required)}):")
    report_lines.append("-" * 80)
    for name, data in sorted(required.items()):
        report_lines.append(f"  {name:35} | {data.get('type'):15} | {data.get('string')}")
    report_lines.append("")

    report_lines.append(f"CAMPI DATI AZIENDALI ({len(business)}):")
    report_lines.append("-" * 80)
    for name, data in sorted(business.items()):
        req = "[REQUIRED]" if data.get('required') else ""
        report_lines.append(f"  {name:35} | {data.get('type'):15} | {data.get('string')} {req}")
    report_lines.append("")

    report_lines.append(f"CAMPI CONTATTO ({len(contact)}):")
    report_lines.append("-" * 80)
    for name, data in sorted(contact.items()):
        report_lines.append(f"  {name:35} | {data.get('type'):15} | {data.get('string')}")
    report_lines.append("")

    report_lines.append(f"CAMPI IMMAGINE ({len(image)}):")
    report_lines.append("-" * 80)
    for name, data in sorted(image.items()):
        report_lines.append(f"  {name:35} | {data.get('type'):15} | {data.get('string')}")
        if data.get('help'):
            report_lines.append(f"    Help: {data.get('help')[:100]}")
    report_lines.append("")

    if examples:
        report_lines.append("ESEMPI REALI:")
        report_lines.append("-" * 80)
        for idx, ex in enumerate(examples, 1):
            report_lines.append(f"ESEMPIO {idx} - {ex.get('name')}:")
            for field, value in sorted(ex.items()):
                if value and field != 'image_1920' and field != 'image_128':
                    if isinstance(value, list) and len(value) == 2:
                        report_lines.append(f"  {field:30} = {value[1]} (ID: {value[0]})")
                    elif isinstance(value, list):
                        report_lines.append(f"  {field:30} = [{len(value)} items]")
                    else:
                        val_str = str(value)[:80]
                        report_lines.append(f"  {field:30} = {val_str}")
            report_lines.append("")

    report_lines.append("=" * 80)
    report_lines.append("ESEMPIO PAYLOAD COMPLETO PER CREARE PARTNER")
    report_lines.append("=" * 80)
    report_lines.append("")
    report_lines.append("""
# Step 1: Prepara dati relazionali

# Cerca paese
country_ids = models.execute_kw(
    db, uid, password,
    'res.country', 'search',
    [[['code', '=', 'CH']]]  # Svizzera
)
country_id = country_ids[0] if country_ids else False

# Cerca stato/cantone
state_ids = models.execute_kw(
    db, uid, password,
    'res.country.state', 'search',
    [[['code', '=', 'TI'], ['country_id', '=', country_id]]]
)
state_id = state_ids[0] if state_ids else False

# Cerca termini pagamento (esempio: 30 giorni)
payment_term_ids = models.execute_kw(
    db, uid, password,
    'account.payment.term', 'search',
    [[['name', 'ilike', '30']]]
)
payment_term_id = payment_term_ids[0] if payment_term_ids else False

# Step 2: Prepara logo (opzionale)
import base64

logo_base64 = None
try:
    with open('company_logo.png', 'rb') as f:
        logo_base64 = base64.b64encode(f.read()).decode('ascii')
except:
    pass  # Logo opzionale

# Step 3: Crea partner con TUTTI i campi rilevanti

partner_data = {
    # ===== IDENTIFICAZIONE =====
    'name': 'Azienda Esempio SA',  # OBBLIGATORIO per person, auto per company
    'ref': 'CLI-12345',  # Codice cliente interno

    # ===== TIPO =====
    'is_company': True,  # True=azienda, False=persona
    'company_type': 'company',  # 'company' o 'person'
    'type': 'contact',  # 'contact', 'invoice', 'delivery', 'other'

    # ===== DATI FISCALI =====
    'vat': 'CHE123456789',  # P.IVA
    'company_registry': '123.456.789',  # Numero registro imprese
    'l10n_it_codice_fiscale': 'RSSMRA80A01H501U',  # Solo per Italia

    # ===== INDIRIZZO =====
    'street': 'Via Esempio 123',
    'street2': 'Edificio A',  # Secondo rigo indirizzo
    'city': 'Lugano',
    'zip': '6900',
    'state_id': state_id,  # ID stato/cantone
    'country_id': country_id,  # ID paese

    # ===== CONTATTI =====
    'phone': '+41 91 123 45 67',
    'mobile': '+41 79 123 45 67',
    'email': 'info@esempio.ch',
    'website': 'https://www.esempio.ch',

    # ===== IMMAGINE/LOGO =====
    'image_1920': logo_base64,  # Base64 dell'immagine (max 1920x1920)
    # Odoo genera automaticamente:
    # - image_1024, image_512, image_256, image_128

    # ===== CLASSIFICAZIONE =====
    'customer_rank': 1,  # >0 = è un cliente
    'supplier_rank': 0,  # >0 = è un fornitore

    # ===== ASSEGNAZIONI =====
    'user_id': 7,  # ID venditore assegnato
    'team_id': 1,  # ID team vendite

    # ===== TAG/CATEGORIE =====
    'category_id': [(6, 0, [1, 2, 3])],  # IDs delle categorie
    # Formato Many2many: [(6, 0, [lista_ids])]

    # ===== CONDIZIONI PAGAMENTO =====
    'property_payment_term_id': payment_term_id,  # Termini pagamento VENDITA
    'property_supplier_payment_term_id': payment_term_id,  # Termini pagamento ACQUISTO

    # ===== CONTI CONTABILI (OBBLIGATORI) =====
    # Se non specificati, Odoo usa quelli di default
    # 'property_account_receivable_id': account_receivable_id,
    # 'property_account_payable_id': account_payable_id,

    # ===== LOCALIZZAZIONE =====
    'lang': 'it_IT',  # Lingua (it_IT, en_US, de_DE, fr_FR, etc.)
    'tz': 'Europe/Zurich',  # Timezone

    # ===== NOTE =====
    'comment': 'Cliente VIP - Consegna sempre urgente',
}

# Step 4: Crea il partner
partner_id = models.execute_kw(
    db, uid, password,
    'res.partner', 'create',
    [partner_data]
)

print(f"Partner creato con ID: {partner_id}")

# Step 5 (opzionale): Aggiungi indirizzi secondari
# Crea indirizzo di consegna separato
delivery_address_id = models.execute_kw(
    db, uid, password,
    'res.partner', 'create',
    [{
        'name': 'Magazzino Principale',
        'type': 'delivery',
        'parent_id': partner_id,  # Collega al partner principale
        'street': 'Via Magazzino 45',
        'city': 'Bellinzona',
        'zip': '6500',
        'country_id': country_id,
        'phone': '+41 91 999 88 77',
    }]
)

# Crea indirizzo fatturazione separato
invoice_address_id = models.execute_kw(
    db, uid, password,
    'res.partner', 'create',
    [{
        'name': 'Ufficio Amministrazione',
        'type': 'invoice',
        'parent_id': partner_id,
        'street': 'Via Amministrazione 99',
        'city': 'Lugano',
        'zip': '6900',
        'country_id': country_id,
        'email': 'fatture@esempio.ch',
    }]
)

print(f"Indirizzi aggiunti: delivery={delivery_address_id}, invoice={invoice_address_id}")
""")

    report_lines.append("")
    report_lines.append("=" * 80)
    report_lines.append("CAMPI CHIAVE SPIEGATI")
    report_lines.append("=" * 80)
    report_lines.append("")
    report_lines.append("CAMPI OBBLIGATORI:")
    report_lines.append("  - property_account_receivable_id: Conto contabile crediti (auto-assegnato)")
    report_lines.append("  - property_account_payable_id: Conto contabile debiti (auto-assegnato)")
    report_lines.append("")
    report_lines.append("CAMPO LOGO/IMMAGINE:")
    report_lines.append("  - image_1920: Immagine originale (base64), max 1920x1920px")
    report_lines.append("  - Odoo genera automaticamente: image_1024, image_512, image_256, image_128")
    report_lines.append("  - Formato: base64.b64encode(file_bytes).decode('ascii')")
    report_lines.append("")
    report_lines.append("TIPO PARTNER:")
    report_lines.append("  - is_company: True=azienda, False=persona")
    report_lines.append("  - company_type: 'company' o 'person'")
    report_lines.append("  - type: 'contact' (principale), 'invoice', 'delivery', 'other'")
    report_lines.append("")
    report_lines.append("CLASSIFICAZIONE:")
    report_lines.append("  - customer_rank: Numero ordini come cliente (>0 = e' cliente)")
    report_lines.append("  - supplier_rank: Numero ordini come fornitore (>0 = e' fornitore)")
    report_lines.append("")
    report_lines.append("MANY2MANY (es. category_id):")
    report_lines.append("  - Formato: [(6, 0, [id1, id2, id3])]")
    report_lines.append("  - 6 = replace all")
    report_lines.append("  - 4 = add existing")
    report_lines.append("  - 3 = remove")
    report_lines.append("")

    with open('res-partner-report.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))

    print("OK - Report salvato in res-partner-report.txt")
    print("")
    print(f"Campi totali: {len(fields_info)}")
    print(f"Campi obbligatori: {len(required)}")
    print(f"Campi aziendali: {len(business)}")
    print(f"Campi contatto: {len(contact)}")
    print(f"Campi immagine: {len(image)}")
    print("")
    print("File generati:")
    print("  - res-partner-analysis.json (dati completi)")
    print("  - res-partner-report.txt (report leggibile)")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"ERRORE: {e}")
        import traceback
        traceback.print_exc()
