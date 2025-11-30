#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DEEP ANALYSIS - OUTSTANDING SALDI
==================================

Analisi approfondita per capire perché i saldi non sono a zero
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import xmlrpc.client
import ssl
from decimal import Decimal

ODOO_CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def connect():
    ssl_context = ssl._create_unverified_context()
    common = xmlrpc.client.ServerProxy(f"{ODOO_CONFIG['url']}/xmlrpc/2/common", context=ssl_context)
    uid = common.authenticate(ODOO_CONFIG['db'], ODOO_CONFIG['username'], ODOO_CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{ODOO_CONFIG['url']}/xmlrpc/2/object", context=ssl_context)
    return uid, models

def format_chf(amount):
    return f"CHF {amount:,.2f}".replace(',', "'")

def get_balance_by_state(uid, models, account_code):
    """Calcola saldo separando per stato move"""

    # Trova account
    account_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.account', 'search',
        [[['code', '=', account_code]]]
    )

    if not account_ids:
        return None

    account_id = account_ids[0]

    # TUTTE le righe (anche draft)
    all_lines = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'search_read',
        [[['account_id', '=', account_id]]],
        {'fields': ['id', 'debit', 'credit', 'parent_state', 'move_id', 'date']}
    )

    # Separa per stato
    posted_lines = [l for l in all_lines if l['parent_state'] == 'posted']
    draft_lines = [l for l in all_lines if l['parent_state'] == 'draft']

    # Calcola saldi
    posted_debit = sum(Decimal(str(l['debit'])) for l in posted_lines)
    posted_credit = sum(Decimal(str(l['credit'])) for l in posted_lines)
    posted_balance = posted_debit - posted_credit

    draft_debit = sum(Decimal(str(l['debit'])) for l in draft_lines)
    draft_credit = sum(Decimal(str(l['credit'])) for l in draft_lines)
    draft_balance = draft_debit - draft_credit

    total_balance = posted_balance + draft_balance

    return {
        'account_code': account_code,
        'total_lines': len(all_lines),
        'posted_lines': len(posted_lines),
        'draft_lines': len(draft_lines),
        'posted_debit': posted_debit,
        'posted_credit': posted_credit,
        'posted_balance': posted_balance,
        'draft_debit': draft_debit,
        'draft_credit': draft_credit,
        'draft_balance': draft_balance,
        'total_balance': total_balance
    }

def analyze_closing_moves(uid, models):
    """Analizza TUTTI i moves di chiusura"""

    # Cerca TUTTI i moves con CHIUSURA
    move_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'search',
        [[['ref', 'ilike', 'CHIUSURA-102']]]
    )

    moves = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'read',
        [move_ids],
        {'fields': ['id', 'name', 'ref', 'date', 'state', 'line_ids']}
    )

    # Raggruppa per ref e state
    by_ref = {}
    for move in moves:
        ref = move['ref']
        state = move['state']
        key = f"{ref} ({state})"

        if key not in by_ref:
            by_ref[key] = []
        by_ref[key].append(move)

    return by_ref

def main():
    print("\n" + "="*70)
    print("DEEP ANALYSIS - OUTSTANDING SALDI")
    print("="*70 + "\n")

    uid, models = connect()
    print("✓ Connesso\n")

    # Analizza 1022
    print("="*70)
    print("KONTO 1022 - DETAILED BREAKDOWN")
    print("="*70 + "\n")

    analysis_1022 = get_balance_by_state(uid, models, '1022')

    print(f"RIGHE:")
    print(f"  Totale: {analysis_1022['total_lines']}")
    print(f"  Posted: {analysis_1022['posted_lines']}")
    print(f"  Draft: {analysis_1022['draft_lines']}\n")

    print(f"SALDO POSTED:")
    print(f"  Debit: {format_chf(analysis_1022['posted_debit'])}")
    print(f"  Credit: {format_chf(analysis_1022['posted_credit'])}")
    print(f"  Balance: {format_chf(analysis_1022['posted_balance'])}\n")

    print(f"SALDO DRAFT:")
    print(f"  Debit: {format_chf(analysis_1022['draft_debit'])}")
    print(f"  Credit: {format_chf(analysis_1022['draft_credit'])}")
    print(f"  Balance: {format_chf(analysis_1022['draft_balance'])}\n")

    print(f"SALDO TOTALE (Posted + Draft):")
    print(f"  Balance: {format_chf(analysis_1022['total_balance'])}\n")

    if abs(analysis_1022['posted_balance']) < Decimal('0.01'):
        print("✓ POSTED BALANCE = ZERO!")
    else:
        print(f"⚠ POSTED BALANCE != ZERO: {format_chf(analysis_1022['posted_balance'])}")

    # Analizza 1023
    print("\n" + "="*70)
    print("KONTO 1023 - DETAILED BREAKDOWN")
    print("="*70 + "\n")

    analysis_1023 = get_balance_by_state(uid, models, '1023')

    print(f"RIGHE:")
    print(f"  Totale: {analysis_1023['total_lines']}")
    print(f"  Posted: {analysis_1023['posted_lines']}")
    print(f"  Draft: {analysis_1023['draft_lines']}\n")

    print(f"SALDO POSTED:")
    print(f"  Debit: {format_chf(analysis_1023['posted_debit'])}")
    print(f"  Credit: {format_chf(analysis_1023['posted_credit'])}")
    print(f"  Balance: {format_chf(analysis_1023['posted_balance'])}\n")

    print(f"SALDO DRAFT:")
    print(f"  Debit: {format_chf(analysis_1023['draft_debit'])}")
    print(f"  Credit: {format_chf(analysis_1023['draft_credit'])}")
    print(f"  Balance: {format_chf(analysis_1023['draft_balance'])}\n")

    print(f"SALDO TOTALE (Posted + Draft):")
    print(f"  Balance: {format_chf(analysis_1023['total_balance'])}\n")

    if abs(analysis_1023['posted_balance']) < Decimal('0.01'):
        print("✓ POSTED BALANCE = ZERO!")
    else:
        print(f"⚠ POSTED BALANCE != ZERO: {format_chf(analysis_1023['posted_balance'])}")

    # Analizza moves chiusura
    print("\n" + "="*70)
    print("REGISTRAZIONI CHIUSURA - BY STATE")
    print("="*70 + "\n")

    closing_moves = analyze_closing_moves(uid, models)

    for key, moves in sorted(closing_moves.items()):
        print(f"{key}:")
        for move in moves:
            print(f"  Move ID {move['id']}: {move['name']} - Date: {move['date']}")
        print()

    # CONCLUSIONE
    print("="*70)
    print("CONCLUSIONE")
    print("="*70 + "\n")

    print("SITUAZIONE ATTUALE:")
    print(f"  1. Konto 1022 Posted Balance: {format_chf(analysis_1022['posted_balance'])}")
    print(f"  2. Konto 1023 Posted Balance: {format_chf(analysis_1023['posted_balance'])}\n")

    if abs(analysis_1022['posted_balance']) < Decimal('0.01') and abs(analysis_1023['posted_balance']) < Decimal('0.01'):
        print("✓✓✓ SUCCESS: Entrambi i konti hanno POSTED BALANCE = ZERO!")
        print("\nNote:")
        print("  - Solo le righe POSTED contano per bilancio")
        print("  - Le righe DRAFT sono registrazioni in bozza non finalizzate")
        print("  - Per la chiusura contabile contano SOLO le righe POSTED")
    else:
        print("⚠⚠⚠ ATTENZIONE: Posted balance non a zero!")

        if abs(analysis_1022['posted_balance']) >= Decimal('0.01'):
            print(f"\n  Konto 1022 ha still balance: {format_chf(analysis_1022['posted_balance'])}")
            print(f"  Serve registrazione di chiusura per: {format_chf(abs(analysis_1022['posted_balance']))}")

        if abs(analysis_1023['posted_balance']) >= Decimal('0.01'):
            print(f"\n  Konto 1023 ha still balance: {format_chf(analysis_1023['posted_balance'])}")
            print(f"  Serve registrazione di chiusura per: {format_chf(abs(analysis_1023['posted_balance']))}")

    print()

if __name__ == "__main__":
    main()
