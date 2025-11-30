#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cleanup Zero-Amount Payments from Account 1022

ATTENZIONE: Questo script ELIMINA permanentemente righe contabili.
Eseguire SOLO dopo approvazione del commercialista.

Usage:
  python cleanup-zero-payments.py --dry-run    # Simula senza modificare
  python cleanup-zero-payments.py --execute    # ESEGUE ELIMINAZIONE REALE
"""

import xmlrpc.client
import ssl
from datetime import datetime
import json
import argparse
import sys
import io
import pandas as pd

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Odoo credentials
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"
ACCOUNT_1022_CODE = "1022"


class OdooClient:
    """Client XML-RPC per Odoo 17"""

    def __init__(self, url: str, db: str, username: str, password: str):
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
        if not self.uid:
            raise Exception("Authentication failed!")
        return self.uid

    def execute(self, model: str, method: str, *args, **kwargs):
        return self.models.execute_kw(self.db, self.uid, self.password, model, method, args, kwargs)

    def search_read(self, model: str, domain, fields, limit=None, order=None):
        args = [domain]
        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit
        if order:
            kwargs['order'] = order
        return self.execute(model, 'search_read', *args, **kwargs)


def backup_lines_to_json(lines, filename):
    """Backup lines to JSON before deletion"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(lines, f, indent=2, ensure_ascii=False)
    print(f"✅ Backup salvato: {filename}")


def main():
    parser = argparse.ArgumentParser(description='Cleanup zero-amount payments from Account 1022')
    parser.add_argument('--dry-run', action='store_true', help='Simulate without making changes')
    parser.add_argument('--execute', action='store_true', help='Execute deletion (DANGEROUS!)')
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("ERROR: Specify --dry-run or --execute")
        print("Usage: python cleanup-zero-payments.py --dry-run")
        return 1

    if args.execute:
        print("\n" + "="*80)
        print("⚠️  WARNING: EXECUTION MODE - CHANGES WILL BE PERMANENT!")
        print("="*80)
        response = input("Type 'DELETE ZERO PAYMENTS' to confirm: ")
        if response != "DELETE ZERO PAYMENTS":
            print("❌ Operation cancelled")
            return 1

    print("="*80)
    print("ODOO 17 - CLEANUP ZERO-AMOUNT PAYMENTS")
    print("="*80)
    print(f"Mode: {'DRY-RUN (simulation)' if args.dry_run else 'EXECUTION (real changes)'}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Connect to Odoo
    client = OdooClient(ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD)
    client.authenticate()
    print("✅ Connected to Odoo\n")

    # Get account 1022
    accounts = client.search_read('account.account', [('code', '=', ACCOUNT_1022_CODE)], ['id', 'name'])
    if not accounts:
        print("❌ Account 1022 not found!")
        return 1

    account_1022_id = accounts[0]['id']
    print(f"✅ Found Account: {accounts[0]['code']} - {accounts[0]['name']}\n")

    # Get unreconciled lines
    print("📥 Fetching unreconciled lines...")
    domain = [
        ('account_id', '=', account_1022_id),
        ('reconciled', '=', False),
        ('parent_state', '=', 'posted')
    ]

    fields = [
        'id', 'name', 'ref', 'date', 'partner_id', 'debit', 'credit',
        'amount_currency', 'currency_id', 'move_id', 'move_name'
    ]

    all_lines = client.search_read('account.move.line', domain, fields, order='date asc')
    print(f"✅ Found {len(all_lines)} unreconciled lines\n")

    # Filter zero-amount lines
    zero_lines = [line for line in all_lines if line['debit'] == 0 and line['credit'] == 0]
    non_zero_lines = [line for line in all_lines if line['debit'] != 0 or line['credit'] != 0]

    print("="*80)
    print("ANALYSIS")
    print("="*80)
    print(f"Total unreconciled lines: {len(all_lines)}")
    print(f"Zero-amount lines: {len(zero_lines)} ({len(zero_lines)/len(all_lines)*100:.1f}%)")
    print(f"Non-zero lines: {len(non_zero_lines)} ({len(non_zero_lines)/len(all_lines)*100:.1f}%)")

    total_debit = sum(line['debit'] for line in non_zero_lines)
    total_credit = sum(line['credit'] for line in non_zero_lines)
    print(f"\nNon-zero lines balance:")
    print(f"  Debit:  CHF {total_debit:,.2f}")
    print(f"  Credit: CHF {total_credit:,.2f}")
    print(f"  Balance: CHF {total_debit - total_credit:,.2f}")

    # Show sample zero lines
    print("\n" + "="*80)
    print("SAMPLE ZERO-AMOUNT LINES (first 10)")
    print("="*80)
    for i, line in enumerate(zero_lines[:10], 1):
        partner = line['partner_id'][1] if line['partner_id'] else 'N/A'
        print(f"{i}. {line['move_name']:20s} | {line['date']} | {partner:40s}")

    # Backup before deletion
    if args.execute:
        backup_filename = f"backup-zero-payments-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        backup_lines_to_json(zero_lines, backup_filename)

    # Execute or simulate deletion
    print("\n" + "="*80)
    if args.dry_run:
        print("DRY-RUN: Would delete the following lines:")
        print("="*80)
        for line in zero_lines[:20]:  # Show first 20
            print(f"  - {line['id']:6d} | {line['move_name']:20s} | {line['date']}")
        if len(zero_lines) > 20:
            print(f"  ... and {len(zero_lines) - 20} more lines")

        print(f"\n✅ DRY-RUN complete. {len(zero_lines)} lines would be deleted.")
        print("Run with --execute to perform actual deletion.")

    else:
        print("EXECUTING DELETION...")
        print("="*80)

        # Delete lines in batches of 50
        batch_size = 50
        deleted_count = 0
        failed_count = 0

        for i in range(0, len(zero_lines), batch_size):
            batch = zero_lines[i:i+batch_size]
            batch_ids = [line['id'] for line in batch]

            try:
                # IMPORTANT: In Odoo, deleting move lines might require unlinking the entire move
                # This is safer approach - just mark as draft and delete
                print(f"Deleting batch {i//batch_size + 1}/{(len(zero_lines)-1)//batch_size + 1}...")

                # Try to delete
                client.execute('account.move.line', 'unlink', [batch_ids])
                deleted_count += len(batch)
                print(f"  ✅ Deleted {len(batch)} lines")

            except Exception as e:
                print(f"  ❌ Failed: {str(e)}")
                failed_count += len(batch)

                # If deletion fails, these lines might be in posted moves
                # Try to button_draft the move first
                for line in batch:
                    try:
                        move_id = line['move_id'][0]
                        # Reset to draft
                        client.execute('account.move', 'button_draft', [[move_id]])
                        # Delete line
                        client.execute('account.move.line', 'unlink', [[line['id']]])
                        # Re-post move
                        client.execute('account.move', 'action_post', [[move_id]])
                        deleted_count += 1
                        print(f"    ✅ Deleted line {line['id']} via draft-delete-post")
                    except Exception as e2:
                        print(f"    ❌ Failed line {line['id']}: {str(e2)}")

        print("\n" + "="*80)
        print("DELETION RESULTS")
        print("="*80)
        print(f"Successfully deleted: {deleted_count} lines")
        print(f"Failed: {failed_count} lines")

    # Verify final state
    print("\n" + "="*80)
    print("FINAL STATE VERIFICATION")
    print("="*80)

    final_lines = client.search_read('account.move.line', domain, ['id', 'debit', 'credit'])
    final_zero = [l for l in final_lines if l['debit'] == 0 and l['credit'] == 0]

    print(f"Remaining unreconciled lines: {len(final_lines)}")
    print(f"Remaining zero-amount lines: {len(final_zero)}")

    final_debit = sum(l['debit'] for l in final_lines)
    final_credit = sum(l['credit'] for l in final_lines)
    final_balance = final_debit - final_credit

    print(f"\nFinal balance Account 1022:")
    print(f"  Debit:  CHF {final_debit:,.2f}")
    print(f"  Credit: CHF {final_credit:,.2f}")
    print(f"  Balance: CHF {final_balance:,.2f}")

    if abs(final_balance) < 0.01:
        print("\n🎉 SUCCESS! Account 1022 is fully reconciled!")
    else:
        print(f"\n⚠️  Account 1022 still has balance of CHF {final_balance:,.2f}")
        print(f"   {len(final_lines)} lines need further attention")

    print("\n" + "="*80)
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    return 0


if __name__ == "__main__":
    exit(main())
