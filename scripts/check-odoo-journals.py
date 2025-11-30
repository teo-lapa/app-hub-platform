#!/usr/bin/env python3
"""
Check Odoo Journals - Python Version

Lists all bank journals in Odoo to find correct codes for import
"""

import xmlrpc.client

# Configuration
URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
USERNAME = "paul@lapa.ch"
PASSWORD = "lapa201180"

def main():
    print("\n" + "=" * 80)
    print("ODOO JOURNAL CHECKER")
    print("=" * 80 + "\n")

    try:
        # Connect
        print("Connecting to Odoo...")
        common = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/common")
        uid = common.authenticate(DB, USERNAME, PASSWORD, {})

        if not uid:
            print("[ERROR] Authentication failed!")
            return

        print(f"[OK] Connected as user {USERNAME} (UID: {uid})\n")

        # Get models
        models = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/object")

        # Fetch all bank journals
        print("Fetching bank journals...\n")
        journals = models.execute_kw(
            DB, uid, PASSWORD,
            'account.journal', 'search_read',
            [[['type', '=', 'bank']]],
            {'fields': ['code', 'name', 'currency_id', 'bank_account_id', 'default_account_id']}
        )

        print(f"Found {len(journals)} bank journals:\n")
        print("-" * 80)
        print(f"{'CODE':<15}{'NAME':<40}{'CURRENCY':<15}{'ID'}")
        print("-" * 80)

        for journal in journals:
            code = journal.get('code', '')
            name = journal.get('name', '')
            currency = journal['currency_id'][1] if journal.get('currency_id') else 'CHF'
            jid = journal.get('id', 0)

            print(f"{code:<15}{name:<40}{currency:<15}{jid}")

        print("-" * 80)
        print("")

        # Look for UBS accounts
        print("Looking for UBS accounts specifically...\n")
        ubs_journals = [j for j in journals if 'ubs' in j.get('name', '').lower() or 'ubs' in j.get('code', '').lower()]

        if ubs_journals:
            print("UBS-related journals found:")
            for j in ubs_journals:
                currency = j['currency_id'][1] if j.get('currency_id') else 'CHF'
                print(f"  {j['code']}: {j['name']} ({currency}) - ID: {j['id']}")
        else:
            print("[WARNING] No UBS-specific journals found.")
            print("\nSearching for account 1024 (UBS CHF)...")

            # Try to find by default account
            journals_1024 = [j for j in journals if j.get('default_account_id') and '1024' in str(j['default_account_id'])]
            if journals_1024:
                print("Found journals with account 1024:")
                for j in journals_1024:
                    currency = j['currency_id'][1] if j.get('currency_id') else 'CHF'
                    print(f"  {j['code']}: {j['name']} ({currency}) - ID: {j['id']}")

        print("")

        # Get account info for 1024
        print("Searching for account 1024 (UBS CHF)...")
        accounts = models.execute_kw(
            DB, uid, PASSWORD,
            'account.account', 'search_read',
            [[['code', '=', '1024']]],
            {'fields': ['code', 'name', 'currency_id'], 'limit': 1}
        )

        if accounts:
            account = accounts[0]
            print(f"[OK] Found account: {account['code']} - {account['name']} (ID: {account['id']})")

            # Find journal using this account
            journals_by_account = models.execute_kw(
                DB, uid, PASSWORD,
                'account.journal', 'search_read',
                [['|', ['default_account_id', '=', account['id']], ['name', 'ilike', '1024']]],
                {'fields': ['code', 'name', 'type', 'currency_id']}
            )

            if journals_by_account:
                print(f"\nJournals linked to account 1024:")
                for j in journals_by_account:
                    currency = j['currency_id'][1] if j.get('currency_id') else 'CHF'
                    print(f"  {j['code']}: {j['name']} (Type: {j['type']}, Currency: {currency})")
        else:
            print("[WARNING] Account 1024 not found")

        print("")

    except Exception as e:
        print(f"\n[ERROR]: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
