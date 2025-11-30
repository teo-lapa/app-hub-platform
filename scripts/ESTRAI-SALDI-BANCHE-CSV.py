#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ESTRAZIONE SALDI FINALI BANCHE DA CSV E CONFRONTO CON ODOO
"""

import xmlrpc.client
import ssl
import sys
import io
import csv
import glob

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

print("=" * 100)
print("CONFRONTO SALDI BANCHE: ESTRATTI CONTO (CSV) vs ODOO 31/12/2024")
print("=" * 100)

# Get bank statement balances from CSV files
csv_folder = r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024'

# UBS CHF files
ubs_chf_q4 = f'{csv_folder}\\UBS CHF\\UBS CHF 1.10-31.12.2024.csv'
# UBS EUR files
ubs_eur_h2 = f'{csv_folder}\\UBS EUR\\UBS EUR 1.7-31.12.2024.csv'

bank_statements = {}

print("\n" + "=" * 100)
print("STEP 1: LETTURA SALDI FINALI DA CSV ESTRATTI CONTO")
print("=" * 100)

def get_last_balance_from_csv(filepath, currency='CHF'):
    """Estrae il saldo finale (ultima riga) da un CSV UBS"""
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
            if len(lines) < 2:
                return None

            # UBS CSV format: last line has balance in column 9 (0-indexed = 8)
            last_line = lines[-1].strip()
            if not last_line:
                last_line = lines[-2].strip()  # Try second to last if empty

            # Parse CSV
            parts = last_line.split(';')
            if len(parts) > 9:
                # Column 9 is balance
                balance_str = parts[9].replace("'", "").replace(",", "").strip()
                if balance_str:
                    balance = float(balance_str)
                    return balance

            # Fallback: try to find balance column differently
            reader = csv.reader(f, delimiter=';')
            rows = list(reader)
            if len(rows) > 0:
                last_row = rows[-1]
                # Look for a number that could be balance
                for val in reversed(last_row):
                    try:
                        val_clean = val.replace("'", "").replace(",", "")
                        balance = float(val_clean)
                        if abs(balance) > 100:  # Must be reasonably large
                            return balance
                    except:
                        continue

    except Exception as e:
        print(f"  ERRORE leggendo {filepath}: {str(e)}")
        return None

# UBS CHF
print(f"\n1. UBS CHF (Q4 2024): {ubs_chf_q4}")
ubs_chf_balance = get_last_balance_from_csv(ubs_chf_q4, 'CHF')
if ubs_chf_balance:
    print(f"   SALDO FINALE: CHF {ubs_chf_balance:,.2f}")
    bank_statements['UBS CHF 278-122087.01J'] = {
        'currency': 'CHF',
        'balance': ubs_chf_balance,
        'source': 'UBS CHF 1.10-31.12.2024.csv',
        'odoo_account': '1024'
    }
else:
    print(f"   ERRORE: Impossibile estrarre saldo")

# UBS EUR
print(f"\n2. UBS EUR (H2 2024): {ubs_eur_h2}")
ubs_eur_balance = get_last_balance_from_csv(ubs_eur_h2, 'EUR')
if ubs_eur_balance:
    # Convert to CHF (assume rate ~0.93 EUR/CHF)
    ubs_eur_balance_chf = ubs_eur_balance * 0.93
    print(f"   SALDO FINALE: EUR {ubs_eur_balance:,.2f}")
    print(f"   SALDO IN CHF (rate 0.93): CHF {ubs_eur_balance_chf:,.2f}")
    bank_statements['UBS EUR 278-122087.60A'] = {
        'currency': 'EUR',
        'balance': ubs_eur_balance,
        'balance_chf': ubs_eur_balance_chf,
        'source': 'UBS EUR 1.7-31.12.2024.csv',
        'odoo_account': '1025'
    }
else:
    print(f"   ERRORE: Impossibile estrarre saldo")

print("\n" + "=" * 100)
print("STEP 2: LETTURA SALDI ODOO 31/12/2024")
print("=" * 100)

# Connect to Odoo
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USERNAME, PASSWORD, {})

if not uid:
    print("ERRORE: Autenticazione Odoo fallita")
    sys.exit(1)

print(f"\nConnesso a Odoo (UID: {uid})")
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

def get_odoo_balance(account_code):
    """Ottiene saldo account Odoo"""
    accounts = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id', 'code', 'name'], 'limit': 1}
    )

    if not accounts:
        return None

    account = accounts[0]
    account_id = account['id']

    move_lines = models.execute_kw(DB, uid, PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['debit', 'credit']}
    )

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

odoo_balances = {}

# Get main bank accounts
bank_accounts_to_check = [
    '1024',  # UBS CHF
    '1025',  # UBS EUR
    '1026',  # Credit Suisse CHF
    '1034',  # UBS CHF 02U
    '10230', # UBS USD
]

for code in bank_accounts_to_check:
    balance = get_odoo_balance(code)
    if balance:
        odoo_balances[code] = balance
        print(f"\n{code} - {balance['name']}")
        print(f"  Saldo: CHF {balance['balance']:>15,.2f}")
        print(f"  Movimenti: {balance['count']}")

print("\n" + "=" * 100)
print("STEP 3: CONFRONTO SALDI BANCHE vs ODOO")
print("=" * 100)

print("\n{:<40} {:>20} {:>20} {:>20}".format("BANCA", "ESTRATTO CONTO", "ODOO", "DIFFERENZA"))
print("-" * 100)

total_statement = 0
total_odoo = 0
total_diff = 0

for bank_name, statement_data in bank_statements.items():
    odoo_code = statement_data['odoo_account']
    statement_balance = statement_data.get('balance_chf', statement_data['balance'])

    if odoo_code in odoo_balances:
        odoo_balance = odoo_balances[odoo_code]['balance']
        diff = statement_balance - odoo_balance

        print(f"{bank_name:<40} CHF {statement_balance:>15,.2f} CHF {odoo_balance:>15,.2f} CHF {diff:>15,.2f}")

        total_statement += statement_balance
        total_odoo += odoo_balance
        total_diff += diff
    else:
        print(f"{bank_name:<40} CHF {statement_balance:>15,.2f} {'NON TROVATO':>20} {'N/A':>20}")

print("-" * 100)
print(f"{'TOTALE':<40} CHF {total_statement:>15,.2f} CHF {total_odoo:>15,.2f} CHF {total_diff:>15,.2f}")

print("\n" + "=" * 100)
print("STEP 4: SALDI ALTRI CONTI CHIAVE")
print("=" * 100)

key_accounts = ['1001', '1022', '1023', '10901', '1099']
print("\n{:<10} {:<40} {:>20} {:>15}".format("KONTO", "DESCRIZIONE", "SALDO", "TARGET"))
print("-" * 100)

for code in key_accounts:
    balance = get_odoo_balance(code)
    if balance:
        target = 0.00 if code != '1001' else 90000.00
        delta = abs(balance['balance'] - target)
        status = "✅" if delta < 0.01 else "❌"

        print(f"{code:<10} {balance['name']:<40} CHF {balance['balance']:>15,.2f} CHF {target:>10,.2f} {status}")

print("\n" + "=" * 100)
print("RIEPILOGO FINALE")
print("=" * 100)

print(f"\nBANCHE:")
print(f"  Saldo totale Estratti Conto: CHF {total_statement:,.2f}")
print(f"  Saldo totale Odoo:            CHF {total_odoo:,.2f}")
print(f"  DIFFERENZA:                   CHF {total_diff:,.2f}")

if abs(total_diff) < 1.00:
    print(f"\n  STATUS: ✅ ALLINEATO (differenza < CHF 1)")
elif abs(total_diff) < 1000.00:
    print(f"\n  STATUS: ⚠️  QUASI ALLINEATO (differenza < CHF 1,000)")
else:
    print(f"\n  STATUS: ❌ NON ALLINEATO (differenza > CHF 1,000)")

print("\n" + "=" * 100)
print("END OF REPORT")
print("=" * 100)
