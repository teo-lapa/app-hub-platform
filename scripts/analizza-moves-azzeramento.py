#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analisi dettagliata moves di azzeramento 2023
"""

import sys
import io
import xmlrpc.client
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "lapa201180"

print("=" * 80)
print("ANALISI DETTAGLIATA MOVES AZZERAMENTO 2023")
print("=" * 80)

common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Moves da analizzare
target_moves = [58103, 58101, 95413, 95447]

for move_id in target_moves:
    print(f"\n{'=' * 80}")
    print(f"MOVE ID: {move_id}")
    print('=' * 80)

    # Get move header
    move = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
        'account.move', 'read',
        [[move_id]],
        {'fields': ['name', 'date', 'ref', 'state', 'journal_id', 'create_date', 'create_uid', 'write_date', 'write_uid']})

    if not move:
        print(f"Move {move_id} non trovato!")
        continue

    move = move[0]

    print(f"Nome: {move['name']}")
    print(f"Data: {move['date']}")
    print(f"Ref: {move['ref']}")
    print(f"Stato: {move['state']}")
    print(f"Journal: {move['journal_id'][1] if move['journal_id'] else 'N/A'}")
    print(f"Creato: {move['create_date']} da UID {move['create_uid'][0] if move['create_uid'] else 'N/A'}")
    print(f"Modificato: {move['write_date']} da UID {move['write_uid'][0] if move['write_uid'] else 'N/A'}")

    # Get all lines
    lines = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'search_read',
        [[['move_id', '=', move_id]]],
        {'fields': ['id', 'account_id', 'name', 'debit', 'credit', 'balance', 'partner_id']})

    print(f"\nRighe: {len(lines)}")
    print("-" * 80)

    total_debit = 0
    total_credit = 0

    for line in lines:
        account_code = line['account_id'][1].split(' - ')[0] if line['account_id'] else 'N/A'
        account_name = line['account_id'][1] if line['account_id'] else 'N/A'

        print(f"  Account: {account_code} - {account_name[:40]}")
        print(f"  Descrizione: {line['name'][:60]}")
        print(f"  DARE:  CHF {line['debit']:>12,.2f}")
        print(f"  AVERE: CHF {line['credit']:>12,.2f}")
        print(f"  Balance: CHF {line['balance']:>12,.2f}")
        print(f"  Partner: {line['partner_id'][1] if line['partner_id'] else 'N/A'}")
        print("-" * 80)

        total_debit += line['debit']
        total_credit += line['credit']

    print(f"TOTALE DARE:  CHF {total_debit:>12,.2f}")
    print(f"TOTALE AVERE: CHF {total_credit:>12,.2f}")
    print(f"DIFFERENZA:   CHF {total_debit - total_credit:>12,.2f}")

    if abs(total_debit - total_credit) > 0.01:
        print("⚠️  WARNING: Move non bilanciato!")

# Salva summary
print("\n" + "=" * 80)
print("SUMMARY MOVES ANALIZZATI")
print("=" * 80)
print("Move 58103: azzeramento 2023 - CHF 132,834.54")
print("Move 58101: azzerare 2023 - CHF 50,000.00")
print("Move 95413: Rettifica aumento saldo 1024 - CHF 10,903.87")
print("Move 95447: Rettifica CS 51 da -10.000 a 10.903,87 - CHF 20,903.87")
print("=" * 80)
print("TOTALE MOVIMENTI SOSPETTI: CHF 214,642.28")
print("=" * 80)
