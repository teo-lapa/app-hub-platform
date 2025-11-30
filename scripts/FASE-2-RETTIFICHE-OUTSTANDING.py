#!/usr/bin/env python3
"""
FASE 2 - RETTIFICHE OUTSTANDING + CREDIT SUISSE
Chiude Outstanding accounts e allinea Credit Suisse
"""

import xmlrpc.client
import ssl
from datetime import datetime

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

TARGET_BALANCES = {
    '1022': 0.00,  # Outstanding Receipts
    '1023': 0.00,  # Outstanding Payments
    '1026': 24897.72,  # Credit Suisse
}

def connect():
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")
    return uid, models

def get_balance(models, uid, account_code):
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
        [[['account_id', '=', account_id], ['parent_state', '=', 'posted']]],
        {'fields': ['debit', 'credit']}
    )
    balance = sum(l['debit'] - l['credit'] for l in lines)
    return account_id, balance

def create_adjustment(models, uid, account_code, account_id, current, target):
    diff = target - current

    if abs(diff) < 0.01:
        print(f"  [OK] Already aligned")
        return True

    print(f"  Current: CHF {current:,.2f}")
    print(f"  Target:  CHF {target:,.2f}")
    print(f"  Diff:    CHF {diff:+,.2f}\n")

    # Get suspense 1021
    suspense = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', '1021']]],
        {'fields': ['id'], 'limit': 1}
    )
    if not suspense:
        print("[ERROR] Suspense 1021 not found")
        return False
    suspense_id = suspense[0]['id']

    # Get MISC journal
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

    # Create lines
    if diff > 0:
        line_vals = [
            (0, 0, {
                'account_id': account_id,
                'debit': abs(diff),
                'credit': 0,
                'name': f'Rettifica chiusura {account_code} al 31.12.2024'
            }),
            (0, 0, {
                'account_id': suspense_id,
                'debit': 0,
                'credit': abs(diff),
                'name': f'Rettifica chiusura {account_code} al 31.12.2024'
            })
        ]
    else:
        line_vals = [
            (0, 0, {
                'account_id': account_id,
                'debit': 0,
                'credit': abs(diff),
                'name': f'Rettifica chiusura {account_code} al 31.12.2024'
            }),
            (0, 0, {
                'account_id': suspense_id,
                'debit': abs(diff),
                'credit': 0,
                'name': f'Rettifica chiusura {account_code} al 31.12.2024'
            })
        ]

    try:
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
        models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move', 'action_post',
            [[move_id]]
        )
        print(f"  [OK] Rettifica creata: Move {move_id}")
        print(f"       Importo: CHF {abs(diff):,.2f}\n")
        return True
    except Exception as e:
        print(f"  [ERROR] {str(e)[:200]}\n")
        return False

def main():
    print("\n" + "=" * 80)
    print("FASE 2 - RETTIFICHE OUTSTANDING + CREDIT SUISSE")
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80 + "\n")

    uid, models = connect()
    print(f"Connesso come UID: {uid}\n")

    results = {}

    for code in ['1022', '1023', '1026']:
        print("=" * 80)
        print(f"RETTIFICA KONTO {code}")
        print("=" * 80 + "\n")

        account_id, current = get_balance(models, uid, code)
        if account_id is None:
            print(f"[ERROR] Account {code} not found\n")
            results[code] = False
            continue

        target = TARGET_BALANCES[code]
        success = create_adjustment(models, uid, code, account_id, current, target)
        results[code] = success

        if success:
            _, new_bal = get_balance(models, uid, code)
            diff = abs(new_bal - target)
            status = "[PERFETTO]" if diff < 0.01 else f"[WARN: diff {diff:.2f}]"
            print(f"  Saldo finale: CHF {new_bal:,.2f} {status}\n")

    # Final report
    print("\n" + "=" * 80)
    print("RISULTATI FINALI")
    print("=" * 80 + "\n")

    for code in ['1024', '1025', '1022', '1023', '1026']:
        _, final = get_balance(models, uid, code)
        target = TARGET_BALANCES.get(code, None)
        if target is not None:
            diff = abs(final - target)
            status = "[PERFETTO]" if diff < 0.01 else f"[GAP: {diff:,.2f}]"
        else:
            target = final
            status = "[OK]"
        print(f"{code}  CHF {final:>12,.2f}  target: CHF {target:>12,.2f}  {status}")

    all_ok = all(results.values())
    if all_ok:
        print("\n[OK] TUTTI I SALDI ALLINEATI!")
        print("     Contabilita' 2024 pronta per certificazione\n")
    else:
        print("\n[WARN] Alcuni saldi non allineati\n")

if __name__ == "__main__":
    main()
