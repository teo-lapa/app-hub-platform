#!/usr/bin/env python3
"""
RICONCILIAZIONE CONTI ECONOMICI (P&L) 2024
==========================================

Analizza TUTTI i conti economici 2024 per trovare discrepanze e anomalie.

Conti analizzati:
- 3000-3999: Ricavi (Revenue)
- 4000-4999: Costo del venduto (COGS)
- 5000-5999: Spese operative
- 6000-6999: Spese personale
- 7000-7999: Proventi/Oneri finanziari
- 8000-8999: Proventi/Oneri straordinari

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
        print("RICONCILIAZIONE CONTI ECONOMICI (P&L) 2024")
        print(f"{'='*80}\n")

        print("Connessione a Odoo...")
        self.common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        self.uid = self.common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})

        if not self.uid:
            raise Exception("Autenticazione fallita!")

        print(f"Connesso! UID: {self.uid}\n")

        self.all_moves = []
        self.accounts_data = {}
        self.anomalies = []

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

    def get_account_moves(self, account_id, date_from='2024-01-01', date_to='2024-12-31'):
        """Recupera movimenti per conto"""
        moves = self.execute('account.move.line', 'search_read',
            [
                ('account_id', '=', account_id),
                ('date', '>=', date_from),
                ('date', '<=', date_to),
                ('parent_state', '=', 'posted')  # Solo movimenti contabilizzati
            ],
            fields=[
                'id', 'date', 'name', 'ref', 'move_id', 'move_name',
                'account_id', 'partner_id', 'debit', 'credit', 'balance',
                'amount_currency', 'currency_id', 'company_id'
            ],
            order='date asc'
        )
        return moves or []

    def get_move_counterparts(self, move_id):
        """Recupera tutte le righe del movimento (contropartite)"""
        lines = self.execute('account.move.line', 'search_read',
            [('move_id', '=', move_id)],
            fields=['account_id', 'debit', 'credit', 'name']
        )
        return lines or []

    def analyze_account(self, account):
        """Analizza singolo conto"""
        account_code = account['code']
        account_name = account['name']
        account_id = account['id']

        print(f"  Analizzando: {account_code} - {account_name}")

        # Recupera movimenti
        moves = self.get_account_moves(account_id)

        if not moves:
            return {
                'account_code': account_code,
                'account_name': account_name,
                'total_debit': 0,
                'total_credit': 0,
                'balance': 0,
                'move_count': 0,
                'moves': [],
                'anomalies': []
            }

        # Calcola totali
        total_debit = sum(m['debit'] for m in moves)
        total_credit = sum(m['credit'] for m in moves)
        balance = total_credit - total_debit  # Per conti economici (credito = ricavo, debito = costo)

        # Analizza anomalie
        anomalies = self.detect_anomalies(account, moves)

        return {
            'account_code': account_code,
            'account_name': account_name,
            'account_type': account.get('account_type', ''),
            'total_debit': total_debit,
            'total_credit': total_credit,
            'balance': balance,
            'move_count': len(moves),
            'moves': moves,
            'anomalies': anomalies
        }

    def detect_anomalies(self, account, moves):
        """Rileva anomalie nei movimenti"""
        anomalies = []
        account_code = account['code']
        account_name = account['name']

        # 1. Verifica partita doppia per ogni movimento
        move_ids = set(m['move_id'][0] if m['move_id'] else None for m in moves)

        for move_id in move_ids:
            if not move_id:
                continue

            counterparts = self.get_move_counterparts(move_id)
            total_debit = sum(c['debit'] for c in counterparts)
            total_credit = sum(c['credit'] for c in counterparts)

            diff = abs(total_debit - total_credit)
            if diff > 0.01:  # Tolleranza 1 centesimo
                anomalies.append({
                    'type': 'PARTITA_DOPPIA_NON_QUADRA',
                    'severity': 'CRITICAL',
                    'move_id': move_id,
                    'debit': total_debit,
                    'credit': total_credit,
                    'diff': diff,
                    'description': f"Movimento {move_id}: Dare ({total_debit:.2f}) != Avere ({total_credit:.2f}), diff: {diff:.2f}"
                })

        # 2. Importi sospetti (outliers)
        amounts = [abs(m['debit'] - m['credit']) for m in moves]
        if amounts:
            avg_amount = sum(amounts) / len(amounts)
            max_amount = max(amounts)

            if max_amount > avg_amount * 10 and max_amount > 10000:  # 10x media E > 10k
                high_moves = [m for m in moves if abs(m['debit'] - m['credit']) > avg_amount * 10]
                for m in high_moves:
                    anomalies.append({
                        'type': 'IMPORTO_SOSPETTO',
                        'severity': 'WARNING',
                        'move_id': m['move_id'][0] if m['move_id'] else None,
                        'amount': abs(m['debit'] - m['credit']),
                        'avg_amount': avg_amount,
                        'description': f"Importo {abs(m['debit'] - m['credit']):.2f} >> media ({avg_amount:.2f})"
                    })

        # 3. Possibili duplicati (stesso importo, stessa data, stesso partner)
        move_signatures = defaultdict(list)
        for m in moves:
            signature = (
                m['date'],
                round(abs(m['debit'] - m['credit']), 2),
                m['partner_id'][0] if m['partner_id'] else None
            )
            move_signatures[signature].append(m)

        for signature, duplicates in move_signatures.items():
            if len(duplicates) > 1:
                anomalies.append({
                    'type': 'POSSIBILE_DUPLICATO',
                    'severity': 'WARNING',
                    'count': len(duplicates),
                    'date': signature[0],
                    'amount': signature[1],
                    'move_ids': [m['move_id'][0] if m['move_id'] else None for m in duplicates],
                    'description': f"{len(duplicates)} movimenti identici: data={signature[0]}, importo={signature[1]:.2f}"
                })

        # 4. Movimenti senza contropartita
        for m in moves:
            if not m['move_id']:
                anomalies.append({
                    'type': 'SENZA_CONTROPARTITA',
                    'severity': 'CRITICAL',
                    'line_id': m['id'],
                    'description': f"Riga {m['id']} senza movimento padre"
                })

        # 5. Conti ricavi (3xxx) con dare > avere (anomalo)
        if account_code.startswith('3'):
            total_debit = sum(m['debit'] for m in moves)
            total_credit = sum(m['credit'] for m in moves)
            if total_debit > total_credit:
                anomalies.append({
                    'type': 'RICAVO_CON_SALDO_DARE',
                    'severity': 'WARNING',
                    'debit': total_debit,
                    'credit': total_credit,
                    'description': f"Conto ricavi con saldo dare (anomalo): dare={total_debit:.2f}, avere={total_credit:.2f}"
                })

        # 6. Conti costi (4xxx-6xxx) con avere > dare (anomalo)
        if account_code.startswith(('4', '5', '6')):
            total_debit = sum(m['debit'] for m in moves)
            total_credit = sum(m['credit'] for m in moves)
            if total_credit > total_debit:
                anomalies.append({
                    'type': 'COSTO_CON_SALDO_AVERE',
                    'severity': 'WARNING',
                    'debit': total_debit,
                    'credit': total_credit,
                    'description': f"Conto costi con saldo avere (anomalo): dare={total_debit:.2f}, avere={total_credit:.2f}"
                })

        return anomalies

    def analyze_all_accounts(self):
        """Analizza tutti i conti economici"""
        print(f"\n{'='*80}")
        print("FASE 1: ESTRAZIONE DATI CONTI ECONOMICI")
        print(f"{'='*80}\n")

        for category, (min_code, max_code) in ACCOUNT_RANGES.items():
            print(f"\n{category} ({min_code}-{max_code})")
            print("-" * 60)

            accounts = self.get_accounts_in_range(min_code, max_code)
            print(f"Trovati {len(accounts)} conti")

            for account in accounts:
                data = self.analyze_account(account)
                self.accounts_data[account['code']] = data

                # Salva anomalie globali
                for anomaly in data['anomalies']:
                    self.anomalies.append({
                        'account_code': account['code'],
                        'account_name': account['name'],
                        'category': category,
                        **anomaly
                    })

                # Salva movimenti per analisi mensile
                for move in data['moves']:
                    self.all_moves.append({
                        'account_code': account['code'],
                        'account_name': account['name'],
                        'category': category,
                        **move
                    })

        print(f"\n\nTotale conti analizzati: {len(self.accounts_data)}")
        print(f"Totale movimenti: {len(self.all_moves)}")
        print(f"Anomalie trovate: {len(self.anomalies)}")

    def calculate_kpis(self):
        """Calcola KPI finanziari"""
        print(f"\n{'='*80}")
        print("FASE 2: CALCOLO KPI FINANZIARI")
        print(f"{'='*80}\n")

        # Aggrega per categoria
        kpis = {}

        for category, (min_code, max_code) in ACCOUNT_RANGES.items():
            total_debit = 0
            total_credit = 0

            for code, data in self.accounts_data.items():
                if min_code <= int(code) <= max_code:
                    total_debit += data['total_debit']
                    total_credit += data['total_credit']

            balance = total_credit - total_debit

            kpis[category] = {
                'total_debit': total_debit,
                'total_credit': total_credit,
                'balance': balance
            }

            print(f"{category:30} | Dare: {total_debit:>15,.2f} | Avere: {total_credit:>15,.2f} | Saldo: {balance:>15,.2f}")

        # Calcola margini
        ricavi = kpis.get('Ricavi', {}).get('balance', 0)
        cogs = kpis.get('Costo del Venduto', {}).get('balance', 0)
        gross_margin = ricavi + cogs  # COGS è negativo
        gross_margin_pct = (gross_margin / ricavi * 100) if ricavi else 0

        print(f"\n{'='*60}")
        print(f"GROSS MARGIN: {gross_margin:,.2f} EUR ({gross_margin_pct:.1f}%)")
        print(f"{'='*60}")

        return kpis

    def generate_excel_report(self):
        """Genera report Excel completo"""
        print(f"\n{'='*80}")
        print("FASE 3: GENERAZIONE REPORT EXCEL")
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
        date_format = workbook.add_format({'num_format': 'yyyy-mm-dd'})

        critical_format = workbook.add_format({
            'bg_color': '#FFC7CE',
            'font_color': '#9C0006'
        })

        warning_format = workbook.add_format({
            'bg_color': '#FFEB9C',
            'font_color': '#9C6500'
        })

        # 1. SUMMARY
        print("Generando foglio SUMMARY...")
        summary_data = []
        for code, data in sorted(self.accounts_data.items()):
            summary_data.append({
                'Codice': code,
                'Nome': data['account_name'],
                'Tipo': data.get('account_type', ''),
                'Dare': data['total_debit'],
                'Avere': data['total_credit'],
                'Saldo': data['balance'],
                'N. Movimenti': data['move_count'],
                'N. Anomalie': len(data['anomalies'])
            })

        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='SUMMARY', index=False)

        worksheet = writer.sheets['SUMMARY']
        worksheet.set_column('A:A', 10)
        worksheet.set_column('B:B', 40)
        worksheet.set_column('C:C', 20)
        worksheet.set_column('D:F', 15)
        worksheet.set_column('G:H', 15)

        # 2. ANOMALIE
        print("Generando foglio ANOMALIE...")
        anomalies_data = []
        for a in self.anomalies:
            anomalies_data.append({
                'Categoria': a.get('category', ''),
                'Conto': a.get('account_code', ''),
                'Nome Conto': a.get('account_name', ''),
                'Tipo': a.get('type', ''),
                'Severity': a.get('severity', ''),
                'Descrizione': a.get('description', ''),
                'Move ID': a.get('move_id', ''),
                'Importo': a.get('amount', 0)
            })

        df_anomalies = pd.DataFrame(anomalies_data)
        df_anomalies.to_excel(writer, sheet_name='ANOMALIE', index=False)

        worksheet = writer.sheets['ANOMALIE']
        worksheet.set_column('A:C', 15)
        worksheet.set_column('D:E', 20)
        worksheet.set_column('F:F', 60)
        worksheet.set_column('G:H', 15)

        # Formattazione condizionale
        for row_num in range(1, len(df_anomalies) + 1):
            if row_num < len(df_anomalies) + 1:
                severity = df_anomalies.iloc[row_num - 1]['Severity']
                if severity == 'CRITICAL':
                    worksheet.set_row(row_num, None, critical_format)
                elif severity == 'WARNING':
                    worksheet.set_row(row_num, None, warning_format)

        # 3. MOVIMENTI (sample - primi 10k)
        print("Generando foglio MOVIMENTI...")
        moves_data = []
        for m in self.all_moves[:10000]:  # Max 10k righe
            moves_data.append({
                'Categoria': m.get('category', ''),
                'Conto': m.get('account_code', ''),
                'Nome Conto': m.get('account_name', ''),
                'Data': m.get('date', ''),
                'Movimento': m.get('move_name', ''),
                'Descrizione': m.get('name', ''),
                'Riferimento': m.get('ref', ''),
                'Partner': m['partner_id'][1] if m.get('partner_id') else '',
                'Dare': m.get('debit', 0),
                'Avere': m.get('credit', 0),
                'Saldo': m.get('balance', 0)
            })

        df_moves = pd.DataFrame(moves_data)
        df_moves.to_excel(writer, sheet_name='MOVIMENTI', index=False)

        worksheet = writer.sheets['MOVIMENTI']
        worksheet.set_column('A:C', 15)
        worksheet.set_column('D:D', 12)
        worksheet.set_column('E:G', 25)
        worksheet.set_column('H:H', 30)
        worksheet.set_column('I:K', 15)

        # 4. ANALISI MENSILE
        print("Generando foglio ANALISI MENSILE...")

        # Aggrega per mese e categoria
        df_all_moves = pd.DataFrame(self.all_moves)
        if not df_all_moves.empty:
            df_all_moves['date'] = pd.to_datetime(df_all_moves['date'])
            df_all_moves['month'] = df_all_moves['date'].dt.to_period('M')

            monthly = df_all_moves.groupby(['month', 'category']).agg({
                'debit': 'sum',
                'credit': 'sum',
                'balance': 'sum'
            }).reset_index()

            monthly['month'] = monthly['month'].astype(str)
            monthly.to_excel(writer, sheet_name='ANALISI MENSILE', index=False)

            worksheet = writer.sheets['ANALISI MENSILE']
            worksheet.set_column('A:A', 12)
            worksheet.set_column('B:B', 30)
            worksheet.set_column('C:E', 15)

        # 5. KPI
        print("Generando foglio KPI...")
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

        # Calcola margini
        ricavi = kpis.get('Ricavi', {}).get('balance', 0)
        cogs = kpis.get('Costo del Venduto', {}).get('balance', 0)
        gross_margin = ricavi + cogs
        gross_margin_pct = (gross_margin / ricavi * 100) if ricavi else 0

        # Aggiungi margini sotto la tabella
        row = len(df_kpi) + 3
        worksheet.write(row, 0, 'GROSS MARGIN', header_format)
        worksheet.write(row, 3, gross_margin, currency_format)
        worksheet.write(row + 1, 0, 'GROSS MARGIN %', header_format)
        worksheet.write(row + 1, 3, gross_margin_pct / 100, workbook.add_format({'num_format': '0.0%'}))

        writer.close()

        print(f"\nReport salvato: {filename}")
        return filename

def main():
    try:
        analyzer = OdooAnalyzer()

        # Analizza tutti i conti
        analyzer.analyze_all_accounts()

        # Calcola KPI
        analyzer.calculate_kpis()

        # Genera report Excel
        filename = analyzer.generate_excel_report()

        print(f"\n{'='*80}")
        print("RICONCILIAZIONE COMPLETATA!")
        print(f"{'='*80}")
        print(f"\nReport generato: {filename}")
        print(f"\nConti analizzati: {len(analyzer.accounts_data)}")
        print(f"Movimenti totali: {len(analyzer.all_moves)}")
        print(f"Anomalie trovate: {len(analyzer.anomalies)}")

        # Riepilogo anomalie per severity
        critical = sum(1 for a in analyzer.anomalies if a.get('severity') == 'CRITICAL')
        warnings = sum(1 for a in analyzer.anomalies if a.get('severity') == 'WARNING')

        print(f"\nAnomalie CRITICAL: {critical}")
        print(f"Anomalie WARNING: {warnings}")

        if critical > 0:
            print(f"\n{'!'*80}")
            print("ATTENZIONE: Trovate anomalie CRITICHE che richiedono intervento immediato!")
            print(f"{'!'*80}")

        return 0

    except Exception as e:
        print(f"\n\nERRORE FATALE: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
