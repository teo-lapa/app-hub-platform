#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script per analizzare la situazione contabile Odoo per chiusura 2024
Estrae tutti i dati necessari per l'allineamento contabile
"""

import xmlrpc.client
import json
from datetime import datetime
from typing import Dict, List, Any
import ssl
import sys
import io

# Fix encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Configurazione connessione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Conti da analizzare (come indicato dal commercialista)
CONTI_PROBLEMATICI = {
    '1001': 'Cash - Cassa',
    '1022': 'Outstanding Receipts - Incassi non riconciliati',
    '1023': 'Outstanding Payments - Pagamenti non riconciliati',
    '10901': 'Liquiditätstransfer - Trasferimenti liquidità',
    '1099': 'Transferkonto - Conto trasferimento',
    '1170': 'Vorsteuer MWST - IVA su acquisti',
    '2016': 'Kreditor MWST - Debito IVA'
}

# Conti bancari da verificare
CONTI_BANCARI = [
    '1021', '1022', '1023', '1024', '1025', '1026', '1027', '1028',
    '1029', '1030', '1031', '1032', '1033', '1034'
]

class OdooAnalyzer:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.uid = None
        self.models = None

        # Disable SSL verification for dev environment
        ssl._create_default_https_context = ssl._create_unverified_context

    def connect(self):
        """Connessione a Odoo via XML-RPC"""
        print(f"🔌 Connessione a Odoo: {self.url}")
        print(f"📊 Database: {self.db}")
        print(f"👤 Username: {self.username}")

        try:
            # Authenticate
            common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
            self.uid = common.authenticate(self.db, self.username, self.password, {})

            if not self.uid:
                raise Exception("❌ Autenticazione fallita! Verifica username e password.")

            print(f"✅ Autenticazione riuscita! UID: {self.uid}")

            # Setup models proxy
            self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')

            return True

        except Exception as e:
            print(f"❌ Errore connessione: {str(e)}")
            return False

    def execute(self, model: str, method: str, *args, **kwargs):
        """Wrapper per eseguire chiamate Odoo"""
        try:
            return self.models.execute_kw(
                self.db, self.uid, self.password,
                model, method, args, kwargs
            )
        except Exception as e:
            print(f"❌ Errore chiamata {model}.{method}: {str(e)}")
            return None

    def get_chart_of_accounts(self):
        """Estrae il piano dei conti completo con saldi"""
        print("\n📋 Estrazione Piano dei Conti...")

        try:
            accounts = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.account', 'search_read',
                [[]],  # domain vuoto
                {'fields': ['code', 'name', 'account_type', 'currency_id', 'company_id']}
            )

            if accounts:
                print(f"✅ Trovati {len(accounts)} conti")
                return accounts
        except Exception as e:
            print(f"❌ Errore: {str(e)}")
        return []

    def get_account_balance(self, account_code: str, date_to: str = '2024-12-31'):
        """Ottiene il saldo di un conto specifico"""
        print(f"\n💰 Calcolo saldo conto {account_code}...")

        # Cerca il conto per codice
        try:
            accounts = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.account', 'search_read',
                [[['code', '=', account_code]]],
                {'fields': ['id', 'code', 'name'], 'limit': 1}
            )
        except Exception as e:
            print(f"❌ Errore ricerca conto: {str(e)}")
            return None

        if not accounts:
            print(f"⚠️  Conto {account_code} non trovato")
            return None

        account = accounts[0]
        account_id = account['id']

        # Cerca tutte le righe contabili per questo conto fino alla data
        try:
            move_lines = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move.line', 'search_read',
                [[
                    ['account_id', '=', account_id],
                    ['date', '<=', date_to],
                    ['parent_state', '=', 'posted']  # Solo movimenti confermati
                ]],
                {'fields': ['date', 'name', 'debit', 'credit', 'balance', 'move_id', 'partner_id']}
            )
        except Exception as e:
            print(f"❌ Errore ricerca righe contabili: {str(e)}")
            return None

        if not move_lines:
            print(f"ℹ️  Nessun movimento trovato per {account_code}")
            return {
                'account': account,
                'balance': 0,
                'debit_total': 0,
                'credit_total': 0,
                'move_count': 0,
                'moves': []
            }

        # Calcola totali
        debit_total = sum(line['debit'] for line in move_lines)
        credit_total = sum(line['credit'] for line in move_lines)
        balance = debit_total - credit_total

        print(f"   Dare: {debit_total:,.2f}")
        print(f"   Avere: {credit_total:,.2f}")
        print(f"   Saldo: {balance:,.2f}")
        print(f"   Movimenti: {len(move_lines)}")

        return {
            'account': account,
            'balance': balance,
            'debit_total': debit_total,
            'credit_total': credit_total,
            'move_count': len(move_lines),
            'moves': move_lines
        }

    def get_outstanding_payments(self):
        """Estrae pagamenti in Outstanding Receipts e Payments"""
        print("\n💳 Estrazione Outstanding Receipts e Payments...")

        # Account receivable/payable lines non riconciliate
        try:
            outstanding_lines = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move.line', 'search_read',
                [[
                    ['account_id.code', 'in', ['1022', '1023']],
                    ['reconciled', '=', False],
                    ['parent_state', '=', 'posted']
                ]],
                {'fields': ['date', 'name', 'debit', 'credit', 'balance', 'account_id',
                           'partner_id', 'move_id', 'amount_residual']}
            )
        except Exception as e:
            print(f"❌ Errore: {str(e)}")
            return []

        if outstanding_lines:
            print(f"✅ Trovate {len(outstanding_lines)} righe non riconciliate")

            # Raggruppa per account
            by_account = {}
            for line in outstanding_lines:
                acc_code = line['account_id'][1].split()[0] if line['account_id'] else 'N/A'
                if acc_code not in by_account:
                    by_account[acc_code] = []
                by_account[acc_code].append(line)

            for acc_code, lines in by_account.items():
                total = sum(line['amount_residual'] for line in lines)
                print(f"   {acc_code}: {len(lines)} righe, Totale: {total:,.2f}")

        return outstanding_lines

    def get_bank_accounts_balance(self):
        """Verifica saldi dei conti bancari"""
        print("\n🏦 Verifica Saldi Conti Bancari...")

        bank_balances = {}

        # Lista dei codici conti bancari
        bank_codes = ['1021', '1022', '1023', '1024', '1025', '1026',
                      '1027', '1028', '1029', '1030', '1031', '1032', '1033', '1034']

        for code in bank_codes:
            balance_data = self.get_account_balance(code)
            if balance_data and balance_data['move_count'] > 0:
                bank_balances[code] = balance_data

        return bank_balances

    def analyze_konto_10901(self):
        """Analizza il conto 10901 Liquiditätstransfer"""
        print("\n🔄 Analisi Konto 10901 Liquiditätstransfer...")

        balance_data = self.get_account_balance('10901')

        if not balance_data:
            return None

        # Categorizza i movimenti
        moves = balance_data['moves']

        categories = {
            'cambi_valuta': [],
            'bonifici_interbancari': [],
            'carte_credito': [],
            'altri': []
        }

        for move in moves:
            name = move['name'].lower() if move['name'] else ''

            if 'eur' in name or 'chf' in name or 'fx' in name or 'cambio' in name:
                categories['cambi_valuta'].append(move)
            elif 'konto' in name or 'transfer' in name or 'bonifico' in name:
                categories['bonifici_interbancari'].append(move)
            elif 'karte' in name or 'card' in name or 'visa' in name:
                categories['carte_credito'].append(move)
            else:
                categories['altri'].append(move)

        print(f"   📊 Categorizzazione:")
        for cat, items in categories.items():
            if items:
                total = sum(item['debit'] - item['credit'] for item in items)
                print(f"      {cat}: {len(items)} movimenti, Totale: {total:,.2f}")

        return {
            **balance_data,
            'categories': categories
        }

    def generate_report(self):
        """Genera report completo"""
        print("\n" + "="*80)
        print("📊 REPORT ANALISI CONTABILITÀ ODOO - CHIUSURA 2024")
        print("="*80)

        report = {
            'timestamp': datetime.now().isoformat(),
            'conti_problematici': {},
            'conti_bancari': {},
            'outstanding': None,
            'konto_10901_analysis': None
        }

        # 1. Analizza conti problematici
        print("\n🔍 CONTI PROBLEMATICI")
        print("-" * 80)
        for code, desc in CONTI_PROBLEMATICI.items():
            balance_data = self.get_account_balance(code)
            if balance_data:
                report['conti_problematici'][code] = balance_data

        # 2. Analizza conti bancari
        print("\n🏦 CONTI BANCARI")
        print("-" * 80)
        bank_balances = self.get_bank_accounts_balance()
        report['conti_bancari'] = bank_balances

        # 3. Outstanding payments
        outstanding = self.get_outstanding_payments()
        report['outstanding'] = outstanding

        # 4. Analisi speciale Konto 10901
        konto_10901 = self.analyze_konto_10901()
        report['konto_10901_analysis'] = konto_10901

        # Salva report JSON
        report_file = 'odoo_chiusura_2024_report.json'
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)

        print(f"\n✅ Report salvato in: {report_file}")

        # Genera summary
        self.print_summary(report)

        return report

    def print_summary(self, report: Dict):
        """Stampa riepilogo problemi"""
        print("\n" + "="*80)
        print("📌 RIEPILOGO PROBLEMI DA RISOLVERE")
        print("="*80)

        problems = []

        # Check Konto 1001 Cash
        if '1001' in report['conti_problematici']:
            balance = report['conti_problematici']['1001']['balance']
            if abs(balance) > 100000:  # Se > 100k è sospetto
                problems.append({
                    'priority': 'ALTA',
                    'conto': '1001 Cash',
                    'problema': f'Saldo cassa eccessivo: CHF {balance:,.2f}',
                    'azione': 'Riconciliare e verificare errori di registrazione'
                })

        # Check Outstanding Receipts/Payments
        if '1022' in report['conti_problematici']:
            balance = report['conti_problematici']['1022']['balance']
            if abs(balance) > 0:
                problems.append({
                    'priority': '🚨 CRITICA',
                    'conto': '1022 Outstanding Receipts',
                    'problema': f'Incassi non riconciliati: CHF {balance:,.2f}',
                    'azione': 'Riconciliare TUTTI i pagamenti clienti prima della chiusura'
                })

        if '1023' in report['conti_problematici']:
            balance = report['conti_problematici']['1023']['balance']
            if abs(balance) > 0:
                problems.append({
                    'priority': '🚨 CRITICA',
                    'conto': '1023 Outstanding Payments',
                    'problema': f'Pagamenti non riconciliati: CHF {balance:,.2f}',
                    'azione': 'Riconciliare TUTTI i pagamenti fornitori prima della chiusura'
                })

        # Check Konto 10901
        if '10901' in report['conti_problematici']:
            balance = report['conti_problematici']['10901']['balance']
            if abs(balance) > 0:
                problems.append({
                    'priority': 'ALTA',
                    'conto': '10901 Liquiditätstransfer',
                    'problema': f'Conto trasferimenti non a zero: CHF {balance:,.2f}',
                    'azione': 'Riclassificare cambi valuta e bonifici interbancari'
                })

        # Check Konto 1099
        if '1099' in report['conti_problematici']:
            balance = report['conti_problematici']['1099']['balance']
            if abs(balance) > 0:
                problems.append({
                    'priority': 'MEDIA',
                    'conto': '1099 Transferkonto',
                    'problema': f'Conto trasferimento non chiuso: CHF {balance:,.2f}',
                    'azione': 'Chiudere su conto Patrimonio Netto (differenze apertura)'
                })

        # Print problems
        if problems:
            print(f"\n⚠️  Trovati {len(problems)} problemi:\n")
            for i, prob in enumerate(problems, 1):
                print(f"{i}. [{prob['priority']}] {prob['conto']}")
                print(f"   Problema: {prob['problema']}")
                print(f"   Azione: {prob['azione']}\n")
        else:
            print("\n✅ Nessun problema critico trovato!")

        print("="*80)

def main():
    """Main function"""
    print("🚀 ODOO CHIUSURA 2024 ANALYZER")
    print("="*80)

    analyzer = OdooAnalyzer()

    # Connect
    if not analyzer.connect():
        print("❌ Impossibile connettersi a Odoo. Verifica le credenziali.")
        return

    # Generate report
    try:
        report = analyzer.generate_report()
        print("\n✅ Analisi completata con successo!")

    except Exception as e:
        print(f"\n❌ Errore durante l'analisi: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
