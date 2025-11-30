#!/usr/bin/env python3
"""
Fix Suspense Account Configuration for Miscellaneous Operations Journal

Configures the missing "suspense account" for Miscellaneous Operations journal
so that bank statement import can proceed.

Error being fixed:
"Impossibile creare una nuova riga di estratto conto.
Nel registro Miscellaneous Operations non è stato impostato un conto provvisorio."

EXECUTION:
python scripts/FIX-SUSPENSE-ACCOUNT.py
"""

import xmlrpc.client
import ssl

# Disable SSL verification
ssl._create_default_https_context = ssl._create_unverified_context

# Configuration
CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

# Suspense account to use (account 1021 - Bank Suspense Account)
SUSPENSE_ACCOUNT_CODE = '1021'

def main():
    print("\n" + "=" * 80)
    print("FIX SUSPENSE ACCOUNT FOR MISCELLANEOUS OPERATIONS JOURNAL")
    print("=" * 80 + "\n")

    try:
        # Connect to Odoo
        print("Connecting to Odoo...")
        common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
        uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})

        if not uid:
            print("[ERROR] Authentication failed!")
            return

        print(f"[OK] Connected as {CONFIG['username']} (UID: {uid})\n")

        models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

        # Find suspense account
        print(f"Looking for suspense account '{SUSPENSE_ACCOUNT_CODE}'...")
        accounts = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.account', 'search_read',
            [[['code', '=', SUSPENSE_ACCOUNT_CODE]]],
            {'fields': ['id', 'code', 'name'], 'limit': 1}
        )

        if not accounts:
            print(f"[ERROR] Account {SUSPENSE_ACCOUNT_CODE} not found!")
            print(f"\nPlease create account {SUSPENSE_ACCOUNT_CODE} in Odoo first:")
            print("  Go to Accounting > Configuration > Chart of Accounts")
            print(f"  Create account: {SUSPENSE_ACCOUNT_CODE} - Bank Suspense Account")
            print("  Type: Current Assets")
            return

        suspense_account_id = accounts[0]['id']
        print(f"[OK] Found account: {accounts[0]['code']} - {accounts[0]['name']} (ID: {suspense_account_id})\n")

        # Find Miscellaneous Operations journal
        print("Looking for 'Miscellaneous Operations' journal...")

        # Try different search strategies
        misc_journals = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.journal', 'search_read',
            [[['code', '=', 'MISC']]],
            {'fields': ['id', 'code', 'name', 'suspense_account_id'], 'limit': 5}
        )

        if not misc_journals:
            print("  Journal 'MISC' not found, searching by name...")
            misc_journals = models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.journal', 'search_read',
                [[['name', 'ilike', 'Miscellaneous']]],
                {'fields': ['id', 'code', 'name', 'suspense_account_id'], 'limit': 5}
            )

        if not misc_journals:
            print("[ERROR] No 'Miscellaneous Operations' journal found!")
            print("\nSearching for all journals...")
            all_journals = models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.journal', 'search_read',
                [[]],
                {'fields': ['id', 'code', 'name', 'type'], 'limit': 50}
            )

            print(f"\nFound {len(all_journals)} journals:")
            for j in all_journals:
                print(f"  {j['code']:10} - {j['name'][:50]:<50} (Type: {j.get('type', 'N/A')})")

            return

        print(f"[OK] Found {len(misc_journals)} Miscellaneous journal(s)\n")

        # Fix each journal found
        for journal in misc_journals:
            print(f"Configuring journal {journal['code']} - {journal['name']}...")
            print(f"  Journal ID: {journal['id']}")

            current_suspense = journal.get('suspense_account_id')

            if current_suspense:
                if isinstance(current_suspense, list):
                    print(f"  [INFO] Suspense account already set: {current_suspense[0]} - {current_suspense[1]}")
                else:
                    print(f"  [INFO] Suspense account already set: {current_suspense}")

                # Update anyway to ensure it's correct
                print(f"  [INFO] Updating to account {SUSPENSE_ACCOUNT_CODE}...")

            # Set suspense account
            success = models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.journal', 'write',
                [[journal['id']], {'suspense_account_id': suspense_account_id}]
            )

            if success:
                print(f"  [OK] Suspense account set to {SUSPENSE_ACCOUNT_CODE}\n")
            else:
                print(f"  [ERROR] Failed to set suspense account\n")

        print("\n" + "=" * 80)
        print("CONFIGURATION COMPLETE")
        print("=" * 80)
        print("\nYou can now run the bank import script:")
        print("  python scripts/import-bank-statements-2024.py")
        print("")

    except Exception as e:
        print(f"\n[ERROR]: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
