#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANALISI COMPLETA CONTI ODOO 2024
Estrae saldi iniziali e finali di TUTTI i conti bancari in Odoo
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
print("ANALISI COMPLETA CONTI BANCARI ODOO 2024")
print("=" * 120)

# Connect to Odoo
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USERNAME, PASSWORD, {})

if not uid:
    print("\nERRORE: Autenticazione fallita")
    sys.exit(1)

print(f"\n✓ Connesso a Odoo (UID: {uid})")
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

def get_account_balance_at_date(account_id, date):
    """Calcola saldo di un conto a una data specifica"""
    move_lines = models.execute_kw(DB, uid, PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '<=', date],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['debit', 'credit']}
    )

    debit = sum(line['debit'] for line in move_lines)
    credit = sum(line['credit'] for line in move_lines)
    balance = debit - credit

    return {
        'balance': balance,
        'debit': debit,
        'credit': credit,
        'count': len(move_lines)
    }

# Tutti i conti bancari da analizzare
bank_accounts = [
    ('1024', 'UBS CHF 278-122087.01J'),
    ('1025', 'UBS EUR 278-122087.60A'),
    ('1026', 'Credit Suisse CHF 3977497-51'),
    ('1034', 'UBS CHF 278-122087.02U'),
    ('10230', 'UBS USD 278-122087.61V'),
    ('10224', 'UBS CHF COVID-KONTO'),
    ('1021', 'Bank Suspense Account'),
    ('10213', 'Carta Credito UBS Laura 8280'),
    ('10214', 'Carta Credito UBS Laura 0280'),
    ('10215', 'Carta Credito UBS Paul 5367'),
    ('10216', 'Carta Credito UBS Paul 0063'),
    ('10222', 'Carta Credito UBS USD'),
    ('10210', 'Carta Credito CS Autisti 2152'),
    ('10211', 'Carta Credito CS Autisti 1112'),
    ('10212', 'Carta Credito CS Autisti 1312'),
    ('1028', 'Carta Credito CS Autisti 8596'),
    ('1029', 'Carta Credito CS Autisti 5820'),
]

print("\n" + "=" * 120)
print("STEP 1: SALDI TUTTI I CONTI BANCARI AL 01/01/2024 e 31/12/2024")
print("=" * 120)

print(f"\n{'KONTO':<10} {'DESCRIZIONE':<50} {'SALDO 01/01/2024':>20} {'SALDO 31/12/2024':>20} {'MOVIMENTI':>10}")
print("-" * 120)

all_data = []
total_inizio = 0
total_fine = 0

for code, description in bank_accounts:
    # Trova account
    accounts = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', code]]],
        {'fields': ['id', 'code', 'name'], 'limit': 1}
    )

    if not accounts:
        print(f"{code:<10} {description:<50} {'NON TROVATO':>20} {'NON TROVATO':>20} {'N/A':>10}")
        continue

    account = accounts[0]
    account_id = account['id']
    account_name = account['name']

    # Saldo a inizio anno (31/12/2023 = saldo iniziale 2024)
    balance_start = get_account_balance_at_date(account_id, '2023-12-31')

    # Saldo a fine anno
    balance_end = get_account_balance_at_date(account_id, '2024-12-31')

    saldo_inizio = balance_start['balance']
    saldo_fine = balance_end['balance']
    movimenti = balance_end['count']

    print(f"{code:<10} {account_name[:50]:<50} CHF {saldo_inizio:>15,.2f} CHF {saldo_fine:>15,.2f} {movimenti:>10}")

    total_inizio += saldo_inizio
    total_fine += saldo_fine

    all_data.append({
        'code': code,
        'name': account_name,
        'description': description,
        'saldo_inizio': saldo_inizio,
        'saldo_fine': saldo_fine,
        'variazione': saldo_fine - saldo_inizio,
        'movimenti': movimenti
    })

print("-" * 120)
print(f"{'TOTALE':<10} {'':<50} CHF {total_inizio:>15,.2f} CHF {total_fine:>15,.2f}")

print("\n" + "=" * 120)
print("STEP 2: VARIAZIONI ANNO 2024")
print("=" * 120)

print(f"\n{'KONTO':<10} {'DESCRIZIONE':<50} {'VARIAZIONE 2024':>20} {'%':>10}")
print("-" * 120)

for data in all_data:
    variazione = data['variazione']
    saldo_inizio = data['saldo_inizio']

    # Calcola percentuale (se saldo iniziale != 0)
    if abs(saldo_inizio) > 0.01:
        pct = (variazione / abs(saldo_inizio)) * 100
        pct_str = f"{pct:+.1f}%"
    else:
        pct_str = "N/A"

    simbolo = "+" if variazione > 0 else ""
    print(f"{data['code']:<10} {data['name'][:50]:<50} CHF {variazione:>15,.2f} {pct_str:>10}")

variazione_totale = total_fine - total_inizio
print("-" * 120)
print(f"{'TOTALE':<10} {'':<50} CHF {variazione_totale:>15,.2f}")

print("\n" + "=" * 120)
print("STEP 3: CONTI CON SALDO SIGNIFICATIVO AL 31/12/2024")
print("=" * 120)

print(f"\n{'KONTO':<10} {'DESCRIZIONE':<50} {'SALDO 31/12/2024':>20}")
print("-" * 120)

# Ordina per saldo assoluto (più grandi prima)
sorted_data = sorted(all_data, key=lambda x: abs(x['saldo_fine']), reverse=True)

for data in sorted_data:
    if abs(data['saldo_fine']) > 100:  # Solo conti con saldo > 100 CHF
        print(f"{data['code']:<10} {data['name'][:50]:<50} CHF {data['saldo_fine']:>15,.2f}")

print("\n" + "=" * 120)
print("STEP 4: CONTI CON MOVIMENTI NEL 2024")
print("=" * 120)

print(f"\n{'KONTO':<10} {'DESCRIZIONE':<50} {'MOVIMENTI 2024':>20}")
print("-" * 120)

# Calcola movimenti solo del 2024
for code, description in bank_accounts:
    accounts = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', code]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not accounts:
        continue

    account_id = accounts[0]['id']

    # Movimenti del 2024
    move_lines_2024 = models.execute_kw(DB, uid, PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['id']}
    )

    movimenti_2024 = len(move_lines_2024)

    if movimenti_2024 > 0:
        account_name = next((d['name'] for d in all_data if d['code'] == code), description)
        print(f"{code:<10} {account_name[:50]:<50} {movimenti_2024:>20,}")

print("\n" + "=" * 120)
print("SUMMARY FINALE")
print("=" * 120)

print(f"""
RIEPILOGO ODOO AL 31/12/2024:
------------------------------
Conti bancari analizzati:     {len(all_data)}
Saldo totale inizio anno:     CHF {total_inizio:>15,.2f}
Saldo totale fine anno:       CHF {total_fine:>15,.2f}
VARIAZIONE TOTALE 2024:       CHF {variazione_totale:>15,.2f}
""")

print("\n" + "=" * 120)
print("END OF REPORT")
print("=" * 120)
