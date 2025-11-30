#!/usr/bin/env python3
"""
Check company accounts and find correct suspense account for ItaEmpire
"""

import xmlrpc.client
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def main():
    print("\n" + "="*80)
    print("CHECK COMPANY ACCOUNTS")
    print("="*80 + "\n")

    # Connect
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})

    if not uid:
        print("[ERROR] Authentication failed!")
        return

    print(f"[OK] Connected as {CONFIG['username']} (UID: {uid})\n")

    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

    # 1. Find all companies
    print("=" * 80)
    print("COMPANIES")
    print("=" * 80)

    companies = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'res.company', 'search_read',
        [[]],
        {'fields': ['id', 'name']}
    )

    for company in companies:
        print(f"  ID: {company['id']:3d} | {company['name']}")

    # 2. Find MISC journal details
    print("\n" + "=" * 80)
    print("MISC JOURNAL")
    print("=" * 80)

    journals = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.journal', 'search_read',
        [[['code', '=', 'MISC']]],
        {'fields': ['id', 'code', 'name', 'company_id', 'suspense_account_id']}
    )

    for journal in journals:
        print(f"\nJournal: {journal['name']}")
        print(f"  ID: {journal['id']}")
        print(f"  Code: {journal['code']}")
        print(f"  Company: {journal['company_id']}")
        print(f"  Suspense Account: {journal.get('suspense_account_id', 'NOT SET')}")

        # Get company for this journal
        if journal.get('company_id'):
            company_id = journal['company_id'][0] if isinstance(journal['company_id'], list) else journal['company_id']

            # 3. Find all suspense-like accounts for this company
            print(f"\n  Searching for suspense accounts in company {company_id}...")

            suspense_accounts = models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.account', 'search_read',
                [[
                    ['company_id', '=', company_id],
                    '|',
                    ['code', 'ilike', '102'],
                    ['name', 'ilike', 'suspense']
                ]],
                {'fields': ['id', 'code', 'name', 'company_id', 'account_type']}
            )

            if suspense_accounts:
                print(f"\n  Found {len(suspense_accounts)} suspense account(s):")
                for acc in suspense_accounts:
                    print(f"    {acc['code']:10s} | {acc['name']:40s} | Type: {acc.get('account_type', 'N/A')}")
            else:
                print("  [WARNING] No suspense accounts found for this company!")

                # Search for account 1024 (UBS CHF)
                print(f"\n  Searching for account 1024 (UBS CHF) in company {company_id}...")

                ubs_accounts = models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.account', 'search_read',
                    [[
                        ['company_id', '=', company_id],
                        ['code', '=', '1024']
                    ]],
                    {'fields': ['id', 'code', 'name', 'company_id', 'account_type']}
                )

                if ubs_accounts:
                    print(f"  Found UBS CHF account:")
                    for acc in ubs_accounts:
                        print(f"    {acc['code']:10s} | {acc['name']:40s} | Type: {acc.get('account_type', 'N/A')}")
                else:
                    print("  [ERROR] UBS CHF account 1024 not found in this company!")

    # 4. Find all 102x accounts
    print("\n" + "=" * 80)
    print("ALL 102x ACCOUNTS (Any Company)")
    print("=" * 80)

    all_102x = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', 'ilike', '102']]],
        {'fields': ['id', 'code', 'name', 'company_id', 'account_type']}
    )

    for acc in all_102x:
        company_name = acc['company_id'][1] if isinstance(acc['company_id'], list) else 'N/A'
        print(f"  {acc['code']:10s} | {acc['name']:40s} | Company: {company_name:20s} | Type: {acc.get('account_type', 'N/A')}")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
