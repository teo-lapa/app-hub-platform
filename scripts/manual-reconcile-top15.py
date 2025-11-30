#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Manual Reconciliation Assistant for Top 15 Largest Payments

Interactive tool to help reconcile the 15 largest unreconciled payments
in Account 1022 (Outstanding Receipts)
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

# Top 15 largest payment line IDs (from analysis)
TOP_15_LINE_IDS = [
    526672,  # Ricorrente merenda69 - CHF 182,651.03
    88413,   # CASA COSI GMBH - CHF 37,606.31
    105090,  # HALTEN GASTRO GMBH - CHF 26,159.47
    157216,  # HALTEN GASTRO GMBH - CHF 24,807.77
    155563,  # CAMILLA AG - CHF 24,277.51
    167842,  # HALTEN GASTRO GMBH - CHF 18,337.43
    154982,  # CAMILLA AG OPFIKON - CHF 16,743.54
    166836,  # CUMANO SA - CHF 16,582.35
    61976,   # ADALBIRO SA - CHF 16,383.73
    61433,   # BMW Finanzdienstleistungen - CHF 15,000.00
    155016,  # TREBELLICO SA - CHF 14,724.18
    147253,  # CUMANO SA - CHF 12,967.02
    154974,  # AGINULFO SA - CHF 12,683.66
    154962,  # ADALBIRO SA - CHF 12,096.60
    154970,  # FILOMENO SA - CHF 11,906.44
]


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


class ReconciliationAssistant:
    def __init__(self, client):
        self.client = client
        self.reconciled_count = 0
        self.skipped_count = 0
        self.total_reconciled_amount = 0.0

    def get_payment_details(self, line_id):
        """Get full details of a payment line"""
        lines = self.client.search_read(
            'account.move.line',
            [('id', '=', line_id)],
            ['id', 'name', 'ref', 'date', 'partner_id', 'debit', 'credit',
             'account_id', 'move_id', 'move_name', 'reconciled']
        )
        return lines[0] if lines else None

    def find_matching_invoices(self, partner_id, amount, date, tolerance=0.05):
        """
        Find invoices that might match this payment

        Args:
            partner_id: Partner ID
            amount: Payment amount
            date: Payment date
            tolerance: Tolerance % for amount matching (default 5%)
        """
        if not partner_id:
            return []

        # Calculate amount range
        min_amount = amount * (1 - tolerance)
        max_amount = amount * (1 + tolerance)

        # Search for invoices
        invoices = self.client.search_read(
            'account.move',
            [
                ('partner_id', '=', partner_id),
                ('move_type', '=', 'out_invoice'),
                ('state', '=', 'posted'),
                ('payment_state', 'in', ['not_paid', 'partial']),
                ('amount_residual', '>=', min_amount),
                ('amount_residual', '<=', max_amount)
            ],
            ['id', 'name', 'invoice_date', 'amount_total', 'amount_residual',
             'payment_state', 'invoice_origin'],
            limit=10,
            order='invoice_date asc'
        )

        # Also search for exact amount matches (wider range)
        exact_matches = self.client.search_read(
            'account.move',
            [
                ('partner_id', '=', partner_id),
                ('move_type', '=', 'out_invoice'),
                ('state', '=', 'posted'),
                ('payment_state', 'in', ['not_paid', 'partial']),
                ('amount_residual', '>=', amount - 1),
                ('amount_residual', '<=', amount + 1)
            ],
            ['id', 'name', 'invoice_date', 'amount_total', 'amount_residual',
             'payment_state', 'invoice_origin'],
            limit=5,
            order='amount_residual asc'
        )

        # Combine and deduplicate
        all_invoices = invoices + exact_matches
        unique_invoices = {inv['id']: inv for inv in all_invoices}.values()

        return list(unique_invoices)

    def reconcile_payment_with_invoice(self, payment_line_id, invoice_id):
        """Execute reconciliation"""
        try:
            # Get invoice receivable line
            invoice_lines = self.client.search_read(
                'account.move.line',
                [
                    ('move_id', '=', invoice_id),
                    ('account_id.account_type', '=', 'asset_receivable'),
                    ('reconciled', '=', False)
                ],
                ['id', 'debit', 'credit', 'amount_residual']
            )

            if not invoice_lines:
                return False, "No unreconciled receivable line found"

            invoice_line_id = invoice_lines[0]['id']

            # Reconcile
            line_ids = [payment_line_id, invoice_line_id]
            self.client.execute('account.move.line', 'reconcile', [line_ids])

            return True, "Reconciliation successful"

        except Exception as e:
            return False, str(e)

    def process_payment_interactive(self, payment):
        """Process a single payment interactively"""
        print("\n" + "="*80)
        print(f"PAYMENT #{self.reconciled_count + self.skipped_count + 1}")
        print("="*80)

        # Display payment info
        partner_name = payment['partner_id'][1] if payment['partner_id'] else 'N/A'
        amount = max(payment['debit'], payment['credit'])
        amount_type = "DEBIT" if payment['debit'] > 0 else "CREDIT"

        print(f"ID:      {payment['id']}")
        print(f"Move:    {payment['move_name']}")
        print(f"Date:    {payment['date']}")
        print(f"Partner: {partner_name}")
        print(f"Amount:  CHF {amount:,.2f} ({amount_type})")
        print(f"Name:    {payment['name']}")

        # Special handling for "Ricorrente merenda69"
        if 'merenda69' in payment['name'].lower() or 'ricorrente' in payment['name'].lower():
            print("\n⚠️  WARNING: This is the CRITICAL movement 'Ricorrente merenda69'")
            print("   This requires special handling from accountant.")
            print("   Amount: CHF 182,651.03 (72% of total balance)")

            response = input("\nSkip this for now? (Y/n): ").strip().lower()
            if response != 'n':
                print("✓ Skipped - needs accountant review")
                self.skipped_count += 1
                return

        # Find matching invoices
        if payment['partner_id']:
            partner_id = payment['partner_id'][0]
            print("\n🔍 Searching for matching invoices...")

            invoices = self.find_matching_invoices(partner_id, amount, payment['date'])

            if not invoices:
                print("❌ No matching invoices found")
                response = input("\nSkip this payment? (Y/n): ").strip().lower()
                if response != 'n':
                    self.skipped_count += 1
                    return
            else:
                print(f"\n✓ Found {len(invoices)} possible matches:")
                print(f"\n{'#':<3} | {'Invoice':20} | {'Date':12} | {'Amount Total':>15} | {'Amount Due':>15} | Status")
                print("-" * 90)

                for i, inv in enumerate(invoices, 1):
                    print(f"{i:<3} | {inv['name']:20} | {inv['invoice_date']:12} | "
                          f"{inv['amount_total']:15,.2f} | {inv['amount_residual']:15,.2f} | "
                          f"{inv['payment_state']}")

                # User selection
                print("\nOptions:")
                print("  1-N: Select invoice to reconcile")
                print("  0: Skip this payment")
                print("  Q: Quit")

                choice = input("\nYour choice: ").strip().upper()

                if choice == 'Q':
                    return 'QUIT'
                elif choice == '0':
                    print("✓ Skipped")
                    self.skipped_count += 1
                    return
                else:
                    try:
                        idx = int(choice) - 1
                        if 0 <= idx < len(invoices):
                            selected_invoice = invoices[idx]

                            # Confirm
                            print(f"\nReconciling:")
                            print(f"  Payment: {payment['move_name']} - CHF {amount:,.2f}")
                            print(f"  Invoice: {selected_invoice['name']} - CHF {selected_invoice['amount_residual']:,.2f}")

                            confirm = input("\nConfirm reconciliation? (Y/n): ").strip().lower()
                            if confirm != 'n':
                                success, message = self.reconcile_payment_with_invoice(
                                    payment['id'],
                                    selected_invoice['id']
                                )

                                if success:
                                    print(f"✅ {message}")
                                    self.reconciled_count += 1
                                    self.total_reconciled_amount += amount
                                else:
                                    print(f"❌ Reconciliation failed: {message}")
                                    self.skipped_count += 1
                            else:
                                print("✓ Skipped")
                                self.skipped_count += 1
                        else:
                            print("Invalid choice - skipped")
                            self.skipped_count += 1
                    except ValueError:
                        print("Invalid input - skipped")
                        self.skipped_count += 1
        else:
            print("\n⚠️  No partner associated - cannot auto-find invoices")
            self.skipped_count += 1

    def run(self):
        """Main interactive reconciliation process"""
        print("="*80)
        print("TOP 15 PAYMENT RECONCILIATION ASSISTANT")
        print("="*80)
        print(f"Total payments to process: {len(TOP_15_LINE_IDS)}")
        print("\nThis tool will guide you through reconciling the 15 largest")
        print("unreconciled payments in Account 1022.")
        print("\nPress ENTER to start...")
        input()

        for line_id in TOP_15_LINE_IDS:
            payment = self.get_payment_details(line_id)

            if not payment:
                print(f"\n⚠️  Payment {line_id} not found - skipping")
                continue

            if payment['reconciled']:
                print(f"\n✓ Payment {payment['move_name']} already reconciled - skipping")
                continue

            result = self.process_payment_interactive(payment)

            if result == 'QUIT':
                print("\n⚠️  User requested quit")
                break

        # Summary
        print("\n" + "="*80)
        print("RECONCILIATION SUMMARY")
        print("="*80)
        print(f"Reconciled: {self.reconciled_count}")
        print(f"Skipped:    {self.skipped_count}")
        print(f"Total amount reconciled: CHF {self.total_reconciled_amount:,.2f}")


def main():
    print("Connecting to Odoo...")
    client = OdooClient(ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD)
    client.authenticate()
    print("✅ Connected\n")

    assistant = ReconciliationAssistant(client)
    assistant.run()

    print("\n✅ Process complete")
    return 0


if __name__ == "__main__":
    exit(main())
