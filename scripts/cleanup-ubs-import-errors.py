#!/usr/bin/env python3
r"""
Cleanup UBS CHF Import Errors

Elimina le transazioni errate importate con il bug debit/credit invertito.
"""

import xmlrpc.client
import ssl
from datetime import datetime

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def main():
    print("\n" + "="*80)
    print("CLEANUP UBS CHF IMPORT ERRORS")
    print("="*80 + "\n")

    # Connect
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})

    if not uid:
        print("[ERROR] Authentication failed!")
        return

    print(f"[OK] Connected as {CONFIG['username']} (UID: {uid})\n")

    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

    # Find account 1024
    accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', '1024']]],
        {'fields': ['id', 'code', 'name'], 'limit': 1}
    )

    if not accounts:
        print("[ERROR] Account 1024 not found!")
        return

    account_id = accounts[0]['id']
    print(f"Account: {accounts[0]['code']} - {accounts[0]['name']} (ID: {account_id})")

    # Get current balance
    moves = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[['account_id', '=', account_id]]],
        {'fields': ['debit', 'credit']}
    )

    balance = sum(m.get('debit', 0) - m.get('credit', 0) for m in moves)
    print(f"Current balance: CHF {balance:,.2f}\n")

    # Find moves created today with ref containing "UBS CHF"
    today = datetime.now().strftime('%Y-%m-%d')

    print(f"Searching for moves created today ({today}) with ref='UBS CHF'...")

    moves_to_delete = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move', 'search_read',
        [[
            ['ref', 'ilike', 'UBS CHF'],
            ['create_date', '>=', f'{today} 00:00:00'],
            ['create_date', '<=', f'{today} 23:59:59']
        ]],
        {'fields': ['id', 'name', 'ref', 'date', 'state'], 'limit': 5000}
    )

    print(f"Found {len(moves_to_delete)} moves to delete\n")

    if not moves_to_delete:
        print("[OK] No moves to delete!")
        return

    # Show sample
    print("Sample moves (first 10):")
    for move in moves_to_delete[:10]:
        print(f"  {move['name']:20s} | {move['date']} | {move['ref'][:50]}")

    # Ask confirmation
    print(f"\n[WARNING] About to delete {len(moves_to_delete)} moves!")
    confirm = input("Type 'YES' to confirm: ")

    if confirm != 'YES':
        print("Cancelled.")
        return

    # Delete moves
    print(f"\nDeleting {len(moves_to_delete)} moves...")

    # First, unpost if posted
    posted_ids = [m['id'] for m in moves_to_delete if m['state'] == 'posted']
    if posted_ids:
        print(f"  Unposting {len(posted_ids)} posted moves...")
        try:
            models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.move', 'button_draft',
                [posted_ids]
            )
            print(f"  [OK] Unposted {len(posted_ids)} moves")
        except Exception as e:
            print(f"  [WARNING] Could not unpost some moves: {e}")

    # Delete all
    move_ids = [m['id'] for m in moves_to_delete]

    try:
        models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move', 'unlink',
            [move_ids]
        )
        print(f"[OK] Deleted {len(move_ids)} moves\n")
    except Exception as e:
        print(f"[ERROR] Failed to delete: {e}")
        return

    # Get new balance
    moves_after = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[['account_id', '=', account_id]]],
        {'fields': ['debit', 'credit']}
    )

    balance_after = sum(m.get('debit', 0) - m.get('credit', 0) for m in moves_after)
    print(f"Balance after cleanup: CHF {balance_after:,.2f}")
    print(f"[OK] Cleanup complete!")

if __name__ == '__main__':
    main()
