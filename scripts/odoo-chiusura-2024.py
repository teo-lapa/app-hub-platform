#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Report Chiusura 2024 per Commercialista
Estrae dati da Odoo per Patrick Angstmann - PAGG Treuhand AG
"""

import sys
import io
import xmlrpc.client
import json
from datetime import datetime
from collections import defaultdict

# Fix encoding su Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Credenziali Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Data chiusura
CLOSING_DATE = "2024-12-31"

# Conti da verificare (checklist)
ACCOUNTS_CHECKLIST = {
    "1022": "Outstanding Receipts",
    "1023": "Outstanding Payments",
    "10901": "Liquiditätstransfer",
    "1099": "Transferkonto",
    "1001": "Cash",
    "1170": "Vorsteuer MWST",
    "2016": "Kreditor MWST"
}

class OdooConnection:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USER
        self.password = ODOO_PASSWORD
        self.uid = None
        self.models = None

    def connect(self):
        """Connessione a Odoo"""
        print(f"Connessione a Odoo: {self.url}")

        common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
        self.uid = common.authenticate(self.db, self.username, self.password, {})

        if not self.uid:
            raise Exception("Autenticazione fallita")

        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
        print(f"✓ Connesso come UID: {self.uid}")
        return self.uid

    def search_read(self, model, domain=None, fields=None, limit=None):
        """Wrapper per search_read"""
        if domain is None:
            domain = []
        if fields is None:
            fields = []

        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit

        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain],
            kwargs
        )

class ChiusuraReport:
    def __init__(self, odoo: OdooConnection):
        self.odoo = odoo
        self.report_data = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'closing_date': CLOSING_DATE,
                'company': 'Lapa Delikatessen',
                'accountant': 'Patrick Angstmann - PAGG Treuhand AG',
                'accountant_email': 'p.angstmann@pagg.ch'
            },
            'balance_sheet': {},
            'profit_loss': {},
            'accounts': [],
            'bank_reconciliations': [],
            'checklist_validation': {},
            'vat_accounts': {}
        }

    def get_balance_sheet(self):
        """Estrae Balance Sheet al 31.12.2024"""
        print("\n📊 Estrazione Balance Sheet...")

        # Skip report templates - andiamo direttamente ai conti
        # (account.financial.html.report potrebbe non esistere in tutte le versioni)

        # Estrai conti patrimoniali (Assets, Liabilities, Equity)
        account_types = [
            'asset_receivable',
            'asset_cash',
            'asset_current',
            'asset_non_current',
            'asset_prepayments',
            'asset_fixed',
            'liability_payable',
            'liability_credit_card',
            'liability_current',
            'liability_non_current',
            'equity',
            'equity_unaffected'
        ]

        accounts = self.odoo.search_read(
            'account.account',
            [['account_type', 'in', account_types]],
            ['code', 'name', 'account_type', 'current_balance']
        )

        print(f"  ✓ Estratti {len(accounts)} conti patrimoniali")

        # Organizza per tipo
        balance_by_type = defaultdict(list)
        for acc in accounts:
            balance_by_type[acc['account_type']].append({
                'code': acc['code'],
                'name': acc['name'],
                'balance': acc.get('current_balance', 0.0)
            })

        self.report_data['balance_sheet']['accounts_by_type'] = dict(balance_by_type)

        # Calcola totali
        total_assets = sum(acc['current_balance'] for acc in accounts
                          if 'asset' in acc['account_type'])
        total_liabilities = sum(acc['current_balance'] for acc in accounts
                               if 'liability' in acc['account_type'])
        total_equity = sum(acc['current_balance'] for acc in accounts
                          if 'equity' in acc['account_type'])

        self.report_data['balance_sheet']['totals'] = {
            'assets': total_assets,
            'liabilities': total_liabilities,
            'equity': total_equity,
            'balance_check': total_assets - (total_liabilities + total_equity)
        }

        print(f"  Assets: CHF {total_assets:,.2f}")
        print(f"  Liabilities: CHF {total_liabilities:,.2f}")
        print(f"  Equity: CHF {total_equity:,.2f}")
        print(f"  Balance Check: CHF {total_assets - (total_liabilities + total_equity):,.2f}")

    def get_profit_loss(self):
        """Estrae Profit & Loss 2024"""
        print("\n📈 Estrazione Profit & Loss 2024...")

        # Skip report templates - andiamo direttamente ai conti economici

        # Estrai conti economici
        account_types = [
            'income',
            'income_other',
            'expense',
            'expense_depreciation',
            'expense_direct_cost'
        ]

        accounts = self.odoo.search_read(
            'account.account',
            [['account_type', 'in', account_types]],
            ['code', 'name', 'account_type', 'current_balance']
        )

        print(f"  ✓ Estratti {len(accounts)} conti economici")

        # Organizza per tipo
        pl_by_type = defaultdict(list)
        for acc in accounts:
            pl_by_type[acc['account_type']].append({
                'code': acc['code'],
                'name': acc['name'],
                'balance': acc.get('current_balance', 0.0)
            })

        self.report_data['profit_loss']['accounts_by_type'] = dict(pl_by_type)

        # Calcola totali
        total_income = sum(acc['current_balance'] for acc in accounts
                          if 'income' in acc['account_type'])
        total_expenses = sum(acc['current_balance'] for acc in accounts
                            if 'expense' in acc['account_type'])
        net_profit = total_income - total_expenses

        self.report_data['profit_loss']['totals'] = {
            'income': total_income,
            'expenses': total_expenses,
            'net_profit': net_profit
        }

        print(f"  Income: CHF {total_income:,.2f}")
        print(f"  Expenses: CHF {total_expenses:,.2f}")
        print(f"  Net Profit: CHF {net_profit:,.2f}")

    def get_chart_of_accounts(self):
        """Estrae Piano dei Conti completo con saldi"""
        print("\n📋 Estrazione Piano dei Conti...")

        accounts = self.odoo.search_read(
            'account.account',
            [],
            ['code', 'name', 'account_type', 'current_balance', 'reconcile', 'deprecated']
        )

        # Ordina per codice
        accounts.sort(key=lambda x: x['code'])

        self.report_data['accounts'] = [{
            'code': acc['code'],
            'name': acc['name'],
            'type': acc['account_type'],
            'balance': acc.get('current_balance', 0.0),
            'reconcile': acc.get('reconcile', False),
            'deprecated': acc.get('deprecated', False)
        } for acc in accounts if not acc.get('deprecated', False)]

        print(f"  ✓ Estratti {len(self.report_data['accounts'])} conti attivi")

    def get_bank_reconciliations(self):
        """Verifica riconciliazioni bancarie"""
        print("\n🏦 Verifica Riconciliazioni Bancarie...")

        # Trova conti bancari
        bank_accounts = self.odoo.search_read(
            'account.account',
            [['account_type', '=', 'asset_cash']],
            ['code', 'name', 'current_balance']
        )

        print(f"  Trovati {len(bank_accounts)} conti bancari")

        for bank in bank_accounts:
            print(f"  {bank['code']} - {bank['name']}: CHF {bank.get('current_balance', 0.0):,.2f}")

            # Cerca movimenti non riconciliati
            unreconciled = self.odoo.search_read(
                'account.move.line',
                [
                    ['account_id', '=', bank['id']],
                    ['reconciled', '=', False],
                    ['date', '<=', CLOSING_DATE]
                ],
                ['date', 'name', 'debit', 'credit', 'balance']
            )

            self.report_data['bank_reconciliations'].append({
                'account_code': bank['code'],
                'account_name': bank['name'],
                'balance': bank.get('current_balance', 0.0),
                'unreconciled_count': len(unreconciled),
                'unreconciled_items': unreconciled[:10]  # Prime 10
            })

            if unreconciled:
                print(f"    ⚠️  {len(unreconciled)} movimenti non riconciliati")

    def validate_checklist_accounts(self):
        """Valida conti della checklist"""
        print("\n✅ Validazione Checklist Conti Tecnici...")

        for code, description in ACCOUNTS_CHECKLIST.items():
            accounts = self.odoo.search_read(
                'account.account',
                [['code', '=', code]],
                ['code', 'name', 'current_balance']
            )

            if accounts:
                acc = accounts[0]
                balance = acc.get('current_balance', 0.0)

                # Validazione specifica
                status = "✓ OK"
                issues = []

                if code in ["1022", "1023", "10901", "1099"]:
                    # Devono essere a zero
                    if abs(balance) > 0.01:
                        status = "✗ ERRORE"
                        issues.append(f"Saldo {balance:,.2f} deve essere 0.00")

                elif code == "1001":  # Cash
                    # Deve essere realistico (< 10000 CHF)
                    if balance > 10000:
                        status = "⚠️  WARNING"
                        issues.append(f"Saldo alto: {balance:,.2f}")

                self.report_data['checklist_validation'][code] = {
                    'code': code,
                    'name': acc['name'],
                    'description': description,
                    'balance': balance,
                    'status': status,
                    'issues': issues
                }

                print(f"  [{status}] {code} {description}: CHF {balance:,.2f}")
                for issue in issues:
                    print(f"        → {issue}")
            else:
                print(f"  [✗] {code} {description}: NON TROVATO")
                self.report_data['checklist_validation'][code] = {
                    'code': code,
                    'description': description,
                    'status': '✗ NON TROVATO',
                    'issues': ['Conto non presente nel piano dei conti']
                }

    def get_vat_accounts(self):
        """Estrae saldi IVA"""
        print("\n💶 Estrazione Saldi IVA...")

        vat_codes = {
            "1170": "Vorsteuer MWST (IVA a credito)",
            "2016": "Kreditor MWST (IVA a debito)"
        }

        for code, description in vat_codes.items():
            accounts = self.odoo.search_read(
                'account.account',
                [['code', '=', code]],
                ['code', 'name', 'current_balance']
            )

            if accounts:
                acc = accounts[0]
                balance = acc.get('current_balance', 0.0)

                self.report_data['vat_accounts'][code] = {
                    'code': code,
                    'name': acc['name'],
                    'description': description,
                    'balance': balance
                }

                print(f"  {code} - {description}: CHF {balance:,.2f}")

    def generate_report(self):
        """Genera report completo"""
        print("\n" + "="*60)
        print("REPORT CHIUSURA 2024 - LAPA DELIKATESSEN")
        print("="*60)

        # Esegui tutte le estrazioni
        self.get_balance_sheet()
        self.get_profit_loss()
        self.get_chart_of_accounts()
        self.get_bank_reconciliations()
        self.validate_checklist_accounts()
        self.get_vat_accounts()

        # Salva JSON
        output_file = "report-chiusura-2024.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.report_data, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Report salvato: {output_file}")

        # Summary
        print("\n" + "="*60)
        print("SUMMARY FINALE")
        print("="*60)

        bs = self.report_data['balance_sheet']['totals']
        pl = self.report_data['profit_loss']['totals']

        print(f"\nBALANCE SHEET al {CLOSING_DATE}:")
        print(f"  Assets:      CHF {bs['assets']:>15,.2f}")
        print(f"  Liabilities: CHF {bs['liabilities']:>15,.2f}")
        print(f"  Equity:      CHF {bs['equity']:>15,.2f}")
        print(f"  Balance:     CHF {bs['balance_check']:>15,.2f}")

        print(f"\nPROFIT & LOSS 2024:")
        print(f"  Income:      CHF {pl['income']:>15,.2f}")
        print(f"  Expenses:    CHF {pl['expenses']:>15,.2f}")
        print(f"  Net Profit:  CHF {pl['net_profit']:>15,.2f}")

        print(f"\nCONTI:")
        print(f"  Totale conti attivi: {len(self.report_data['accounts'])}")

        print(f"\nBANCHE:")
        print(f"  Conti bancari: {len(self.report_data['bank_reconciliations'])}")

        # Checklist validation
        print("\nCHECKLIST VALIDATION:")
        errors = 0
        warnings = 0
        for code, data in self.report_data['checklist_validation'].items():
            if '✗' in data['status']:
                errors += 1
            elif '⚠️' in data['status']:
                warnings += 1

        print(f"  Errori: {errors}")
        print(f"  Warning: {warnings}")
        print(f"  OK: {len(self.report_data['checklist_validation']) - errors - warnings}")

        return self.report_data

def main():
    try:
        # Connetti a Odoo
        odoo = OdooConnection()
        odoo.connect()

        # Genera report
        report = ChiusuraReport(odoo)
        report.generate_report()

        print("\n✓ Report completato con successo!")

    except Exception as e:
        print(f"\n✗ ERRORE: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
