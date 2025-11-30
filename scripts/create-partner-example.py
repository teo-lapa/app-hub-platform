#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Esempio COMPLETO di creazione partner in Odoo 17
Tutti i campi rilevanti con spiegazioni dettagliate
"""

import xmlrpc.client
import base64

# Credenziali Odoo Staging
ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USERNAME = 'paul@lapa.ch'
ODOO_PASSWORD = 'lapa201180'


def create_complete_partner():
    """
    Crea un partner completo con TUTTI i campi rilevanti

    Questo esempio dimostra:
    1. Come autenticarsi
    2. Come recuperare dati relazionali (paese, cantone, termini pagamento)
    3. Come gestire il logo (base64)
    4. Come creare il partner principale
    5. Come creare indirizzi secondari (consegna, fatturazione)
    """

    print("=" * 80)
    print("CREAZIONE PARTNER COMPLETO - ODOO 17")
    print("=" * 80)
    print()

    # ========================================
    # STEP 1: AUTENTICAZIONE
    # ========================================
    print("STEP 1: Autenticazione...")

    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        print("ERRORE: Autenticazione fallita")
        return

    print(f"  OK - UID: {uid}")
    print()

    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

    # ========================================
    # STEP 2: RECUPERA DATI RELAZIONALI
    # ========================================
    print("STEP 2: Recupero dati relazionali...")

    # 2.1 - Cerca paese Svizzera
    print("  2.1 - Cerca paese Svizzera (CH)...")
    country_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.country', 'search',
        [[['code', '=', 'CH']]]
    )
    country_id = country_ids[0] if country_ids else False
    print(f"      Country ID: {country_id}")

    # 2.2 - Cerca cantone Ticino
    print("  2.2 - Cerca cantone Ticino (TI)...")
    state_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.country.state', 'search',
        [[['code', '=', 'TI'], ['country_id', '=', country_id]]]
    )
    state_id = state_ids[0] if state_ids else False
    print(f"      State ID: {state_id}")

    # 2.3 - Cerca termini pagamento (30 giorni)
    print("  2.3 - Cerca termini pagamento (30 Days)...")
    payment_term_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.payment.term', 'search',
        [[['name', 'ilike', '30']]]
    )
    payment_term_id = payment_term_ids[0] if payment_term_ids else False
    print(f"      Payment Term ID: {payment_term_id}")

    # 2.4 - Cerca categorie partner (opzionale)
    print("  2.4 - Cerca categorie partner...")
    category_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner.category', 'search',
        [[]],
        {'limit': 3}
    )
    print(f"      Category IDs disponibili: {category_ids}")

    print()

    # ========================================
    # STEP 3: PREPARA LOGO (OPZIONALE)
    # ========================================
    print("STEP 3: Prepara logo...")

    logo_base64 = None

    # Puoi caricare da file:
    # try:
    #     with open('logo.png', 'rb') as f:
    #         logo_base64 = base64.b64encode(f.read()).decode('ascii')
    #     print("  OK - Logo caricato da file")
    # except:
    #     print("  SKIP - Nessun logo (opzionale)")

    # Oppure creare un logo di test (1x1 pixel PNG trasparente)
    # Questo è solo per test, in produzione usa un vero logo
    test_logo_bytes = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    )
    logo_base64 = base64.b64encode(test_logo_bytes).decode('ascii')
    print("  OK - Logo di test creato (sostituisci con logo reale in produzione)")
    print()

    # ========================================
    # STEP 4: CREA PARTNER PRINCIPALE
    # ========================================
    print("STEP 4: Crea partner principale...")

    partner_data = {
        # ===== IDENTIFICAZIONE =====
        'name': 'Test Partner Completo SA',
        'ref': 'TEST-001',  # Codice cliente interno

        # ===== TIPO =====
        'is_company': True,  # True = azienda, False = persona
        'company_type': 'company',  # 'company' o 'person'
        'type': 'contact',  # 'contact' (principale), 'invoice', 'delivery', 'other'

        # ===== DATI FISCALI =====
        'vat': 'CHE-123.456.788 TVA',  # P.IVA formato Svizzera (deve essere valida)
        'company_registry': 'CHE-123.456.788',  # Numero registro imprese

        # ===== INDIRIZZO =====
        'street': 'Via Test 123',
        'street2': 'Edificio A, Piano 3',  # Secondo rigo indirizzo (opzionale)
        'city': 'Lugano',
        'zip': '6900',
        'state_id': state_id,  # ID cantone Ticino
        'country_id': country_id,  # ID Svizzera

        # ===== CONTATTI =====
        'phone': '+41 91 123 45 67',
        'mobile': '+41 79 987 65 43',
        'email': 'test@partner-completo.ch',
        'website': 'https://www.partner-completo.ch',

        # ===== IMMAGINE/LOGO =====
        'image_1920': logo_base64,  # Immagine in base64 (max 1920x1920)
        # Odoo genera automaticamente: image_1024, image_512, image_256, image_128

        # ===== CLASSIFICAZIONE =====
        'customer_rank': 1,  # >0 significa che è un cliente
        'supplier_rank': 0,  # >0 significa che è un fornitore (0 = no)

        # ===== ASSEGNAZIONI =====
        'user_id': uid,  # Venditore assegnato (usa l'utente corrente)
        # 'team_id': 1,  # Team vendite (opzionale)

        # ===== TAG/CATEGORIE =====
        # 'category_id': [(6, 0, category_ids)],  # Many2many: sostituisci con IDs reali

        # ===== CONDIZIONI PAGAMENTO =====
        'property_payment_term_id': payment_term_id,  # Termini pagamento vendita
        'property_supplier_payment_term_id': payment_term_id,  # Termini pagamento acquisto

        # ===== LOCALIZZAZIONE =====
        'lang': 'it_IT',  # Lingua (it_IT, en_US, de_DE, fr_FR, etc.)
        'tz': 'Europe/Zurich',  # Timezone

        # ===== NOTE =====
        'comment': 'Partner di test creato via API XML-RPC - Esempio completo con tutti i campi',
    }

    # Crea il partner
    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )

    print(f"  OK - Partner creato con ID: {partner_id}")
    print()

    # ========================================
    # STEP 5: LEGGI PARTNER CREATO
    # ========================================
    print("STEP 5: Verifica partner creato...")

    partner = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'read',
        [[partner_id]],
        {
            'fields': [
                'name', 'ref', 'vat', 'company_registry',
                'street', 'city', 'zip', 'state_id', 'country_id',
                'phone', 'mobile', 'email', 'website',
                'is_company', 'company_type', 'type',
                'customer_rank', 'supplier_rank',
                'user_id', 'lang', 'tz',
                'property_payment_term_id',
                'comment'
            ]
        }
    )[0]

    print("  Dati partner creato:")
    for field, value in sorted(partner.items()):
        if field != 'id':
            if isinstance(value, list) and len(value) == 2:
                print(f"    {field:30} = {value[1]} (ID: {value[0]})")
            else:
                val_str = str(value)[:60]
                print(f"    {field:30} = {val_str}")
    print()

    # ========================================
    # STEP 6: CREA INDIRIZZI SECONDARI
    # ========================================
    print("STEP 6: Crea indirizzi secondari...")

    # 6.1 - Indirizzo di consegna
    print("  6.1 - Crea indirizzo di consegna...")
    delivery_address_data = {
        'name': 'Magazzino Principale',
        'type': 'delivery',  # Tipo: consegna
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
        [delivery_address_data]
    )
    print(f"      OK - Indirizzo consegna ID: {delivery_id}")

    # 6.2 - Indirizzo di fatturazione
    print("  6.2 - Crea indirizzo di fatturazione...")
    invoice_address_data = {
        'name': 'Ufficio Amministrazione',
        'type': 'invoice',  # Tipo: fatturazione
        'parent_id': partner_id,  # Collega al partner principale
        'street': 'Via Amministrazione 99',
        'city': 'Lugano',
        'zip': '6900',
        'country_id': country_id,
        'email': 'fatture@partner-completo.ch',
    }

    invoice_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [invoice_address_data]
    )
    print(f"      OK - Indirizzo fatturazione ID: {invoice_id}")
    print()

    # ========================================
    # STEP 7: VERIFICA INDIRIZZI COLLEGATI
    # ========================================
    print("STEP 7: Verifica indirizzi collegati al partner...")

    # Rileggi il partner per vedere i child_ids
    partner_updated = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'read',
        [[partner_id]],
        {'fields': ['name', 'child_ids']}
    )[0]

    print(f"  Partner: {partner_updated['name']}")
    print(f"  Child IDs: {partner_updated['child_ids']}")

    # Leggi i dettagli degli indirizzi figli
    if partner_updated['child_ids']:
        children = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'res.partner', 'read',
            [partner_updated['child_ids']],
            {'fields': ['name', 'type', 'street', 'city', 'zip']}
        )

        for child in children:
            print(f"    - {child['type']:10} | {child['name']:30} | {child.get('street', '')} - {child.get('city', '')}")

    print()

    # ========================================
    # RIEPILOGO
    # ========================================
    print("=" * 80)
    print("RIEPILOGO")
    print("=" * 80)
    print(f"Partner principale ID: {partner_id}")
    print(f"  - Nome: {partner['name']}")
    print(f"  - Ref: {partner['ref']}")
    print(f"  - P.IVA: {partner['vat']}")
    print(f"  - Email: {partner['email']}")
    print(f"  - Website: {partner['website']}")
    print()
    print(f"Indirizzo consegna ID: {delivery_id}")
    print(f"Indirizzo fatturazione ID: {invoice_id}")
    print()
    print("IMPORTANTE:")
    print("  - I campi property_account_receivable_id e property_account_payable_id")
    print("    sono OBBLIGATORI ma Odoo li assegna automaticamente dai default")
    print("  - L'immagine image_1920 è in formato base64")
    print("  - Odoo genera automaticamente le versioni ridotte (1024, 512, 256, 128)")
    print("  - Per many2many (es. category_id) usa: [(6, 0, [id1, id2, id3])]")
    print()
    print("=" * 80)


def minimal_partner_example():
    """
    Esempio MINIMO - Solo campi essenziali
    """

    print("=" * 80)
    print("ESEMPIO MINIMO - SOLO CAMPI ESSENZIALI")
    print("=" * 80)
    print()

    # Autenticazione
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

    # Dati minimi
    minimal_data = {
        'name': 'Partner Minimo Test',
        'email': 'minimal@test.ch',
        'phone': '+41 91 111 22 33',
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [minimal_data]
    )

    print(f"Partner minimo creato con ID: {partner_id}")
    print()
    print("Note:")
    print("  - Solo 'name' è realmente necessario")
    print("  - Odoo assegna automaticamente i conti contabili di default")
    print("  - is_company default = False (persona)")
    print("  - type default = 'contact'")
    print()


if __name__ == '__main__':
    try:
        # Esempio completo con tutti i campi
        create_complete_partner()

        # Esempio minimo
        # minimal_partner_example()

    except Exception as e:
        print(f"\nERRORE: {e}")
        import traceback
        traceback.print_exc()
