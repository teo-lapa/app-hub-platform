#!/usr/bin/env python3
r"""
UBS CHF Transactions Import Script
===================================

Importa le 3,290 transazioni mancanti dal conto UBS CHF (Konto 1024) in Odoo.

OBIETTIVO:
- Saldo DOCUMENTO finale: CHF 182,573.56
- Saldo ODOO attuale: CHF 67,550.94
- Discrepanza: CHF -115,062.32 (MANCANTE)

STRATEGIA:
1. Estrai transazioni complete dai CSV UBS CHF
2. Verifica stato attuale Odoo (konto 1024)
3. Identifica transazioni già presenti (dedup)
4. Import mensile con validazione saldi progressivi
5. Verifica finale delta < 0.01 CHF

EXECUTION:
python scripts/import-ubs-chf-transactions.py

REQUIREMENTS:
- File CSV in: C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS\UBS CHF\
- Odoo staging environment con credenziali configurate
- Suspense account configurato (esegui FIX-SUSPENSE-ACCOUNT.py se necessario)
"""

import csv
import json
import xmlrpc.client
import ssl
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from collections import defaultdict
from decimal import Decimal

# Disable SSL verification for Odoo staging
ssl._create_default_https_context = ssl._create_unverified_context

# Configuration
CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

# UBS CHF CSV Files
BASE_PATH = r"C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF"
CSV_FILES = [
    "UBS CHF 1.1-31.3.2024.csv",
    "UBS CHF 1.4-30.6.2024.csv",
    "UBS CHF 1.7-30.9.2024.csv",
    "UBS CHF 1.10-31.12.2024.csv"
]

# Expected final balance
EXPECTED_FINAL_BALANCE = 182573.56

# Konto in Odoo
KONTO_CODE = "1024"  # UBS-CHF, 278-122087.01J

# Output log file
LOG_FILE = r"C:\Users\lapa\Desktop\Claude Code\app-hub-platform\UBS-CHF-IMPORT-LOG.txt"

class ImportLogger:
    """Logging utility for import operations"""

    def __init__(self, log_file: str):
        self.log_file = log_file
        self.logs = []

    def log(self, message: str, level: str = "INFO"):
        """Log a message"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"[{timestamp}] [{level}] {message}"
        self.logs.append(log_entry)
        print(log_entry)

    def save(self):
        """Save logs to file"""
        with open(self.log_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(self.logs))
        self.log(f"Log salvato in: {self.log_file}")

class OdooClient:
    """Odoo XML-RPC client wrapper"""

    def __init__(self, config: Dict[str, str], logger: ImportLogger):
        self.config = config
        self.logger = logger
        self.uid = None
        self.models = None
        self._connect()

    def _connect(self):
        """Connect to Odoo"""
        self.logger.log("Connessione a Odoo staging...")
        common = xmlrpc.client.ServerProxy(f"{self.config['url']}/xmlrpc/2/common")

        self.uid = common.authenticate(
            self.config['db'],
            self.config['username'],
            self.config['password'],
            {}
        )

        if not self.uid:
            raise Exception("Autenticazione fallita")

        self.models = xmlrpc.client.ServerProxy(f"{self.config['url']}/xmlrpc/2/object")
        self.logger.log(f"Connesso come {self.config['username']} (UID: {self.uid})")

    def execute(self, model: str, method: str, *args, **kwargs):
        """Execute Odoo method"""
        return self.models.execute_kw(
            self.config['db'],
            self.uid,
            self.config['password'],
            model,
            method,
            args,
            kwargs
        )

    def search_read(self, model: str, domain: List, fields: List[str], limit: int = None):
        """Search and read records"""
        # For search_read, pass fields and limit as keyword args
        # NOT nested inside another dict
        return self.models.execute_kw(
            self.config['db'],
            self.uid,
            self.config['password'],
            model,
            'search_read',
            [domain],
            {'fields': fields, 'limit': limit} if limit else {'fields': fields}
        )

    def get_account_by_code(self, code: str) -> Optional[int]:
        """Get account ID by code"""
        accounts = self.search_read(
            'account.account',
            [['code', '=', code]],
            ['id', 'code', 'name'],
            limit=1
        )

        if accounts:
            self.logger.log(f"Account trovato: {accounts[0]['code']} - {accounts[0]['name']} (ID: {accounts[0]['id']})")
            return accounts[0]['id']

        self.logger.log(f"Account {code} non trovato!", "ERROR")
        return None

    def get_account_moves(self, account_id: int, year: int = 2024) -> List[Dict[str, Any]]:
        """Get all account moves for an account in a year"""
        self.logger.log(f"Estrazione movimenti account {account_id} per anno {year}...")

        moves = self.search_read(
            'account.move.line',
            [
                ['account_id', '=', account_id],
                ['date', '>=', f'{year}-01-01'],
                ['date', '<=', f'{year}-12-31']
            ],
            ['id', 'date', 'debit', 'credit', 'balance', 'name', 'ref', 'move_id']
        )

        self.logger.log(f"Trovati {len(moves)} movimenti esistenti in Odoo")
        return moves

    def get_account_balance(self, account_id: int, date: str = None) -> Decimal:
        """Get account balance at a specific date"""
        domain = [['account_id', '=', account_id]]

        if date:
            domain.append(['date', '<=', date])

        moves = self.search_read(
            'account.move.line',
            domain,
            ['debit', 'credit']
        )

        balance = Decimal('0')
        for move in moves:
            debit = Decimal(str(move.get('debit', 0)))
            credit = Decimal(str(move.get('credit', 0)))
            balance += debit - credit

        return balance

class UBSCSVParser:
    """Parse UBS CHF CSV files"""

    def __init__(self, logger: ImportLogger):
        self.logger = logger

    def parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date in DD/MM/YYYY format"""
        if not date_str or date_str.strip() == '':
            return None
        try:
            return datetime.strptime(date_str.strip(), '%d/%m/%Y')
        except:
            return None

    def parse_amount(self, amount_str: str) -> Decimal:
        """Parse amount string to Decimal"""
        if not amount_str or amount_str.strip() == '':
            return Decimal('0')
        try:
            clean = amount_str.strip().replace(' ', '').replace("'", '')
            return Decimal(clean)
        except:
            return Decimal('0')

    def extract_transactions(self, file_path: str) -> List[Dict[str, Any]]:
        """Extract all transactions from CSV"""
        self.logger.log(f"Parsing file: {Path(file_path).name}")
        transactions = []

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            # Skip metadata lines (first 9 lines)
            for _ in range(9):
                f.readline()

            # Read header (line 10)
            header_line = f.readline()

            # UBS CSV Format:
            # Col 0: Abschlussdatum (closing date)
            # Col 1: Abschlusszeit (closing time)
            # Col 2: Buchungsdatum (booking date)
            # Col 3: Valutadatum (value date)
            # Col 4: Währung (currency)
            # Col 5: Belastung (debit - negative amount)
            # Col 6: Gutschrift (credit - positive amount)
            # Col 7: Einzelbetrag (single amount)
            # Col 8: Saldo (balance)
            # Col 9: Transaktions-Nr. (transaction number)
            # Col 10+: Descriptions

            # Read transactions
            reader = csv.reader(f, delimiter=';')
            for row_num, row in enumerate(reader, 1):
                if len(row) < 10:
                    continue

                # Main transactions have date in col 0 (Abschlussdatum)
                # Sub-transactions (multi-line entries) have empty col 0-3
                closing_date_str = row[0].strip() if len(row) > 0 else ""

                # Skip sub-transaction lines (they're part of previous transaction)
                if not closing_date_str:
                    continue

                # Parse closing date
                closing_date = self.parse_date(closing_date_str)
                if not closing_date:
                    continue

                # Get amounts from columns 5 (Belastung) and 6 (Gutschrift)
                debit_str = row[5].strip() if len(row) > 5 else ""
                credit_str = row[6].strip() if len(row) > 6 else ""

                # Calculate amount
                amount = Decimal('0')

                if credit_str and credit_str != '':
                    # Positive amount (income/credit)
                    amount = self.parse_amount(credit_str)
                elif debit_str and debit_str != '':
                    # Negative amount (expense/debit)
                    amount = -self.parse_amount(debit_str)

                # Skip zero-amount transactions
                if amount == Decimal('0'):
                    continue

                # Get descriptions (cols 10, 11, 12)
                desc1 = row[10].strip() if len(row) > 10 else ""
                desc2 = row[11].strip() if len(row) > 11 else ""
                desc3 = row[12].strip() if len(row) > 12 else ""

                # Combine descriptions
                description_parts = [d for d in [desc1, desc2, desc3] if d]
                description = " | ".join(description_parts) if description_parts else f"Transaction {closing_date_str}"

                transactions.append({
                    'date': closing_date.strftime('%Y-%m-%d'),
                    'description': description[:255],  # Limit length
                    'amount': float(amount),
                    'original_row': row_num
                })

        self.logger.log(f"  Estratte {len(transactions)} transazioni")
        return transactions

    def load_all_transactions(self) -> List[Dict[str, Any]]:
        """Load all transactions from all CSV files"""
        self.logger.log("Caricamento transazioni da tutti i file CSV...")
        all_transactions = []

        for filename in CSV_FILES:
            file_path = Path(BASE_PATH) / filename

            if not file_path.exists():
                self.logger.log(f"File non trovato: {file_path}", "ERROR")
                continue

            transactions = self.extract_transactions(str(file_path))
            all_transactions.extend(transactions)

        self.logger.log(f"Totale transazioni caricate: {len(all_transactions)}")
        return all_transactions

class TransactionMatcher:
    """Match transactions between CSV and Odoo"""

    def __init__(self, logger: ImportLogger):
        self.logger = logger

    def create_signature(self, date: str, amount: float, description: str = "") -> str:
        """Create unique signature for transaction matching"""
        # Use date + amount as primary key
        # Description is optional (might vary between systems)
        return f"{date}|{amount:.2f}"

    def find_duplicates(
        self,
        csv_transactions: List[Dict[str, Any]],
        odoo_moves: List[Dict[str, Any]]
    ) -> Tuple[List[Dict], List[Dict]]:
        """Find duplicates and new transactions"""

        self.logger.log("Identificazione transazioni duplicate...")

        # Create signatures for Odoo moves
        odoo_signatures = set()
        for move in odoo_moves:
            date = move['date']
            # Calculate amount from debit/credit
            debit = float(move.get('debit', 0))
            credit = float(move.get('credit', 0))
            amount = credit - debit  # Positive = income, Negative = expense

            sig = self.create_signature(date, amount)
            odoo_signatures.add(sig)

        # Classify CSV transactions
        duplicates = []
        new_transactions = []

        for tx in csv_transactions:
            sig = self.create_signature(tx['date'], tx['amount'])

            if sig in odoo_signatures:
                duplicates.append(tx)
            else:
                new_transactions.append(tx)

        self.logger.log(f"Trovate {len(duplicates)} transazioni duplicate")
        self.logger.log(f"Trovate {len(new_transactions)} transazioni nuove da importare")

        return duplicates, new_transactions

class OdooImporter:
    """Import transactions into Odoo"""

    def __init__(self, odoo: OdooClient, logger: ImportLogger):
        self.odoo = odoo
        self.logger = logger

    def create_bank_statement(
        self,
        journal_id: int,
        date: str,
        balance_start: float,
        balance_end: float,
        transactions: List[Dict[str, Any]]
    ) -> int:
        """Create bank statement with transactions"""

        statement_data = {
            'name': f"UBS CHF {date}",
            'journal_id': journal_id,
            'date': date,
            'balance_start': balance_start,
            'balance_end_real': balance_end,
            'line_ids': []
        }

        # Add transaction lines
        for tx in transactions:
            line_data = {
                'date': tx['date'],
                'payment_ref': tx['description'][:64] if tx['description'] else f"Transaction {tx['date']}",
                'amount': tx['amount']
            }
            statement_data['line_ids'].append((0, 0, line_data))

        # Create statement
        statement_id = self.odoo.execute(
            'account.bank.statement',
            'create',
            statement_data
        )

        return statement_id

    def import_monthly_batch(
        self,
        transactions: List[Dict[str, Any]],
        month: str,
        account_id: int,
        journal_id: int,
        suspense_account_id: int
    ) -> bool:
        """Import transactions for a specific month"""

        self.logger.log(f"\n{'='*80}")
        self.logger.log(f"Import transazioni per {month}")
        self.logger.log(f"{'='*80}")

        # Filter transactions for this month
        month_txs = [tx for tx in transactions if tx['date'].startswith(month)]

        if not month_txs:
            self.logger.log(f"Nessuna transazione per {month}")
            return True

        self.logger.log(f"Transazioni da importare: {len(month_txs)}")

        # Get balance before import
        month_start = f"{month}-01"
        balance_before = self.odoo.get_account_balance(account_id, month_start)
        self.logger.log(f"Saldo prima import: CHF {balance_before:,.2f}")

        # Calculate expected balance after import
        total_amount = sum(Decimal(str(tx['amount'])) for tx in month_txs)
        expected_balance = balance_before + total_amount

        # Sort transactions by date
        month_txs.sort(key=lambda x: x['date'])

        # Group by date for batch import (max 100 per statement)
        batch_size = 100
        for i in range(0, len(month_txs), batch_size):
            batch = month_txs[i:i+batch_size]

            self.logger.log(f"Importando batch {i//batch_size + 1} ({len(batch)} transazioni)...")

            # For now, just create account.move.line entries directly
            # (simpler than bank statements which require reconciliation)
            for tx in batch:
                try:
                    self._create_journal_entry(account_id, journal_id, tx, suspense_account_id)
                except Exception as e:
                    self.logger.log(f"Errore importando transazione {tx['date']}: {e}", "ERROR")
                    return False

        # Verify balance after import
        last_day = month_txs[-1]['date']
        balance_after = self.odoo.get_account_balance(account_id, last_day)

        self.logger.log(f"Saldo dopo import: CHF {balance_after:,.2f}")
        self.logger.log(f"Saldo atteso:      CHF {expected_balance:,.2f}")

        delta = abs(balance_after - expected_balance)

        if delta > Decimal('1.00'):
            self.logger.log(f"ERRORE: Delta troppo grande: CHF {delta:,.2f}", "ERROR")
            return False

        self.logger.log(f"[OK] Import completato. Delta: CHF {delta:,.2f}")
        return True

    def _create_journal_entry(self, account_id: int, journal_id: int, tx: Dict[str, Any], suspense_account_id: int):
        """Create a simple journal entry for a transaction"""

        amount = Decimal(str(tx['amount']))

        # Bank account is an ASSET account
        # Positive amount (income) = DEBIT bank account (increase asset)
        # Negative amount (expense) = CREDIT bank account (decrease asset)

        if amount > 0:
            # Income: DEBIT bank account, CREDIT suspense
            bank_debit = float(amount)
            bank_credit = 0
        else:
            # Expense: CREDIT bank account, DEBIT suspense
            bank_debit = 0
            bank_credit = float(abs(amount))

        # Create move
        move_data = {
            'date': tx['date'],
            'journal_id': journal_id,
            'ref': tx['description'][:64] if tx['description'] else f"UBS CHF {tx['date']}",
            'line_ids': [
                # Bank account line
                (0, 0, {
                    'account_id': account_id,
                    'name': tx['description'][:64] if tx['description'] else "UBS CHF Transaction",
                    'debit': bank_debit,
                    'credit': bank_credit,
                }),
                # Suspense account line (opposite)
                (0, 0, {
                    'account_id': suspense_account_id,
                    'name': tx['description'][:64] if tx['description'] else "UBS CHF Transaction",
                    'debit': bank_credit,  # Opposite
                    'credit': bank_debit,  # Opposite
                })
            ]
        }

        move_id = self.odoo.execute('account.move', 'create', move_data)

        # Post the move
        self.odoo.execute('account.move', 'action_post', [move_id])

def main():
    """Main import workflow"""

    logger = ImportLogger(LOG_FILE)

    logger.log("\n" + "="*80)
    logger.log("UBS CHF TRANSACTIONS IMPORT")
    logger.log("="*80)

    try:
        # 1. Connect to Odoo
        odoo = OdooClient(CONFIG, logger)

        # 2. Get UBS CHF account
        account_id = odoo.get_account_by_code(KONTO_CODE)
        if not account_id:
            raise Exception(f"Account {KONTO_CODE} non trovato in Odoo")

        # 3. Get current balance
        current_balance = odoo.get_account_balance(account_id)
        logger.log(f"\nSaldo ATTUALE Odoo: CHF {current_balance:,.2f}")
        logger.log(f"Saldo ATTESO:       CHF {EXPECTED_FINAL_BALANCE:,.2f}")
        logger.log(f"Discrepanza:        CHF {EXPECTED_FINAL_BALANCE - float(current_balance):+,.2f}")

        # 4. Load CSV transactions
        parser = UBSCSVParser(logger)
        csv_transactions = parser.load_all_transactions()

        # 5. Get existing Odoo moves
        odoo_moves = odoo.get_account_moves(account_id, year=2024)

        # 6. Find duplicates
        matcher = TransactionMatcher(logger)
        duplicates, new_transactions = matcher.find_duplicates(csv_transactions, odoo_moves)

        logger.log(f"\n{'='*80}")
        logger.log("RIEPILOGO ANALISI")
        logger.log(f"{'='*80}")
        logger.log(f"Transazioni CSV:       {len(csv_transactions)}")
        logger.log(f"Movimenti Odoo:        {len(odoo_moves)}")
        logger.log(f"Duplicate:             {len(duplicates)}")
        logger.log(f"Nuove da importare:    {len(new_transactions)}")

        if not new_transactions:
            logger.log("\n[OK] Nessuna transazione da importare!")
            logger.save()
            return

        # 7. Verify suspense account configuration
        logger.log("\nVerifica configurazione suspense account...")
        suspense_id = odoo.get_account_by_code('1021')
        if not suspense_id:
            logger.log("ERRORE: Suspense account 1021 non trovato!", "ERROR")
            logger.log("Esegui: python scripts/FIX-SUSPENSE-ACCOUNT.py", "ERROR")
            logger.save()
            return

        # 8. Get journal for import (LAPA company)
        logger.log("Ricerca journal Miscellaneous Operations per LAPA company...")

        # Get LAPA company ID
        lapa_companies = odoo.search_read(
            'res.company',
            [['name', 'ilike', 'LAPA']],
            ['id', 'name'],
            limit=1
        )

        if not lapa_companies:
            logger.log("ERRORE: LAPA company non trovata!", "ERROR")
            logger.save()
            return

        lapa_company_id = lapa_companies[0]['id']
        logger.log(f"LAPA Company: {lapa_companies[0]['name']} (ID: {lapa_company_id})")

        # Get MISC journal for LAPA
        journals = odoo.search_read(
            'account.journal',
            [
                ['code', '=', 'MISC'],
                ['company_id', '=', lapa_company_id]
            ],
            ['id', 'code', 'name', 'suspense_account_id'],
            limit=1
        )

        if not journals:
            logger.log("ERRORE: Journal MISC per LAPA non trovato!", "ERROR")
            logger.save()
            return

        journal_id = journals[0]['id']
        logger.log(f"Journal trovato: {journals[0]['name']} (ID: {journal_id})")

        # Verify suspense account
        if not journals[0].get('suspense_account_id'):
            logger.log("ERRORE: Suspense account non configurato nel journal!", "ERROR")
            logger.log("Esegui: python scripts/FIX-SUSPENSE-ACCOUNT.py", "ERROR")
            logger.save()
            return

        logger.log(f"Suspense account: {journals[0]['suspense_account_id'][1]}")

        # 9. Group transactions by month
        logger.log("\nRaggruppo transazioni per mese...")
        by_month = defaultdict(list)
        for tx in new_transactions:
            month = tx['date'][:7]  # YYYY-MM
            by_month[month].append(tx)

        # 10. Import month by month
        importer = OdooImporter(odoo, logger)

        for month in sorted(by_month.keys()):
            success = importer.import_monthly_batch(
                by_month[month],
                month,
                account_id,
                journal_id,
                suspense_id
            )

            if not success:
                logger.log(f"\n[ERROR] Import fallito per {month}. Interruzione.", "ERROR")
                logger.save()
                return

        # 11. Final verification
        logger.log("\n" + "="*80)
        logger.log("VERIFICA FINALE")
        logger.log("="*80)

        final_balance = odoo.get_account_balance(account_id)
        delta = abs(final_balance - Decimal(str(EXPECTED_FINAL_BALANCE)))

        logger.log(f"Saldo FINALE Odoo:  CHF {final_balance:,.2f}")
        logger.log(f"Saldo ATTESO:       CHF {EXPECTED_FINAL_BALANCE:,.2f}")
        logger.log(f"Delta:              CHF {delta:,.2f}")

        if delta < Decimal('0.01'):
            logger.log("\n[OK] IMPORT COMPLETATO CON SUCCESSO!", "SUCCESS")
            logger.log(f"Delta finale: CHF {delta} (< 0.01 CHF)")
        else:
            logger.log(f"\n[WARNING] Delta superiore a 0.01 CHF: {delta:,.2f}", "WARNING")

        # Save log
        logger.save()

    except Exception as e:
        logger.log(f"\n[ERROR] {e}", "ERROR")
        import traceback
        logger.log(traceback.format_exc(), "ERROR")
        logger.save()
        raise

if __name__ == '__main__':
    main()
