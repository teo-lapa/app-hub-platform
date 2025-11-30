#!/usr/bin/env python3
"""
Diagnose journal and company setup to find correct suspense account
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
    print("\n" + "=" * 80)
    print("DIAGNOSE JOURNAL AND COMPANY SETUP")
    print("=" * 80 + "\n")

    # Connect
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    print(f"Connected as UID: {uid}\n")

    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

    # Get all companies
    print("=" * 80)
    print("COMPANIES")
    print("=" * 80)
    companies = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'res.company', 'search_read',
        [[]],
        {'fields': ['id', 'name']}
    )

    for c in companies:
        print(f"  {c['id']:3}: {c['name']}")

    # Get LAPA company ID
    lapa_company = [c for c in companies if 'LAPA' in c['name']]
    if lapa_company:
        lapa_id = lapa_company[0]['id']
        print(f"\nLAPA Company ID: {lapa_id} - {lapa_company[0]['name']}")
    else:
        print("\nNo LAPA company found!")
        return

    # Get all journals with company info
    print("\n" + "=" * 80)
    print("JOURNALS BY COMPANY")
    print("=" * 80)

    journals = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.journal', 'search_read',
        [[]],
        {'fields': ['id', 'code', 'name', 'company_id', 'type', 'suspense_account_id']}
    )

    lapa_journals = [j for j in journals if j.get('company_id') and j['company_id'][0] == lapa_id]

    print(f"\n{len(lapa_journals)} journals for LAPA:")
    for j in lapa_journals:
        suspense = j.get('suspense_account_id', False)
        suspense_str = f"{suspense[1]}" if suspense else "NOT SET"
        print(f"  {j['code']:10} - {j['name'][:40]:40} (Type: {j['type']:10}) Suspense: {suspense_str}")

    # Get bank accounts for LAPA
    print("\n" + "=" * 80)
    print("BANK ACCOUNTS FOR LAPA")
    print("=" * 80)

    bank_accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[
            ['company_id', '=', lapa_id],
            ['code', 'ilike', '10%'],
            ['code', '<=', '1099']
        ]],
        {'fields': ['id', 'code', 'name', 'company_id'], 'order': 'code'}
    )

    print(f"\n{len(bank_accounts)} bank accounts found:")
    for acc in bank_accounts:
        company_name = acc['company_id'][1] if acc.get('company_id') else 'N/A'
        print(f"  {acc['code']:10} - {acc['name'][:50]:50} ({company_name})")

    # Find 1021 account for LAPA
    print("\n" + "=" * 80)
    print("SUSPENSE ACCOUNT 1021")
    print("=" * 80)

    suspense_accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', '1021']]],
        {'fields': ['id', 'code', 'name', 'company_id']}
    )

    if suspense_accounts:
        for acc in suspense_accounts:
            company_name = acc['company_id'][1] if acc.get('company_id') else 'N/A'
            print(f"  ID {acc['id']:3}: {acc['code']} - {acc['name']} ({company_name})")

            if acc.get('company_id') and acc['company_id'][0] == lapa_id:
                print(f"\n  ✓ This account belongs to LAPA!")
                lapa_1021_id = acc['id']
    else:
        print("  No 1021 account found!")

    # SOLUTION: Find MISC journal for LAPA
    print("\n" + "=" * 80)
    print("SOLUTION")
    print("=" * 80)

    misc_lapa = [j for j in lapa_journals if j['code'] == 'MISC']

    if misc_lapa:
        print(f"\nMISC journal for LAPA found: ID {misc_lapa[0]['id']}")
        print(f"  Name: {misc_lapa[0]['name']}")
        print(f"  Current suspense: {misc_lapa[0].get('suspense_account_id', 'NOT SET')}")

        print(f"\nTo fix, set suspense account to: 1021 (ID {suspense_accounts[0]['id']})")
    else:
        print("\nNo MISC journal found for LAPA!")
        print("\nUse one of these bank journals instead:")

        bank_journals = [j for j in lapa_journals if j['type'] == 'bank']
        for j in bank_journals:
            print(f"  {j['code']:10} - {j['name']}")

if __name__ == "__main__":
    main()
