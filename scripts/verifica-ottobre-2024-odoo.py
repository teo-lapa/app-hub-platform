#!/usr/bin/env python3
"""
VERIFICA OTTOBRE 2024 - Direct Odoo Analysis
Analizza movimenti contabili Odoo per i konti bancari 1024, 1025, 1026
Periodo: 01/10/2024 - 31/10/2024

Report: REPORT-OTTOBRE-2024.json
"""

import xmlrpc.client
import json
import os
from datetime import datetime
from decimal import Decimal
from collections import defaultdict
from typing import Dict, List
from dotenv import load_dotenv

# Fix Windows encoding
import sys
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Carica .env.local
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local')
load_dotenv(env_path)

# Configurazione Odoo
ODOO_URL = os.getenv('ODOO_URL', 'https://erp.huboapps.com')
ODOO_DB = os.getenv('ODOO_DB', 'hubo-erp-main')
ODOO_USERNAME = os.getenv('ODOO_ADMIN_EMAIL', 'admin')
ODOO_PASSWORD = os.getenv('ODOO_ADMIN_PASSWORD')

if not ODOO_PASSWORD:
    print("ERRORE: Imposta ODOO_ADMIN_PASSWORD in .env.local")
    sys.exit(1)

# Periodo
START_DATE = '2024-10-01'
END_DATE = '2024-10-31'
MONTH_NAME = 'Ottobre 2024'

# Konti da analizzare
KONTI = {
    1024: {'name': 'UBS CHF', 'currency': 'CHF'},
    1025: {'name': 'UBS EUR', 'currency': 'EUR'},
    1026: {'name': 'Credit Suisse CHF', 'currency': 'CHF'}
}

class OdooClient:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common', allow_none=True)
        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object', allow_none=True)
        self.uid = None

    def authenticate(self):
        """Autentica su Odoo"""
        print(f"Autenticazione su {self.url}...")
        self.uid = self.common.authenticate(self.db, self.username, self.password, {})
        if not self.uid:
            raise Exception("Autenticazione fallita - verifica credenziali")
        print(f"OK - Autenticato come UID {self.uid}")
        return self.uid

    def search_read(self, model, domain, fields, limit=None):
        """Search & Read records"""
        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain],
            kwargs
        )

    def get_account_by_code(self, code: int) -> Dict:
        """Trova account per codice"""
        accounts = self.search_read(
            'account.account',
            [('code', '=', str(code))],
            ['id', 'code', 'name', 'currency_id']
        )
        return accounts[0] if accounts else None

    def get_account_moves(self, account_id: int, start_date: str, end_date: str) -> List[Dict]:
        """Recupera movimenti contabili per account"""
        domain = [
            ('account_id', '=', account_id),
            ('date', '>=', start_date),
            ('date', '<=', end_date),
            ('parent_state', '=', 'posted')  # Solo registrazioni confermate
        ]

        fields = [
            'id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
            'move_id', 'partner_id', 'currency_id', 'amount_currency',
            'company_currency_id'
        ]

        return self.search_read('account.move.line', domain, fields)

    def get_balance_at_date(self, account_id: int, date: str) -> Dict:
        """Calcola saldo conto a una certa data"""
        # Tutti i movimenti fino a quella data
        domain = [
            ('account_id', '=', account_id),
            ('date', '<=', date),
            ('parent_state', '=', 'posted')
        ]

        moves = self.search_read(
            'account.move.line',
            domain,
            ['debit', 'credit']
        )

        total_debit = sum(float(m.get('debit', 0)) for m in moves)
        total_credit = sum(float(m.get('credit', 0)) for m in moves)

        return {
            'date': date,
            'debit': round(total_debit, 2),
            'credit': round(total_credit, 2),
            'balance': round(total_debit - total_credit, 2),
            'num_moves': len(moves)
        }

def analyze_konto(odoo: OdooClient, konto_code: int, konto_info: Dict) -> Dict:
    """Analizza un singolo konto"""
    print(f"\n{'=' * 80}")
    print(f"Analisi Konto {konto_code} - {konto_info['name']}")
    print(f"{'=' * 80}")

    # 1. Trova account
    account = odoo.get_account_by_code(konto_code)
    if not account:
        print(f"ERRORE - Account {konto_code} non trovato in Odoo")
        return {
            'error': f'Account {konto_code} not found',
            'konto': konto_code,
            'name': konto_info['name']
        }

    account_id = account['id']
    print(f"Account trovato: {account['name']} (ID: {account_id})")

    # 2. Saldo inizio mese (30 settembre 2024)
    saldo_inizio = odoo.get_balance_at_date(account_id, '2024-09-30')
    print(f"\nSaldo al 30/09/2024:")
    print(f"  Dare:    {konto_info['currency']} {saldo_inizio['debit']:>12,.2f}")
    print(f"  Avere:   {konto_info['currency']} {saldo_inizio['credit']:>12,.2f}")
    print(f"  Saldo:   {konto_info['currency']} {saldo_inizio['balance']:>12,.2f}")

    # 3. Movimenti ottobre
    print(f"\nRecupero movimenti ottobre 2024...")
    moves = odoo.get_account_moves(account_id, START_DATE, END_DATE)
    print(f"Trovati {len(moves)} movimenti")

    # 4. Analizza movimenti
    total_debit = sum(float(m.get('debit', 0)) for m in moves)
    total_credit = sum(float(m.get('credit', 0)) for m in moves)
    net_change = total_debit - total_credit

    # Raggruppa per giorno
    by_day = defaultdict(list)
    for move in moves:
        date = move.get('date', '')
        by_day[date].append(move)

    daily_summary = {}
    for date in sorted(by_day.keys()):
        day_moves = by_day[date]
        day_debit = sum(float(m.get('debit', 0)) for m in day_moves)
        day_credit = sum(float(m.get('credit', 0)) for m in day_moves)
        daily_summary[date] = {
            'num_moves': len(day_moves),
            'debit': round(day_debit, 2),
            'credit': round(day_credit, 2),
            'net': round(day_debit - day_credit, 2)
        }

    # 5. Saldo fine mese (31 ottobre 2024)
    saldo_fine = odoo.get_balance_at_date(account_id, END_DATE)
    print(f"\nSaldo al 31/10/2024:")
    print(f"  Dare:    {konto_info['currency']} {saldo_fine['debit']:>12,.2f}")
    print(f"  Avere:   {konto_info['currency']} {saldo_fine['credit']:>12,.2f}")
    print(f"  Saldo:   {konto_info['currency']} {saldo_fine['balance']:>12,.2f}")

    # 6. Summary
    print(f"\nMovimenti Ottobre 2024:")
    print(f"  Totale movimenti:  {len(moves)}")
    print(f"  Dare (entrate):    {konto_info['currency']} {total_debit:>12,.2f}")
    print(f"  Avere (uscite):    {konto_info['currency']} {total_credit:>12,.2f}")
    print(f"  Variazione netta:  {konto_info['currency']} {net_change:>12,.2f}")

    # Verifica coerenza
    expected_final = saldo_inizio['balance'] + net_change
    diff = abs(saldo_fine['balance'] - expected_final)

    print(f"\nVerifica coerenza:")
    print(f"  Saldo inizio:      {konto_info['currency']} {saldo_inizio['balance']:>12,.2f}")
    print(f"  + Variazione:      {konto_info['currency']} {net_change:>12,.2f}")
    print(f"  = Saldo atteso:    {konto_info['currency']} {expected_final:>12,.2f}")
    print(f"  Saldo effettivo:   {konto_info['currency']} {saldo_fine['balance']:>12,.2f}")
    print(f"  Differenza:        {konto_info['currency']} {diff:>12,.2f}")

    if diff < 0.01:
        print("  Status: OK - Tutto quadra!")
    else:
        print(f"  Status: ATTENZIONE - Differenza di {konto_info['currency']} {diff:,.2f}")

    return {
        'konto': konto_code,
        'name': konto_info['name'],
        'currency': konto_info['currency'],
        'account_id': account_id,
        'period': {
            'start_date': START_DATE,
            'end_date': END_DATE,
            'month': MONTH_NAME
        },
        'balance_start': {
            'date': '2024-09-30',
            'debit': saldo_inizio['debit'],
            'credit': saldo_inizio['credit'],
            'balance': saldo_inizio['balance']
        },
        'balance_end': {
            'date': END_DATE,
            'debit': saldo_fine['debit'],
            'credit': saldo_fine['credit'],
            'balance': saldo_fine['balance']
        },
        'october_movements': {
            'num_moves': len(moves),
            'total_debit': round(total_debit, 2),
            'total_credit': round(total_credit, 2),
            'net_change': round(net_change, 2)
        },
        'daily_summary': daily_summary,
        'verification': {
            'expected_final_balance': round(expected_final, 2),
            'actual_final_balance': saldo_fine['balance'],
            'difference': round(diff, 2),
            'status': 'OK' if diff < 0.01 else 'WARNING'
        },
        'transactions': [
            {
                'id': m['id'],
                'date': m.get('date', ''),
                'name': m.get('name', ''),
                'ref': m.get('ref', ''),
                'debit': float(m.get('debit', 0)),
                'credit': float(m.get('credit', 0)),
                'balance': float(m.get('balance', 0)),
                'partner': m.get('partner_id', [None, ''])[1] if m.get('partner_id') else '',
                'move_id': m.get('move_id', [None, ''])[1] if m.get('move_id') else ''
            }
            for m in moves
        ]
    }

def main():
    print("=" * 80)
    print("VERIFICA OTTOBRE 2024 - Analisi Odoo Diretta")
    print("=" * 80)
    print(f"Periodo: {START_DATE} -> {END_DATE}")
    print(f"Konti: {', '.join(str(k) for k in KONTI.keys())}")
    print()

    # 1. Connetti a Odoo
    print("STEP 1: Connessione a Odoo")
    print("-" * 80)
    odoo = OdooClient()
    odoo.authenticate()

    # 2. Analizza ogni konto
    print("\n\nSTEP 2: Analisi movimenti per konto")
    print("-" * 80)

    results = {}
    for konto_code, konto_info in KONTI.items():
        result = analyze_konto(odoo, konto_code, konto_info)
        results[str(konto_code)] = result

    # 3. Report finale
    print("\n\n" + "=" * 80)
    print("REPORT FINALE OTTOBRE 2024")
    print("=" * 80)

    total_moves = sum(r.get('october_movements', {}).get('num_moves', 0) for r in results.values())
    print(f"\nTotale movimenti analizzati: {total_moves}")

    print("\nSaldi al 31/10/2024:")
    for konto_code, result in results.items():
        if 'balance_end' in result:
            currency = result['currency']
            balance = result['balance_end']['balance']
            print(f"  Konto {konto_code} ({result['name']:20s}): {currency} {balance:>12,.2f}")

    # Verifica status
    warnings = [k for k, r in results.items() if r.get('verification', {}).get('status') == 'WARNING']
    if warnings:
        print(f"\nATTENZIONE - Incongruenze trovate nei konti: {', '.join(warnings)}")
    else:
        print("\nOK - Tutti i konti sono allineati!")

    # 4. Salva report
    print("\n\nSTEP 3: Salvataggio report")
    print("-" * 80)

    report = {
        'period': {
            'start_date': START_DATE,
            'end_date': END_DATE,
            'month': MONTH_NAME
        },
        'generated_at': datetime.now().isoformat(),
        'odoo_connection': {
            'url': ODOO_URL,
            'database': ODOO_DB,
            'user': ODOO_USERNAME
        },
        'konti_analyzed': list(KONTI.keys()),
        'results': results,
        'summary': {
            'total_moves': total_moves,
            'konti_with_warnings': warnings,
            'status': 'OK' if not warnings else 'WARNINGS_PRESENT'
        }
    }

    output_file = 'c:/Users/lapa/Desktop/Claude Code/app-hub-platform/REPORT-OTTOBRE-2024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"OK Report salvato: {output_file}")
    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
