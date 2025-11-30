#!/usr/bin/env python3
"""
BATCH RECONCILIATION - Stile Automated_Audit_Reconciliations
Riconcilia MIGLIAIA di righe in poche chiamate API

Ispirato da: github.com/seyithocuk/Automated_Audit_Reconciliations
"""

import xmlrpc.client
import ssl
from collections import defaultdict
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

def batch_reconcile_account(models, uid, account_code, account_name):
    """
    BATCH RECONCILIATION di un account

    ALGORITMO (simile a Automated_Audit_Reconciliations):
    1. Estrai TUTTE le righe non riconciliate
    2. Raggruppa per criterio di matching (partner + amount)
    3. Per ogni gruppo: se debit = credit → BATCH reconcile
    """

    print(f"\n{'=' * 80}")
    print(f"BATCH RECONCILIATION: {account_code} - {account_name}")
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

    # Get ALL unreconciled lines
    lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['reconciled', '=', False],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['id', 'date', 'debit', 'credit', 'partner_id', 'name', 'amount_currency'], 'order': 'date'}
    )

    print(f"Righe non riconciliate: {len(lines)}\n")

    if len(lines) == 0:
        print("[OK] Nessuna riga da riconciliare")
        return 0

    # GROUP BY: partner + absolute_amount
    # Questo è il "matching criteria" dell'audit reconciliation
    groups = defaultdict(list)

    for line in lines:
        partner_id = line.get('partner_id', [False])[0] if line.get('partner_id') else False
        amount = abs(line['debit'] if line['debit'] > 0 else line['credit'])

        # Key: (partner, rounded_amount)
        key = (partner_id, round(amount, 2))
        groups[key].append(line)

    print(f"Gruppi identificati: {len(groups)}\n")

    # BATCH RECONCILE
    reconciled_batches = 0
    reconciled_lines = 0
    skipped_groups = 0

    for key, group_lines in groups.items():
        partner_id, amount = key

        # Calcola balance del gruppo
        total_debit = sum(l['debit'] for l in group_lines)
        total_credit = sum(l['credit'] for l in group_lines)
        balance = total_debit - total_credit

        # Se bilancia (±0.01) → RICONCILIA
        if abs(balance) < 0.01 and len(group_lines) >= 2:
            line_ids = [l['id'] for l in group_lines]

            try:
                # BATCH RECONCILE - UNA sola chiamata API per N righe!
                models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.move.line', 'reconcile',
                    [line_ids]
                )

                reconciled_batches += 1
                reconciled_lines += len(line_ids)

                print(f"✓ Riconciliate {len(line_ids)} righe (Partner: {partner_id}, Amount: {amount:,.2f})")

                if reconciled_batches % 10 == 0:
                    print(f"  Progress: {reconciled_batches} batch processati...")

            except Exception as e:
                print(f"✗ Errore su batch Partner {partner_id}: {str(e)[:100]}")
                skipped_groups += 1
        else:
            # Gruppo non bilancia o ha solo 1 riga
            skipped_groups += 1

    print(f"\n{'=' * 80}")
    print(f"RISULTATI BATCH RECONCILIATION")
    print(f"{'=' * 80}")
    print(f"Batch riconciliati: {reconciled_batches}")
    print(f"Righe riconciliate: {reconciled_lines}")
    print(f"Gruppi saltati (non bilanciano): {skipped_groups}")
    print()

    return reconciled_lines

def verify_balance(models, uid, account_code):
    """Verifica saldo finale"""
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

def main():
    print("\n" + "=" * 80)
    print("BATCH RECONCILIATION - Automated Approach")
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    uid, models = connect()
    print(f"\nConnesso come UID: {uid}\n")

    # Accounts da riconciliare in batch
    accounts_to_reconcile = [
        ('1022', 'Outstanding Receipts'),
        ('1023', 'Outstanding Payments'),
    ]

    total_reconciled = 0

    for code, name in accounts_to_reconcile:
        reconciled = batch_reconcile_account(models, uid, code, name)
        total_reconciled += reconciled

    # Verify final balances
    print("\n" + "=" * 80)
    print("VERIFICA SALDI FINALI")
    print("=" * 80 + "\n")

    for code, name in accounts_to_reconcile:
        balance = verify_balance(models, uid, code)
        if balance is not None:
            status = "OK" if abs(balance) < 1.00 else "WARN"
            print(f"{code:10} {name:30} CHF {balance:>15,.2f} [{status}]")

    print("\n" + "=" * 80)
    print(f"COMPLETATO - Totale righe riconciliate: {total_reconciled}")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
