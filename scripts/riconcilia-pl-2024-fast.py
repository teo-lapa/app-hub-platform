#!/usr/bin/env python3
"""
RICONCILIAZIONE CONTI ECONOMICI (P&L) 2024 - VERSIONE FAST
=============================================================

Analizza AGGREGATI dei conti economici 2024 (molto più veloce).

Output: RICONCILIAZIONE-PL-2024.xlsx
"""

import xmlrpc.client
from datetime import datetime
import pandas as pd
from collections import defaultdict
import sys

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Range conti economici
ACCOUNT_RANGES = {
    'Ricavi': (3000, 3999),
    'Costo del Venduto': (4000, 4999),
    'Spese Operative': (5000, 5999),
    'Spese Personale': (6000, 6999),
    'Proventi/Oneri Finanziari': (7000, 7999),
    'Proventi/Oneri Straordinari': (8000, 8999)
}

class OdooAnalyzer:
    def __init__(self):
        print(f"\n{'='*80}")
        print("RICONCILIAZIONE CONTI ECONOMICI (P&L) 2024 - FAST")
        print(f"{'='*80}\n")

        print("Connessione a Odoo...")
        self.common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        self.uid = self.common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})

        if not self.uid:
            raise Exception("Autenticazione fallita!")

        print(f"Connesso! UID: {self.uid}\n")

        self.accounts_summary = []
        self.monthly_data = []

    def execute(self, model, method, *args, **kwargs):
        """Esegue chiamata Odoo con retry"""
        try:
            return self.models.execute_kw(
                ODOO_DB, self.uid, ODOO_PASSWORD,
                model, method, args, kwargs
            )
        except Exception as e:
            print(f"ERRORE {model}.{method}: {e}")
            return None

    def get_accounts_in_range(self, min_code, max_code):
        """Recupera conti in range"""
        accounts = self.execute('account.account', 'search_read',
            [('code', '>=', str(min_code)), ('code', '<=', str(max_code))],
            fields=['id', 'code', 'name', 'account_type']
        )
        return accounts or []

    def get_account_balance_2024(self, account_id):
        """Recupera saldo aggregato 2024 per conto (VELOCE!)"""
        # Usa read_group per aggregare (molto più veloce di scaricare tutti i movimenti)
        result = self.execute('account.move.line', 'read_group',
            [
                ('account_id', '=', account_id),
                ('date', '>=', '2024-01-01'),
                ('date', '<=', '2024-12-31'),
                ('parent_state', '=', 'posted')
            ],
            fields=['debit', 'credit', 'balance'],
            groupby=[]
        )

        if result and len(result) > 0:
            return {
                'debit': result[0].get('debit', 0),
                'credit': result[0].get('credit', 0),
                'balance': result[0].get('balance', 0),
                'count': result[0].get('__count', 0)
            }
        return {'debit': 0, 'credit': 0, 'balance': 0, 'count': 0}

    def get_monthly_balances(self, account_id):
        """Recupera saldi mensili 2024 per conto"""
        months_data = []

        for month in range(1, 13):
            if month == 12:
                date_from = f'2024-{month:02d}-01'
                date_to = '2024-12-31'
            else:
                date_from = f'2024-{month:02d}-01'
                next_month = month + 1
                date_to = f'2024-{next_month:02d}-01'

            result = self.execute('account.move.line', 'read_group',
                [
                    ('account_id', '=', account_id),
                    ('date', '>=', date_from),
                    ('date', '<', date_to),
                    ('parent_state', '=', 'posted')
                ],
                fields=['debit', 'credit', 'balance'],
                groupby=[]
            )

            if result and len(result) > 0:
                months_data.append({
                    'month': f'2024-{month:02d}',
                    'debit': result[0].get('debit', 0),
                    'credit': result[0].get('credit', 0),
                    'balance': result[0].get('balance', 0)
                })
            else:
                months_data.append({
                    'month': f'2024-{month:02d}',
                    'debit': 0,
                    'credit': 0,
                    'balance': 0
                })

        return months_data

    def analyze_account_fast(self, account, category):
        """Analizza conto (versione veloce)"""
        account_code = account['code']
        account_name = account['name']
        account_id = account['id']

        print(f"  {account_code} - {account_name}")

        # Recupera saldo totale 2024
        balance_2024 = self.get_account_balance_2024(account_id)

        # Recupera saldi mensili
        monthly = self.get_monthly_balances(account_id)

        # Salva summary
        self.accounts_summary.append({
            'Categoria': category,
            'Codice': account_code,
            'Nome': account_name,
            'Tipo': account.get('account_type', ''),
            'Dare': balance_2024['debit'],
            'Avere': balance_2024['credit'],
            'Saldo': balance_2024['balance'],
            'N. Movimenti': balance_2024['count']
        })

        # Salva monthly
        for m in monthly:
            self.monthly_data.append({
                'Categoria': category,
                'Codice': account_code,
                'Nome': account_name,
                'Mese': m['month'],
                'Dare': m['debit'],
                'Avere': m['credit'],
                'Saldo': m['balance']
            })

    def analyze_all_accounts(self):
        """Analizza tutti i conti economici"""
        print(f"\n{'='*80}")
        print("ESTRAZIONE DATI CONTI ECONOMICI (versione veloce)")
        print(f"{'='*80}\n")

        for category, (min_code, max_code) in ACCOUNT_RANGES.items():
            print(f"\n{category} ({min_code}-{max_code})")
            print("-" * 60)

            accounts = self.get_accounts_in_range(min_code, max_code)
            print(f"Trovati {len(accounts)} conti")

            for account in accounts:
                self.analyze_account_fast(account, category)

        print(f"\n\nTotale conti analizzati: {len(self.accounts_summary)}")

    def calculate_kpis(self):
        """Calcola KPI finanziari"""
        print(f"\n{'='*80}")
        print("CALCOLO KPI FINANZIARI")
        print(f"{'='*80}\n")

        df = pd.DataFrame(self.accounts_summary)

        kpis = {}
        for category in ACCOUNT_RANGES.keys():
            cat_data = df[df['Categoria'] == category]
            total_debit = cat_data['Dare'].sum()
            total_credit = cat_data['Avere'].sum()
            balance = cat_data['Saldo'].sum()

            kpis[category] = {
                'total_debit': total_debit,
                'total_credit': total_credit,
                'balance': balance
            }

            print(f"{category:30} | Dare: {total_debit:>15,.2f} | Avere: {total_credit:>15,.2f} | Saldo: {balance:>15,.2f}")

        # Margini
        ricavi = kpis.get('Ricavi', {}).get('balance', 0)
        cogs = kpis.get('Costo del Venduto', {}).get('balance', 0)
        gross_margin = ricavi + cogs
        gross_margin_pct = (gross_margin / ricavi * 100) if ricavi else 0

        print(f"\n{'='*60}")
        print(f"GROSS MARGIN: {gross_margin:,.2f} EUR ({gross_margin_pct:.1f}%)")
        print(f"{'='*60}")

        return kpis

    def generate_excel_report(self):
        """Genera report Excel"""
        print(f"\n{'='*80}")
        print("GENERAZIONE REPORT EXCEL")
        print(f"{'='*80}\n")

        filename = "RICONCILIAZIONE-PL-2024.xlsx"
        writer = pd.ExcelWriter(filename, engine='xlsxwriter')
        workbook = writer.book

        # Formati
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1
        })

        currency_format = workbook.add_format({'num_format': '#,##0.00'})

        # 1. SUMMARY
        print("Foglio SUMMARY...")
        df_summary = pd.DataFrame(self.accounts_summary)
        df_summary.to_excel(writer, sheet_name='SUMMARY', index=False)

        worksheet = writer.sheets['SUMMARY']
        worksheet.set_column('A:A', 15)
        worksheet.set_column('B:B', 12)
        worksheet.set_column('C:C', 40)
        worksheet.set_column('D:D', 20)
        worksheet.set_column('E:H', 15)

        for row_num in range(1, len(df_summary) + 1):
            worksheet.write(row_num, 4, df_summary.iloc[row_num - 1]['Dare'], currency_format)
            worksheet.write(row_num, 5, df_summary.iloc[row_num - 1]['Avere'], currency_format)
            worksheet.write(row_num, 6, df_summary.iloc[row_num - 1]['Saldo'], currency_format)

        # 2. MENSILE
        print("Foglio MENSILE...")
        df_monthly = pd.DataFrame(self.monthly_data)
        df_monthly.to_excel(writer, sheet_name='MENSILE', index=False)

        worksheet = writer.sheets['MENSILE']
        worksheet.set_column('A:A', 20)
        worksheet.set_column('B:B', 12)
        worksheet.set_column('C:C', 40)
        worksheet.set_column('D:D', 12)
        worksheet.set_column('E:G', 15)

        # 3. KPI
        print("Foglio KPI...")
        kpis = self.calculate_kpis()

        kpi_data = []
        for category, values in kpis.items():
            kpi_data.append({
                'Categoria': category,
                'Dare Totale': values['total_debit'],
                'Avere Totale': values['total_credit'],
                'Saldo': values['balance']
            })

        df_kpi = pd.DataFrame(kpi_data)
        df_kpi.to_excel(writer, sheet_name='KPI', index=False)

        worksheet = writer.sheets['KPI']
        worksheet.set_column('A:A', 30)
        worksheet.set_column('B:D', 20)

        # Aggiungi margini
        ricavi = kpis.get('Ricavi', {}).get('balance', 0)
        cogs = kpis.get('Costo del Venduto', {}).get('balance', 0)
        gross_margin = ricavi + cogs
        gross_margin_pct = (gross_margin / ricavi * 100) if ricavi else 0

        row = len(df_kpi) + 3
        worksheet.write(row, 0, 'GROSS MARGIN', header_format)
        worksheet.write(row, 3, gross_margin, currency_format)
        worksheet.write(row + 1, 0, 'GROSS MARGIN %', header_format)
        worksheet.write(row + 1, 3, gross_margin_pct / 100, workbook.add_format({'num_format': '0.0%'}))

        # 4. PIVOT MENSILE PER CATEGORIA
        print("Foglio PIVOT MENSILE...")
        if not df_monthly.empty:
            pivot = df_monthly.pivot_table(
                index='Mese',
                columns='Categoria',
                values='Saldo',
                aggfunc='sum',
                fill_value=0
            )
            pivot.to_excel(writer, sheet_name='PIVOT MENSILE')

        writer.close()

        print(f"\nReport salvato: {filename}")
        return filename

def main():
    try:
        analyzer = OdooAnalyzer()

        # Analizza
        analyzer.analyze_all_accounts()

        # Genera report
        filename = analyzer.generate_excel_report()

        print(f"\n{'='*80}")
        print("RICONCILIAZIONE COMPLETATA!")
        print(f"{'='*80}")
        print(f"\nReport: {filename}")
        print(f"Conti analizzati: {len(analyzer.accounts_summary)}")

        return 0

    except Exception as e:
        print(f"\n\nERRORE FATALE: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
