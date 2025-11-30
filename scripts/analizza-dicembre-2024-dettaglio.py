#!/usr/bin/env python3
"""
VERIFICA DICEMBRE 2024 - RIGA PER RIGA
Konti: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)
Periodo: 01/12/2024 - 31/12/2024
"""

import os
import sys
import json
import xmlrpc.client
from datetime import datetime
from collections import defaultdict
from decimal import Decimal

# Configurazione Odoo
ODOO_URL = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
ODOO_DB = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
ODOO_USERNAME = os.getenv('ODOO_ADMIN_EMAIL', 'apphubplatform@lapa.ch')
ODOO_PASSWORD = os.getenv('ODOO_ADMIN_PASSWORD', 'apphubplatform2025')

def connect_odoo():
    """Connessione a Odoo"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception('Autenticazione fallita')

    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return models, uid

def get_account_info(models, uid, account_codes):
    """Ottieni info account"""
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', 'in', account_codes]]],
        {'fields': ['id', 'code', 'name', 'currency_id']}
    )
    return {acc['code']: acc for acc in accounts}

def get_december_moves(models, uid, account_ids):
    """Ottieni TUTTE le righe di dicembre 2024"""
    print("\nEstrazione movimenti dicembre 2024...")

    # Cerca tutte le move lines di dicembre 2024
    domain = [
        ['account_id', 'in', account_ids],
        ['date', '>=', '2024-12-01'],
        ['date', '<=', '2024-12-31'],
        ['parent_state', '=', 'posted']  # Solo movimenti contabilizzati
    ]

    fields = [
        'id',
        'date',
        'move_id',
        'account_id',
        'partner_id',
        'name',
        'ref',
        'debit',
        'credit',
        'balance',
        'amount_currency',
        'currency_id',
        'reconciled',
        'full_reconcile_id',
        'matching_number'
    ]

    move_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [domain],
        {'fields': fields, 'order': 'date asc, id asc'}
    )

    print(f"Trovate {len(move_lines)} righe")

    # Arricchisci con info move
    for line in move_lines:
        move_id = line['move_id'][0] if line['move_id'] else None
        if move_id:
            move = models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move', 'read',
                [move_id],
                {'fields': ['name', 'move_type', 'payment_reference', 'journal_id']}
            )
            if move:
                line['move_name'] = move[0]['name']
                line['move_type'] = move[0]['move_type']
                line['payment_ref'] = move[0].get('payment_reference', '')
                line['journal'] = move[0]['journal_id'][1] if move[0]['journal_id'] else ''

    return move_lines

def get_opening_balance(models, uid, account_ids):
    """Calcola saldo di apertura al 01/12/2024"""
    print("\nCalcolo saldo apertura 01/12/2024...")

    domain = [
        ['account_id', 'in', account_ids],
        ['date', '<', '2024-12-01'],
        ['parent_state', '=', 'posted']
    ]

    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [domain],
        {'fields': ['account_id', 'debit', 'credit']}
    )

    balances = defaultdict(Decimal)
    for line in lines:
        acc_id = line['account_id'][0]
        balances[acc_id] += Decimal(str(line['debit'])) - Decimal(str(line['credit']))

    return balances

def get_closing_balance(models, uid, account_ids):
    """Calcola saldo chiusura al 31/12/2024"""
    print("\nCalcolo saldo chiusura 31/12/2024...")

    domain = [
        ['account_id', 'in', account_ids],
        ['date', '<=', '2024-12-31'],
        ['parent_state', '=', 'posted']
    ]

    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [domain],
        {'fields': ['account_id', 'debit', 'credit']}
    )

    balances = defaultdict(Decimal)
    for line in lines:
        acc_id = line['account_id'][0]
        balances[acc_id] += Decimal(str(line['debit'])) - Decimal(str(line['credit']))

    return balances

def analyze_by_account(move_lines, accounts_info):
    """Analizza movimenti per account"""
    by_account = defaultdict(list)

    for line in move_lines:
        acc_id = line['account_id'][0]
        by_account[acc_id].append(line)

    return by_account

def format_currency(amount):
    """Formatta importo"""
    if amount >= 0:
        return f"{amount:,.2f}"
    else:
        return f"({abs(amount):,.2f})"

def main():
    print("=" * 80)
    print("ANALISI DICEMBRE 2024 - RIGA PER RIGA")
    print("=" * 80)
    print(f"Konti: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)")
    print(f"Periodo: 01/12/2024 - 31/12/2024")
    print("=" * 80)

    if not ODOO_PASSWORD:
        print("ERRORE: Manca ODOO_PASSWORD")
        return

    # Connetti a Odoo
    models, uid = connect_odoo()
    print(f"Connesso a Odoo come: {ODOO_USERNAME}")

    # Ottieni account info
    account_codes = ['1024', '1025', '1026']
    accounts_info = get_account_info(models, uid, account_codes)

    print(f"\nAccount trovati:")
    for code, info in accounts_info.items():
        currency = info['currency_id'][1] if info['currency_id'] else 'CHF'
        print(f"  {code}: {info['name']} ({currency})")

    account_ids = [acc['id'] for acc in accounts_info.values()]

    # Saldi apertura
    opening_balances = get_opening_balance(models, uid, account_ids)

    # Movimenti dicembre
    move_lines = get_december_moves(models, uid, account_ids)

    # Saldi chiusura
    closing_balances = get_closing_balance(models, uid, account_ids)

    # Analizza per account
    by_account = analyze_by_account(move_lines, accounts_info)

    # Prepara report
    report = {
        'periodo': '01/12/2024 - 31/12/2024',
        'data_analisi': datetime.now().isoformat(),
        'accounts': {},
        'totali': {
            'num_movimenti': len(move_lines),
            'num_righe_riconciliate': sum(1 for l in move_lines if l['reconciled']),
            'num_righe_non_riconciliate': sum(1 for l in move_lines if not l['reconciled'])
        }
    }

    # Report per account
    print("\n" + "=" * 80)
    print("DETTAGLIO PER ACCOUNT")
    print("=" * 80)

    for code in sorted(account_codes):
        if code not in accounts_info:
            continue

        acc_info = accounts_info[code]
        acc_id = acc_info['id']
        currency = acc_info['currency_id'][1] if acc_info['currency_id'] else 'CHF'

        lines = by_account.get(acc_id, [])

        opening = opening_balances.get(acc_id, Decimal('0'))
        closing = closing_balances.get(acc_id, Decimal('0'))

        total_debit = sum(Decimal(str(l['debit'])) for l in lines)
        total_credit = sum(Decimal(str(l['credit'])) for l in lines)
        net_movement = total_debit - total_credit

        print(f"\n{code} - {acc_info['name']} ({currency})")
        print(f"-" * 80)
        print(f"Saldo apertura 01/12/2024:  {format_currency(float(opening)):>20}")
        print(f"Movimenti dicembre:")
        print(f"  Addebiti (debit):         {format_currency(float(total_debit)):>20}")
        print(f"  Accrediti (credit):       {format_currency(float(total_credit)):>20}")
        print(f"  Movimento netto:          {format_currency(float(net_movement)):>20}")
        print(f"Saldo chiusura 31/12/2024:  {format_currency(float(closing)):>20}")
        print(f"Numero righe:               {len(lines):>20}")
        print(f"Riconciliate:               {sum(1 for l in lines if l['reconciled']):>20}")
        print(f"Non riconciliate:           {sum(1 for l in lines if not l['reconciled']):>20}")

        # Verifica matematica
        calculated_closing = opening + net_movement
        diff = closing - calculated_closing
        if abs(diff) > Decimal('0.01'):
            print(f"ATTENZIONE: Saldo calcolato {format_currency(float(calculated_closing))} != saldo effettivo {format_currency(float(closing))}")
            print(f"            Differenza: {format_currency(float(diff))}")

        # Salva in report
        report['accounts'][code] = {
            'name': acc_info['name'],
            'currency': currency,
            'opening_balance': float(opening),
            'closing_balance': float(closing),
            'total_debit': float(total_debit),
            'total_credit': float(total_credit),
            'net_movement': float(net_movement),
            'num_lines': len(lines),
            'num_reconciled': sum(1 for l in lines if l['reconciled']),
            'num_unreconciled': sum(1 for l in lines if not l['reconciled']),
            'lines': []
        }

        # Aggiungi dettaglio righe
        print(f"\n  DETTAGLIO RIGHE:")
        print(f"  {'Data':<12} {'Move':<15} {'Descrizione':<40} {'Dare':>15} {'Avere':>15} {'Ric':^5}")
        print(f"  {'-'*12} {'-'*15} {'-'*40} {'-'*15} {'-'*15} {'-'*5}")

        running_balance = opening
        for line in lines:
            date = line['date']
            move_name = line.get('move_name', 'N/A')
            description = line['name'] or ''
            if line.get('payment_ref'):
                description = f"{description} | Ref: {line['payment_ref']}"

            debit = Decimal(str(line['debit']))
            credit = Decimal(str(line['credit']))
            reconciled = 'SI' if line['reconciled'] else 'NO'

            running_balance += debit - credit

            print(f"  {date:<12} {move_name:<15} {description[:40]:<40} {format_currency(float(debit)):>15} {format_currency(float(credit)):>15} {reconciled:^5}")

            # Salva in report
            report['accounts'][code]['lines'].append({
                'date': date,
                'move_id': line['move_id'][0] if line['move_id'] else None,
                'move_name': move_name,
                'description': description,
                'ref': line['ref'] or '',
                'debit': float(debit),
                'credit': float(credit),
                'balance': float(running_balance),
                'reconciled': line['reconciled'],
                'partner': line['partner_id'][1] if line['partner_id'] else '',
                'journal': line.get('journal', ''),
                'currency_amount': line['amount_currency'] or 0
            })

    # Salva report JSON
    output_file = 'c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\REPORT-DICEMBRE-2024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n" + "=" * 80)
    print(f"REPORT SALVATO: {output_file}")
    print("=" * 80)

    # Confronto con estratti bancari
    print(f"\n" + "=" * 80)
    print("CONFRONTO CON ESTRATTI BANCARI")
    print("=" * 80)

    # Saldi attesi da estratti
    expected_balances = {
        '1024': {'bank': 'UBS CHF', 'expected': 182573.56, 'source': 'UBS-CHF-2024-CLEAN.json'},
        '1025': {'bank': 'UBS EUR', 'expected': 128860.70, 'source': 'UBS-EUR-2024-CLEAN.json'},  # Nota: nel JSON c'è 128860.7
        '1026': {'bank': 'Credit Suisse CHF', 'expected': 24897.72, 'source': 'CREDIT-SUISSE-2024-CLEAN.json'}
    }

    total_diff = Decimal('0')
    for code, expected_info in expected_balances.items():
        if code in report['accounts']:
            odoo_balance = Decimal(str(report['accounts'][code]['closing_balance']))
            expected = Decimal(str(expected_info['expected']))
            diff = odoo_balance - expected
            total_diff += abs(diff)

            status = 'OK' if abs(diff) < Decimal('0.01') else 'DIFFERENZA'

            print(f"\n{code} - {expected_info['bank']}")
            print(f"  Saldo Odoo:       {format_currency(float(odoo_balance)):>20}")
            print(f"  Saldo Estratto:   {format_currency(float(expected)):>20}")
            print(f"  Differenza:       {format_currency(float(diff)):>20} [{status}]")
            print(f"  Fonte: {expected_info['source']}")

            report['accounts'][code]['bank_comparison'] = {
                'bank': expected_info['bank'],
                'expected_balance': float(expected),
                'odoo_balance': float(odoo_balance),
                'difference': float(diff),
                'status': status
            }

    print(f"\nDifferenza totale assoluta: {format_currency(float(total_diff))}")

    # Risalva report con confronti
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n" + "=" * 80)
    print("ANALISI COMPLETATA")
    print("=" * 80)

if __name__ == '__main__':
    main()
