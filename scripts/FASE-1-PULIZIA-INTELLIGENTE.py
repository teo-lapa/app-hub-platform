#!/usr/bin/env python3
"""
FASE 1 - PULIZIA INTELLIGENTE CON GESTIONE PROTEZIONI ODOO
Gestisce correttamente: unreconcile → draft → delete
"""

import xmlrpc.client
import ssl
from datetime import datetime
import json

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def connect():
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")
    return uid, models

def get_saldo(models, uid, account_code):
    """Get current balance of account"""
    accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not accounts:
        return None

    account_id = accounts[0]['id']

    lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['debit', 'credit']}
    )

    balance = sum(l['debit'] - l['credit'] for l in lines)
    return balance

def clean_account_intelligent(models, uid, account_code, account_name, journal_code='BNK1'):
    """
    PULIZIA INTELLIGENTE - Gestisce protezioni Odoo

    Step 1: Unreconcile ALL reconciled lines
    Step 2: Draft ALL posted moves
    Step 3: Delete ALL bank journal moves
    Step 4: Verify balance → 0
    """

    print(f"\n{'=' * 80}")
    print(f"PULIZIA INTELLIGENTE: {account_code} - {account_name}")
    print(f"{'=' * 80}\n")

    # Get account
    accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not accounts:
        print(f"[ERROR] Account {account_code} not found")
        return False

    account_id = accounts[0]['id']

    # Get journal
    journals = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.journal', 'search_read',
        [[['code', '=', journal_code], ['company_id', '=', 1]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not journals:
        print(f"[ERROR] Journal {journal_code} not found")
        return False

    journal_id = journals[0]['id']

    saldo_before = get_saldo(models, uid, account_code)
    print(f"Saldo PRIMA: CHF {saldo_before:,.2f}\n")

    # STEP 1: Get ALL reconciled lines and unreconcile
    print("STEP 1: Unreconcile righe riconciliate...")

    reconciled_lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['reconciled', '=', True]
        ]],
        {'fields': ['id', 'full_reconcile_id'], 'limit': 5000}
    )

    print(f"  Trovate {len(reconciled_lines)} righe riconciliate")

    # Get unique reconcile IDs
    reconcile_ids = set()
    for line in reconciled_lines:
        if line.get('full_reconcile_id'):
            reconcile_ids.add(line['full_reconcile_id'][0])

    print(f"  Trovate {len(reconcile_ids)} riconciliazioni da eliminare")

    unreconciled_count = 0
    for rec_id in reconcile_ids:
        try:
            models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.full.reconcile', 'unlink',
                [[rec_id]]
            )
            unreconciled_count += 1
            if unreconciled_count % 10 == 0:
                print(f"    Unreconciled: {unreconciled_count}/{len(reconcile_ids)}")
        except Exception as e:
            # Try to remove reconcile via button
            try:
                # Get lines for this reconcile
                lines_to_unrec = models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.move.line', 'search',
                    [[['full_reconcile_id', '=', rec_id]]]
                )

                if lines_to_unrec:
                    models.execute_kw(
                        CONFIG['db'], uid, CONFIG['password'],
                        'account.move.line', 'remove_move_reconcile',
                        [lines_to_unrec]
                    )
                    unreconciled_count += 1
            except:
                pass

    print(f"  OK Unreconciled: {unreconciled_count} riconciliazioni\n")

    # STEP 2: Get ALL moves in this account from bank journal and draft them
    print("STEP 2: Draft moves registrati...")

    moves = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move', 'search_read',
        [[
            ['journal_id', '=', journal_id],
            ['state', '=', 'posted']
        ]],
        {'fields': ['id', 'name'], 'limit': 10000}
    )

    print(f"  Trovati {len(moves)} moves da draftare")

    drafted_count = 0
    for move in moves:
        try:
            models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.move', 'button_draft',
                [[move['id']]]
            )
            drafted_count += 1
            if drafted_count % 100 == 0:
                print(f"    Drafted: {drafted_count}/{len(moves)}")
        except Exception as e:
            pass

    print(f"  OK Drafted: {drafted_count} moves\n")

    # STEP 3: Delete ALL drafted moves
    print("STEP 3: Elimina moves in draft...")

    draft_moves = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move', 'search',
        [[
            ['journal_id', '=', journal_id],
            ['state', '=', 'draft']
        ]],
        {'limit': 10000}
    )

    print(f"  Trovati {len(draft_moves)} moves da eliminare")

    deleted_count = 0
    for move_id in draft_moves:
        try:
            models.execute_kw(
                CONFIG['db'], uid, CONFIG['password'],
                'account.move', 'unlink',
                [[move_id]]
            )
            deleted_count += 1
            if deleted_count % 100 == 0:
                print(f"    Eliminati: {deleted_count}/{len(draft_moves)}")
        except Exception as e:
            pass

    print(f"  OK Eliminati: {deleted_count} moves\n")

    # STEP 4: Verify balance
    saldo_after = get_saldo(models, uid, account_code)
    print(f"Saldo DOPO: CHF {saldo_after:,.2f}")

    if abs(saldo_after) < 100:
        print(f"[OK] PULIZIA RIUSCITA - Saldo ~0")
        return True
    else:
        print(f"[WARN] ATTENZIONE - Saldo ancora {saldo_after:,.2f}")
        return False

def main():
    print("\n" + "=" * 80)
    print("FASE 1 - PULIZIA INTELLIGENTE MOVIMENTI ERRATI")
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    uid, models = connect()
    print(f"\nConnesso come UID: {uid}\n")

    # Accounts to clean
    accounts = [
        ('1024', 'UBS CHF', 'BNK1'),
        ('1025', 'UBS EUR', 'BNK2'),
    ]

    results = {}

    for code, name, journal in accounts:
        success = clean_account_intelligent(models, uid, code, name, journal)
        results[code] = success

    # Final report
    print("\n" + "=" * 80)
    print("RISULTATI FASE 1 - PULIZIA")
    print("=" * 80 + "\n")

    for code, name, journal in accounts:
        status = "[OK]" if results.get(code) else "[FAILED]"
        saldo = get_saldo(models, uid, code)
        print(f"{code:10} {name:30} CHF {saldo:>15,.2f} {status}")

    # Check if we can proceed to FASE 2
    all_clean = all(results.values())

    if all_clean:
        print("\n[OK] FASE 1 COMPLETATA - Procedere con FASE 2 (Import)")
    else:
        print("\n[WARN] FASE 1 PARZIALE - Verificare errori prima di FASE 2")

    print()

if __name__ == "__main__":
    main()
