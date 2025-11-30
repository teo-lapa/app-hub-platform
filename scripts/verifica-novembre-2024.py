#!/usr/bin/env python3
"""
VERIFICA NOVEMBRE 2024 - Riga per Riga
Periodo: 01/11/2024 - 30/11/2024
Konti: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)
"""

import xmlrpc.client
import os
from datetime import datetime
from collections import defaultdict
import json

# Odoo connection (DEV environment)
url = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
db = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
username = os.getenv('ODOO_ADMIN_EMAIL', 'apphubplatform@lapa.ch')
password = os.getenv('ODOO_ADMIN_PASSWORD', 'apphubplatform2025')

if not username or not password:
    raise ValueError("ODOO_ADMIN_EMAIL e ODOO_API_KEY devono essere impostati")

common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
uid = common.authenticate(db, username, password, {})
models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

print(f"Connesso a Odoo come UID: {uid}")

# Konti da verificare
KONTI = {
    '1024': 'UBS CHF (0278 00122087.01)',
    '1025': 'UBS EUR (0278 00122087.60)',
    '1026': 'Credit Suisse CHF (3977497-51)'
}

# Periodo novembre 2024
DATE_START = '2024-11-01'
DATE_END = '2024-11-30'

def get_account_id(code):
    """Trova account.account per codice"""
    account_ids = models.execute_kw(db, uid, password,
        'account.account', 'search',
        [[['code', '=', code]]])
    if not account_ids:
        return None
    return account_ids[0]

def get_account_moves(account_id, date_start, date_end):
    """Ottieni tutte le move lines per account in periodo"""
    move_line_ids = models.execute_kw(db, uid, password,
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', date_start],
            ['date', '<=', date_end],
            ['parent_state', '=', 'posted']  # Solo movimenti confermati
        ]],
        {'order': 'date asc, id asc'}
    )

    if not move_line_ids:
        return []

    # Fetch complete data
    move_lines = models.execute_kw(db, uid, password,
        'account.move.line', 'read',
        [move_line_ids],
        {'fields': [
            'date', 'name', 'ref', 'debit', 'credit', 'balance',
            'move_id', 'partner_id', 'account_id', 'journal_id',
            'currency_id', 'amount_currency'
        ]}
    )

    return move_lines

def get_opening_balance(account_id, date):
    """Calcola saldo di apertura alla data"""
    # Somma tutti i movimenti PRIMA della data
    domain = [
        ['account_id', '=', account_id],
        ['date', '<', date],
        ['parent_state', '=', 'posted']
    ]

    move_line_ids = models.execute_kw(db, uid, password,
        'account.move.line', 'search',
        [domain]
    )

    if not move_line_ids:
        return 0.0

    move_lines = models.execute_kw(db, uid, password,
        'account.move.line', 'read',
        [move_line_ids],
        {'fields': ['debit', 'credit']}
    )

    total_debit = sum(ml['debit'] for ml in move_lines)
    total_credit = sum(ml['credit'] for ml in move_lines)

    return total_debit - total_credit

def analyze_konto(code, name):
    """Analizza completa un konto per novembre 2024"""
    print(f"\n{'='*80}")
    print(f"KONTO {code}: {name}")
    print(f"{'='*80}")

    account_id = get_account_id(code)
    if not account_id:
        print(f"ERRORE: Konto {code} non trovato in Odoo")
        return None

    # Saldo apertura (31/10/2024 23:59:59)
    opening_balance = get_opening_balance(account_id, DATE_START)
    print(f"\nSaldo apertura (31/10/2024): {opening_balance:,.2f}")

    # Movimenti novembre
    move_lines = get_account_moves(account_id, DATE_START, DATE_END)
    print(f"Movimenti trovati: {len(move_lines)}")

    if not move_lines:
        print("Nessun movimento in novembre 2024")
        return {
            'code': code,
            'name': name,
            'opening_balance': opening_balance,
            'closing_balance': opening_balance,
            'total_movements': 0,
            'total_debit': 0,
            'total_credit': 0,
            'movements': []
        }

    # Analisi riga per riga
    print(f"\n{'Data':<12} {'Descrizione':<40} {'Dare':>15} {'Avere':>15} {'Saldo':>15}")
    print("-" * 100)

    running_balance = opening_balance
    total_debit = 0
    total_credit = 0
    movements_detail = []

    for ml in move_lines:
        date = ml['date']
        description = ml['name'] or ''
        ref = ml['ref'] or ''
        debit = ml['debit']
        credit = ml['credit']

        # Update running balance
        running_balance += (debit - credit)
        total_debit += debit
        total_credit += credit

        # Format descrizione
        desc = f"{description[:35]}"
        if ref and ref not in description:
            desc = f"{desc} | {ref[:35]}"

        # Partner se presente
        partner_name = ''
        if ml['partner_id']:
            partner_name = ml['partner_id'][1] if isinstance(ml['partner_id'], list) else ''

        print(f"{date:<12} {desc:<40} {debit:>15,.2f} {credit:>15,.2f} {running_balance:>15,.2f}")

        # Salva dettagli
        movements_detail.append({
            'date': date,
            'description': description,
            'ref': ref,
            'partner': partner_name,
            'debit': debit,
            'credit': credit,
            'balance': running_balance,
            'move_id': ml['move_id'][0] if isinstance(ml['move_id'], list) else ml['move_id'],
            'journal': ml['journal_id'][1] if isinstance(ml['journal_id'], list) else '',
            'currency_id': ml['currency_id'][0] if ml['currency_id'] and isinstance(ml['currency_id'], list) else None,
            'amount_currency': ml['amount_currency']
        })

    print("-" * 100)
    print(f"{'TOTALI':<52} {total_debit:>15,.2f} {total_credit:>15,.2f}")
    print(f"\nSaldo chiusura (30/11/2024): {running_balance:,.2f}")
    print(f"Variazione mese: {(total_debit - total_credit):,.2f}")

    return {
        'code': code,
        'name': name,
        'account_id': account_id,
        'opening_balance': opening_balance,
        'closing_balance': running_balance,
        'total_movements': len(move_lines),
        'total_debit': total_debit,
        'total_credit': total_credit,
        'net_change': total_debit - total_credit,
        'movements': movements_detail
    }

def verify_consistency(results):
    """Verifica consistenza con JSON bancari"""
    print(f"\n{'='*80}")
    print("VERIFICA CONSISTENZA CON ESTRATTI BANCARI")
    print(f"{'='*80}\n")

    # Expected balances from JSON files (already read at beginning)
    expected = {
        '1024': {
            'opening': 257538.24,  # from UBS-CHF October ending
            'closing': 154193.40,  # from UBS-CHF November ending
            'source': 'UBS-CHF-2024-CLEAN.json'
        },
        '1025': {
            'opening': 112572.85,  # from UBS-EUR October
            'closing': -16351.75,  # from UBS-EUR November
            'source': 'UBS-EUR-2024-CLEAN.json'
        },
        '1026': {
            'opening': None,  # No monthly data in Credit Suisse JSON
            'closing': None,
            'source': 'CREDIT-SUISSE-2024-CLEAN.json (no monthly breakdown)'
        }
    }

    discrepancies = []

    for code, data in results.items():
        if code not in expected:
            continue

        exp = expected[code]
        print(f"\nKONTO {code}: {data['name']}")
        print(f"Fonte: {exp['source']}")
        print("-" * 80)

        if exp['opening'] is not None:
            diff_opening = data['opening_balance'] - exp['opening']
            status_opening = 'OK' if abs(diff_opening) < 0.01 else 'DISCREPANZA'
            print(f"Saldo apertura Odoo:    {data['opening_balance']:>15,.2f}")
            print(f"Saldo apertura Banca:   {exp['opening']:>15,.2f}")
            print(f"Differenza:             {diff_opening:>15,.2f} [{status_opening}]")
        else:
            print(f"Saldo apertura Odoo:    {data['opening_balance']:>15,.2f}")
            print(f"Saldo apertura Banca:   Non disponibile")

        if exp['closing'] is not None:
            diff_closing = data['closing_balance'] - exp['closing']
            status_closing = 'OK' if abs(diff_closing) < 0.01 else 'DISCREPANZA'
            print(f"\nSaldo chiusura Odoo:    {data['closing_balance']:>15,.2f}")
            print(f"Saldo chiusura Banca:   {exp['closing']:>15,.2f}")
            print(f"Differenza:             {diff_closing:>15,.2f} [{status_closing}]")

            if abs(diff_closing) >= 0.01:
                discrepancies.append({
                    'konto': code,
                    'name': data['name'],
                    'odoo_balance': data['closing_balance'],
                    'bank_balance': exp['closing'],
                    'difference': diff_closing
                })
        else:
            print(f"\nSaldo chiusura Odoo:    {data['closing_balance']:>15,.2f}")
            print(f"Saldo chiusura Banca:   Non disponibile")

    return discrepancies

def main():
    """Main execution"""
    print("="*80)
    print("VERIFICA NOVEMBRE 2024 - ANALISI RIGA PER RIGA")
    print("="*80)
    print(f"Periodo: {DATE_START} - {DATE_END}")
    print(f"Data analisi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    results = {}

    # Analizza ogni konto
    for code, name in KONTI.items():
        result = analyze_konto(code, name)
        if result:
            results[code] = result

    # Verifica consistenza
    discrepancies = verify_consistency(results)

    # Summary finale
    print(f"\n{'='*80}")
    print("RIEPILOGO FINALE")
    print(f"{'='*80}\n")

    total_movements = sum(r['total_movements'] for r in results.values())
    print(f"Totale movimenti analizzati: {total_movements}")
    print(f"Konti verificati: {len(results)}")

    if discrepancies:
        print(f"\nDISCREPANZE RILEVATE: {len(discrepancies)}")
        for disc in discrepancies:
            print(f"  - {disc['konto']}: Differenza {disc['difference']:,.2f}")
    else:
        print("\nNessuna discrepanza rilevata - SALDI ALLINEATI")

    # Salva report JSON
    report = {
        'period': {
            'start': DATE_START,
            'end': DATE_END,
            'month': 'novembre',
            'year': 2024
        },
        'analysis_date': datetime.now().isoformat(),
        'konti_analyzed': list(KONTI.keys()),
        'total_movements': total_movements,
        'results': results,
        'discrepancies': discrepancies,
        'status': 'ALIGNED' if not discrepancies else 'DISCREPANCIES_FOUND'
    }

    output_file = 'REPORT-NOVEMBRE-2024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\nReport salvato: {output_file}")
    print("="*80)

if __name__ == '__main__':
    main()
