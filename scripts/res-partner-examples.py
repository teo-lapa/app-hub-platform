#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
res.partner - Esempi Pratici Comuni
Odoo 17 - Casi d'uso reali
"""

import xmlrpc.client
import base64

# Credenziali
ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USERNAME = 'paul@lapa.ch'
ODOO_PASSWORD = 'lapa201180'


def get_odoo_connection():
    """Helper per connessione Odoo"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models


# ============================================================================
# ESEMPIO 1: Cliente Minimo
# ============================================================================
def esempio_cliente_minimo():
    """Crea cliente con solo i dati essenziali"""
    print("ESEMPIO 1: Cliente Minimo")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # Solo nome, email, telefono
    partner_data = {
        'name': 'Cliente Base Srl',
        'email': 'info@clientebase.ch',
        'phone': '+41 91 111 22 33',
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )

    print(f"Cliente creato con ID: {partner_id}")
    print("Note: Odoo assegna automaticamente tutti i campi obbligatori")
    print()


# ============================================================================
# ESEMPIO 2: Cliente con P.IVA Svizzera
# ============================================================================
def esempio_cliente_con_piva():
    """Crea cliente svizzero con P.IVA validata"""
    print("ESEMPIO 2: Cliente con P.IVA Svizzera")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # Cerca paese Svizzera
    country_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.country', 'search',
        [[['code', '=', 'CH']]]
    )
    country_id = country_ids[0]

    partner_data = {
        'name': 'Azienda CH SA',
        'vat': 'CHE-123.456.788 TVA',  # P.IVA validata!
        'company_registry': 'CHE-123.456.788',
        'is_company': True,
        'street': 'Via Nassa 5',
        'city': 'Lugano',
        'zip': '6900',
        'country_id': country_id,
        'email': 'info@azienda-ch.ch',
        'phone': '+41 91 222 33 44',
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )

    print(f"Cliente con P.IVA creato: {partner_id}")
    print("IMPORTANTE: P.IVA deve essere CHE-XXX.XXX.XXX TVA/MWST/IVA")
    print()


# ============================================================================
# ESEMPIO 3: Cliente con Indirizzo Completo
# ============================================================================
def esempio_cliente_indirizzo_completo():
    """Crea cliente con indirizzo completo (cantone Ticino)"""
    print("ESEMPIO 3: Cliente con Indirizzo Completo")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # Cerca Svizzera
    country_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.country', 'search',
        [[['code', '=', 'CH']]]
    )
    country_id = country_ids[0]

    # Cerca cantone Ticino
    state_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.country.state', 'search',
        [[['code', '=', 'TI'], ['country_id', '=', country_id]]]
    )
    state_id = state_ids[0] if state_ids else False

    partner_data = {
        'name': 'Ristorante Il Gabbiano',
        'is_company': True,
        'street': 'Riva Paradiso 23',
        'city': 'Lugano',
        'zip': '6900',
        'state_id': state_id,
        'country_id': country_id,
        'phone': '+41 91 123 45 67',
        'email': 'info@ilgabbiano.ch',
        'website': 'https://www.ilgabbiano.ch',
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )

    print(f"Cliente con indirizzo completo: {partner_id}")
    print(f"  - Cantone Ticino ID: {state_id}")
    print()


# ============================================================================
# ESEMPIO 4: Cliente con Logo
# ============================================================================
def esempio_cliente_con_logo():
    """Crea cliente con logo caricato"""
    print("ESEMPIO 4: Cliente con Logo")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # Crea logo di test (1x1 pixel PNG trasparente)
    test_logo = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    )
    logo_base64 = base64.b64encode(test_logo).decode('ascii')

    # Oppure carica da file:
    # with open('logo.png', 'rb') as f:
    #     logo_base64 = base64.b64encode(f.read()).decode('ascii')

    partner_data = {
        'name': 'Brand con Logo SA',
        'email': 'info@brand.ch',
        'image_1920': logo_base64,  # Max 1920x1920px
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )

    print(f"Cliente con logo creato: {partner_id}")
    print("Odoo genera automaticamente: image_1024, image_512, image_256, image_128")
    print()


# ============================================================================
# ESEMPIO 5: Cliente con Condizioni Pagamento
# ============================================================================
def esempio_cliente_con_pagamento():
    """Crea cliente con termini di pagamento personalizzati"""
    print("ESEMPIO 5: Cliente con Condizioni Pagamento")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # Cerca termini pagamento "30 giorni"
    payment_term_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.payment.term', 'search',
        [[['name', 'ilike', '30']]]
    )
    payment_term_id = payment_term_ids[0] if payment_term_ids else False

    # Lista tutti i termini disponibili
    all_terms = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.payment.term', 'search_read',
        [[]],
        {'fields': ['id', 'name']}
    )
    print("Termini pagamento disponibili:")
    for term in all_terms[:5]:  # Mostra primi 5
        print(f"  - ID {term['id']}: {term['name']}")
    print()

    partner_data = {
        'name': 'Cliente Pagamento 30gg',
        'email': 'info@cliente30.ch',
        'property_payment_term_id': payment_term_id,  # Termini vendita
        'customer_rank': 1,  # Marca come cliente
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )

    print(f"Cliente con termini pagamento creato: {partner_id}")
    print()


# ============================================================================
# ESEMPIO 6: Cliente con Indirizzi Multipli
# ============================================================================
def esempio_cliente_indirizzi_multipli():
    """Crea cliente con indirizzo fatturazione e consegna separati"""
    print("ESEMPIO 6: Cliente con Indirizzi Multipli")
    print("-" * 80)

    uid, models = get_odoo_connection()

    country_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.country', 'search',
        [[['code', '=', 'CH']]]
    )
    country_id = country_ids[0]

    # 1. Crea partner principale
    partner_data = {
        'name': 'Azienda Multi-Sede SA',
        'is_company': True,
        'email': 'sede.centrale@multi-sede.ch',
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )
    print(f"Partner principale creato: {partner_id}")

    # 2. Indirizzo fatturazione
    invoice_data = {
        'name': 'Ufficio Amministrativo',
        'type': 'invoice',
        'parent_id': partner_id,
        'street': 'Via Canova 5',
        'city': 'Lugano',
        'zip': '6900',
        'country_id': country_id,
        'email': 'fatture@multi-sede.ch',
    }

    invoice_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [invoice_data]
    )
    print(f"Indirizzo fatturazione: {invoice_id}")

    # 3. Indirizzo consegna 1
    delivery1_data = {
        'name': 'Magazzino Lugano',
        'type': 'delivery',
        'parent_id': partner_id,
        'street': 'Via Industria 10',
        'city': 'Lugano',
        'zip': '6900',
        'country_id': country_id,
        'phone': '+41 91 111 11 11',
    }

    delivery1_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [delivery1_data]
    )
    print(f"Magazzino Lugano: {delivery1_id}")

    # 4. Indirizzo consegna 2
    delivery2_data = {
        'name': 'Magazzino Bellinzona',
        'type': 'delivery',
        'parent_id': partner_id,
        'street': 'Via Stazione 45',
        'city': 'Bellinzona',
        'zip': '6500',
        'country_id': country_id,
        'phone': '+41 91 222 22 22',
    }

    delivery2_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [delivery2_data]
    )
    print(f"Magazzino Bellinzona: {delivery2_id}")

    # Verifica
    partner = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'read',
        [[partner_id]],
        {'fields': ['name', 'child_ids']}
    )[0]

    print(f"\nPartner '{partner['name']}' ha {len(partner['child_ids'])} indirizzi collegati")
    print()


# ============================================================================
# ESEMPIO 7: Fornitore
# ============================================================================
def esempio_fornitore():
    """Crea fornitore (non cliente)"""
    print("ESEMPIO 7: Fornitore")
    print("-" * 80)

    uid, models = get_odoo_connection()

    partner_data = {
        'name': 'Fornitore Test Srl',
        'is_company': True,
        'supplier_rank': 1,  # Marca come fornitore (non cliente)
        'customer_rank': 0,  # Non è cliente
        'email': 'ordini@fornitore.it',
        'phone': '+39 02 1234 5678',
    }

    partner_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'create',
        [partner_data]
    )

    print(f"Fornitore creato: {partner_id}")
    print("supplier_rank = 1 -> È un fornitore")
    print("customer_rank = 0 -> Non è un cliente")
    print()


# ============================================================================
# ESEMPIO 8: Cerca e Aggiorna Partner
# ============================================================================
def esempio_cerca_aggiorna():
    """Cerca partner per email e aggiorna telefono"""
    print("ESEMPIO 8: Cerca e Aggiorna Partner")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # 1. Cerca per email
    partner_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'search',
        [[['email', '=', 'test@partner-completo.ch']]]
    )

    if partner_ids:
        partner_id = partner_ids[0]
        print(f"Partner trovato: {partner_id}")

        # 2. Leggi dati attuali
        partner = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'res.partner', 'read',
            [[partner_id]],
            {'fields': ['name', 'phone', 'mobile']}
        )[0]

        print(f"Dati attuali:")
        print(f"  - Nome: {partner['name']}")
        print(f"  - Phone: {partner.get('phone')}")
        print(f"  - Mobile: {partner.get('mobile')}")

        # 3. Aggiorna telefono
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'res.partner', 'write',
            [[partner_id], {
                'phone': '+41 91 999 88 77',
                'mobile': '+41 79 111 22 33',
            }]
        )

        print(f"\nPartner aggiornato!")
        print(f"  - Nuovo phone: +41 91 999 88 77")
        print(f"  - Nuovo mobile: +41 79 111 22 33")
    else:
        print("Nessun partner trovato con quella email")

    print()


# ============================================================================
# ESEMPIO 9: Lista Tutti i Clienti
# ============================================================================
def esempio_lista_clienti():
    """Lista tutti i partner che sono clienti"""
    print("ESEMPIO 9: Lista Tutti i Clienti")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # Cerca tutti i clienti (customer_rank > 0)
    customer_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'search',
        [[['customer_rank', '>', 0]]],
        {'limit': 10}  # Primi 10
    )

    # Leggi dettagli
    customers = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner', 'read',
        [customer_ids],
        {'fields': ['name', 'email', 'phone', 'customer_rank']}
    )

    print(f"Trovati {len(customers)} clienti (mostrando primi 10):")
    for customer in customers:
        print(f"  - {customer['name']:40} | {customer.get('email', 'N/A'):30} | Rank: {customer['customer_rank']}")

    print()


# ============================================================================
# ESEMPIO 10: Partner con Tag/Categorie
# ============================================================================
def esempio_partner_con_tag():
    """Crea partner con categorie/tag"""
    print("ESEMPIO 10: Partner con Tag/Categorie")
    print("-" * 80)

    uid, models = get_odoo_connection()

    # Lista categorie disponibili
    categories = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'res.partner.category', 'search_read',
        [[]],
        {'fields': ['id', 'name'], 'limit': 5}
    )

    print("Categorie partner disponibili:")
    for cat in categories:
        print(f"  - ID {cat['id']}: {cat['name']}")
    print()

    if categories:
        category_ids = [cat['id'] for cat in categories[:2]]  # Usa prime 2

        partner_data = {
            'name': 'Partner con Tag',
            'email': 'info@tag.ch',
            'category_id': [(6, 0, category_ids)]  # Many2many
        }

        partner_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'res.partner', 'create',
            [partner_data]
        )

        print(f"Partner con tag creato: {partner_id}")
        print(f"Tag assegnati: {category_ids}")
    else:
        print("Nessuna categoria disponibile")

    print()


# ============================================================================
# MAIN
# ============================================================================
if __name__ == '__main__':
    print("=" * 80)
    print("RES.PARTNER - ESEMPI PRATICI")
    print("=" * 80)
    print()

    try:
        # Esegui gli esempi che vuoi
        esempio_cliente_minimo()
        # esempio_cliente_con_piva()
        # esempio_cliente_indirizzo_completo()
        # esempio_cliente_con_logo()
        # esempio_cliente_con_pagamento()
        # esempio_cliente_indirizzi_multipli()
        # esempio_fornitore()
        # esempio_cerca_aggiorna()
        # esempio_lista_clienti()
        # esempio_partner_con_tag()

        print("=" * 80)
        print("TUTTI GLI ESEMPI COMPLETATI CON SUCCESSO")
        print("=" * 80)

    except Exception as e:
        print(f"\nERRORE: {e}")
        import traceback
        traceback.print_exc()
