#!/usr/bin/env python3
"""
DETTAGLIO MOVIMENTO AZZERAMENTO 2023
Move: BNK3/2024/00867 del 03/06/2024
Importo: CHF 132,834.54 DARE
"""

import os
import xmlrpc.client
import json

ODOO_URL = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
ODOO_DB = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
ODOO_USERNAME = os.getenv('ODOO_ADMIN_EMAIL', 'apphubplatform@lapa.ch')
ODOO_PASSWORD = os.getenv('ODOO_ADMIN_PASSWORD', 'apphubplatform2025')

def connect_odoo():
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return models, uid

def main():
    models, uid = connect_odoo()

    # Cerca il movimento BNK3/2024/00867
    moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'search_read',
        [[['name', '=', 'BNK3/2024/00867']]],
        {'fields': ['id', 'name', 'date', 'ref', 'move_type', 'journal_id', 'line_ids', 'state']}
    )

    if not moves:
        print("Movimento non trovato")
        return

    move = moves[0]
    print("=" * 80)
    print(f"DETTAGLIO MOVIMENTO: {move['name']}")
    print("=" * 80)
    print(f"ID: {move['id']}")
    print(f"Data: {move['date']}")
    print(f"Ref: {move['ref']}")
    print(f"Tipo: {move['move_type']}")
    print(f"Journal: {move['journal_id'][1] if move['journal_id'] else 'N/A'}")
    print(f"Stato: {move['state']}")

    # Estrai tutte le righe di questo move
    line_ids = move['line_ids']
    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'read',
        [line_ids],
        {'fields': ['id', 'date', 'account_id', 'name', 'ref', 'debit', 'credit', 'balance', 'partner_id']}
    )

    print(f"\nRighe del movimento ({len(lines)}):")
    print("-" * 80)
    print(f"{'Account':<30} {'Descrizione':<30} {'Dare':>15} {'Avere':>15}")
    print("-" * 80)

    for line in lines:
        account = line['account_id'][1] if line['account_id'] else 'N/A'
        description = line['name'] or ''
        print(f"{account[:30]:<30} {description[:30]:<30} {line['debit']:>15,.2f} {line['credit']:>15,.2f}")

    print("-" * 80)
    total_debit = sum(l['debit'] for l in lines)
    total_credit = sum(l['credit'] for l in lines)
    print(f"{'TOTALE':<30} {'':<30} {total_debit:>15,.2f} {total_credit:>15,.2f}")

    # Verifica se e bilanciato
    if abs(total_debit - total_credit) > 0.01:
        print(f"\nATTENZIONE: Movimento NON BILANCIATO!")
        print(f"Differenza: {total_debit - total_credit:,.2f}")

    # Salva dettagli
    output = {
        'move': move,
        'lines': lines,
        'analysis': {
            'total_debit': total_debit,
            'total_credit': total_credit,
            'balanced': abs(total_debit - total_credit) < 0.01
        }
    }

    with open('c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\MOVIMENTO-AZZERAMENTO-2023.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nDettagli salvati: MOVIMENTO-AZZERAMENTO-2023.json")

    # Cerca altri movimenti sospetti con importi simili
    print("\n" + "=" * 80)
    print("ALTRI MOVIMENTI GRANDI GIUGNO 2024")
    print("=" * 80)

    large_moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['date', '>=', '2024-06-01'],
            ['date', '<=', '2024-06-30'],
            ['parent_state', '=', 'posted'],
            '|',
            ['debit', '>', 50000],
            ['credit', '>', 50000]
        ]],
        {'fields': ['date', 'name', 'account_id', 'debit', 'credit', 'move_id'], 'order': 'debit desc, credit desc', 'limit': 10}
    )

    for line in large_moves:
        account = line['account_id'][1] if line['account_id'] else 'N/A'
        move_name = line['move_id'][1] if line['move_id'] else 'N/A'
        amount = line['debit'] if line['debit'] > 0 else line['credit']
        sign = 'DARE' if line['debit'] > 0 else 'AVERE'
        print(f"{line['date']} - {move_name}")
        print(f"  {account}")
        print(f"  {sign}: CHF {amount:,.2f}")
        print()

if __name__ == '__main__':
    main()
