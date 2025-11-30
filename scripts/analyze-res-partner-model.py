#!/usr/bin/env python3
"""
Analizza il modello res.partner in Odoo 17
Estrae TUTTI i campi disponibili con dettagli completi
"""

import xmlrpc.client
import json

# Credenziali Odoo Staging
ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USERNAME = 'paul@lapa.ch'
ODOO_PASSWORD = 'lapa201180'

def analyze_res_partner_model():
    """Analizza il modello res.partner e restituisce tutti i campi"""

    print("=" * 80)
    print("ANALISI MODELLO RES.PARTNER - ODOO 17")
    print("=" * 80)
    print()

    # 1. Autenticazione
    print("1. Connessione a Odoo...")
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        print("ERRORE: Autenticazione fallita!")
        return

    print(f"   OK Autenticato con UID: {uid}")
    print()

    # 2. Connessione al modello
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

    # 3. Ottieni dettagli campi res.partner
    print("2. Recupero metadati modello res.partner...")
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

    print(f"   OK Trovati {len(fields_info)} campi totali")
    print()

    # 4. Categorizza i campi
    print("=" * 80)
    print("CATEGORIZZAZIONE CAMPI")
    print("=" * 80)
    print()

    # Campi obbligatori
    required_fields = {}
    for field_name, field_data in fields_info.items():
        if field_data.get('required'):
            required_fields[field_name] = field_data

    print(f"CAMPI OBBLIGATORI ({len(required_fields)}):")
    print("-" * 80)
    for field_name, field_data in sorted(required_fields.items()):
        print(f"  • {field_name:25} | {field_data.get('type'):15} | {field_data.get('string')}")
    print()

    # Campi aziendali
    business_keywords = [
        'name', 'company', 'vat', 'fiscal', 'ref', 'commercial',
        'street', 'city', 'zip', 'country', 'state', 'address'
    ]
    business_fields = {}
    for field_name, field_data in fields_info.items():
        if any(keyword in field_name.lower() for keyword in business_keywords):
            business_fields[field_name] = field_data

    print(f"CAMPI DATI AZIENDALI ({len(business_fields)}):")
    print("-" * 80)
    for field_name, field_data in sorted(business_fields.items()):
        req = "[REQ]" if field_data.get('required') else ""
        print(f"  • {field_name:30} | {field_data.get('type'):15} | {field_data.get('string')} {req}")
    print()

    # Campi contatto
    contact_keywords = ['phone', 'mobile', 'email', 'fax', 'website']
    contact_fields = {}
    for field_name, field_data in fields_info.items():
        if any(keyword in field_name.lower() for keyword in contact_keywords):
            contact_fields[field_name] = field_data

    print(f"CAMPI CONTATTO ({len(contact_fields)}):")
    print("-" * 80)
    for field_name, field_data in sorted(contact_fields.items()):
        print(f"  • {field_name:30} | {field_data.get('type'):15} | {field_data.get('string')}")
    print()

    # Campi immagine/logo
    image_keywords = ['image', 'avatar', 'logo']
    image_fields = {}
    for field_name, field_data in fields_info.items():
        if any(keyword in field_name.lower() for keyword in image_keywords):
            image_fields[field_name] = field_data

    print(f"CAMPI IMMAGINE/LOGO ({len(image_fields)}):")
    print("-" * 80)
    for field_name, field_data in sorted(image_fields.items()):
        print(f"  • {field_name:30} | {field_data.get('type'):15} | {field_data.get('string')}")
        help_text = field_data.get('help', '')
        if help_text:
            print(f"    └─> Help: {help_text[:100]}...")
    print()

    # Campi categorizzazione
    category_keywords = ['tag', 'category', 'user_id', 'team_id', 'title']
    category_fields = {}
    for field_name, field_data in fields_info.items():
        if any(keyword in field_name.lower() for keyword in category_keywords):
            category_fields[field_name] = field_data

    print(f"CAMPI CATEGORIZZAZIONE ({len(category_fields)}):")
    print("-" * 80)
    for field_name, field_data in sorted(category_fields.items()):
        print(f"  • {field_name:30} | {field_data.get('type'):15} | {field_data.get('string')}")
        if field_data.get('relation'):
            print(f"    └─> Relazione: {field_data.get('relation')}")
    print()

    # Campi tipo partner
    type_keywords = ['type', 'is_company', 'customer', 'supplier']
    type_fields = {}
    for field_name, field_data in fields_info.items():
        field_lower = field_name.lower()
        if any(keyword in field_lower for keyword in type_keywords):
            type_fields[field_name] = field_data

    print(f"CAMPI TIPO PARTNER ({len(type_fields)}):")
    print("-" * 80)
    for field_name, field_data in sorted(type_fields.items()):
        print(f"  • {field_name:30} | {field_data.get('type'):15} | {field_data.get('string')}")
        if field_data.get('selection'):
            print(f"    └─> Opzioni: {field_data.get('selection')}")
    print()

    # 5. Cerca esempi reali
    print("=" * 80)
    print("ESEMPI REALI DAL DATABASE")
    print("=" * 80)
    print()

    print("3. Recupero partner esempio (con più campi compilati)...")
    partner_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'search',
        [[['is_company', '=', True], ['vat', '!=', False]]],
        {'limit': 3}
    )

    if partner_ids:
        print(f"   OK Trovati {len(partner_ids)} partner aziendali con P.IVA")
        print()

        # Leggi i partner con MOLTI campi
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

        partners = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'res.partner', 'read',
            [partner_ids],
            {'fields': important_fields}
        )

        for idx, partner in enumerate(partners, 1):
            print(f"ESEMPIO {idx}:")
            print("-" * 80)
            for field, value in sorted(partner.items()):
                if value and field != 'image_1920':  # Skip immagine per brevità
                    if isinstance(value, list) and len(value) == 2:
                        print(f"  • {field:30} = {value[1]} (ID: {value[0]})")
                    elif isinstance(value, list):
                        print(f"  • {field:30} = {value} ({len(value)} items)")
                    else:
                        val_str = str(value)[:70]
                        print(f"  • {field:30} = {val_str}")
            print()

    # 6. Salva JSON completo
    print("=" * 80)
    print("SALVATAGGIO DATI")
    print("=" * 80)
    print()

    output = {
        'model': 'res.partner',
        'total_fields': len(fields_info),
        'required_fields': required_fields,
        'business_fields': business_fields,
        'contact_fields': contact_fields,
        'image_fields': image_fields,
        'category_fields': category_fields,
        'type_fields': type_fields,
        'all_fields': fields_info,
        'examples': partners if partner_ids else []
    }

    output_file = 'res-partner-complete-analysis.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)

    print(f"OK Dati completi salvati in: {output_file}")
    print()

    # 7. Genera esempio payload
    print("=" * 80)
    print("ESEMPIO PAYLOAD COMPLETO")
    print("=" * 80)
    print()

    print("# Esempio per creare un partner COMPLETO:")
    print("""
import base64

# Leggi logo da file
with open('company_logo.png', 'rb') as f:
    logo_base64 = base64.b64encode(f.read()).decode('ascii')

# Cerca paese Svizzera
country_ids = models.execute_kw(
    db, uid, password,
    'res.country', 'search',
    [[['code', '=', 'CH']]]
)
country_id = country_ids[0] if country_ids else False

# Cerca cantone Ticino (se esiste)
state_ids = models.execute_kw(
    db, uid, password,
    'res.country.state', 'search',
    [[['code', '=', 'TI'], ['country_id', '=', country_id]]]
)
state_id = state_ids[0] if state_ids else False

# Payload completo
partner_data = {
    # IDENTIFICAZIONE
    'name': 'Azienda Esempio SA',
    'ref': 'AZI-001',  # Codice cliente interno

    # TIPO
    'is_company': True,
    'company_type': 'company',  # 'company' o 'person'
    'type': 'contact',  # 'contact', 'invoice', 'delivery', 'other', 'private'

    # DATI FISCALI
    'vat': 'CHE123456789',  # P.IVA formato CH
    'company_registry': '123.456.789',  # Numero registro imprese

    # INDIRIZZO
    'street': 'Via Esempio 123',
    'street2': 'Edificio A, Piano 3',
    'city': 'Lugano',
    'zip': '6900',
    'state_id': state_id,
    'country_id': country_id,

    # CONTATTI
    'phone': '+41 91 123 45 67',
    'mobile': '+41 79 123 45 67',
    'email': 'info@azienda-esempio.ch',
    'website': 'https://www.azienda-esempio.ch',

    # LOGO/IMMAGINE
    'image_1920': logo_base64,  # Immagine originale (max 1920x1920)
    # Odoo genera automaticamente: image_1024, image_512, image_256, image_128

    # CATEGORIZZAZIONE
    'customer_rank': 1,  # Numero ordini come cliente (>0 = è cliente)
    'supplier_rank': 0,  # Numero ordini come fornitore
    'user_id': user_id,  # Venditore assegnato
    'team_id': team_id,  # Team vendita
    'title': title_id,  # Titolo (Sig., Sig.ra, Dott., etc.)
    'category_id': [(6, 0, [cat1_id, cat2_id])],  # Tag/categorie

    # LOCALIZZAZIONE
    'lang': 'it_IT',  # Lingua
    'tz': 'Europe/Zurich',  # Timezone

    # CONDIZIONI PAGAMENTO
    'property_payment_term_id': payment_term_id,  # Termini pagamento vendita
    'property_supplier_payment_term_id': supplier_term_id,  # Termini pagamento acquisto

    # NOTE
    'comment': 'Cliente importante - Consegna sempre urgente'
}

# Crea partner
partner_id = models.execute_kw(
    db, uid, password,
    'res.partner', 'create',
    [partner_data]
)

print(f"Partner creato con ID: {partner_id}")
""")

    print()
    print("=" * 80)
    print("ANALISI COMPLETATA")
    print("=" * 80)


if __name__ == '__main__':
    try:
        analyze_res_partner_model()
    except Exception as e:
        print(f"\nERRORE: {e}")
        import traceback
        traceback.print_exc()
