#!/usr/bin/env python3
"""Delete all MISC moves created today (cleanup import errors)"""

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
    print("\nDELETE TODAY'S MISC MOVES")
    print("="*80)

    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})

    if not uid:
        print("[ERROR] Auth failed!")
        return

    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

    today = datetime.now().strftime('%Y-%m-%d')

    # Get all moves created today in MISC journal
    moves = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move', 'search_read',
        [[
            ['create_date', '>=', f'{today} 00:00:00'],
            ['create_date', '<=', f'{today} 23:59:59'],
            ['journal_id', '=', 4]  # MISC journal
        ]],
        {'fields': ['id', 'name', 'date', 'state'], 'limit': 5000}
    )

    print(f"Found {len(moves)} moves to delete")

    if not moves:
        print("[OK] No moves to delete!")
        return

    move_ids = [m['id'] for m in moves]

    # Unpost if needed
    posted = [m['id'] for m in moves if m['state'] == 'posted']
    if posted:
        print(f"  Unposting {len(posted)} posted moves...")
        try:
            models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.move', 'button_draft',
                [posted]
            )
        except Exception as e:
            print(f"  [WARNING] Unpost error: {e}")

    # Delete
    print(f"  Deleting {len(move_ids)} moves...")
    try:
        models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move', 'unlink',
            [move_ids]
        )
        print(f"[OK] Deleted {len(move_ids)} moves!")
    except Exception as e:
        print(f"[ERROR] Delete failed: {e}")

if __name__ == '__main__':
    main()
