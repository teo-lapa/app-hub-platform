#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Find Large Unreconciled Movements in Account 1022
"""

import xmlrpc.client
import ssl
from datetime import datetime
import sys
import io

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"
ACCOUNT_1022_CODE = "1022"


class OdooClient:
    def __init__(self, url, db, username, password):
        self.url = url
        self.db = db
        self.username = username
        self.password = password
        self.uid = None
        self.ssl_context = ssl._create_unverified_context()
        self.common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common', context=self.ssl_context)
        self.models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object', context=self.ssl_context)

    def authenticate(self):
        self.uid = self.common.authenticate(self.db, self.username, self.password, {})
        return self.uid

    def execute(self, model, method, *args, **kwargs):
        return self.models.execute_kw(self.db, self.uid, self.password, model, method, args, kwargs)

    def search_read(self, model, domain, fields, limit=None, order=None):
        args = [domain]
        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit
        if order:
            kwargs['order'] = order
        return self.execute(model, 'search_read', *args, **kwargs)


def main():
    print("="*80)
    print("FIND LARGE UNRECONCILED MOVEMENTS - ACCOUNT 1022")
    print("="*80)

    client = OdooClient(ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD)
    client.authenticate()
    print("✅ Connected\n")

    # Get account
    accounts = client.search_read('account.account', [('code', '=', ACCOUNT_1022_CODE)], ['id', 'name'])
    account_1022_id = accounts[0]['id']
    print(f"Account: {accounts[0]['name']}\n")

    # Get ALL unreconciled lines (not just amount=0)
    print("📥 Fetching all unreconciled lines...")

    lines = client.search_read(
        'account.move.line',
        [
            ('account_id', '=', account_1022_id),
            ('reconciled', '=', False),
            ('parent_state', '=', 'posted')
        ],
        ['id', 'name', 'ref', 'date', 'partner_id', 'debit', 'credit', 'move_name'],
        order='credit desc, debit desc'  # Sort by largest amounts
    )

    print(f"✅ Found {len(lines)} lines\n")

    # Separate by amount
    zero_lines = []
    small_lines = []  # < 1000
    medium_lines = []  # 1000 - 10000
    large_lines = []  # > 10000

    for line in lines:
        amount = max(line['debit'], line['credit'])

        if amount == 0:
            zero_lines.append(line)
        elif amount < 1000:
            small_lines.append(line)
        elif amount < 10000:
            medium_lines.append(line)
        else:
            large_lines.append(line)

    print("="*80)
    print("DISTRIBUTION BY AMOUNT")
    print("="*80)
    print(f"Zero amount (0):           {len(zero_lines):3d} lines")
    print(f"Small (< CHF 1,000):       {len(small_lines):3d} lines")
    print(f"Medium (CHF 1,000-10,000): {len(medium_lines):3d} lines")
    print(f"Large (> CHF 10,000):      {len(large_lines):3d} lines")

    # Show largest movements
    print("\n" + "="*80)
    print("TOP 20 LARGEST MOVEMENTS")
    print("="*80)
    print(f"{'ID':>6} | {'Move Name':20} | {'Date':12} | {'Debit':>15} | {'Credit':>15} | Partner")
    print("-" * 110)

    sorted_lines = sorted(lines, key=lambda x: max(x['debit'], x['credit']), reverse=True)

    for line in sorted_lines[:20]:
        partner = line['partner_id'][1] if line['partner_id'] else 'N/A'
        print(f"{line['id']:6d} | {line['move_name']:20s} | {line['date']:12} | {line['debit']:15,.2f} | {line['credit']:15,.2f} | {partner}")

    # Calculate totals
    total_debit = sum(l['debit'] for l in lines)
    total_credit = sum(l['credit'] for l in lines)
    balance = total_debit - total_credit

    print("-" * 110)
    print(f"{'TOTALS':>39} | {total_debit:15,.2f} | {total_credit:15,.2f}")
    print(f"\nBalance: CHF {balance:,.2f}")

    # Show non-zero lines details
    print("\n" + "="*80)
    print("ALL NON-ZERO LINES (Detailed)")
    print("="*80)

    non_zero = small_lines + medium_lines + large_lines

    for line in non_zero:
        partner = line['partner_id'][1] if line['partner_id'] else 'N/A'
        amount = max(line['debit'], line['credit'])
        direction = "DEBIT" if line['debit'] > 0 else "CREDIT"

        print(f"\nID: {line['id']}")
        print(f"  Move: {line['move_name']}")
        print(f"  Date: {line['date']}")
        print(f"  Amount: CHF {amount:,.2f} ({direction})")
        print(f"  Partner: {partner}")
        print(f"  Name: {line['name']}")

    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total lines: {len(lines)}")
    print(f"Non-zero lines: {len(non_zero)}")
    print(f"Zero lines: {len(zero_lines)}")
    print(f"\nBalance to reconcile: CHF {balance:,.2f}")

    return 0


if __name__ == "__main__":
    exit(main())
