#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
POST DRAFT CLOSING MOVES
=========================

Registra (POST) le registrazioni di chiusura in DRAFT
per completare la chiusura dei konto 1022 e 1023
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

def main():
    print("\n" + "="*70)
    print("POST DRAFT CLOSING MOVES")
    print("="*70 + "\n")

    uid, models = connect()
    print("✓ Connesso\n")

    # Trova draft moves di chiusura
    draft_move_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'search',
        [[
            ['ref', 'ilike', 'CHIUSURA-102'],
            ['state', '=', 'draft']
        ]]
    )

    if not draft_move_ids:
        print("✓ Nessun draft move trovato - già tutti posted!\n")
        return

    print(f"Trovati {len(draft_move_ids)} draft moves da postare:\n")

    # Leggi dettagli
    draft_moves = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'read',
        [draft_move_ids],
        {'fields': ['id', 'name', 'ref', 'date', 'state', 'line_ids']}
    )

    for move in draft_moves:
        print(f"Move ID {move['id']}:")
        print(f"  Name: {move['name']}")
        print(f"  Ref: {move['ref']}")
        print(f"  Date: {move['date']}")
        print(f"  State: {move['state']}")

        # Leggi righe
        line_ids = move['line_ids']
        lines = models.execute_kw(
            ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
            'account.move.line', 'read',
            [line_ids],
            {'fields': ['account_id', 'debit', 'credit']}
        )

        print(f"  Righe:")
        total_debit = Decimal('0')
        total_credit = Decimal('0')

        for line in lines:
            debit = Decimal(str(line['debit']))
            credit = Decimal(str(line['credit']))
            total_debit += debit
            total_credit += credit

            account_name = line['account_id'][1] if line['account_id'] else 'N/A'

            if debit > 0:
                print(f"    [D] {account_name}: {format_chf(debit)}")
            else:
                print(f"    [A] {account_name}: {format_chf(credit)}")

        print(f"  Quadratura: {'✓ OK' if abs(total_debit - total_credit) < Decimal('0.01') else '✗ ERRORE'}\n")

    # Conferma
    print("="*70)
    print("AZIONE: POSTING DRAFT MOVES")
    print("="*70 + "\n")

    print("Questa operazione registrerà (POST) le registrazioni DRAFT.")
    print("Una volta registrate, NON potranno essere modificate.\n")

    # POST i moves
    print("Posting moves...\n")

    for move_id in draft_move_ids:
        try:
            models.execute_kw(
                ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
                'account.move', 'action_post',
                [[move_id]]
            )
            print(f"✓ Move {move_id} POSTED con successo")

        except Exception as e:
            print(f"✗ ERRORE posting move {move_id}: {e}")

    print()

    # Verifica finale
    print("="*70)
    print("VERIFICA FINALE")
    print("="*70 + "\n")

    # Verifica saldi POSTED
    def get_posted_balance(account_code):
        account_ids = models.execute_kw(
            ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
            'account.account', 'search',
            [[['code', '=', account_code]]]
        )

        if not account_ids:
            return None

        account_id = account_ids[0]

        lines = models.execute_kw(
            ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', account_id],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['debit', 'credit']}
        )

        total_debit = sum(Decimal(str(l['debit'])) for l in lines)
        total_credit = sum(Decimal(str(l['credit'])) for l in lines)
        balance = total_debit - total_credit

        return balance

    balance_1022 = get_posted_balance('1022')
    balance_1023 = get_posted_balance('1023')

    print(f"SALDI POSTED FINALI:")
    print(f"  Konto 1022: {format_chf(balance_1022)}")
    print(f"  Konto 1023: {format_chf(balance_1023)}\n")

    # Status finale
    success = True

    if abs(balance_1022) < Decimal('0.01'):
        print(f"✓ Konto 1022: AZZERATO!")
    else:
        print(f"⚠ Konto 1022: Balance rimanente = {format_chf(balance_1022)}")
        success = False

    if abs(balance_1023) < Decimal('0.01'):
        print(f"✓ Konto 1023: AZZERATO!")
    else:
        print(f"⚠ Konto 1023: Balance rimanente = {format_chf(balance_1023)}")
        success = False

    print()

    if success:
        print("="*70)
        print("✓✓✓ SUCCESS: ENTRAMBI I KONTI AZZERATI!")
        print("="*70 + "\n")
        print("OBIETTIVO RAGGIUNTO:")
        print("  • Konto 1022 (Outstanding Receipts): CHF 0.00")
        print("  • Konto 1023 (Outstanding Payments): CHF 0.00")
        print("\n✓ Pronto per chiusura contabile 31.12.2024\n")
    else:
        print("="*70)
        print("⚠ ATTENZIONE: Saldi non completamente azzerati")
        print("="*70 + "\n")
        print("Analisi ulteriore richiesta.\n")

if __name__ == "__main__":
    main()
