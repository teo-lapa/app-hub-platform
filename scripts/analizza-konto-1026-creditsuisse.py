#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANALISI KONTO 1026 CREDIT SUISSE - GAP CHF 463K

Analisi approfondita per trovare movimenti anomali che causano discrepanza.

Author: Backend Specialist (Commercialista Svizzero)
Date: 2025-11-16
"""

import sys
import io
import xmlrpc.client
from datetime import datetime
from collections import defaultdict
import json

# Force UTF-8 encoding for output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ODOO Configuration
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "lapa201180"

# Expected values
SALDO_ATTESO = 24897.72
SALDO_ODOO = 487751.00
GAP = SALDO_ODOO - SALDO_ATTESO  # +463K

print("=" * 80)
print("ANALISI KONTO 1026 CREDIT SUISSE")
print("=" * 80)
print(f"Saldo atteso:     CHF {SALDO_ATTESO:,.2f}")
print(f"Saldo in Odoo:    CHF {SALDO_ODOO:,.2f}")
print(f"GAP da trovare:   CHF {GAP:,.2f}")
print("=" * 80)

# Connect to Odoo
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})

if not uid:
    print("❌ ERRORE: Autenticazione fallita")
    exit(1)

print(f"OK Autenticato come UID: {uid}")

models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Step 1: Find account 1026
print("\n[1/6] Ricerca account 1026...")
accounts = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
    'account.account', 'search_read',
    [[['code', '=', '1026']]],
    {'fields': ['id', 'code', 'name', 'currency_id']})

if not accounts:
    print("❌ Account 1026 non trovato!")
    exit(1)

account = accounts[0]
print(f"OK Trovato: {account['code']} - {account['name']}")
print(f"  ID: {account['id']}")

account_id = account['id']

# Step 2: Fetch ALL move lines for this account
print("\n[2/6] Estrazione TUTTE le righe del konto 1026...")
move_lines = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
    'account.move.line', 'search_read',
    [[['account_id', '=', account_id]]],
    {'fields': [
        'id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
        'move_id', 'partner_id', 'reconciled', 'amount_currency',
        'currency_id', 'company_currency_id'
    ], 'order': 'date asc'})

print(f"OK Estratte {len(move_lines)} righe")

# Step 3: Calculate current balance
total_debit = sum(line['debit'] for line in move_lines)
total_credit = sum(line['credit'] for line in move_lines)
calculated_balance = total_debit - total_credit

print(f"\n[3/6] Calcolo saldo da righe:")
print(f"  Totale DARE:      CHF {total_debit:,.2f}")
print(f"  Totale AVERE:     CHF {total_credit:,.2f}")
print(f"  Saldo calcolato:  CHF {calculated_balance:,.2f}")
print(f"  Saldo atteso:     CHF {SALDO_ATTESO:,.2f}")
print(f"  Differenza:       CHF {calculated_balance - SALDO_ATTESO:,.2f}")

# Step 4: Sort by absolute amount (largest first)
print("\n[4/6] Ordinamento per importo (più grandi prima)...")

enriched_lines = []
for line in move_lines:
    amount = line['debit'] if line['debit'] > 0 else -line['credit']
    abs_amount = abs(amount)

    enriched_lines.append({
        'id': line['id'],
        'date': line['date'],
        'name': line['name'] or '',
        'ref': line['ref'] or '',
        'debit': line['debit'],
        'credit': line['credit'],
        'amount': amount,
        'abs_amount': abs_amount,
        'balance': line['balance'],
        'move_id': line['move_id'][0] if line['move_id'] else None,
        'partner': line['partner_id'][1] if line['partner_id'] else '',
        'reconciled': line['reconciled']
    })

# Sort by absolute amount descending
enriched_lines.sort(key=lambda x: x['abs_amount'], reverse=True)

print(f"OK Ordinati {len(enriched_lines)} movimenti")

# Step 5: Look for anomalies
print("\n[5/6] Ricerca movimenti anomali...")

# Look for movements around the gap amount (463K)
gap_target = abs(GAP)
tolerance = 5000  # CHF 5K tolerance

print(f"\nMovimenti vicini al GAP ({gap_target:,.2f} ± {tolerance:,.2f}):")
gap_suspects = []

for line in enriched_lines:
    if abs(line['abs_amount'] - gap_target) < tolerance:
        gap_suspects.append(line)
        print(f"  🔍 {line['date']} | CHF {line['amount']:>12,.2f} | {line['name'][:50]}")
        print(f"     Move ID: {line['move_id']} | Ref: {line['ref']}")

# Look for duplicates
print(f"\n[6/6] Ricerca duplicati...")

# Group by amount and date
amount_groups = defaultdict(list)
for line in enriched_lines:
    key = (line['date'], round(line['abs_amount'], 2))
    amount_groups[key].append(line)

duplicates = {k: v for k, v in amount_groups.items() if len(v) > 1 and v[0]['abs_amount'] > 10000}

if duplicates:
    print(f"OK Trovati {len(duplicates)} gruppi di possibili duplicati:")
    for (date, amount), lines in sorted(duplicates.items(), key=lambda x: x[0][1], reverse=True)[:10]:
        print(f"\n  Data: {date} | Importo: CHF {amount:,.2f} | Occorrenze: {len(lines)}")
        for line in lines:
            print(f"    - ID {line['id']:>6} | Move {line['move_id']:>6} | {line['name'][:40]}")
else:
    print("  Nessun duplicato evidente trovato")

# Check 2023 movements
print("\n[7/6] Verifica movimenti 2023 erroneamente in 2024...")
movements_2023 = [line for line in enriched_lines if line['date'] and line['date'].startswith('2023')]
movements_2024 = [line for line in enriched_lines if line['date'] and line['date'].startswith('2024')]

print(f"  Movimenti 2023: {len(movements_2023)}")
print(f"  Movimenti 2024: {len(movements_2024)}")

if movements_2023:
    total_2023 = sum(line['amount'] for line in movements_2023)
    print(f"  Totale 2023: CHF {total_2023:,.2f}")

# Top 20 largest movements
print("\n" + "=" * 80)
print("TOP 20 MOVIMENTI PIÙ GRANDI")
print("=" * 80)

for i, line in enumerate(enriched_lines[:20], 1):
    sign = "+" if line['amount'] > 0 else "-"
    reconciled = "R" if line['reconciled'] else "N"
    print(f"{i:2}. {line['date']} | {sign}CHF {line['abs_amount']:>12,.2f} | {reconciled} | {line['name'][:45]}")
    print(f"    Move: {line['move_id']} | Ref: {line['ref'][:50]}")

# Save detailed analysis
report = {
    'timestamp': datetime.now().isoformat(),
    'account': {
        'id': account_id,
        'code': account['code'],
        'name': account['name']
    },
    'summary': {
        'total_lines': len(move_lines),
        'total_debit': total_debit,
        'total_credit': total_credit,
        'calculated_balance': calculated_balance,
        'expected_balance': SALDO_ATTESO,
        'gap': calculated_balance - SALDO_ATTESO,
        'movements_2023': len(movements_2023),
        'movements_2024': len(movements_2024)
    },
    'gap_suspects': gap_suspects,
    'top_20_movements': enriched_lines[:20],
    'duplicates': {
        f"{date}_{amount}": [l['id'] for l in lines]
        for (date, amount), lines in duplicates.items()
    }
}

report_file = 'c:/Users/lapa/Desktop/Claude Code/app-hub-platform/analisi-konto-1026-report.json'
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False, default=str)

print(f"\nOK Report salvato: {report_file}")

# Final summary
print("\n" + "=" * 80)
print("RIEPILOGO ANALISI")
print("=" * 80)
print(f"Saldo calcolato:  CHF {calculated_balance:,.2f}")
print(f"Saldo atteso:     CHF {SALDO_ATTESO:,.2f}")
print(f"GAP trovato:      CHF {calculated_balance - SALDO_ATTESO:,.2f}")
print(f"\nMovimenti sospetti vicini al GAP: {len(gap_suspects)}")
print(f"Possibili duplicati: {len(duplicates)}")
print("=" * 80)

if gap_suspects:
    print("\n⚠️  AZIONE RICHIESTA:")
    print("Verificare i movimenti sospetti elencati sopra.")
    print("Probabile causa: movimento errato o duplicato da eliminare.")
else:
    print("\n⚠️  GAP NON IDENTIFICATO CON SINGOLO MOVIMENTO:")
    print("Il gap potrebbe derivare da:")
    print("  1. Somma di più movimenti errati")
    print("  2. Saldo iniziale errato")
    print("  3. Movimenti di apertura 2024 sbagliati")
