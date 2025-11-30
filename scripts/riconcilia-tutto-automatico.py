#!/usr/bin/env python3
"""
RICONCILIAZIONE AUTOMATICA COMPLETA
Riconcilia TUTTI i conti aperti in un colpo solo
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

def connect():
    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")
    return uid, models

def get_account_balance(models, uid, account_code):
    """Get balance of an account"""
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

def reconcile_outstanding_auto(models, uid, account_code, account_name):
    """Auto-reconcile outstanding account using Odoo's built-in reconciliation"""

    print(f"\n{'=' * 80}")
    print(f"RICONCILIAZIONE: {account_code} - {account_name}")
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
        return 0

    account_id = accounts[0]['id']

    # Get all unreconciled lines
    lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['parent_state', '=', 'posted'],
            ['reconciled', '=', False]
        ]],
        {'fields': ['id', 'date', 'debit', 'credit', 'name', 'partner_id', 'move_id'], 'order': 'date'}
    )

    print(f"Righe non riconciliate: {len(lines)}")

    if len(lines) == 0:
        print("[OK] Nessuna riga da riconciliare")
        return 0

    # Group by partner and amount for auto-matching
    reconciled_count = 0

    # Try to match debit with credit
    debits = [l for l in lines if l['debit'] > 0]
    credits = [l for l in lines if l['credit'] > 0]

    print(f"  Debiti da riconciliare: {len(debits)}")
    print(f"  Crediti da riconciliare: {len(credits)}")

    for debit_line in debits:
        debit_amount = debit_line['debit']
        debit_partner = debit_line.get('partner_id', [False])[0] if debit_line.get('partner_id') else None

        # Find matching credit
        for credit_line in credits:
            credit_amount = credit_line['credit']
            credit_partner = credit_line.get('partner_id', [False])[0] if credit_line.get('partner_id') else None

            # Match if same amount and same partner
            if abs(debit_amount - credit_amount) < 0.01 and debit_partner == credit_partner:
                try:
                    # Reconcile
                    models.execute_kw(
                        CONFIG['db'], uid, CONFIG['password'],
                        'account.move.line', 'reconcile',
                        [[debit_line['id'], credit_line['id']]]
                    )

                    reconciled_count += 1
                    credits.remove(credit_line)  # Remove from available credits

                    if reconciled_count % 100 == 0:
                        print(f"  Riconciliate {reconciled_count} coppie...")

                    break  # Move to next debit

                except Exception as e:
                    # Ignore errors and continue
                    pass

    print(f"\n[OK] Riconciliate {reconciled_count} coppie")
    return reconciled_count

def close_transfer_account(models, uid, account_code, target_account_code):
    """Close transfer account by moving balance to target"""

    print(f"\n{'=' * 80}")
    print(f"CHIUSURA: {account_code} -> {target_account_code}")
    print(f"{'=' * 80}\n")

    balance = get_account_balance(models, uid, account_code)

    if balance is None:
        print(f"[ERROR] Account {account_code} not found")
        return False

    if abs(balance) < 0.01:
        print(f"[OK] Account già a zero (CHF {balance:.2f})")
        return True

    print(f"Saldo corrente: CHF {balance:,.2f}")

    # Get account IDs
    source = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id'], 'limit': 1}
    )

    target = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', target_account_code]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not source or not target:
        print("[ERROR] Account not found")
        return False

    source_id = source[0]['id']
    target_id = target[0]['id']

    # Get MISC journal
    journals = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.journal', 'search_read',
        [[['code', '=', 'MISC'], ['company_id', '=', 1]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not journals:
        print("[ERROR] MISC journal not found")
        return False

    journal_id = journals[0]['id']

    # Create closing entry
    line_vals = []

    if balance > 0:
        # Debit in source, credit in target
        line_vals = [
            (0, 0, {
                'account_id': source_id,
                'debit': 0,
                'credit': balance,
                'name': f'Chiusura {account_code}'
            }),
            (0, 0, {
                'account_id': target_id,
                'debit': balance,
                'credit': 0,
                'name': f'Da chiusura {account_code}'
            })
        ]
    else:
        # Credit in source, debit in target
        line_vals = [
            (0, 0, {
                'account_id': source_id,
                'debit': abs(balance),
                'credit': 0,
                'name': f'Chiusura {account_code}'
            }),
            (0, 0, {
                'account_id': target_id,
                'debit': 0,
                'credit': abs(balance),
                'name': f'Da chiusura {account_code}'
            })
        ]

    try:
        # Create move
        move_id = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move', 'create',
            [{
                'journal_id': journal_id,
                'date': '2024-12-31',
                'ref': f'Chiusura {account_code}',
                'line_ids': line_vals
            }]
        )

        # Post move
        models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move', 'action_post',
            [[move_id]]
        )

        print(f"[OK] Creata registrazione di chiusura (Move ID: {move_id})")
        return True

    except Exception as e:
        print(f"[ERROR] {e}")
        return False

def main():
    print("\n" + "=" * 80)
    print("RICONCILIAZIONE AUTOMATICA COMPLETA")
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    uid, models = connect()
    print(f"\nConnesso come UID: {uid}\n")

    # Step 1: Reconcile outstanding accounts
    print("\nSTEP 1: RICONCILIAZIONE OUTSTANDING ACCOUNTS")
    print("=" * 80)

    reconcile_outstanding_auto(models, uid, '1022', 'Outstanding Receipts')
    reconcile_outstanding_auto(models, uid, '1023', 'Outstanding Payments')

    # Step 2: Close transfer accounts
    print("\n\nSTEP 2: CHIUSURA CONTI TRANSITORI")
    print("=" * 80)

    close_transfer_account(models, uid, '10901', '1024')  # Transfer to UBS CHF
    close_transfer_account(models, uid, '1021', '1024')   # Bank Suspense to UBS CHF

    # Step 3: Verify final balances
    print("\n\nSTEP 3: VERIFICA SALDI FINALI")
    print("=" * 80)

    accounts_to_check = [
        ('1022', 'Outstanding Receipts', 0.00),
        ('1023', 'Outstanding Payments', 0.00),
        ('10901', 'Trasferimento liquidità', 0.00),
        ('1021', 'Bank Suspense Account', 0.00),
        ('1024', 'UBS-CHF', 182573.56),
        ('1025', 'EUR-UBS', 128860.70),
        ('1026', 'CHF-CRS PRINCIPALE', 24897.72),
    ]

    print()
    for code, name, expected in accounts_to_check:
        balance = get_account_balance(models, uid, code)
        if balance is not None:
            status = "OK" if abs(balance - expected) < 1.00 else "ERROR"
            print(f"{code:10} {name:30} CHF {balance:>15,.2f}  (atteso: {expected:>12,.2f}) [{status}]")
        else:
            print(f"{code:10} {name:30} NOT FOUND")

    print("\n" + "=" * 80)
    print("RICONCILIAZIONE COMPLETATA")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
