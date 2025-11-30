#!/usr/bin/env python3
"""Verifica campi disponibili su account.account"""

import xmlrpc.client

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Connetti
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Ottieni fields di account.account
fields = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'account.account', 'fields_get',
    [],
    {'attributes': ['string', 'type']}
)

# Filtra solo campi con "balance" nel nome
balance_fields = {k: v for k, v in fields.items() if 'balance' in k.lower() or 'debit' in k.lower() or 'credit' in k.lower()}

print("Campi con balance/debit/credit:")
for field_name, field_info in sorted(balance_fields.items()):
    print(f"  {field_name}: {field_info.get('string', '')} ({field_info.get('type', '')})")
