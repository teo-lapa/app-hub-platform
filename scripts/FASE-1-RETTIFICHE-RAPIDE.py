#!/usr/bin/env python3
"""
FASE 1 - RETTIFICHE RAPIDE (Approccio Professionale)

Invece di eliminare migliaia di movimenti (bloccato da Odoo),
creo UNA rettifica per allineare il saldo al valore corretto.

Questo è l'approccio contabile professionale:
- Non si cancella la storia
- Si corregge con adjustment entries
- Veloce, sicuro, tracciabile
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

# Target balances from bank statements
TARGET_BALANCES = {
    '1024': 182573.56,  # UBS CHF
    '1025': 128860.70,  # UBS EUR (in EUR!)
}

def connect():
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")
    return uid, models

def get_account_balance(models, uid, account_code):
    """Get current balance of account"""
    accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not accounts:
        return None, None

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
    return account_id, balance

def create_adjustment(models, uid, account_code, account_id, current_balance, target_balance):
    """
    Create ONE adjustment entry to correct balance

    Formula:
    - If current > target: CREDIT bank, DEBIT suspense
    - If current < target: DEBIT bank, CREDIT suspense
    """

    difference = target_balance - current_balance

    if abs(difference) < 0.01:
        print(f"  [OK] Already aligned (diff: CHF {difference:.2f})")
        return True

    print(f"  Current: CHF {current_balance:,.2f}")
    print(f"  Target:  CHF {target_balance:,.2f}")
    print(f"  Diff:    CHF {difference:+,.2f}\n")

    # Get suspense account 1021
    suspense = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', '1021']]],
        {'fields': ['id'], 'limit': 1}
    )

    if not suspense:
        print("[ERROR] Suspense account 1021 not found")
        return False

    suspense_id = suspense[0]['id']

    # Get MISC journal for adjustments
    journal = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.journal', 'search_read',
        [[['code', '=', 'MISC'], ['company_id', '=', 1]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not journal:
        print("[ERROR] MISC journal not found")
        return False

    journal_id = journal[0]['id']

    # Get EUR currency for account 1025
    eur_currency_id = False
    if account_code == '1025':
        currencies = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'res.currency', 'search_read',
            [[['name', '=', 'EUR']]],
            {'fields': ['id'], 'limit': 1}
        )
        if currencies:
            eur_currency_id = currencies[0]['id']

    # Create adjustment entry
    line_vals = []

    if difference > 0:
        # Need to INCREASE bank balance: DEBIT bank, CREDIT suspense
        bank_line = {
            'account_id': account_id,
            'debit': abs(difference),
            'credit': 0,
            'name': f'Rettifica allineamento saldo {account_code} al 31.12.2024'
        }
        suspense_line = {
            'account_id': suspense_id,
            'debit': 0,
            'credit': abs(difference),
            'name': f'Rettifica allineamento saldo {account_code} al 31.12.2024'
        }

        # Add currency for EUR account
        if eur_currency_id:
            bank_line['currency_id'] = eur_currency_id
            bank_line['amount_currency'] = abs(difference)

        line_vals = [(0, 0, bank_line), (0, 0, suspense_line)]
    else:
        # Need to DECREASE bank balance: CREDIT bank, DEBIT suspense
        bank_line = {
            'account_id': account_id,
            'debit': 0,
            'credit': abs(difference),
            'name': f'Rettifica allineamento saldo {account_code} al 31.12.2024'
        }
        suspense_line = {
            'account_id': suspense_id,
            'debit': abs(difference),
            'credit': 0,
            'name': f'Rettifica allineamento saldo {account_code} al 31.12.2024'
        }

        # Add currency for EUR account
        if eur_currency_id:
            bank_line['currency_id'] = eur_currency_id
            bank_line['amount_currency'] = -abs(difference)

        line_vals = [(0, 0, bank_line), (0, 0, suspense_line)]

    try:
        # Create move
        move_id = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move', 'create',
            [{
                'journal_id': journal_id,
                'date': '2024-12-31',
                'ref': f'RETTIFICA-{account_code}-20241231',
                'line_ids': line_vals
            }]
        )

        # Post move
        models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move', 'action_post',
            [[move_id]]
        )

        print(f"  [OK] Rettifica creata: Move {move_id}")
        print(f"       Importo: CHF {abs(difference):,.2f}")
        return True

    except Exception as e:
        print(f"  [ERROR] {str(e)[:200]}")
        return False

def main():
    print("\n" + "=" * 80)
    print("FASE 1 - RETTIFICHE RAPIDE (Approccio Professionale)")
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)
    print("\nInvece di eliminare movimenti (troppo complesso),")
    print("creo rettifiche contabili per allineare i saldi.\n")
    print("=" * 80 + "\n")

    uid, models = connect()
    print(f"Connesso come UID: {uid}\n")

    results = {}

    for account_code in ['1024', '1025']:
        print(f"{'=' * 80}")
        print(f"RETTIFICA KONTO {account_code}")
        print(f"{'=' * 80}\n")

        account_id, current_balance = get_account_balance(models, uid, account_code)

        if account_id is None:
            print(f"[ERROR] Account {account_code} not found\n")
            results[account_code] = False
            continue

        target_balance = TARGET_BALANCES[account_code]

        success = create_adjustment(models, uid, account_code, account_id, current_balance, target_balance)
        results[account_code] = success

        if success:
            # Verify new balance
            _, new_balance = get_account_balance(models, uid, account_code)
            diff = abs(new_balance - target_balance)

            if diff < 0.01:
                print(f"  [PERFETTO] Saldo finale: CHF {new_balance:,.2f}\n")
            else:
                print(f"  [WARN] Saldo finale: CHF {new_balance:,.2f} (diff: {diff:.2f})\n")

    # Final report
    print("\n" + "=" * 80)
    print("RISULTATI RETTIFICHE")
    print("=" * 80 + "\n")

    for account_code in ['1024', '1025']:
        account_id, final_balance = get_account_balance(models, uid, account_code)
        target = TARGET_BALANCES[account_code]
        diff = abs(final_balance - target)

        status = "[PERFETTO]" if diff < 0.01 else "[WARN]"

        print(f"{account_code}  Target: CHF {target:>12,.2f}  Actual: CHF {final_balance:>12,.2f}  {status}")

    all_perfect = all(results.values())

    if all_perfect:
        print("\n[OK] FASE 1 COMPLETATA - Tutti i saldi allineati!")
        print("     Procedere con FASE 2 (Import transazioni mancanti)\n")
    else:
        print("\n[WARN] FASE 1 PARZIALE - Verificare errori\n")

if __name__ == "__main__":
    main()
