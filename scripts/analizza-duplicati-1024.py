#!/usr/bin/env python3
"""
ANALISI DUPLICATI KONTO 1024 - UBS CHF
Cerca movimenti duplicati che potrebbero spiegare gap di CHF 193K
"""

import xmlrpc.client
import os
from datetime import datetime
from collections import defaultdict
import json

# Odoo connection (DEV environment)
url = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
db = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
username = os.getenv('ODOO_ADMIN_EMAIL', 'apphubplatform@lapa.ch')
password = os.getenv('ODOO_ADMIN_PASSWORD', 'apphubplatform2025')

common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
uid = common.authenticate(db, username, password, {})
models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

print(f"Connesso a Odoo come UID: {uid}")

# Konto 1024
ACCOUNT_CODE = '1024'

def get_account_id(code):
    """Trova account.account per codice"""
    account_ids = models.execute_kw(db, uid, password,
        'account.account', 'search',
        [[['code', '=', code]]])
    if not account_ids:
        return None
    return account_ids[0]

def get_all_moves_2024(account_id):
    """Ottieni TUTTI i movimenti 2024"""
    move_line_ids = models.execute_kw(db, uid, password,
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'order': 'date asc, id asc'}
    )

    if not move_line_ids:
        return []

    move_lines = models.execute_kw(db, uid, password,
        'account.move.line', 'read',
        [move_line_ids],
        {'fields': [
            'id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
            'move_id', 'partner_id', 'journal_id', 'create_date', 'write_date'
        ]}
    )

    return move_lines

def find_duplicates(move_lines):
    """Trova duplicati basandosi su: data + importo + descrizione simile"""

    # Group by signature: date + debit + credit
    signatures = defaultdict(list)

    for ml in move_lines:
        sig = f"{ml['date']}|{ml['debit']:.2f}|{ml['credit']:.2f}"
        signatures[sig].append(ml)

    # Find duplicates (same signature with 2+ entries)
    duplicates = {k: v for k, v in signatures.items() if len(v) > 1}

    return duplicates

def find_exact_duplicates(move_lines):
    """Trova duplicati ESATTI: stessa data, importo, descrizione"""

    signatures = defaultdict(list)

    for ml in move_lines:
        name = (ml['name'] or '').strip()
        ref = (ml['ref'] or '').strip()
        sig = f"{ml['date']}|{ml['debit']:.2f}|{ml['credit']:.2f}|{name}|{ref}"
        signatures[sig].append(ml)

    duplicates = {k: v for k, v in signatures.items() if len(v) > 1}

    return duplicates

def analyze_opening_balance(account_id):
    """Verifica saldo apertura 2024"""

    # Somma tutti movimenti PRIMA 2024
    move_line_ids = models.execute_kw(db, uid, password,
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_id],
            ['date', '<', '2024-01-01'],
            ['parent_state', '=', 'posted']
        ]]
    )

    if not move_line_ids:
        return 0.0

    move_lines = models.execute_kw(db, uid, password,
        'account.move.line', 'read',
        [move_line_ids],
        {'fields': ['debit', 'credit']}
    )

    total_debit = sum(ml['debit'] for ml in move_lines)
    total_credit = sum(ml['credit'] for ml in move_lines)

    return total_debit - total_credit

def main():
    print("="*80)
    print("ANALISI DUPLICATI KONTO 1024 - UBS CHF")
    print("="*80)

    account_id = get_account_id(ACCOUNT_CODE)
    if not account_id:
        print(f"ERRORE: Konto {ACCOUNT_CODE} non trovato")
        return

    print(f"\nKonto 1024 ID: {account_id}")

    # 1. Verifica saldo apertura
    print("\n" + "="*80)
    print("1. VERIFICA SALDO APERTURA 2024")
    print("="*80)

    opening_balance = analyze_opening_balance(account_id)
    print(f"\nSaldo apertura calcolato (pre-2024): CHF {opening_balance:,.2f}")
    print(f"Saldo apertura atteso da banca:      CHF 143,739.47")
    print(f"Differenza:                          CHF {(opening_balance - 143739.47):,.2f}")

    if abs(opening_balance - 143739.47) > 0.01:
        print("\n[!] DISCREPANZA SALDO APERTURA RILEVATA!")
    else:
        print("\n[OK] Saldo apertura allineato")

    # 2. Carica tutti movimenti 2024
    print("\n" + "="*80)
    print("2. CARICAMENTO MOVIMENTI 2024")
    print("="*80)

    move_lines = get_all_moves_2024(account_id)
    print(f"\nTotale movimenti 2024: {len(move_lines)}")

    total_debit = sum(ml['debit'] for ml in move_lines)
    total_credit = sum(ml['credit'] for ml in move_lines)

    print(f"Totale DARE:  CHF {total_debit:,.2f}")
    print(f"Totale AVERE: CHF {total_credit:,.2f}")
    print(f"Netto 2024:   CHF {(total_debit - total_credit):,.2f}")

    # 3. Cerca duplicati per firma (data + importo)
    print("\n" + "="*80)
    print("3. RICERCA DUPLICATI PER FIRMA (DATA + IMPORTO)")
    print("="*80)

    duplicates_by_signature = find_duplicates(move_lines)

    print(f"\nTrovati {len(duplicates_by_signature)} gruppi di possibili duplicati")

    total_duplicate_amount = 0

    if duplicates_by_signature:
        print("\nPRIMI 20 GRUPPI DI DUPLICATI:")
        print("-" * 100)

        sorted_dups = sorted(
            duplicates_by_signature.items(),
            key=lambda x: sum(ml['debit'] + ml['credit'] for ml in x[1]),
            reverse=True
        )[:20]

        for sig, group in sorted_dups:
            date, debit, credit = sig.split('|')
            amount = float(debit) if float(debit) > 0 else float(credit)
            count = len(group)

            print(f"\n{date} | DARE: {debit} | AVERE: {credit} | Count: {count}")

            for ml in group[:3]:  # Show first 3
                name = ml['name'] or ''
                ref = ml['ref'] or ''
                print(f"  - ID {ml['id']}: {name[:50]} | {ref[:30]}")

            if count > 3:
                print(f"  ... e altri {count - 3} duplicati")

            # Sum potential duplicate amount
            if count > 1:
                duplicate_amount = amount * (count - 1)  # Assume 1 is real, rest are duplicates
                total_duplicate_amount += duplicate_amount

    print(f"\n[!] Potenziale importo duplicato: CHF {total_duplicate_amount:,.2f}")

    # 4. Cerca duplicati ESATTI
    print("\n" + "="*80)
    print("4. RICERCA DUPLICATI ESATTI (DATA + IMPORTO + DESCRIZIONE)")
    print("="*80)

    exact_duplicates = find_exact_duplicates(move_lines)

    print(f"\nTrovati {len(exact_duplicates)} gruppi di duplicati ESATTI")

    total_exact_duplicate_amount = 0

    if exact_duplicates:
        print("\nTUTTI I DUPLICATI ESATTI:")
        print("-" * 100)

        for sig, group in sorted(exact_duplicates.items(), key=lambda x: x[0]):
            date, debit, credit, name, ref = sig.split('|')
            amount = float(debit) if float(debit) > 0 else float(credit)
            count = len(group)

            print(f"\n{date} | {name[:40]}")
            print(f"  DARE: {debit} | AVERE: {credit} | Count: {count}")

            for ml in group:
                journal = ml['journal_id'][1] if isinstance(ml['journal_id'], list) else ''
                print(f"  - ID {ml['id']} | Journal: {journal} | Created: {ml['create_date']}")

            # Sum exact duplicates (count - 1 because one is legit)
            if count > 1:
                exact_amount = amount * (count - 1)
                total_exact_duplicate_amount += exact_amount

    print(f"\n[!] Importo duplicati ESATTI: CHF {total_exact_duplicate_amount:,.2f}")

    # 5. Analisi FX transactions
    print("\n" + "="*80)
    print("5. ANALISI FX TRANSACTIONS")
    print("="*80)

    fx_moves = [ml for ml in move_lines if 'FX' in (ml['name'] or '').upper() or 'VERKAUF CHF' in (ml['name'] or '').upper()]

    print(f"\nTrovati {len(fx_moves)} movimenti FX")

    total_fx_amount = sum(ml['credit'] for ml in fx_moves)
    print(f"Totale importo FX (AVERE): CHF {total_fx_amount:,.2f}")

    if fx_moves:
        print("\nPRIMI 10 MOVIMENTI FX:")
        print("-" * 100)

        for ml in fx_moves[:10]:
            print(f"{ml['date']} | {ml['name'][:60]} | AVERE: {ml['credit']:,.2f}")

    # 6. SUMMARY
    print("\n" + "="*80)
    print("SUMMARY FINALE")
    print("="*80)

    print(f"\nSaldo apertura discrepanza:     CHF {(opening_balance - 143739.47):,.2f}")
    print(f"Potenziali duplicati (firma):   CHF {total_duplicate_amount:,.2f}")
    print(f"Duplicati ESATTI:               CHF {total_exact_duplicate_amount:,.2f}")
    print(f"Totale FX transactions:         CHF {total_fx_amount:,.2f}")
    print(f"\nGap da spiegare:                CHF 193,916.21")

    gap_explained = abs(opening_balance - 143739.47) + total_exact_duplicate_amount
    print(f"\nGap spiegato con questa analisi: CHF {gap_explained:,.2f}")
    print(f"Gap rimanente:                    CHF {(193916.21 - gap_explained):,.2f}")

    # Save detailed report
    report = {
        'analysis_date': datetime.now().isoformat(),
        'konto': ACCOUNT_CODE,
        'opening_balance': {
            'calculated': opening_balance,
            'expected': 143739.47,
            'difference': opening_balance - 143739.47
        },
        'movements_2024': {
            'total_count': len(move_lines),
            'total_debit': total_debit,
            'total_credit': total_credit,
            'net_change': total_debit - total_credit
        },
        'duplicates': {
            'by_signature_count': len(duplicates_by_signature),
            'by_signature_amount': total_duplicate_amount,
            'exact_count': len(exact_duplicates),
            'exact_amount': total_exact_duplicate_amount,
            'exact_details': [
                {
                    'date': sig.split('|')[0],
                    'debit': float(sig.split('|')[1]),
                    'credit': float(sig.split('|')[2]),
                    'name': sig.split('|')[3],
                    'ref': sig.split('|')[4],
                    'count': len(group),
                    'ids': [ml['id'] for ml in group]
                }
                for sig, group in exact_duplicates.items()
            ]
        },
        'fx_transactions': {
            'count': len(fx_moves),
            'total_amount': total_fx_amount
        },
        'gap_analysis': {
            'target_gap': 193916.21,
            'explained': gap_explained,
            'remaining': 193916.21 - gap_explained
        }
    }

    output_file = 'ANALISI-DUPLICATI-1024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n[OK] Report salvato: {output_file}")

if __name__ == '__main__':
    main()
