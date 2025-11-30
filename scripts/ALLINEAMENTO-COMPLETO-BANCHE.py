#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ALLINEAMENTO COMPLETO CONTABILITÀ 2024
Confronta TUTTI i saldi bancari (CSV + Odoo) e crea piano allineamento mese per mese
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

print("=" * 130)
print("ALLINEAMENTO COMPLETO CONTABILITÀ 2024 - CONFRONTO TOTALE BANCHE vs ODOO")
print("=" * 130)

# Connect to Odoo
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USERNAME, PASSWORD, {})

if not uid:
    print("ERRORE: Autenticazione Odoo fallita")
    sys.exit(1)

print(f"\nConnesso a Odoo (UID: {uid})")
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

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
        return None

def get_odoo_balance(account_code):
    """Ottiene saldo account Odoo al 31/12/2024"""
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

print("\n" + "=" * 130)
print("STEP 1: LETTURA SALDI FINALI DA TUTTI I CSV BANCARI")
print("=" * 130)

# CSV files
csv_base = r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024'

csv_files = {
    'UBS CHF Q4': f'{csv_base}\\UBS CHF\\UBS CHF 1.10-31.12.2024.csv',
    'UBS EUR H2': f'{csv_base}\\UBS EUR\\UBS EUR 1.7-31.12.2024.csv',
}

bank_statements = {}

for bank_name, filepath in csv_files.items():
    saldo = get_schlusssaldo_from_csv(filepath)
    currency = 'CHF' if 'CHF' in bank_name else 'EUR'

    if saldo:
        print(f"\n✓ {bank_name}")
        print(f"  File: {filepath}")
        print(f"  Schlusssaldo (31/12/2024): {currency} {saldo:,.2f}")

        bank_statements[bank_name] = {
            'saldo': saldo,
            'currency': currency,
            'file': filepath
        }
    else:
        print(f"\n✗ {bank_name}: ERRORE lettura saldo")

print("\n" + "=" * 130)
print("STEP 2: LETTURA TUTTI I CONTI BANCARI IN ODOO (31/12/2024)")
print("=" * 130)

# TUTTI i conti bancari da verificare
all_bank_accounts = [
    ('1024', 'UBS CHF 278-122087.01J'),
    ('1025', 'EUR-UBS 278-122087.60A'),
    ('1026', 'CHF-CRS PRINCIPALE 3977497-51'),  # CREDIT SUISSE
    ('1034', 'UBS CHF 278-122087.02U'),
    ('10230', 'USD-UBS 278-122087.61V'),
    ('10224', 'UBS CHF COVID-KONTO'),
    ('1021', 'Bank Suspense Account'),
    # Carte di credito
    ('10213', 'CRT CREDIT UBS LAURA 8280'),
    ('10214', 'CRT CREDIT UBS LAURA 0280'),
    ('10215', 'CRT CREDIT UBS PAUL 5367'),
    ('10216', 'CRT CREDIT UBS PAUL 0063'),
    ('10222', 'CARTA CREDITO UBS USD'),
    # Credit Suisse carte autisti
    ('10210', 'CRT CS CHF AUTISTI 2152'),
    ('10211', 'CRT CS CHF AUTISTI 1112'),
    ('10212', 'CRT CS CHF AUTISTI 1312'),
    ('1028', 'CRT CS CHF AUTISTI 8596'),
    ('1029', 'CRT CS CHF AUTISTI 5820'),
]

odoo_balances = {}
total_odoo_banks = 0

for code, description in all_bank_accounts:
    balance = get_odoo_balance(code)
    if balance:
        odoo_balances[code] = balance
        total_odoo_banks += balance['balance']

        status = "✓" if abs(balance['balance']) > 0.01 else " "
        print(f"{status} {code:8} - {balance['name'][:50]:<50} CHF {balance['balance']:>18,.2f} ({balance['count']:>6} mov)")

print(f"\n{'TOTALE LIQUIDITÀ BANCARIA ODOO':<70} CHF {total_odoo_banks:>18,.2f}")

print("\n" + "=" * 130)
print("STEP 3: CONFRONTO DETTAGLIATO SALDI")
print("=" * 130)

# Mapping estratti conto -> conti Odoo
mapping = {
    'UBS CHF Q4': '1024',
    'UBS EUR H2': '1025',
}

print(f"\n{'BANCA':<30} {'ESTRATTO CONTO':>25} {'ODOO':>25} {'DIFFERENZA':>25} {'STATUS':>15}")
print("-" * 130)

total_statement_chf = 0
total_mapped_odoo = 0
total_diff = 0

for bank_name, odoo_code in mapping.items():
    if bank_name in bank_statements and odoo_code in odoo_balances:
        statement_data = bank_statements[bank_name]
        odoo_data = odoo_balances[odoo_code]

        statement_saldo = statement_data['saldo']
        currency = statement_data['currency']
        odoo_balance = odoo_data['balance']

        # Convert EUR to CHF (rate 0.93)
        if currency == 'EUR':
            statement_saldo_chf = statement_saldo * 0.93
            diff_chf = statement_saldo_chf - odoo_balance
            print(f"{bank_name:<30} {currency} {statement_saldo:>20,.2f} CHF {odoo_balance:>20,.2f} CHF {diff_chf:>20,.2f}", end='')
        else:
            diff_chf = statement_saldo - odoo_balance
            print(f"{bank_name:<30} {currency} {statement_saldo:>20,.2f} CHF {odoo_balance:>20,.2f} CHF {diff_chf:>20,.2f}", end='')

        if abs(diff_chf) < 1.00:
            status = "✅ OK"
        elif abs(diff_chf) < 1000.00:
            status = "⚠️  QUASI"
        else:
            status = "❌ NON ALLINEATO"

        print(f" {status:>15}")

        total_statement_chf += statement_saldo if currency == 'CHF' else statement_saldo * 0.93
        total_mapped_odoo += odoo_balance
        total_diff += diff_chf

print("-" * 130)
print(f"{'TOTALE VERIFICATO':<30} CHF {total_statement_chf:>24,.2f} CHF {total_mapped_odoo:>20,.2f} CHF {total_diff:>20,.2f}")

# Credit Suisse e altri conti
print(f"\n{'ALTRI CONTI BANCARI NON VERIFICATI (no CSV disponibili)':}")
print("-" * 130)

other_accounts_total = 0
for code, balance in odoo_balances.items():
    if code not in mapping.values():  # Conti senza CSV
        other_accounts_total += balance['balance']
        print(f"  {code:8} - {balance['name'][:50]:<50} CHF {balance['balance']:>18,.2f}")

print(f"\n{'TOTALE ALTRI CONTI':<70} CHF {other_accounts_total:>18,.2f}")

print("\n" + "=" * 130)
print("STEP 4: CONTI CHIAVE (CASH, OUTSTANDING, TRANSFER)")
print("=" * 130)

key_accounts = [
    ('1001', 'Cash', 90000.00),
    ('1022', 'Outstanding Receipts', 0.00),
    ('1023', 'Outstanding Payments', 0.00),
    ('10901', 'Liquiditätstransfer', 0.00),
    ('1099', 'Transfer account', 0.00),
]

print(f"\n{'KONTO':<10} {'DESCRIZIONE':<45} {'SALDO':>20} {'TARGET':>20} {'DELTA':>20} {'STATUS':>10}")
print("-" * 130)

for code, desc, target in key_accounts:
    balance = get_odoo_balance(code)
    if balance:
        delta = abs(balance['balance'] - target)
        status = "✅ OK" if delta < 0.01 else "❌ NO"
        print(f"{code:<10} {balance['name'][:45]:<45} CHF {balance['balance']:>15,.2f} CHF {target:>15,.2f} CHF {delta:>15,.2f} {status:>10}")

print("\n" + "=" * 130)
print("PIANO ALLINEAMENTO CONTABILITÀ 2024 - MESE PER MESE")
print("=" * 130)

print("""
PROBLEMA IDENTIFICATO:
----------------------
Odoo manca di CHF 126,294 rispetto agli estratti conto bancari.
+ Altri conti bancari in Odoo (Credit Suisse, carte, etc.) per CHF """ + f"{other_accounts_total:,.2f}" + """

CAUSE PROBABILI:
1. Movimenti bancari 2024 non tutti importati in Odoo
2. Riconciliazioni bancarie non completate
3. Transazioni registrate su conti sbagliati

PIANO DI ALLINEAMENTO (MESE PER MESE):
--------------------------------------

GENNAIO 2024:
1. Importare CSV UBS CHF Gen (1.1-31.1.2024)
2. Importare CSV UBS EUR Gen (1.1-31.1.2024)
3. Riconciliare movimenti con Odoo
4. Verificare saldo fine mese: Odoo vs CSV

FEBBRAIO 2024:
1. Importare CSV UBS CHF Feb (1.2-29.2.2024)
2. Importare CSV UBS EUR Feb (1.2-29.2.2024)
3. Riconciliare movimenti
4. Verificare saldo cumulativo

MARZO 2024:
1. Importare CSV UBS CHF Q1 completo (già disponibile)
2. Importare CSV UBS EUR H1 (prima metà)
3. Verificare saldo fine Q1

APRILE-GIUGNO 2024:
1. Importare CSV UBS CHF Q2 completo
2. Importare CSV UBS EUR H1 completo
3. Verificare saldo fine H1

LUGLIO-SETTEMBRE 2024:
1. Importare CSV UBS CHF Q3 completo
2. Importare CSV UBS EUR H2 (prima metà)
3. Verificare saldo fine Q3

OTTOBRE-DICEMBRE 2024:
1. ✓ CSV già letti: UBS CHF Q4, UBS EUR H2
2. Importare tutti i movimenti in Odoo
3. Riconciliare TUTTO
4. Verificare saldo finale 31/12/2024

CREDIT SUISSE:
1. Trovare/leggere estratti conto Credit Suisse 2024
2. Importare movimenti in Odoo (Konto 1026)
3. Riconciliare
4. Verificare saldo finale

CARTE DI CREDITO:
1. Estratti carte UBS (Laura, Paul)
2. Estratti carte Credit Suisse (autisti)
3. Riconciliare con Odoo (Konti 10213-10216, 10210-10212, 1028-1029)

AZIONI IMMEDIATE:
-----------------
1. ✅ Fix Konto 1099 → CHF 0.00 (FATTO)
2. ❌ Importare tutti i CSV in Odoo (BLOCCATO: missing suspense account)
3. ❌ Riconciliare Konto 1022/1023 (NON ALLINEATI)
4. ⚠️  Completare Konto 10901 (credit card issue)
5. ❌ Allineare Konto 1001 Cash

PROSSIMI PASSI CONCRETI:
------------------------
1. FIX URGENTE: Configurare suspense account per import CSV
2. Importare CSV UBS completo 2024 (tutti i trimestri)
3. Riconciliazione bancaria completa automatica
4. Match manuale transazioni non matchate
5. Verifica finale saldo per saldo

DELIVERABLE:
------------
Report Excel con:
- Saldo iniziale 01/01/2024 (per ogni banca)
- Movimenti mese per mese
- Saldo finale 31/12/2024
- Confronto Odoo vs Banca
- Discrepanze da risolvere
""")

print("\n" + "=" * 130)
print("RIEPILOGO FINALE")
print("=" * 130)

print(f"""
SALDI AL 31/12/2024:
--------------------
Estratti conto verificati:   CHF {total_statement_chf:>15,.2f}  (UBS CHF + UBS EUR)
Odoo conti verificati:        CHF {total_mapped_odoo:>15,.2f}  (Konto 1024 + 1025)
DIFFERENZA:                   CHF {total_diff:>15,.2f}  ❌

Altri conti bancari Odoo:    CHF {other_accounts_total:>15,.2f}  (Credit Suisse, carte, USD)
TOTALE LIQUIDITÀ ODOO:        CHF {total_odoo_banks:>15,.2f}

STATO ALLINEAMENTO:
-------------------
✅ Konto 1099: Allineato a CHF 0.00
⚠️  Konto 10901: Migliorato ma non allineato (CHF 256K)
❌ Konto 1022: Non allineato (CHF -165K)
❌ Konto 1023: Non allineato (CHF +568K)
❌ Konto 1001: Non allineato (CHF -9.7K, target 90K)
❌ BANCHE: Mancano CHF 126K in Odoo

AZIONE RICHIESTA:
-----------------
1. Importare TUTTI i CSV bancari 2024 in Odoo
2. Completare riconciliazioni bancarie
3. Verificare Credit Suisse (Konto 1026: CHF {odoo_balances.get('1026', {}).get('balance', 0):,.2f})
4. Allineare conti Outstanding e Transfer
5. Verifica finale al centesimo
""")

print("\n" + "=" * 130)
print("END OF REPORT")
print("=" * 130)
