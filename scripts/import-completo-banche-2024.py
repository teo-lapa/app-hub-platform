#!/usr/bin/env python3
"""
IMPORT COMPLETO ESTRATTI CONTO 2024
Importa TUTTE le transazioni bancarie dai JSON puliti
"""

import xmlrpc.client
import ssl
import json
from datetime import datetime
from collections import defaultdict

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

def get_or_create_partner(models, uid, name):
    """Get or create partner by name"""
    if not name or name == 'N/A':
        return False

    partners = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'res.partner', 'search_read',
        [[['name', '=', name]]],
        {'fields': ['id'], 'limit': 1}
    )

    if partners:
        return partners[0]['id']

    # Create new partner
    try:
        partner_id = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'res.partner', 'create',
            [{'name': name, 'company_type': 'company'}]
        )
        return partner_id
    except:
        return False

def check_transaction_exists(models, uid, account_id, date, amount, description):
    """Check if transaction already exists in Odoo"""
    lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '=', date],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['id', 'debit', 'credit', 'name']}
    )

    for line in lines:
        line_amount = line['debit'] - line['credit']
        if abs(line_amount - amount) < 0.01:
            # Same date, same amount, probably same transaction
            return True

    return False

def import_ubs_chf(models, uid):
    """Import UBS CHF transactions from JSON"""

    print("\n" + "=" * 80)
    print("IMPORT UBS CHF - 3,290 TRANSAZIONI")
    print("=" * 80 + "\n")

    # Load JSON
    with open('data-estratti/UBS-CHF-2024-CLEAN.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Get account
    accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', '1024']]],
        {'fields': ['id'], 'limit': 1}
    )

    if not accounts:
        print("[ERROR] Account 1024 not found")
        return False

    account_id = accounts[0]['id']

    # Get journal BNK1 (UBS CHF)
    journals = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.journal', 'search_read',
        [[['code', '=', 'BNK1'], ['company_id', '=', 1]]],
        {'fields': ['id', 'default_account_id'], 'limit': 1}
    )

    if not journals:
        print("[ERROR] Journal BNK1 not found")
        return False

    journal_id = journals[0]['id']

    # Get suspense account (1021)
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

    print(f"Account: 1024 (ID: {account_id})")
    print(f"Journal: BNK1 (ID: {journal_id})")
    print(f"Suspense: 1021 (ID: {suspense_id})\n")

    # Load all transactions from CSV files
    transactions = []

    for quarter in data['quarters']:
        csv_file = f"C:/Users/lapa/Downloads/CHIUSURA 2024/{quarter['file']}"
        print(f"Caricando {quarter['file']}...")

        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Parse CSV (skip headers)
            for line in lines[1:]:
                if not line.strip():
                    continue

                parts = line.strip().split(';')
                if len(parts) < 8:
                    continue

                try:
                    # Parse date (DD.MM.YYYY)
                    date_str = parts[1].strip()
                    if not date_str:
                        continue

                    date_parts = date_str.split('.')
                    if len(date_parts) != 3:
                        continue

                    date = f"{date_parts[2]}-{date_parts[1]}-{date_parts[0]}"

                    # Parse amount
                    amount_str = parts[7].strip().replace("'", "")
                    amount = float(amount_str) if amount_str else 0.0

                    if amount == 0:
                        continue

                    # Description
                    description = parts[2].strip()
                    if not description:
                        description = "UBS CHF Transaction"

                    transactions.append({
                        'date': date,
                        'amount': amount,
                        'description': description,
                        'file': quarter['file']
                    })

                except Exception as e:
                    # Skip problematic lines
                    continue

        except Exception as e:
            print(f"  [ERROR] Cannot read {csv_file}: {e}")
            continue

    print(f"\nCaricate {len(transactions)} transazioni dai CSV")

    # Import transactions month by month
    by_month = defaultdict(list)
    for t in transactions:
        month = t['date'][:7]  # YYYY-MM
        by_month[month].append(t)

    imported_count = 0
    skipped_count = 0

    for month in sorted(by_month.keys()):
        month_transactions = by_month[month]
        print(f"\n{month}: {len(month_transactions)} transazioni")

        for t in month_transactions:
            # Check if exists
            if check_transaction_exists(models, uid, account_id, t['date'], t['amount'], t['description']):
                skipped_count += 1
                continue

            # Create move
            line_vals = []

            if t['amount'] > 0:
                # Debit in bank, credit in suspense
                line_vals = [
                    (0, 0, {
                        'account_id': account_id,
                        'debit': t['amount'],
                        'credit': 0,
                        'name': t['description']
                    }),
                    (0, 0, {
                        'account_id': suspense_id,
                        'debit': 0,
                        'credit': t['amount'],
                        'name': t['description']
                    })
                ]
            else:
                # Credit in bank, debit in suspense
                line_vals = [
                    (0, 0, {
                        'account_id': account_id,
                        'debit': 0,
                        'credit': abs(t['amount']),
                        'name': t['description']
                    }),
                    (0, 0, {
                        'account_id': suspense_id,
                        'debit': abs(t['amount']),
                        'credit': 0,
                        'name': t['description']
                    })
                ]

            try:
                # Create move
                move_id = models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.move', 'create',
                    [{
                        'journal_id': journal_id,
                        'date': t['date'],
                        'ref': f"UBS CHF - {t['description'][:50]}",
                        'line_ids': line_vals
                    }]
                )

                # Post move
                models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.move', 'action_post',
                    [[move_id]]
                )

                imported_count += 1

                if imported_count % 100 == 0:
                    print(f"  Importate {imported_count} transazioni...")

            except Exception as e:
                print(f"  [ERROR] {t['date']}: {e}")
                continue

        # Verify monthly balance
        lines = models.execute_kw(
            CONFIG['db'], uid, CONFIG['password'],
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', account_id],
                ['date', '<=', f"{month}-31"],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['debit', 'credit']}
        )

        balance = sum(l['debit'] - l['credit'] for l in lines)
        expected = data['monthly_balances'].get(month, {}).get('ending_balance', 0)

        if expected > 0:
            diff = abs(balance - expected)
            status = "OK" if diff < 100 else "WARN"
            print(f"  Saldo {month}: CHF {balance:,.2f} (atteso: {expected:,.2f}) [{status}]")

    print(f"\n{'=' * 80}")
    print(f"COMPLETATO IMPORT UBS CHF")
    print(f"{'=' * 80}")
    print(f"Importate: {imported_count} transazioni")
    print(f"Saltate (già esistenti): {skipped_count} transazioni")
    print(f"Totale processate: {len(transactions)} transazioni\n")

    return True

def main():
    print("\n" + "=" * 80)
    print("IMPORT COMPLETO ESTRATTI CONTO 2024")
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    uid, models = connect()
    print(f"\nConnesso come UID: {uid}\n")

    # Import UBS CHF
    success = import_ubs_chf(models, uid)

    if not success:
        print("\n[ERROR] Import fallito")
        return

    print("\n[OK] Import completato!\n")

if __name__ == "__main__":
    main()
