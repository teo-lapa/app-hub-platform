#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CONFRONTO SALDI BANCHE vs ODOO - Fine 2024
Compara i saldi finali dei conti bancari tra estratti conto CSV e contabilità Odoo
"""

import xmlrpc.client
import ssl
import sys
import io
import csv
import glob
from datetime import datetime
from collections import defaultdict

# Fix encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Odoo connection
URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
USERNAME = "paul@lapa.ch"
PASSWORD = "lapa201180"

# Disable SSL verification
ssl._create_default_https_context = ssl._create_unverified_context

print("=" * 80)
print("CONFRONTO SALDI BANCARI: ESTRATTI CONTO vs ODOO")
print(f"Data: {datetime.now().strftime('%d %B %Y, %H:%M')}")
print("=" * 80)

# Connect to Odoo
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USERNAME, PASSWORD, {})

if not uid:
    print("ERRORE: Autenticazione fallita")
    sys.exit(1)

print(f"\nConnesso a Odoo come UID: {uid}\n")
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

def get_odoo_bank_balance(account_code, date='2024-12-31'):
    """Ottiene il saldo di un conto bancario da Odoo"""
    accounts = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id', 'code', 'name'], 'limit': 1}
    )

    if not accounts:
        return None

    account = accounts[0]
    account_id = account['id']

    # Get all posted move lines up to date
    move_lines = models.execute_kw(DB, uid, PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '<=', date],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['debit', 'credit', 'date']}
    )

    if not move_lines:
        return {
            'code': account['code'],
            'name': account['name'],
            'balance': 0.00,
            'count': 0
        }

    debit = sum(line['debit'] for line in move_lines)
    credit = sum(line['credit'] for line in move_lines)
    balance = debit - credit

    return {
        'code': account['code'],
        'name': account['name'],
        'balance': balance,
        'debit': debit,
        'credit': credit,
        'count': len(move_lines)
    }

# Mapping conti bancari Odoo (aggiorna con i codici reali)
# Devo verificare quali conti esistono realmente
print("=" * 80)
print("STEP 1: RICERCA CONTI BANCARI IN ODOO")
print("=" * 80)

# Cerca tutti i conti che potrebbero essere banche
bank_keywords = ['UBS', 'Credit', 'PostFinance', 'Raiffeisen', 'Bank', 'CHF', 'EUR', 'USD']
bank_accounts = []

for keyword in bank_keywords:
    accounts = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['name', 'ilike', keyword], ['code', '=like', '10%']]],
        {'fields': ['id', 'code', 'name'], 'limit': 50}
    )
    for acc in accounts:
        if acc not in bank_accounts:
            bank_accounts.append(acc)

# Remove duplicates based on id
seen_ids = set()
unique_accounts = []
for acc in bank_accounts:
    if acc['id'] not in seen_ids:
        seen_ids.add(acc['id'])
        unique_accounts.append(acc)

bank_accounts = sorted(unique_accounts, key=lambda x: x['code'])

print(f"\nTrovati {len(bank_accounts)} conti bancari potenziali:\n")
for acc in bank_accounts:
    print(f"  {acc['code']} - {acc['name']}")

print("\n" + "=" * 80)
print("STEP 2: LETTURA ESTRATTI CONTO CSV")
print("=" * 80)

# Cerca file CSV nella cartella Downloads/CHIUSURA 2024
csv_folder = r'C:\Users\lapa\Downloads\CHIUSURA 2024'
csv_pattern = f'{csv_folder}\\*.csv'

csv_files = glob.glob(csv_pattern)
print(f"\nCercando file CSV in: {csv_folder}")
print(f"Pattern: {csv_pattern}")
print(f"Trovati {len(csv_files)} file CSV:\n")

bank_statement_balances = {}

for csv_file in csv_files:
    print(f"\nFile: {csv_file}")
    try:
        # Prova a leggere il CSV
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            # Read first few lines to understand structure
            lines = f.readlines()
            if len(lines) < 2:
                print(f"  SKIP: File vuoto o troppo corto")
                continue

            # Try to detect delimiter
            first_line = lines[0]
            delimiter = ';' if ';' in first_line else ','

            # Reset file
            f.seek(0)
            reader = csv.DictReader(f, delimiter=delimiter)

            rows = list(reader)
            print(f"  Righe: {len(rows)}")
            print(f"  Colonne: {reader.fieldnames}")

            if len(rows) > 0:
                # Get last row (final balance)
                last_row = rows[-1]
                print(f"  Ultima riga: {last_row}")

                # Try to extract balance - look for common field names
                balance_fields = ['Balance', 'Saldo', 'balance', 'saldo', 'Amount', 'Importo']
                balance = None

                for field in balance_fields:
                    if field in last_row and last_row[field]:
                        try:
                            # Clean and parse balance
                            balance_str = last_row[field].replace("'", "").replace(",", "").replace(" ", "")
                            balance = float(balance_str)
                            print(f"  Saldo finale ({field}): {balance:.2f}")
                            break
                        except:
                            continue

                if balance is not None:
                    # Try to determine which bank account this is
                    filename = csv_file.split('\\')[-1]
                    bank_statement_balances[filename] = {
                        'file': filename,
                        'balance': balance,
                        'rows': len(rows),
                        'last_row': last_row
                    }
                else:
                    print(f"  WARNING: Saldo non trovato")

    except Exception as e:
        print(f"  ERRORE: {str(e)}")

print("\n" + "=" * 80)
print("STEP 3: SALDI ODOO CONTI BANCARI AL 31/12/2024")
print("=" * 80)

odoo_balances = {}
for acc in bank_accounts:
    balance_data = get_odoo_bank_balance(acc['code'], '2024-12-31')
    if balance_data:
        odoo_balances[acc['code']] = balance_data
        print(f"\n{balance_data['code']} - {balance_data['name']}")
        print(f"  Saldo: CHF {balance_data['balance']:>15,.2f}")
        print(f"  Movimenti: {balance_data['count']}")

print("\n" + "=" * 80)
print("STEP 4: CONFRONTO SALDI")
print("=" * 80)

print("\nESTRATTI CONTO CSV:")
print("-" * 80)
for filename, data in bank_statement_balances.items():
    print(f"\n{filename}")
    print(f"  Saldo finale: CHF {data['balance']:>15,.2f}")
    print(f"  Transazioni: {data['rows']}")

print("\n\nCONTI ODOO:")
print("-" * 80)
total_odoo = 0
for code, data in sorted(odoo_balances.items()):
    print(f"\n{code} - {data['name']}")
    print(f"  Saldo: CHF {data['balance']:>15,.2f}")
    total_odoo += data['balance']

print(f"\n{'='*80}")
print(f"TOTALE SALDI ODOO (tutti i conti bancari): CHF {total_odoo:>15,.2f}")
print(f"{'='*80}")

print("\n" + "=" * 80)
print("STEP 5: SALDI ALTRI CONTI CHIAVE (1001, 1022, 1023, 10901, 1099)")
print("=" * 80)

key_accounts = ['1001', '1022', '1023', '10901', '1099']
for code in key_accounts:
    balance_data = get_odoo_bank_balance(code, '2024-12-31')
    if balance_data:
        print(f"\n{balance_data['code']} - {balance_data['name']}")
        print(f"  Saldo: CHF {balance_data['balance']:>15,.2f}")
        print(f"  Target: CHF 0.00" if code != '1001' else "  Target: CHF 90,000.00")

        target = 0.00 if code != '1001' else 90000.00
        delta = abs(balance_data['balance'] - target)
        status = "✅ OK" if delta < 0.01 else f"❌ Delta: CHF {delta:,.2f}"
        print(f"  Status: {status}")

print("\n" + "=" * 80)
print("END OF REPORT")
print("=" * 80)
