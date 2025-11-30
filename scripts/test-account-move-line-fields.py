#!/usr/bin/env python3
"""
Test per verificare quali campi esistono in account.move.line
"""

import xmlrpc.client

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Connect
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
print(f"[OK] Autenticato come UID: {uid}")

models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Get fields_get for account.move.line
fields_info = models.execute_kw(
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    'account.move.line',
    'fields_get',
    [],
    {'attributes': ['string', 'type', 'help']}
)

print(f"\n[OK] Trovati {len(fields_info)} campi in account.move.line\n")

# Verifica campi che vogliamo usare
wanted_fields = [
    'id',
    'move_id',
    'date',
    'name',
    'debit',
    'credit',
    'balance',
    'partner_id',
    'account_id',
    'company_id',
    'currency_id',
    'display_type',
    'parent_state',
    'reconciled',
    'full_reconcile_id',
    'matching_number'
]

print("Verifica campi richiesti:")
print("="*80)
for field in wanted_fields:
    if field in fields_info:
        print(f"[OK] {field:25s} - {fields_info[field].get('string', 'N/A')}")
    else:
        print(f"[ERROR] {field:25s} - CAMPO NON ESISTE!")

# Stampa alcuni altri campi utili
print("\n\nCampi simili a 'state':")
print("="*80)
for field_name, field_info in fields_info.items():
    if 'state' in field_name.lower():
        print(f"{field_name:30s} - {field_info.get('string', 'N/A')}")
