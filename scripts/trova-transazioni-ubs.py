#!/usr/bin/env python3
"""
Trova DOVE sono finite le transazioni UBS in Odoo
Potrebbero essere in konti diversi da 1024/1025
"""

import xmlrpc.client
import ssl
from datetime import datetime
import csv

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def main():
    print("\n" + "=" * 80)
    print("TROVA TRANSAZIONI UBS - Analisi completa konti")
    print("=" * 80 + "\n")

    # Connect
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    print(f"Connected as UID: {uid}\n")

    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

    # Get LAPA company ID
    companies = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'res.company', 'search_read',
        [[['name', 'ilike', 'LAPA']]],
        {'fields': ['id', 'name'], 'limit': 1}
    )

    lapa_id = companies[0]['id']
    print(f"LAPA Company: {companies[0]['name']} (ID: {lapa_id})\n")

    # Get ALL UBS accounts for LAPA
    print("=" * 80)
    print("TUTTI I KONTI UBS IN ODOO")
    print("=" * 80 + "\n")

    ubs_accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[
            ['company_id', '=', lapa_id],
            ['name', 'ilike', 'UBS']
        ]],
        {'fields': ['id', 'code', 'name'], 'order': 'code'}
    )

    print(f"Trovati {len(ubs_accounts)} konti UBS:\n")
    for acc in ubs_accounts:
        print(f"  {acc['code']:10} - {acc['name']}")

    # For each UBS account, count movements in 2024
    print("\n" + "=" * 80)
    print("MOVIMENTI 2024 PER OGNI KONTO UBS")
    print("=" * 80 + "\n")

    for acc in ubs_accounts:
        move_lines = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', acc['id']],
                ['date', '>=', '2024-01-01'],
                ['date', '<=', '2024-12-31'],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['id', 'date', 'debit', 'credit', 'name'], 'limit': 5}
        )

        count = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move.line', 'search_count',
            [[
                ['account_id', '=', acc['id']],
                ['date', '>=', '2024-01-01'],
                ['date', '<=', '2024-12-31'],
                ['parent_state', '=', 'posted']
            ]]
        )

        if count > 0:
            print(f"\n{acc['code']} - {acc['name']}")
            print(f"  Movimenti 2024: {count}")

            # Calculate balance
            all_lines = models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.move.line', 'search_read',
                [[
                    ['account_id', '=', acc['id']],
                    ['date', '<=', '2024-12-31'],
                    ['parent_state', '=', 'posted']
                ]],
                {'fields': ['debit', 'credit']}
            )

            balance = sum(l['debit'] - l['credit'] for l in all_lines)
            print(f"  Saldo al 31/12/2024: {balance:,.2f}")

            # Show sample transactions
            if move_lines:
                print(f"  Esempio transazioni:")
                for line in move_lines[:3]:
                    amount = line['debit'] if line['debit'] > 0 else -line['credit']
                    desc = line.get('name', 'N/A')[:40]
                    print(f"    {line['date']} | {amount:>12.2f} | {desc}")

    # Now let's look for specific UBS transactions from CSV
    print("\n" + "=" * 80)
    print("CERCO TRANSAZIONI SPECIFICHE DAI CSV UBS")
    print("=" * 80 + "\n")

    # Sample transaction from UBS CHF CSV (Jan 3, 2024)
    print("Cercando: 03/01/2024, CHF -23,317.89 (TAMBURRO)...\n")

    # Search in all accounts
    for acc in ubs_accounts:
        lines = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', acc['id']],
                ['date', '=', '2024-01-03'],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['id', 'date', 'debit', 'credit', 'name'], 'limit': 20}
        )

        for line in lines:
            amount = line['debit'] - line['credit']
            if abs(abs(amount) - 23317.89) < 1:  # Within 1 CHF
                print(f"  ✓ TROVATA in {acc['code']} - {acc['name']}")
                print(f"    Importo: {amount:,.2f}")
                print(f"    Descrizione: {line.get('name', 'N/A')}")

    # Another sample: Jan 5, 2024 EUR
    print("\nCercando: 05/01/2024, EUR -4,983.00 (TRINITA)...\n")

    for acc in ubs_accounts:
        lines = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', acc['id']],
                ['date', '=', '2024-01-05'],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['id', 'date', 'debit', 'credit', 'name', 'currency_id'], 'limit': 20}
        )

        for line in lines:
            amount = line['debit'] - line['credit']
            if abs(abs(amount) - 4983.00) < 1:
                print(f"  ✓ TROVATA in {acc['code']} - {acc['name']}")
                print(f"    Importo: {amount:,.2f}")
                print(f"    Descrizione: {line.get('name', 'N/A')}")
                print(f"    Currency: {line.get('currency_id', 'CHF')}")

    print("\n" + "=" * 80)
    print("ANALISI COMPLETATA")
    print("=" * 80)

if __name__ == "__main__":
    main()
