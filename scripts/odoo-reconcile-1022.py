#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Odoo 17 - Riconciliazione Automatica Outstanding Receipts (Konto 1022)

OBIETTIVO: Riconciliare 204 righe non riconciliate portando saldo a CHF 0.00
URGENZA: CRITICA - Chiusura bilancio commercialista

Author: Odoo Integration Master
Date: 2025-11-15
"""

import xmlrpc.client
import ssl
from datetime import datetime, timedelta
from collections import defaultdict
import json
from typing import List, Dict, Any, Tuple
import pandas as pd
from decimal import Decimal
import sys
import io

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ========================================
# CONFIGURAZIONE ODOO
# ========================================

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Account 1022 - Outstanding Receipts
ACCOUNT_1022_CODE = "1022"


class OdooClient:
    """Client XML-RPC per Odoo 17"""

    def __init__(self, url: str, db: str, username: str, password: str):
        self.url = url
        self.db = db
        self.username = username
        self.password = password
        self.uid = None

        # Create SSL context that doesn't verify certificates (for dev)
        self.ssl_context = ssl._create_unverified_context()

        # Common and Object endpoints
        self.common = xmlrpc.client.ServerProxy(
            f'{url}/xmlrpc/2/common',
            context=self.ssl_context
        )
        self.models = xmlrpc.client.ServerProxy(
            f'{url}/xmlrpc/2/object',
            context=self.ssl_context
        )

    def authenticate(self) -> int:
        """Authenticate and get UID"""
        print(f"Connecting to Odoo: {self.url}")
        print(f"Database: {self.db}")
        print(f"User: {self.username}")

        self.uid = self.common.authenticate(
            self.db,
            self.username,
            self.password,
            {}
        )

        if not self.uid:
            raise Exception("Authentication failed!")

        print(f"✅ Authenticated successfully! UID: {self.uid}")
        return self.uid

    def execute(self, model: str, method: str, *args, **kwargs):
        """Execute Odoo method"""
        return self.models.execute_kw(
            self.db,
            self.uid,
            self.password,
            model,
            method,
            args,
            kwargs
        )

    def search_read(self, model: str, domain: List, fields: List[str],
                    limit: int = None, order: str = None):
        """Search and read records"""
        args = [domain]
        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit
        if order:
            kwargs['order'] = order

        return self.execute(model, 'search_read', *args, **kwargs)


class ReconciliationEngine:
    """Engine per riconciliazione automatica"""

    def __init__(self, client: OdooClient):
        self.client = client
        self.account_1022_id = None
        self.unreconciled_lines = []
        self.invoices = []
        self.reconciled = []
        self.failed = []
        self.partial_matches = []

    def get_account_1022(self) -> int:
        """Get Account 1022 ID"""
        print("\n📊 Searching for Account 1022 (Outstanding Receipts)...")

        accounts = self.client.search_read(
            'account.account',
            [('code', '=', ACCOUNT_1022_CODE)],
            ['id', 'name', 'code', 'account_type']
        )

        if not accounts:
            raise Exception(f"Account {ACCOUNT_1022_CODE} not found!")

        account = accounts[0]
        self.account_1022_id = account['id']

        print(f"✅ Found Account: {account['code']} - {account['name']}")
        print(f"   ID: {self.account_1022_id}")
        print(f"   Type: {account['account_type']}")

        return self.account_1022_id

    def get_unreconciled_lines(self) -> List[Dict]:
        """Get all unreconciled move lines for account 1022"""
        print(f"\n📥 Fetching unreconciled lines for account {ACCOUNT_1022_CODE}...")

        # Search for unreconciled move lines
        domain = [
            ('account_id', '=', self.account_1022_id),
            ('reconciled', '=', False),
            ('parent_state', '=', 'posted')  # Only posted entries
        ]

        fields = [
            'id', 'name', 'ref', 'date', 'partner_id',
            'debit', 'credit', 'amount_currency', 'currency_id',
            'move_id', 'move_name', 'reconciled', 'full_reconcile_id',
            'matched_debit_ids', 'matched_credit_ids'
        ]

        self.unreconciled_lines = self.client.search_read(
            'account.move.line',
            domain,
            fields,
            order='date asc'
        )

        total_debit = sum(line['debit'] for line in self.unreconciled_lines)
        total_credit = sum(line['credit'] for line in self.unreconciled_lines)
        balance = total_debit - total_credit

        print(f"✅ Found {len(self.unreconciled_lines)} unreconciled lines")
        print(f"   Total Debit:  CHF {total_debit:,.2f}")
        print(f"   Total Credit: CHF {total_credit:,.2f}")
        print(f"   Balance:      CHF {balance:,.2f}")

        return self.unreconciled_lines

    def get_open_invoices(self) -> List[Dict]:
        """Get all open customer invoices"""
        print("\n📄 Fetching open customer invoices...")

        domain = [
            ('move_type', '=', 'out_invoice'),
            ('state', '=', 'posted'),
            ('payment_state', 'in', ['not_paid', 'partial'])
        ]

        fields = [
            'id', 'name', 'invoice_date', 'partner_id',
            'amount_total', 'amount_residual', 'currency_id',
            'payment_state', 'ref', 'invoice_origin'
        ]

        self.invoices = self.client.search_read(
            'account.move',
            domain,
            fields,
            order='invoice_date asc'
        )

        print(f"✅ Found {len(self.invoices)} open invoices")
        print(f"   Total Outstanding: CHF {sum(inv['amount_residual'] for inv in self.invoices):,.2f}")

        return self.invoices

    def match_payment_to_invoice(self, payment_line: Dict) -> List[Dict]:
        """
        Match a payment line to corresponding invoice(s)

        Returns list of matched invoices with confidence score
        """
        matches = []

        partner_id = payment_line['partner_id'][0] if payment_line['partner_id'] else None
        amount = payment_line['credit'] if payment_line['credit'] > 0 else payment_line['debit']
        date = payment_line['date']

        if not partner_id or amount == 0:
            return matches

        # Filter invoices by customer
        customer_invoices = [
            inv for inv in self.invoices
            if inv['partner_id'] and inv['partner_id'][0] == partner_id
        ]

        if not customer_invoices:
            return matches

        # Strategy 1: Exact amount match
        for inv in customer_invoices:
            if abs(inv['amount_residual'] - amount) < 0.01:  # Tolerance 1 cent
                matches.append({
                    'invoice': inv,
                    'confidence': 100,
                    'method': 'exact_amount',
                    'amount_to_reconcile': amount
                })

        # Strategy 2: Partial payment (multiple invoices sum to payment)
        if not matches:
            # Try to find combination of invoices that sum to payment amount
            # (simplified version - check pairs)
            for i, inv1 in enumerate(customer_invoices):
                for inv2 in customer_invoices[i+1:]:
                    total = inv1['amount_residual'] + inv2['amount_residual']
                    if abs(total - amount) < 0.01:
                        matches.append({
                            'invoice': inv1,
                            'confidence': 80,
                            'method': 'multi_invoice',
                            'amount_to_reconcile': inv1['amount_residual'],
                            'related_invoices': [inv2]
                        })

        # Strategy 3: Partial payment on single invoice
        if not matches:
            for inv in customer_invoices:
                if amount < inv['amount_residual'] and amount > 0:
                    # Payment is less than invoice - partial payment
                    matches.append({
                        'invoice': inv,
                        'confidence': 60,
                        'method': 'partial_payment',
                        'amount_to_reconcile': amount
                    })

        # Sort by confidence
        matches.sort(key=lambda x: x['confidence'], reverse=True)

        return matches

    def reconcile_payment_with_invoice(self, payment_line: Dict, invoice: Dict,
                                       amount: float = None) -> bool:
        """
        Reconcile a payment line with an invoice

        Returns True if successful, False otherwise
        """
        try:
            # Get invoice move lines for receivable account
            invoice_lines = self.client.search_read(
                'account.move.line',
                [
                    ('move_id', '=', invoice['id']),
                    ('account_id.account_type', '=', 'asset_receivable'),
                    ('reconciled', '=', False)
                ],
                ['id', 'debit', 'credit', 'amount_residual']
            )

            if not invoice_lines:
                print(f"   ⚠️  No unreconciled receivable lines for invoice {invoice['name']}")
                return False

            invoice_line = invoice_lines[0]

            # Prepare lines to reconcile
            line_ids = [payment_line['id'], invoice_line['id']]

            # Execute reconciliation
            print(f"   🔄 Reconciling payment {payment_line['move_name']} with invoice {invoice['name']}")
            print(f"      Payment: CHF {payment_line['credit']:,.2f}")
            print(f"      Invoice: CHF {invoice_line['debit']:,.2f}")

            # Use account.move.line reconcile method
            result = self.client.execute(
                'account.move.line',
                'reconcile',
                [line_ids]
            )

            print(f"   ✅ Reconciliation successful!")

            self.reconciled.append({
                'payment_line_id': payment_line['id'],
                'payment_name': payment_line['move_name'],
                'payment_date': payment_line['date'],
                'invoice_id': invoice['id'],
                'invoice_name': invoice['name'],
                'invoice_date': invoice['invoice_date'],
                'partner_name': payment_line['partner_id'][1] if payment_line['partner_id'] else 'N/A',
                'amount': payment_line['credit'],
                'reconcile_result': result
            })

            return True

        except Exception as e:
            print(f"   ❌ Reconciliation failed: {str(e)}")

            self.failed.append({
                'payment_line_id': payment_line['id'],
                'payment_name': payment_line['move_name'],
                'payment_date': payment_line['date'],
                'invoice_name': invoice['name'],
                'partner_name': payment_line['partner_id'][1] if payment_line['partner_id'] else 'N/A',
                'amount': payment_line['credit'],
                'error': str(e)
            })

            return False

    def process_reconciliations(self):
        """Process all reconciliations"""
        print("\n" + "="*80)
        print("STARTING AUTOMATIC RECONCILIATION PROCESS")
        print("="*80)

        total = len(self.unreconciled_lines)
        processed = 0

        for idx, line in enumerate(self.unreconciled_lines, 1):
            print(f"\n[{idx}/{total}] Processing line {line['move_name']}")
            print(f"   Date: {line['date']}")
            print(f"   Partner: {line['partner_id'][1] if line['partner_id'] else 'N/A'}")
            print(f"   Amount: CHF {line['credit']:,.2f}")

            # Find matching invoices
            matches = self.match_payment_to_invoice(line)

            if not matches:
                print(f"   ⚠️  No matching invoice found")
                self.failed.append({
                    'payment_line_id': line['id'],
                    'payment_name': line['move_name'],
                    'payment_date': line['date'],
                    'partner_name': line['partner_id'][1] if line['partner_id'] else 'N/A',
                    'amount': line['credit'],
                    'error': 'No matching invoice found'
                })
                continue

            # Try best match
            best_match = matches[0]
            print(f"   ✓ Match found: {best_match['invoice']['name']}")
            print(f"     Confidence: {best_match['confidence']}%")
            print(f"     Method: {best_match['method']}")

            if best_match['confidence'] >= 80:
                # Auto-reconcile high confidence matches
                success = self.reconcile_payment_with_invoice(
                    line,
                    best_match['invoice'],
                    best_match['amount_to_reconcile']
                )
                if success:
                    processed += 1
            else:
                # Store for manual review
                print(f"   ⚠️  Confidence too low - needs manual review")
                self.partial_matches.append({
                    'payment': line,
                    'matches': matches
                })

        print("\n" + "="*80)
        print("RECONCILIATION PROCESS COMPLETED")
        print("="*80)
        print(f"✅ Successfully reconciled: {len(self.reconciled)}")
        print(f"❌ Failed reconciliations: {len(self.failed)}")
        print(f"⚠️  Needs manual review: {len(self.partial_matches)}")

    def generate_excel_report(self, filename: str):
        """Generate Excel report with reconciliation results"""
        print(f"\n📊 Generating Excel report: {filename}")

        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            # Sheet 1: Reconciled
            if self.reconciled:
                df_reconciled = pd.DataFrame(self.reconciled)
                df_reconciled.to_excel(writer, sheet_name='Reconciled', index=False)
                print(f"   ✓ Sheet 'Reconciled': {len(self.reconciled)} rows")

            # Sheet 2: Failed
            if self.failed:
                df_failed = pd.DataFrame(self.failed)
                df_failed.to_excel(writer, sheet_name='Failed', index=False)
                print(f"   ✓ Sheet 'Failed': {len(self.failed)} rows")

            # Sheet 3: Manual Review
            if self.partial_matches:
                manual_review = []
                for pm in self.partial_matches:
                    payment = pm['payment']
                    for match in pm['matches']:
                        manual_review.append({
                            'payment_name': payment['move_name'],
                            'payment_date': payment['date'],
                            'partner': payment['partner_id'][1] if payment['partner_id'] else 'N/A',
                            'payment_amount': payment['credit'],
                            'invoice_name': match['invoice']['name'],
                            'invoice_date': match['invoice']['invoice_date'],
                            'invoice_amount': match['invoice']['amount_residual'],
                            'confidence': match['confidence'],
                            'method': match['method']
                        })

                df_manual = pd.DataFrame(manual_review)
                df_manual.to_excel(writer, sheet_name='Manual Review', index=False)
                print(f"   ✓ Sheet 'Manual Review': {len(manual_review)} rows")

            # Sheet 4: Summary
            summary_data = {
                'Metric': [
                    'Total Unreconciled Lines',
                    'Successfully Reconciled',
                    'Failed Reconciliations',
                    'Needs Manual Review',
                    'Initial Balance CHF',
                    'Reconciled Amount CHF',
                    'Remaining Balance CHF'
                ],
                'Value': [
                    len(self.unreconciled_lines),
                    len(self.reconciled),
                    len(self.failed),
                    len(self.partial_matches),
                    sum(line['credit'] for line in self.unreconciled_lines),
                    sum(r['amount'] for r in self.reconciled),
                    sum(line['credit'] for line in self.unreconciled_lines) - sum(r['amount'] for r in self.reconciled)
                ]
            }

            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name='Summary', index=False)
            print(f"   ✓ Sheet 'Summary': Complete")

        print(f"✅ Report generated successfully!")

    def verify_final_balance(self):
        """Verify final balance of account 1022"""
        print("\n" + "="*80)
        print("VERIFYING FINAL BALANCE")
        print("="*80)

        # Re-fetch unreconciled lines
        domain = [
            ('account_id', '=', self.account_1022_id),
            ('reconciled', '=', False),
            ('parent_state', '=', 'posted')
        ]

        remaining_lines = self.client.search_read(
            'account.move.line',
            domain,
            ['id', 'debit', 'credit']
        )

        total_debit = sum(line['debit'] for line in remaining_lines)
        total_credit = sum(line['credit'] for line in remaining_lines)
        balance = total_debit - total_credit

        print(f"Remaining unreconciled lines: {len(remaining_lines)}")
        print(f"Final Balance: CHF {balance:,.2f}")

        if abs(balance) < 0.01:
            print("✅ SUCCESS! Account 1022 is fully reconciled!")
        else:
            print(f"⚠️  WARNING: Account 1022 still has balance of CHF {balance:,.2f}")
            print(f"   {len(remaining_lines)} lines need manual attention")


def main():
    """Main execution function"""
    print("="*80)
    print("ODOO 17 - OUTSTANDING RECEIPTS RECONCILIATION (KONTO 1022)")
    print("="*80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        # Step 1: Connect to Odoo
        client = OdooClient(ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD)
        client.authenticate()

        # Step 2: Initialize reconciliation engine
        engine = ReconciliationEngine(client)

        # Step 3: Get account 1022
        engine.get_account_1022()

        # Step 4: Get unreconciled lines
        engine.get_unreconciled_lines()

        # Step 5: Get open invoices
        engine.get_open_invoices()

        # Step 6: Process reconciliations
        engine.process_reconciliations()

        # Step 7: Generate report
        report_filename = f"C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\reconciliation-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xlsx"
        engine.generate_excel_report(report_filename)

        # Step 8: Verify final balance
        engine.verify_final_balance()

        print("\n" + "="*80)
        print("RECONCILIATION PROCESS COMPLETED SUCCESSFULLY!")
        print("="*80)
        print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"\nReport saved to: {report_filename}")

    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
