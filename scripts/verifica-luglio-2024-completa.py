#!/usr/bin/env python3
"""
VERIFICA COMPLETA LUGLIO 2024 - Riga per Riga
==============================================

Analizza tutti i movimenti bancari di luglio 2024 per:
- Konto 1024 (UBS CHF)
- Konto 1025 (UBS EUR)
- Konto 1026 (Credit Suisse CHF)

Produce report dettagliato JSON con:
- Tutti i movimenti riga per riga
- Controlli di riconciliazione
- Anomalie e duplicati
- Saldi calcolati vs saldi bancari
"""

import xmlrpc.client
import os
import json
from datetime import datetime
from collections import defaultdict
from decimal import Decimal
from dotenv import load_dotenv

# Carica .env.odoo.production
load_dotenv('.env.odoo.production')

# Odoo credentials
ODOO_URL = os.getenv('ODOO_URL', 'https://erp.alpenpur.ch')
ODOO_DB = os.getenv('ODOO_DB', 'alpenpur')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_PASSWORD = os.getenv('ODOO_PASSWORD')

# Konti bancari
ACCOUNTS = {
    '1024': {'name': 'UBS CHF', 'code': '1024', 'currency': 'CHF'},
    '1025': {'name': 'UBS EUR', 'code': '1025', 'currency': 'EUR'},
    '1026': {'name': 'Credit Suisse CHF', 'code': '1026', 'currency': 'CHF'}
}

# Periodo
START_DATE = '2024-07-01'
END_DATE = '2024-07-31'

class OdooClient:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
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
        print(f"Connesso come UID: {self.uid}")
        return True

    def search_read(self, model, domain, fields, limit=None):
        """Search and read records"""
        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit

        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain],
            kwargs
        )

def get_account_id(client, account_code):
    """Recupera account_id dal codice"""
    accounts = client.search_read(
        'account.account',
        [('code', '=', account_code)],
        ['id', 'name', 'code']
    )

    if accounts:
        return accounts[0]['id']
    return None

def get_opening_balance(client, account_id, date):
    """Calcola saldo di apertura alla data specificata"""
    # Tutti i movimenti PRIMA della data
    moves = client.search_read(
        'account.move.line',
        [
            ('account_id', '=', account_id),
            ('date', '<', date),
            ('parent_state', '=', 'posted')
        ],
        ['debit', 'credit']
    )

    balance = sum(float(m['debit']) - float(m['credit']) for m in moves)
    return balance

def get_month_movements(client, account_id, start_date, end_date):
    """Recupera tutti i movimenti del mese"""
    moves = client.search_read(
        'account.move.line',
        [
            ('account_id', '=', account_id),
            ('date', '>=', start_date),
            ('date', '<=', end_date),
            ('parent_state', '=', 'posted')
        ],
        [
            'id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
            'move_id', 'partner_id', 'journal_id', 'payment_id'
        ],
        limit=10000
    )

    # Ordina per data
    moves.sort(key=lambda x: (x['date'], x['id']))
    return moves

def analyze_movement(move):
    """Analizza singolo movimento per anomalie"""
    issues = []

    debit = float(move['debit'])
    credit = float(move['credit'])

    # Check 1: Movimento senza importo
    if debit == 0 and credit == 0:
        issues.append("ZERO_AMOUNT")

    # Check 2: Movimento con sia debit che credit (anomalo)
    if debit > 0 and credit > 0:
        issues.append("BOTH_DEBIT_CREDIT")

    # Check 3: Importi molto alti (>100K)
    if debit > 100000 or credit > 100000:
        issues.append("HIGH_AMOUNT")

    # Check 4: Descrizione mancante
    if not move.get('name') or move['name'] == '/':
        issues.append("MISSING_DESCRIPTION")

    # Check 5: Partner mancante
    if not move.get('partner_id'):
        issues.append("NO_PARTNER")

    return issues

def find_duplicates(movements):
    """Trova possibili duplicati"""
    duplicates = []

    # Raggruppa per data e importo
    by_date_amount = defaultdict(list)
    for move in movements:
        key = (
            move['date'],
            float(move['debit']),
            float(move['credit'])
        )
        by_date_amount[key].append(move)

    # Trova gruppi con più movimenti
    for key, moves in by_date_amount.items():
        if len(moves) > 1:
            duplicates.append({
                'date': key[0],
                'debit': key[1],
                'credit': key[2],
                'count': len(moves),
                'move_ids': [m['id'] for m in moves],
                'descriptions': [m['name'] for m in moves]
            })

    return duplicates

def calculate_running_balance(opening, movements):
    """Calcola saldo progressivo"""
    balance = opening
    results = []

    for move in movements:
        debit = float(move['debit'])
        credit = float(move['credit'])

        balance += debit - credit

        results.append({
            'id': move['id'],
            'date': move['date'],
            'description': move['name'],
            'ref': move.get('ref', ''),
            'debit': debit,
            'credit': credit,
            'net': debit - credit,
            'balance': balance,
            'move_id': move['move_id'][0] if move['move_id'] else None,
            'partner': move['partner_id'][1] if move['partner_id'] else None,
            'journal': move['journal_id'][1] if move['journal_id'] else None,
            'issues': analyze_movement(move)
        })

    return results, balance

def analyze_account(client, account_code, account_name):
    """Analizza completo un conto bancario"""
    print(f"\n{'='*80}")
    print(f"Analisi {account_name} ({account_code}) - Luglio 2024")
    print(f"{'='*80}")

    # Get account ID
    account_id = get_account_id(client, account_code)
    if not account_id:
        return {
            'error': f'Account {account_code} non trovato',
            'account_code': account_code,
            'account_name': account_name
        }

    print(f"Account ID: {account_id}")

    # Saldo apertura (30/06/2024)
    opening_balance = get_opening_balance(client, account_id, START_DATE)
    print(f"Saldo apertura 01/07/2024: {opening_balance:,.2f}")

    # Movimenti luglio
    movements = get_month_movements(client, account_id, START_DATE, END_DATE)
    print(f"Movimenti trovati: {len(movements)}")

    # Calcola saldo progressivo
    detailed_movements, closing_balance = calculate_running_balance(
        opening_balance, movements
    )

    print(f"Saldo chiusura calcolato: {closing_balance:,.2f}")

    # Trova duplicati
    duplicates = find_duplicates(movements)
    if duplicates:
        print(f"Possibili duplicati trovati: {len(duplicates)}")

    # Statistiche
    total_debit = sum(float(m['debit']) for m in movements)
    total_credit = sum(float(m['credit']) for m in movements)
    net_change = total_debit - total_credit

    print(f"Totale entrate: {total_debit:,.2f}")
    print(f"Totale uscite: {total_credit:,.2f}")
    print(f"Variazione netta: {net_change:,.2f}")

    # Conta anomalie
    all_issues = defaultdict(int)
    for move in detailed_movements:
        for issue in move['issues']:
            all_issues[issue] += 1

    if all_issues:
        print(f"\nAnomalie trovate:")
        for issue, count in sorted(all_issues.items()):
            print(f"   - {issue}: {count}")

    return {
        'account_code': account_code,
        'account_name': account_name,
        'account_id': account_id,
        'currency': ACCOUNTS[account_code]['currency'],
        'period': {
            'start': START_DATE,
            'end': END_DATE
        },
        'balances': {
            'opening': opening_balance,
            'closing_calculated': closing_balance,
            'net_change': net_change
        },
        'statistics': {
            'total_movements': len(movements),
            'total_debit': total_debit,
            'total_credit': total_credit,
            'avg_debit': total_debit / len([m for m in movements if m['debit'] > 0]) if any(m['debit'] > 0 for m in movements) else 0,
            'avg_credit': total_credit / len([m for m in movements if m['credit'] > 0]) if any(m['credit'] > 0 for m in movements) else 0
        },
        'movements': detailed_movements,
        'duplicates': duplicates,
        'issues_summary': dict(all_issues)
    }

def compare_with_bank_statements(results):
    """Confronta con saldi bancari attesi"""
    # Saldi attesi da file JSON
    expected_balances = {
        '1024': 345760.44,  # UBS CHF luglio 2024
        '1025': 14702.54,   # UBS EUR luglio 2024
        '1026': None        # Non abbiamo dettaglio mensile Credit Suisse
    }

    comparison = {}

    for account_code, expected in expected_balances.items():
        if account_code in results and not results[account_code].get('error'):
            calculated = results[account_code]['balances']['closing_calculated']

            if expected is not None:
                difference = calculated - expected
                match = abs(difference) < 0.01

                comparison[account_code] = {
                    'calculated': calculated,
                    'expected': expected,
                    'difference': difference,
                    'match': match,
                    'status': 'OK' if match else f'DIFFERENZA: {difference:,.2f}'
                }
            else:
                comparison[account_code] = {
                    'calculated': calculated,
                    'expected': 'N/A',
                    'difference': None,
                    'match': None,
                    'status': 'Saldo bancario non disponibile'
                }

    return comparison

def main():
    print("="*80)
    print("VERIFICA COMPLETA LUGLIO 2024 - Riga per Riga")
    print("="*80)
    print(f"Periodo: {START_DATE} - {END_DATE}")
    print(f"Data analisi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")

    # Connect to Odoo
    client = OdooClient()
    client.connect()

    # Analizza ogni conto
    results = {}
    for account_code, account_info in ACCOUNTS.items():
        try:
            results[account_code] = analyze_account(
                client,
                account_code,
                account_info['name']
            )
        except Exception as e:
            print(f"❌ Errore analizzando {account_code}: {e}")
            results[account_code] = {
                'error': str(e),
                'account_code': account_code
            }

    # Confronta con saldi bancari
    print(f"\n{'='*80}")
    print("CONFRONTO CON SALDI BANCARI")
    print(f"{'='*80}")

    comparison = compare_with_bank_statements(results)

    for account_code, comp in comparison.items():
        print(f"\n{ACCOUNTS[account_code]['name']} ({account_code}):")
        print(f"  Calcolato Odoo: {comp['calculated']:>15,.2f}")
        print(f"  Atteso Banca:   {str(comp['expected']):>15}")
        print(f"  Status: {comp['status']}")

    # Crea report finale
    report = {
        'metadata': {
            'analysis_date': datetime.now().isoformat(),
            'period_start': START_DATE,
            'period_end': END_DATE,
            'accounts_analyzed': list(ACCOUNTS.keys())
        },
        'results': results,
        'comparison': comparison,
        'summary': {
            'total_accounts': len(results),
            'total_movements': sum(
                r.get('statistics', {}).get('total_movements', 0)
                for r in results.values()
                if not r.get('error')
            ),
            'total_duplicates': sum(
                len(r.get('duplicates', []))
                for r in results.values()
                if not r.get('error')
            ),
            'total_issues': sum(
                sum(r.get('issues_summary', {}).values())
                for r in results.values()
                if not r.get('error')
            ),
            'accounts_matching': sum(
                1 for c in comparison.values()
                if c.get('match') is True
            ),
            'accounts_with_differences': sum(
                1 for c in comparison.values()
                if c.get('match') is False
            )
        }
    }

    # Salva report
    output_file = 'c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\REPORT-LUGLIO-2024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n{'='*80}")
    print(f"Report salvato: {output_file}")
    print(f"{'='*80}")

    # Summary finale
    print(f"\nRIEPILOGO FINALE:")
    print(f"   - Conti analizzati: {report['summary']['total_accounts']}")
    print(f"   - Movimenti totali: {report['summary']['total_movements']}")
    print(f"   - Duplicati trovati: {report['summary']['total_duplicates']}")
    print(f"   - Anomalie totali: {report['summary']['total_issues']}")
    print(f"   - Conti riconciliati: {report['summary']['accounts_matching']}/{len(comparison)}")

    if report['summary']['accounts_with_differences'] > 0:
        print(f"\nATTENZIONE: {report['summary']['accounts_with_differences']} conti con differenze!")
    else:
        print(f"\nTutti i conti riconciliati correttamente!")

    return report

if __name__ == '__main__':
    main()
