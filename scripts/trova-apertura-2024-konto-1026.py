#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trova movimenti di apertura 2024 per konto 1026
"""

import sys
import io
import xmlrpc.client
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "lapa201180"

print("=" * 80)
print("RICERCA MOVIMENTI APERTURA 2024 - KONTO 1026")
print("=" * 80)

# Connect
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

print(f"OK Autenticato UID: {uid}")

# Account 1026
account_id = 182

# 1. Movimenti gennaio 2024
print("\n[1] Movimenti GENNAIO 2024...")
jan_moves = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
    'account.move.line', 'search_read',
    [[
        ['account_id', '=', account_id],
        ['date', '>=', '2024-01-01'],
        ['date', '<=', '2024-01-31']
    ]],
    {'fields': ['id', 'date', 'name', 'ref', 'debit', 'credit', 'move_id'],
     'order': 'date asc, id asc'})

print(f"Trovati {len(jan_moves)} movimenti gennaio 2024")

# Cerca keywords apertura
keywords = ['apertura', 'opening', 'riporto', 'saldo iniziale', 'balance', 'opening balance']

print("\nMovimenti con keywords apertura:")
for move in jan_moves[:20]:  # Prime 20 righe
    name_lower = (move['name'] or '').lower()
    ref_lower = (move['ref'] or '').lower()

    is_opening = any(kw in name_lower or kw in ref_lower for kw in keywords)

    amount = move['debit'] - move['credit']
    marker = " *** APERTURA ***" if is_opening else ""

    print(f"{move['date']} | CHF {amount:>12,.2f} | Move {move['move_id'][0]:>6} | {move['name'][:50]}{marker}")

# 2. Calcola saldo al 31.12.2023
print("\n[2] Calcolo saldo al 31.12.2023...")
moves_2023 = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
    'account.move.line', 'search_read',
    [[
        ['account_id', '=', account_id],
        ['date', '<=', '2023-12-31']
    ]],
    {'fields': ['debit', 'credit']})

total_debit_2023 = sum(m['debit'] for m in moves_2023)
total_credit_2023 = sum(m['credit'] for m in moves_2023)
saldo_2023 = total_debit_2023 - total_credit_2023

print(f"Totale DARE 2023:   CHF {total_debit_2023:,.2f}")
print(f"Totale AVERE 2023:  CHF {total_credit_2023:,.2f}")
print(f"SALDO al 31.12.2023: CHF {saldo_2023:,.2f}")

# 3. Primi movimenti 2024 ordinati per importo
print("\n[3] TOP 10 primi movimenti 2024 (per importo)...")
jan_sorted = sorted(jan_moves, key=lambda x: abs(x['debit'] - x['credit']), reverse=True)

for i, move in enumerate(jan_sorted[:10], 1):
    amount = move['debit'] - move['credit']
    print(f"{i:2}. {move['date']} | CHF {amount:>12,.2f} | {move['name'][:50]}")
    print(f"    Move {move['move_id'][0]} | Ref: {move['ref'][:50] if move['ref'] else '(vuoto)'}")

# 4. Cerca tutti movimenti con importo vicino a saldo 2023
print(f"\n[4] Movimenti gennaio con importo vicino a saldo 2023 ({saldo_2023:,.2f})...")
tolerance = 5000
for move in jan_moves:
    amount = abs(move['debit'] - move['credit'])
    if abs(amount - abs(saldo_2023)) < tolerance:
        print(f"  MATCH! {move['date']} | CHF {move['debit'] - move['credit']:,.2f}")
        print(f"    {move['name']}")
        print(f"    Move: {move['move_id'][0]} | Ref: {move['ref']}")

# Save report
report = {
    'saldo_31_12_2023': saldo_2023,
    'gennaio_2024_movimenti': len(jan_moves),
    'top_10_gennaio': jan_sorted[:10]
}

with open('c:/Users/lapa/Desktop/Claude Code/app-hub-platform/apertura-2024-konto-1026.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False, default=str)

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Saldo chiusura 2023: CHF {saldo_2023:,.2f}")
print(f"Movimenti gennaio 2024: {len(jan_moves)}")
print("=" * 80)
