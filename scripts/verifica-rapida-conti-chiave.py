#!/usr/bin/env python3
"""
VERIFICA RAPIDA CONTI CHIAVE - Staging
Solo i 5 conti critici
"""

import xmlrpc.client

# Configurazione
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

CONTI = ['1099', '10901', '1022', '1023', '1001']

# Connessione
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

print(f"Connesso UID: {uid}\n")
print("STATO CONTI CHIAVE:")
print("=" * 60)

for code in CONTI:
    # Cerca account
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[('code', '=', code)]]
    )

    if not account_ids:
        print(f"{code}: NON TROVATO")
        continue

    # Movimenti 2024
    move_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[
            ('account_id', '=', account_ids[0]),
            ('date', '<=', '2024-12-31'),
            ('parent_state', '=', 'posted')
        ]],
        {'fields': ['debit', 'credit']}
    )

    debit = sum(line['debit'] for line in move_lines)
    credit = sum(line['credit'] for line in move_lines)
    balance = debit - credit

    # Status
    if code in ['1099', '10901', '1022', '1023']:
        status = "OK ZERO" if abs(balance) < 0.01 else f"WARNING {balance:,.2f}"
    else:
        status = "OK" if 80000 <= balance <= 100000 else f"CHECK {balance:,.2f}"

    print(f"{code}: CHF {balance:,.2f} ({len(move_lines)} movimenti) - {status}")

print("=" * 60)
