#!/usr/bin/env python3
"""
COMPLETE BANK STATEMENT IMPORT SCRIPT - 2024

Imports ALL missing UBS bank statements (CHF + EUR) into Odoo
Resolves CHF 343K discrepancy caused by missing transactions from June onwards

STRATEGY:
1. Parse all 6 CSV files (4 CHF + 2 EUR)
2. Deduplicate against existing Odoo transactions
3. Batch import with error handling
4. Validate balances
5. Generate comprehensive report

EXECUTION:
python scripts/import-bank-statements-2024.py
"""

import xmlrpc.client
import csv
import os
import sys
from datetime import datetime
from decimal import Decimal
import json
from typing import List, Dict, Any, Optional, Tuple

# Configuration
CONFIG = {
    'odoo': {
        'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
        'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
        'username': 'paul@lapa.ch',
        'password': 'lapa201180'
    },
    'base_dir': r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024',
    'journals': {
        'UBS CHF': {'code': 'BNK1', 'id': 9, 'currency': 'CHF'},
        'UBS EUR': {'code': 'BNK2', 'id': 11, 'currency': 'EUR'}
    },
    'skip_if_exists': True,
    'dry_run': False  # REAL IMPORT MODE
}

class OdooConnection:
    """Handles Odoo XML-RPC connection"""

    def __init__(self, config):
        self.url = config['url']
        self.db = config['db']
        self.username = config['username']
        self.password = config['password']
        self.uid = None
        self.models = None

    def connect(self):
        """Authenticate with Odoo"""
        print("Connecting to Odoo...")
        common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
        self.uid = common.authenticate(self.db, self.username, self.password, {})

        if not self.uid:
            raise Exception("Authentication failed!")

        self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")
        print(f"[OK] Connected as {self.username} (UID: {self.uid})")

    def search_read(self, model, domain, fields=None, limit=None, offset=None, order=None):
        """Search and read records"""
        kw = {}
        if fields:
            kw['fields'] = fields
        if limit:
            kw['limit'] = limit
        if offset:
            kw['offset'] = offset
        if order:
            kw['order'] = order

        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain], kw
        )

    def create(self, model, values):
        """Create a record"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'create',
            [values]
        )

    def write(self, model, ids, values):
        """Update records"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'write',
            [ids, values]
        )

class UBSCSVParser:
    """Parses UBS Switzerland CSV bank statements"""

    @staticmethod
    def parse_ubs_date(date_str: str) -> Optional[str]:
        """Convert DD/MM/YYYY to YYYY-MM-DD"""
        if not date_str or date_str.strip() == '':
            return None

        try:
            day, month, year = date_str.split('/')
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        except:
            return None

    @staticmethod
    def parse_ubs_number(num_str: str) -> Decimal:
        """Parse UBS number format: 123'456.78"""
        if not num_str or num_str.strip() == '':
            return Decimal('0')

        cleaned = num_str.replace("'", "").replace(" ", "")
        try:
            return Decimal(cleaned)
        except:
            return Decimal('0')

    @staticmethod
    def extract_partner(desc1: str) -> str:
        """Extract partner name from description"""
        if not desc1:
            return ''

        # Clean common prefixes
        cleaned = desc1.replace('e-banking-Vergütungsauftrag', '').replace('e-banking-Sammelauftrag', '').strip()

        # Extract name before semicolon/comma
        if ';' in cleaned:
            return cleaned.split(';')[0].strip()
        if ',' in cleaned:
            return cleaned.split(',')[0].strip()

        return cleaned[:100]  # Limit length

    @classmethod
    def parse_file(cls, file_path: str) -> Dict[str, Any]:
        """Parse UBS CSV file"""
        print(f"\nParsing: {os.path.basename(file_path)}")

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()

        # Parse header
        account_info = {
            'account_number': lines[0].split(';')[1].strip(),
            'iban': lines[1].split(';')[1].strip(),
            'date_from': lines[2].split(';')[1].strip(),
            'date_to': lines[3].split(';')[1].strip(),
            'opening_balance': cls.parse_ubs_number(lines[4].split(';')[1]),
            'closing_balance': cls.parse_ubs_number(lines[5].split(';')[1]),
            'currency': lines[6].split(';')[1].strip(),
            'transaction_count': int(lines[7].split(';')[1].strip()) if lines[7].split(';')[1].strip().isdigit() else 0
        }

        # Parse transactions (start at line 11 - index 10)
        transactions = []
        current_tx = None

        for line in lines[10:]:
            if not line.strip():
                continue

            fields = line.split(';')
            if len(fields) < 10:
                continue

            # Check if main transaction line (has settlement or booking date)
            has_settlement = fields[0] and fields[0].strip() != ''
            has_booking = fields[2] and fields[2].strip() != ''

            if has_settlement or has_booking:
                # Save previous transaction
                if current_tx and current_tx.get('transaction_number'):
                    transactions.append(current_tx)

                # Parse new transaction
                debit = cls.parse_ubs_number(fields[5]) if len(fields) > 5 else Decimal('0')
                credit = cls.parse_ubs_number(fields[6]) if len(fields) > 6 else Decimal('0')
                amount = credit if credit != 0 else debit  # Debit is already negative

                current_tx = {
                    'settlement_date': cls.parse_ubs_date(fields[0]),
                    'booking_date': cls.parse_ubs_date(fields[2]) if len(fields) > 2 else None,
                    'value_date': cls.parse_ubs_date(fields[3]) if len(fields) > 3 else None,
                    'currency': fields[4].strip() if len(fields) > 4 else account_info['currency'],
                    'amount': float(amount),
                    'balance': float(cls.parse_ubs_number(fields[8])) if len(fields) > 8 else 0,
                    'transaction_number': fields[9].strip() if len(fields) > 9 else '',
                    'description1': fields[10].strip() if len(fields) > 10 else '',
                    'description2': fields[11].strip() if len(fields) > 11 else '',
                    'description3': fields[12].strip() if len(fields) > 12 else '',
                    'partner': cls.extract_partner(fields[10]) if len(fields) > 10 else ''
                }

        # Save last transaction
        if current_tx and current_tx.get('transaction_number'):
            transactions.append(current_tx)

        print(f"  Account: {account_info['iban']}")
        print(f"  Period: {account_info['date_from']} to {account_info['date_to']}")
        print(f"  Opening: {account_info['opening_balance']} {account_info['currency']}")
        print(f"  Closing: {account_info['closing_balance']} {account_info['currency']}")
        print(f"  Transactions: {len(transactions)} (Header says: {account_info['transaction_count']})")

        return {
            'account_info': account_info,
            'transactions': transactions,
            'file_name': os.path.basename(file_path)
        }

class BankStatementImporter:
    """Handles import into Odoo"""

    def __init__(self, odoo: OdooConnection, config: Dict):
        self.odoo = odoo
        self.config = config
        self.stats = {
            'files_processed': 0,
            'files_success': 0,
            'files_failed': 0,
            'transactions_imported': 0,
            'transactions_skipped': 0,
            'errors': []
        }

    def import_statement(self, statement_data: Dict, journal_info: Dict) -> bool:
        """Import one bank statement"""
        file_name = statement_data['file_name']
        account_info = statement_data['account_info']
        transactions = statement_data['transactions']

        self.stats['files_processed'] += 1

        try:
            # Generate statement name
            statement_name = f"UBS {account_info['currency']} {account_info['date_from']} - {account_info['date_to']}"

            print(f"\nImporting: {statement_name}")

            # Check if already exists
            existing = self.odoo.search_read(
                'account.bank.statement',
                [['journal_id', '=', journal_info['id']], ['name', '=', statement_name]],
                fields=['id', 'name'],
                limit=1
            )

            if existing:
                if self.config['skip_if_exists']:
                    print(f"  [SKIP] Statement already exists (ID: {existing[0]['id']})")
                    self.stats['files_success'] += 1
                    self.stats['transactions_skipped'] += len(transactions)
                    return True
                else:
                    print(f"  [ERROR] Statement already exists (ID: {existing[0]['id']})")
                    self.stats['errors'].append(f"{file_name}: Already exists")
                    self.stats['files_failed'] += 1
                    return False

            if self.config['dry_run']:
                print(f"  [DRY RUN] Would create statement with {len(transactions)} transactions")
                self.stats['files_success'] += 1
                return True

            # Create statement
            print(f"  Creating statement...")
            statement_id = self.odoo.create(
                'account.bank.statement',
                {
                    'name': statement_name,
                    'journal_id': journal_info['id'],
                    'date': self.parse_date(account_info['date_to']),
                    'balance_start': float(account_info['opening_balance']),
                    'balance_end_real': float(account_info['closing_balance'])
                }
            )

            print(f"  [OK] Statement created (ID: {statement_id})")

            # Create lines
            print(f"  Creating {len(transactions)} transaction lines...")
            lines_created = 0

            for i, tx in enumerate(transactions):
                try:
                    # Find or create partner
                    partner_id = None
                    if tx['partner']:
                        partner_id = self.find_or_create_partner(tx['partner'])

                    # Build payment reference
                    payment_ref = tx['description1']
                    if tx['description2']:
                        payment_ref += f" - {tx['description2']}"
                    payment_ref = payment_ref[:200]  # Odoo field limit

                    # Determine date (prefer value_date, fallback to booking_date)
                    date = tx['value_date'] or tx['booking_date'] or self.parse_date(account_info['date_to'])

                    line_data = {
                        'statement_id': statement_id,
                        'date': date,
                        'payment_ref': payment_ref,
                        'amount': tx['amount'],
                        'sequence': i + 1
                    }

                    if partner_id:
                        line_data['partner_id'] = partner_id

                    line_id = self.odoo.create(
                        'account.bank.statement.line',
                        line_data
                    )

                    lines_created += 1

                    if (i + 1) % 100 == 0:
                        print(f"    {i + 1}/{len(transactions)} lines created...")

                except Exception as e:
                    print(f"    [WARNING] Failed to create line {i+1}: {e}")

            print(f"  [OK] {lines_created}/{len(transactions)} lines created")

            # Validate balance
            computed_balance = float(account_info['opening_balance']) + sum(tx['amount'] for tx in transactions)
            expected_balance = float(account_info['closing_balance'])
            balance_diff = computed_balance - expected_balance

            if abs(balance_diff) < 0.01:
                print(f"  [OK] Balance matches: {expected_balance}")
            else:
                print(f"  [WARNING] Balance mismatch:")
                print(f"    Expected: {expected_balance}")
                print(f"    Computed: {computed_balance}")
                print(f"    Difference: {balance_diff}")

            self.stats['files_success'] += 1
            self.stats['transactions_imported'] += lines_created

            return True

        except Exception as e:
            print(f"  [ERROR] Import failed: {e}")
            self.stats['errors'].append(f"{file_name}: {str(e)}")
            self.stats['files_failed'] += 1
            import traceback
            traceback.print_exc()
            return False

    def find_or_create_partner(self, name: str) -> int:
        """Find or create partner by name"""
        # Search existing
        partners = self.odoo.search_read(
            'res.partner',
            [['name', 'ilike', name]],
            fields=['id'],
            limit=1
        )

        if partners:
            return partners[0]['id']

        # Create new
        return self.odoo.create(
            'res.partner',
            {'name': name[:100], 'is_company': True}
        )

    @staticmethod
    def parse_date(date_str: str) -> str:
        """Convert DD/MM/YYYY to YYYY-MM-DD"""
        try:
            day, month, year = date_str.split('/')
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        except:
            return datetime.now().strftime('%Y-%m-%d')

    def generate_report(self) -> str:
        """Generate import report"""
        lines = []
        lines.append("=" * 80)
        lines.append("BANK STATEMENT IMPORT REPORT - 2024")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"Files processed:      {self.stats['files_processed']}")
        lines.append(f"Successful imports:   {self.stats['files_success']}")
        lines.append(f"Failed imports:       {self.stats['files_failed']}")
        lines.append(f"Transactions added:   {self.stats['transactions_imported']:,}")
        lines.append(f"Transactions skipped: {self.stats['transactions_skipped']:,}")
        lines.append("")

        if self.stats['errors']:
            lines.append("ERRORS:")
            for error in self.stats['errors']:
                lines.append(f"  - {error}")
            lines.append("")

        lines.append("=" * 80)

        return "\n".join(lines)

def main():
    print("\n" + "=" * 80)
    print("BANK STATEMENT IMPORT - CHIUSURA 2024")
    print("Resolving CHF 343K discrepancy from missing statements")
    print("=" * 80 + "\n")

    try:
        # Connect to Odoo
        odoo = OdooConnection(CONFIG['odoo'])
        odoo.connect()
        print("")

        # Initialize importer
        importer = BankStatementImporter(odoo, CONFIG)

        # Process each journal
        for journal_name, journal_info in CONFIG['journals'].items():
            print("\n" + "=" * 80)
            print(f"Processing {journal_name} (Journal: {journal_info['code']}, Currency: {journal_info['currency']})")
            print("=" * 80)

            # Find CSV files
            journal_dir = os.path.join(CONFIG['base_dir'], journal_name)

            if not os.path.exists(journal_dir):
                print(f"[WARNING] Directory not found: {journal_dir}")
                continue

            csv_files = sorted([
                f for f in os.listdir(journal_dir)
                if f.endswith('.csv')
            ])

            print(f"Found {len(csv_files)} CSV files")

            # Parse and import each file
            for csv_file in csv_files:
                file_path = os.path.join(journal_dir, csv_file)

                # Parse CSV
                statement_data = UBSCSVParser.parse_file(file_path)

                # Import to Odoo
                importer.import_statement(statement_data, journal_info)

        # Generate report
        print("\n\n" + "=" * 80)
        print("IMPORT COMPLETED")
        print("=" * 80 + "\n")

        report = importer.generate_report()
        print(report)

        # Save report
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = f"bank-import-report-{timestamp}.txt"

        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)

        print(f"\n[OK] Report saved to: {report_file}\n")

        # Check success
        if importer.stats['files_failed'] > 0:
            print("[WARNING] Some imports failed. Please review errors above.")
            sys.exit(1)
        else:
            print("[OK] All imports completed successfully!")
            sys.exit(0)

    except Exception as e:
        print(f"\n[ERROR] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
