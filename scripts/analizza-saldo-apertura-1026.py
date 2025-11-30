#!/usr/bin/env python3
"""
ANALISI SALDO APERTURA KONTO 1026 - Credit Suisse
Trova dove si e creata la discrepanza di CHF 346,556
"""

import os
import xmlrpc.client
from datetime import datetime
from decimal import Decimal

# Configurazione Odoo
ODOO_URL = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
ODOO_DB = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
ODOO_USERNAME = os.getenv('ODOO_ADMIN_EMAIL', 'apphubplatform@lapa.ch')
ODOO_PASSWORD = os.getenv('ODOO_ADMIN_PASSWORD', 'apphubplatform2025')

def connect_odoo():
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return models, uid

def get_balance_at_date(models, uid, account_id, date):
    """Calcola saldo a una data specifica"""
    domain = [
        ['account_id', '=', account_id],
        ['date', '<=', date],
        ['parent_state', '=', 'posted']
    ]

    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [domain],
        {'fields': ['debit', 'credit']}
    )

    balance = Decimal('0')
    for line in lines:
        balance += Decimal(str(line['debit'])) - Decimal(str(line['credit']))

    return balance

def get_monthly_movements(models, uid, account_id, year=2024):
    """Estrai movimenti mensili per tutto l'anno"""
    months = []

    for month in range(1, 13):
        start_date = f'{year}-{month:02d}-01'
        if month == 12:
            end_date = f'{year}-12-31'
        else:
            # Primo giorno del mese successivo - 1
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            end_date = f'{year}-{month:02d}-{last_day:02d}'

        domain = [
            ['account_id', '=', account_id],
            ['date', '>=', start_date],
            ['date', '<=', end_date],
            ['parent_state', '=', 'posted']
        ]

        lines = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move.line', 'search_read',
            [domain],
            {'fields': ['date', 'debit', 'credit', 'name', 'ref']}
        )

        total_debit = sum(Decimal(str(l['debit'])) for l in lines)
        total_credit = sum(Decimal(str(l['credit'])) for l in lines)
        net_movement = total_debit - total_credit

        # Saldo fine mese
        balance_end = get_balance_at_date(models, uid, account_id, end_date)

        months.append({
            'month': month,
            'month_name': f'{year}-{month:02d}',
            'num_lines': len(lines),
            'total_debit': float(total_debit),
            'total_credit': float(total_credit),
            'net_movement': float(net_movement),
            'balance_end': float(balance_end)
        })

    return months

def main():
    print("=" * 80)
    print("ANALISI SALDO APERTURA KONTO 1026 - CREDIT SUISSE")
    print("=" * 80)

    models, uid = connect_odoo()
    print(f"Connesso a Odoo")

    # Ottieni account
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', '1026']]],
        {'fields': ['id', 'code', 'name']}
    )

    if not accounts:
        print("ERRORE: Account 1026 non trovato")
        return

    account = accounts[0]
    account_id = account['id']

    print(f"Account: {account['code']} - {account['name']}")

    # Saldo 31/12/2023 (dovrebbe essere il saldo di apertura 2024)
    balance_2023_end = get_balance_at_date(models, uid, account_id, '2023-12-31')
    print(f"\nSaldo 31/12/2023: CHF {balance_2023_end:,.2f}")

    # Saldo 01/01/2024
    balance_2024_start = get_balance_at_date(models, uid, account_id, '2024-01-01')
    print(f"Saldo 01/01/2024: CHF {balance_2024_start:,.2f}")

    # Prima riga 2024
    first_line_2024 = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-01-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['date', 'name', 'ref', 'debit', 'credit', 'move_id'], 'order': 'date asc', 'limit': 5}
    )

    print(f"\nPrime 5 righe gennaio 2024:")
    for line in first_line_2024:
        move_name = line['move_id'][1] if line['move_id'] else 'N/A'
        print(f"  {line['date']} - {move_name} - {line['name']} - D: {line['debit']:,.2f} A: {line['credit']:,.2f}")

    # Movimenti mensili 2024
    print("\n" + "=" * 80)
    print("MOVIMENTI MENSILI 2024")
    print("=" * 80)

    months = get_monthly_movements(models, uid, account_id, 2024)

    print(f"{'Mese':<10} {'Righe':>8} {'Dare':>15} {'Avere':>15} {'Netto':>15} {'Saldo Fine':>15}")
    print("-" * 80)

    for m in months:
        print(f"{m['month_name']:<10} {m['num_lines']:>8} {m['total_debit']:>15,.2f} "
              f"{m['total_credit']:>15,.2f} {m['net_movement']:>15,.2f} {m['balance_end']:>15,.2f}")

    # Saldo finale 31/12/2024
    balance_2024_end = get_balance_at_date(models, uid, account_id, '2024-12-31')
    print("\n" + "=" * 80)
    print(f"Saldo ODOO 31/12/2024:     CHF {balance_2024_end:>15,.2f}")
    print(f"Saldo BANCA 31/12/2024:    CHF {24897.72:>15,.2f}")
    print(f"DIFFERENZA:                CHF {balance_2024_end - Decimal('24897.72'):>15,.2f}")
    print("=" * 80)

    # Cerca gennaio 2024 per capire se c'e stato un import errato
    print("\n" + "=" * 80)
    print("ANALISI GENNAIO 2024 (primo mese)")
    print("=" * 80)

    jan_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-01-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['date', 'name', 'ref', 'debit', 'credit', 'move_id', 'journal_id'], 'order': 'date asc'}
    )

    print(f"Righe gennaio: {len(jan_lines)}")

    # Raggruppa per journal
    from collections import defaultdict
    by_journal = defaultdict(list)
    for line in jan_lines:
        journal_name = line['journal_id'][1] if line['journal_id'] else 'N/A'
        by_journal[journal_name].append(line)

    print(f"\nRighe per journal:")
    for journal, lines in sorted(by_journal.items(), key=lambda x: len(x[1]), reverse=True):
        total_debit = sum(l['debit'] for l in lines)
        total_credit = sum(l['credit'] for l in lines)
        print(f"  {journal}: {len(lines)} righe - D: {total_debit:,.2f} A: {total_credit:,.2f}")

    # Cerca movimenti di apertura o rettifiche
    print("\n" + "=" * 80)
    print("CERCA MOVIMENTI DI APERTURA/RETTIFICA SOSPETTI")
    print("=" * 80)

    # Movimenti > CHF 50,000
    large_moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted'],
            '|',
            ['debit', '>', 50000],
            ['credit', '>', 50000]
        ]],
        {'fields': ['date', 'name', 'ref', 'debit', 'credit', 'move_id', 'journal_id'], 'order': 'debit desc, credit desc'}
    )

    print(f"\nMovimenti > CHF 50,000 nel 2024:")
    for line in large_moves[:10]:
        move_name = line['move_id'][1] if line['move_id'] else 'N/A'
        journal = line['journal_id'][1] if line['journal_id'] else 'N/A'
        amount = line['debit'] if line['debit'] > 0 else line['credit']
        sign = 'DARE' if line['debit'] > 0 else 'AVERE'
        print(f"  {line['date']} - {move_name} - {journal}")
        print(f"    {line['name'][:60]}")
        print(f"    {sign}: CHF {amount:,.2f}")
        print()

if __name__ == '__main__':
    main()
