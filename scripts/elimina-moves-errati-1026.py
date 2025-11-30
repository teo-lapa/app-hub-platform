#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ELIMINA MOVIMENTI ERRATI KONTO 1026 CREDIT SUISSE

Elimina 3 movimenti identificati come errati:
- Move 58103: azzeramento 2023 (CHF 132,834.54)
- Move 58101: azzerare 2023 (CHF 50,000.00)
- Move 95413: Rettifica su account sbagliato (CHF 10,903.87)

TOTALE CORREZIONE: CHF 193,738.41

ATTENZIONE: Questa operazione è IRREVERSIBILE!
Backup consigliato prima dell'esecuzione.
"""

import sys
import io
import xmlrpc.client
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "lapa201180"

print("=" * 80)
print("ELIMINAZIONE MOVIMENTI ERRATI - KONTO 1026 CREDIT SUISSE")
print("=" * 80)
print(f"Data esecuzione: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 80)

# Moves da eliminare
MOVES_TO_DELETE = [
    {
        'id': 58103,
        'name': 'BNK3/2024/00867',
        'date': '2024-06-03',
        'description': 'azzeramento 2023',
        'amount': 132834.54,
        'reason': 'Movimento fittizio senza giustificazione bancaria'
    },
    {
        'id': 58101,
        'name': 'BNK3/2024/00866',
        'date': '2024-06-03',
        'description': 'azzerare 2023',
        'amount': 50000.00,
        'reason': 'Movimento fittizio senza giustificazione bancaria'
    },
    {
        'id': 95413,
        'name': 'RET23/2024/01/0007',
        'date': '2024-01-31',
        'description': 'Rettifica aumento saldo 1024',
        'amount': 10903.87,
        'reason': 'Rettifica su account sbagliato (1024≠1026) + duplicato move 95447'
    }
]

total_correction = sum(m['amount'] for m in MOVES_TO_DELETE)

print("\nMOVIMENTI DA ELIMINARE:")
print("-" * 80)
for move in MOVES_TO_DELETE:
    print(f"\nMove ID: {move['id']} ({move['name']})")
    print(f"  Data: {move['date']}")
    print(f"  Descrizione: {move['description']}")
    print(f"  Importo: CHF {move['amount']:,.2f}")
    print(f"  Motivo: {move['reason']}")

print("\n" + "=" * 80)
print(f"TOTALE CORREZIONE: CHF {total_correction:,.2f}")
print("=" * 80)

# Conferma utente
print("\nATTENZIONE: Questa operazione eliminerà definitivamente i movimenti sopra elencati.")
print("L'operazione NON può essere annullata.")
print("\nVuoi procedere? (scrivi 'SI ELIMINA' per confermare)")

confirmation = input("\n> ").strip()

if confirmation != "SI ELIMINA":
    print("\nOperazione ANNULLATA dall'utente.")
    print("Nessuna modifica effettuata.")
    sys.exit(0)

print("\n" + "=" * 80)
print("INIZIO ELIMINAZIONE")
print("=" * 80)

# Connect to Odoo
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})

if not uid:
    print("ERRORE: Autenticazione fallita!")
    sys.exit(1)

print(f"OK Autenticato come UID: {uid}")

models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Calcola saldo prima
print("\n[1] Calcolo saldo PRIMA dell'eliminazione...")
lines_before = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
    'account.move.line', 'search_read',
    [[['account_id', '=', 182]]],  # 1026
    {'fields': ['debit', 'credit']})

debit_before = sum(l['debit'] for l in lines_before)
credit_before = sum(l['credit'] for l in lines_before)
balance_before = debit_before - credit_before

print(f"  Saldo attuale: CHF {balance_before:,.2f}")

# Elimina ogni move
deleted_moves = []
failed_moves = []

print("\n[2] Eliminazione movimenti...")

for move_data in MOVES_TO_DELETE:
    move_id = move_data['id']
    print(f"\n  Processamento Move {move_id} ({move_data['name']})...")

    # Verifica esistenza
    try:
        move = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
            'account.move', 'read',
            [[move_id]],
            {'fields': ['name', 'state']})

        if not move:
            print(f"    ERRORE: Move {move_id} non trovato!")
            failed_moves.append({'id': move_id, 'error': 'Non trovato'})
            continue

        move = move[0]
        print(f"    Trovato: {move['name']} - Stato: {move['state']}")

    except Exception as e:
        print(f"    ERRORE lettura move: {e}")
        failed_moves.append({'id': move_id, 'error': str(e)})
        continue

    # Metti in bozza se necessario
    if move['state'] == 'posted':
        try:
            print(f"    Messa in bozza...")
            models.execute_kw(ODOO_DB, uid, ODOO_PASS,
                'account.move', 'button_draft', [[move_id]])
            print(f"    OK - In bozza")
        except Exception as e:
            print(f"    ERRORE messa in bozza: {e}")
            failed_moves.append({'id': move_id, 'error': f'Button draft: {e}'})
            continue

    # Elimina
    try:
        print(f"    Eliminazione...")
        models.execute_kw(ODOO_DB, uid, ODOO_PASS,
            'account.move', 'unlink', [[move_id]])
        print(f"    OK - Move {move_id} ELIMINATO!")
        deleted_moves.append(move_data)
    except Exception as e:
        print(f"    ERRORE eliminazione: {e}")
        failed_moves.append({'id': move_id, 'error': f'Unlink: {e}'})

# Calcola saldo dopo
print("\n[3] Calcolo saldo DOPO l'eliminazione...")
lines_after = models.execute_kw(ODOO_DB, uid, ODOO_PASS,
    'account.move.line', 'search_read',
    [[['account_id', '=', 182]]],  # 1026
    {'fields': ['debit', 'credit']})

debit_after = sum(l['debit'] for l in lines_after)
credit_after = sum(l['credit'] for l in lines_after)
balance_after = debit_after - credit_after

print(f"  Nuovo saldo: CHF {balance_after:,.2f}")

# Report finale
print("\n" + "=" * 80)
print("REPORT FINALE")
print("=" * 80)

print(f"\nMovimenti eliminati: {len(deleted_moves)}/{len(MOVES_TO_DELETE)}")
if deleted_moves:
    print("\nELIMINATI:")
    for m in deleted_moves:
        print(f"  - Move {m['id']}: {m['description']} (CHF {m['amount']:,.2f})")

if failed_moves:
    print(f"\nFALLITI: {len(failed_moves)}")
    for f in failed_moves:
        print(f"  - Move {f['id']}: {f['error']}")

print("\n" + "-" * 80)
print("SALDI:")
print("-" * 80)
print(f"Saldo PRIMA:      CHF {balance_before:,.2f}")
print(f"Saldo DOPO:       CHF {balance_after:,.2f}")
print(f"Correzione:       CHF {balance_before - balance_after:,.2f}")
print(f"Correzione attesa: CHF {total_correction:,.2f}")
print("-" * 80)

if abs((balance_before - balance_after) - total_correction) < 0.01:
    print("\nOK - Correzione applicata correttamente!")
else:
    print("\nWARNING - Correzione non corrisponde all'atteso!")

# Calcola gap residuo
SALDO_ATTESO = 24897.72
gap_residuo = balance_after - SALDO_ATTESO

print("\n" + "=" * 80)
print("GAP ANALISI")
print("=" * 80)
print(f"Saldo attuale (dopo correzione): CHF {balance_after:,.2f}")
print(f"Saldo atteso:                     CHF {SALDO_ATTESO:,.2f}")
print(f"GAP RESIDUO:                      CHF {gap_residuo:,.2f}")
print("=" * 80)

if gap_residuo > 100000:
    print("\nWARNING: Gap residuo ancora significativo!")
    print("Verificare:")
    print("  1. Saldo apertura 2024")
    print("  2. Move 95447 (Rettifica 31.12.2023)")
    print("  3. Movimenti clearing duplicati")
    print("  4. Confronto con estratto conto bancario")

print(f"\n\nEsecuzione completata: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 80)

# Save log
log_file = f"c:/Users/lapa/Desktop/Claude Code/app-hub-platform/eliminazione-1026-log-{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
with open(log_file, 'w', encoding='utf-8') as f:
    f.write(f"ELIMINAZIONE MOVIMENTI KONTO 1026\n")
    f.write(f"Data: {datetime.now()}\n\n")
    f.write(f"Saldo prima: CHF {balance_before:,.2f}\n")
    f.write(f"Saldo dopo: CHF {balance_after:,.2f}\n")
    f.write(f"Correzione: CHF {balance_before - balance_after:,.2f}\n\n")
    f.write(f"Movimenti eliminati: {len(deleted_moves)}\n")
    for m in deleted_moves:
        f.write(f"  - {m['id']}: {m['description']} (CHF {m['amount']:,.2f})\n")
    if failed_moves:
        f.write(f"\nFalliti: {len(failed_moves)}\n")
        for m in failed_moves:
            f.write(f"  - {m}\n")

print(f"\nLog salvato: {log_file}")
