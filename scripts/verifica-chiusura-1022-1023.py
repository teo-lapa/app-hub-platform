#!/usr/bin/env python3
"""
VERIFICA CHIUSURA KONTO 1022 E 1023
====================================

Quick check per commercialista
"""

import xmlrpc.client
from decimal import Decimal

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

def format_chf(amount):
    return f"CHF {amount:,.2f}".replace(',', "'")

def get_account_balance(models, uid, account_code):
    """Calcola saldo account"""
    # Get account ID
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[['code', '=', account_code]]]
    )

    if not account_ids:
        return None, f"Account {account_code} not found"

    account_id = account_ids[0]

    # Somma debit - credit
    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[['account_id', '=', account_id]]],
        {'fields': ['debit', 'credit']}
    )

    total_debit = Decimal('0')
    total_credit = Decimal('0')

    for line in lines:
        total_debit += Decimal(str(line['debit']))
        total_credit += Decimal(str(line['credit']))

    balance = total_debit - total_credit

    return balance, None

def check_move_exists(models, uid, move_id):
    """Verifica esistenza move"""
    moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'search_read',
        [[['id', '=', move_id]]],
        {'fields': ['name', 'ref', 'date', 'state']}
    )

    return moves[0] if moves else None

def main():
    print("\n" + "="*70)
    print("  VERIFICA CHIUSURA KONTO 1022 E 1023")
    print("="*70 + "\n")

    # Connect
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})

    if not uid:
        print("[ERRORE] Autenticazione fallita!")
        return False

    print("[OK] Connesso a Odoo STAGING\n")

    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")

    # Check balances
    print("="*70)
    print("CHECK 1: SALDI KONTI")
    print("="*70 + "\n")

    accounts_to_check = [
        ('1022', 'Outstanding Receipts'),
        ('1023', 'Outstanding Payments'),
        ('3900', 'Differences')
    ]

    all_ok = True

    for code, name in accounts_to_check:
        balance, error = get_account_balance(models, uid, code)

        if error:
            print(f"[ERROR] {code} {name}: {error}")
            all_ok = False
            continue

        status = "OK" if abs(balance) < Decimal('0.01') else "ATTENZIONE"

        if code in ['1022', '1023']:
            # Questi devono essere zero
            if abs(balance) < Decimal('0.01'):
                print(f"[OK] Konto {code} {name}:")
                print(f"     Saldo: {format_chf(balance)} - AZZERATO!")
            else:
                print(f"[ERRORE] Konto {code} {name}:")
                print(f"         Saldo: {format_chf(balance)} - NON ZERO!")
                all_ok = False
        else:
            # 3900 può essere diverso da zero
            print(f"[INFO] Konto {code} {name}:")
            print(f"       Saldo: {format_chf(balance)}")

        print()

    # Check moves
    print("="*70)
    print("CHECK 2: REGISTRAZIONI CHIUSURA")
    print("="*70 + "\n")

    moves_to_check = [
        (97148, 'CHIUSURA-1022-STAGING-2024'),
        (97149, 'CHIUSURA-1023-STAGING-2024')
    ]

    for move_id, expected_ref in moves_to_check:
        move = check_move_exists(models, uid, move_id)

        if not move:
            print(f"[ERRORE] Move {move_id} non trovato!")
            all_ok = False
            continue

        print(f"[OK] Move {move_id}:")
        print(f"     Name: {move['name']}")
        print(f"     Ref: {move['ref']}")
        print(f"     Date: {move['date']}")
        print(f"     State: {move['state']}")

        if move['state'] != 'posted':
            print(f"     [WARNING] Move non posted!")
            all_ok = False

        if move['ref'] != expected_ref:
            print(f"     [WARNING] Ref diverso dall'atteso!")

        print()

    # Final summary
    print("="*70)
    print("RIEPILOGO FINALE")
    print("="*70 + "\n")

    if all_ok:
        print("[SUCCESS] Tutti i check PASSED!")
        print("\n1. Konto 1022: CHF 0.00")
        print("2. Konto 1023: CHF 0.00")
        print("3. Move 97148: POSTED")
        print("4. Move 97149: POSTED")
        print("\n[OK] Chiusura completata correttamente!\n")
        return True
    else:
        print("[FAIL] Alcuni check FALLITI - verificare output sopra\n")
        return False

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERRORE] {e}")
        import traceback
        traceback.print_exc()
        exit(1)
