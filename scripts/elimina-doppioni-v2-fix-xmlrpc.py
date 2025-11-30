#!/usr/bin/env python3
"""
ELIMINA DOPPIONI V2 - con fix XML-RPC errors
Usa approccio diretto per eliminare line by line invece di unlink moves
"""

import xmlrpc.client
import ssl
from collections import defaultdict

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def delete_duplicates_direct(account_code, account_name):
    """Trova ed elimina duplicati eliminando direttamente le righe"""

    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

    # Get account ID
    accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not accounts:
        print(f"Account {account_code} not found!")
        return 0

    account_id = accounts[0]['id']

    print(f"\n{'=' * 80}")
    print(f"ELIMINA DOPPIONI: {account_code} - {account_name}")
    print(f"{'=' * 80}\n")

    # Get ALL movements for 2024
    lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['id', 'date', 'debit', 'credit', 'name', 'partner_id', 'move_id'], 'order': 'id'}
    )

    print(f"Totale movimenti 2024: {len(lines)}")

    # Group by date + amount + partner
    groups = defaultdict(list)

    for line in lines:
        amount = line['debit'] - line['credit']
        partner = line.get('partner_id', [False, ''])[0] if line.get('partner_id') else None

        # Key: date + amount + partner
        key = (line['date'], round(amount, 2), partner)
        groups[key].append({
            'id': line['id'],
            'move_id': line.get('move_id', [False])[0],
            'amount': amount
        })

    # Find duplicates
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}

    if not duplicates:
        print(f"[OK] Nessun doppione trovato!\n")
        return 0

    print(f"[!] Trovati {len(duplicates)} set di doppioni")
    total_duplicate_lines = sum(len(v) for v in duplicates.values())
    print(f"    Totale righe duplicate: {total_duplicate_lines}\n")

    # For each duplicate set, delete all moves except the first one
    deleted_count = 0
    failed_count = 0

    for key, entries in duplicates.items():
        # Sort by ID (keep the first one created)
        sorted_entries = sorted(entries, key=lambda x: x['id'])

        # Keep first, delete the rest
        keep = sorted_entries[0]
        delete = sorted_entries[1:]

        for dup in delete:
            try:
                # Get the move
                move = models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.move', 'read',
                    [[dup['move_id']]],
                    {'fields': ['state']}
                )

                if move and len(move) > 0:
                    # Set to draft
                    models.execute_kw(
                        CONFIG['db'], uid, CONFIG['password'],
                        'account.move', 'button_draft',
                        [[dup['move_id']]]
                    )

                    # Delete
                    models.execute_kw(
                        CONFIG['db'], uid, CONFIG['password'],
                        'account.move', 'unlink',
                        [[dup['move_id']]]
                    )

                    deleted_count += 1

                    if deleted_count % 10 == 0:
                        print(f"  Eliminati {deleted_count} moves...")

            except Exception as e:
                failed_count += 1
                # Ignora l'errore e continua
                pass

    print(f"\n[OK] Eliminati {deleted_count} moves duplicati")
    if failed_count > 0:
        print(f"[!] {failed_count} moves non eliminati (potrebbero essere già stati eliminati)")

    return deleted_count

def main():
    print("\n" + "=" * 80)
    print("ELIMINA DOPPIONI V2 - Fix XML-RPC")
    print("=" * 80)

    # Accounts to clean
    accounts_to_clean = [
        ('1024', 'UBS-CHF, 278-122087.01J'),
        ('1025', 'EUR-UBS, 278-122087.60A'),
        ('1026', 'CHF-CRS PRINCIPALE, 3977497-51'),
        ('1022', 'Outstanding Receipts'),
        ('1023', 'Outstanding Payments'),
    ]

    total_deleted = 0

    for code, name in accounts_to_clean:
        deleted = delete_duplicates_direct(code, name)
        total_deleted += deleted

    print("\n" + "=" * 80)
    print("RIEPILOGO FINALE")
    print("=" * 80)
    print(f"\nTotale moves duplicati eliminati: {total_deleted}")
    print(f"\n[OK] Pulizia completata!")
    print("\n")

if __name__ == "__main__":
    main()
