#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CONFRONTO FINALE SALDI BANCHE: ESTRATTI CONTO vs ODOO
Estrae "Schlusssaldo" da CSV UBS e confronta con Odoo
"""

import xmlrpc.client
import ssl
import sys
import io

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

print("=" * 120)
print("CONFRONTO FINALE SALDI BANCARI: ESTRATTI CONTO (CSV) vs ODOO (31/12/2024)")
print("=" * 120)

# Function to extract "Schlusssaldo" from UBS CSV
def get_schlusssaldo_from_csv(filepath):
    """Estrae il Schlusssaldo (saldo finale) da un CSV UBS"""
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
            for line in lines:
                if line.startswith('Schlusssaldo:'):
                    parts = line.split(';')
                    if len(parts) >= 2:
                        saldo_str = parts[1].replace("'", "").replace(",", "").strip()
                        return float(saldo_str)
        return None
    except Exception as e:
        print(f"  ERRORE leggendo {filepath}: {str(e)}")
        return None

# CSV files
csv_files = {
    'UBS CHF': r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.10-31.12.2024.csv',
    'UBS EUR': r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS EUR\UBS EUR 1.7-31.12.2024.csv',
}

print("\n" + "=" * 120)
print("STEP 1: LETTURA SALDI FINALI DA ESTRATTI CONTO CSV")
print("=" * 120)

bank_statements = {}

for bank_name, filepath in csv_files.items():
    print(f"\n{bank_name}: {filepath}")
    saldo = get_schlusssaldo_from_csv(filepath)
    if saldo:
        currency = 'CHF' if 'CHF' in bank_name else 'EUR'
        print(f"  Schlusssaldo (Saldo finale): {currency} {saldo:,.2f}")
        bank_statements[bank_name] = {
            'saldo': saldo,
            'currency': currency
        }
    else:
        print(f"  ERRORE: Impossibile estrarre Schlusssaldo")

print("\n" + "=" * 120)
print("STEP 2: LETTURA SALDI ODOO AL 31/12/2024")
print("=" * 120)

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

# Main bank accounts mapping
odoo_accounts = {
    'UBS CHF': '1024',
    'UBS EUR': '1025',
}

odoo_balances = {}

for bank_name, code in odoo_accounts.items():
    balance = get_odoo_balance(code)
    if balance:
        odoo_balances[bank_name] = balance
        print(f"\n{code} - {balance['name']}")
        print(f"  Saldo: CHF {balance['balance']:>15,.2f}")
        print(f"  Movimenti: {balance['count']}")

print("\n" + "=" * 120)
print("STEP 3: CONFRONTO SALDI BANCHE")
print("=" * 120)

print(f"\n{'BANCA':<20} {'ESTRATTO CONTO':>25} {'ODOO':>25} {'DIFFERENZA':>25} {'STATUS':>10}")
print("-" * 120)

total_statement_chf = 0
total_odoo_chf = 0
total_diff_chf = 0

for bank_name in ['UBS CHF', 'UBS EUR']:
    if bank_name in bank_statements and bank_name in odoo_balances:
        statement_data = bank_statements[bank_name]
        odoo_data = odoo_balances[bank_name]

        statement_saldo = statement_data['saldo']
        currency = statement_data['currency']
        odoo_balance = odoo_data['balance']

        # Convert EUR to CHF for comparison (assume rate 0.93)
        if currency == 'EUR':
            statement_saldo_chf = statement_saldo * 0.93
            diff_chf = statement_saldo_chf - odoo_balance
            print(f"{bank_name:<20} {currency} {statement_saldo:>18,.2f} CHF {odoo_balance:>18,.2f} CHF {diff_chf:>18,.2f}", end='')
        else:
            diff_chf = statement_saldo - odoo_balance
            print(f"{bank_name:<20} {currency} {statement_saldo:>18,.2f} CHF {odoo_balance:>18,.2f} CHF {diff_chf:>18,.2f}", end='')

        # Status
        if abs(diff_chf) < 1.00:
            status = "✅ OK"
        elif abs(diff_chf) < 1000.00:
            status = "⚠️  QUASI"
        else:
            status = "❌ NO"

        print(f" {status:>10}")

        total_statement_chf += statement_saldo if currency == 'CHF' else statement_saldo * 0.93
        total_odoo_chf += odoo_balance
        total_diff_chf += diff_chf

print("-" * 120)
print(f"{'TOTALE':<20} CHF {total_statement_chf:>22,.2f} CHF {total_odoo_chf:>18,.2f} CHF {total_diff_chf:>18,.2f}")

print("\n" + "=" * 120)
print("STEP 4: SALDI ALTRI CONTI CHIAVE (1001, 1022, 1023, 10901, 1099)")
print("=" * 120)

key_accounts = [
    ('1001', 'Cash', 90000.00),
    ('1022', 'Outstanding Receipts', 0.00),
    ('1023', 'Outstanding Payments', 0.00),
    ('10901', 'Liquiditätstransfer', 0.00),
    ('1099', 'Transfer account', 0.00),
]

print(f"\n{'KONTO':<10} {'DESCRIZIONE':<35} {'SALDO':>20} {'TARGET':>20} {'DELTA':>20} {'STATUS':>10}")
print("-" * 120)

for code, desc, target in key_accounts:
    balance = get_odoo_balance(code)
    if balance:
        delta = abs(balance['balance'] - target)
        status = "✅ OK" if delta < 0.01 else "❌ NO"
        print(f"{code:<10} {balance['name'][:35]:<35} CHF {balance['balance']:>15,.2f} CHF {target:>15,.2f} CHF {delta:>15,.2f} {status:>10}")

print("\n" + "=" * 120)
print("RIEPILOGO FINALE")
print("=" * 120)

print(f"\nBANCHE (UBS CHF + UBS EUR):")
print(f"  Saldo totale Estratti Conto: CHF {total_statement_chf:>15,.2f}")
print(f"  Saldo totale Odoo:            CHF {total_odoo_chf:>15,.2f}")
print(f"  DIFFERENZA TOTALE:            CHF {total_diff_chf:>15,.2f}")

if abs(total_diff_chf) < 1.00:
    print(f"\n  ✅ STATUS: ALLINEATO (differenza < CHF 1)")
elif abs(total_diff_chf) < 1000.00:
    print(f"\n  ⚠️  STATUS: QUASI ALLINEATO (differenza < CHF 1,000)")
else:
    print(f"\n  ❌ STATUS: NON ALLINEATO (differenza CHF {abs(total_diff_chf):,.2f})")
    print(f"\n  AZIONE RICHIESTA: Odoo ha CHF {abs(total_diff_chf):,.2f} IN MENO rispetto agli estratti conto!")
    print(f"  Causa probabile: Movimenti bancari non registrati in Odoo")

print("\n" + "=" * 120)
print("END OF REPORT")
print("=" * 120)
