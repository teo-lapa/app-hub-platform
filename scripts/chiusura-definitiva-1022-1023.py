#!/usr/bin/env python3
"""
CHIUSURA DEFINITIVA KONTO 1022 E 1023
======================================

Porta a ZERO entrambi i konti Outstanding con registrazioni al 31.12.2024

STAGING ENVIRONMENT - Safe to experiment!
"""

import xmlrpc.client
from datetime import datetime
from decimal import Decimal

# ============================================================================
# CONFIGURAZIONE ODOO STAGING
# ============================================================================

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# ============================================================================
# PARAMETRI CHIUSURA
# ============================================================================

CHIUSURA_DATE = "2024-12-31"
JOURNAL_ID = 1  # Miscellaneous Operations

# Konto accounts
KONTO_1022 = "1022"  # Outstanding Receipts
KONTO_1023 = "1023"  # Outstanding Payments
KONTO_3900 = "3900"  # Differences

# Importi da chiudere (saldi attuali)
SALDO_1022 = Decimal("200647.42")  # Avere (positivo)
SALDO_1023 = Decimal("-324575.20")  # Dare (negativo)

# ============================================================================
# CONNESSIONE ODOO
# ============================================================================

def connect_odoo():
    """Connette a Odoo e restituisce uid"""
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("[ERRORE] Autenticazione fallita!")

    print(f"[OK] Connesso a Odoo come {ODOO_USER}")
    print(f"     Database: {ODOO_DB}")
    print(f"     UID: {uid}\n")

    return uid

def get_models():
    """Restituisce proxy per models"""
    return xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_account_id(models, uid, account_code):
    """Trova ID account da codice"""
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[['code', '=', account_code]]]
    )

    if not account_ids:
        raise Exception(f"[ERRORE] Account {account_code} non trovato!")

    return account_ids[0]

def get_account_balance(models, uid, account_id):
    """Legge saldo attuale account da account.move.line"""
    # Somma debit - credit per questo account
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

    return balance

def format_amount(amount):
    """Formatta importo per display"""
    return f"CHF {amount:,.2f}".replace(',', "'")

# ============================================================================
# CREAZIONE REGISTRAZIONI
# ============================================================================

def create_closing_entry(models, uid, account_ids, entry_config):
    """
    Crea registrazione di chiusura

    entry_config = {
        'ref': 'CHIUSURA-1022-STAGING-2024',
        'lines': [
            {'account': account_id, 'debit': amount, 'credit': 0},
            {'account': account_id, 'debit': 0, 'credit': amount}
        ]
    }
    """

    print(f"\n{'='*70}")
    print(f"CREAZIONE REGISTRAZIONE: {entry_config['ref']}")
    print(f"{'='*70}\n")

    # Prepara move vals
    move_vals = {
        'journal_id': JOURNAL_ID,
        'date': CHIUSURA_DATE,
        'ref': entry_config['ref'],
        'line_ids': []
    }

    # Aggiungi righe
    total_debit = Decimal('0')
    total_credit = Decimal('0')

    for line_config in entry_config['lines']:
        account_code = line_config['account_code']
        account_id = account_ids[account_code]
        debit = Decimal(str(line_config['debit']))
        credit = Decimal(str(line_config['credit']))

        line_vals = (0, 0, {
            'account_id': account_id,
            'name': entry_config['ref'],
            'debit': float(debit),
            'credit': float(credit)
        })

        move_vals['line_ids'].append(line_vals)
        total_debit += debit
        total_credit += credit

        # Display
        if debit > 0:
            print(f"  [D] Dare  {account_code}: {format_amount(debit)}")
        else:
            print(f"  [A] Avere {account_code}: {format_amount(credit)}")

    # Verifica quadratura
    if abs(total_debit - total_credit) > Decimal('0.01'):
        raise Exception(f"[ERRORE] Dare/Avere non quadrano!")

    print(f"\n  [TOTALI] Totale Dare:  {format_amount(total_debit)}")
    print(f"  [TOTALI] Totale Avere: {format_amount(total_credit)}")
    print(f"  [OK] Quadratura OK!")

    # Crea move
    try:
        move_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'create',
            [move_vals]
        )

        print(f"\n  [MOVE] Move creato: ID {move_id}")

        # Post move
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'action_post',
            [[move_id]]
        )

        print(f"  [OK] Move registrato (posted)")

        return move_id

    except Exception as e:
        print(f"\n  [ERRORE] ERRORE creazione move: {e}")
        raise

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    print("\n" + "="*70)
    print("  CHIUSURA DEFINITIVA KONTO 1022 E 1023")
    print("="*70)
    print(f"\n[DATA] Data chiusura: {CHIUSURA_DATE}")
    print(f"[ENV] Environment: STAGING")
    print(f"[INFO] Safe to experiment!\n")

    # Connect
    uid = connect_odoo()
    models = get_models()

    # Get account IDs
    print("[SETUP] Recupero account IDs...")
    account_ids = {
        '1022': get_account_id(models, uid, KONTO_1022),
        '1023': get_account_id(models, uid, KONTO_1023),
        '3900': get_account_id(models, uid, KONTO_3900)
    }

    for code, acc_id in account_ids.items():
        print(f"        Account {code}: ID {acc_id}")

    # Leggi saldi PRE-chiusura
    print(f"\n{'='*70}")
    print("SALDI PRE-CHIUSURA")
    print(f"{'='*70}\n")

    saldo_1022_pre = get_account_balance(models, uid, account_ids['1022'])
    saldo_1023_pre = get_account_balance(models, uid, account_ids['1023'])
    saldo_3900_pre = get_account_balance(models, uid, account_ids['3900'])

    print(f"  Konto 1022: {format_amount(saldo_1022_pre)}")
    print(f"  Konto 1023: {format_amount(saldo_1023_pre)}")
    print(f"  Konto 3900: {format_amount(saldo_3900_pre)}")

    # Verifica saldi attesi
    diff_1022 = abs(saldo_1022_pre - SALDO_1022)
    diff_1023 = abs(saldo_1023_pre - SALDO_1023)

    if diff_1022 > Decimal('0.01'):
        print(f"\n[WARNING] Saldo 1022 differisce dall'atteso!")
        print(f"          Atteso: {format_amount(SALDO_1022)}")
        print(f"          Attuale: {format_amount(saldo_1022_pre)}")
        print(f"          Diff: {format_amount(diff_1022)}")

    if diff_1023 > Decimal('0.01'):
        print(f"\n[WARNING] Saldo 1023 differisce dall'atteso!")
        print(f"          Atteso: {format_amount(SALDO_1023)}")
        print(f"          Attuale: {format_amount(saldo_1023_pre)}")
        print(f"          Diff: {format_amount(diff_1023)}")

    # CHIUSURA 1022
    # Saldo = Dare - Avere
    # Se saldo > 0 (Dare > Avere): dobbiamo fare AVERE per azzerare
    # Se saldo < 0 (Avere > Dare): dobbiamo fare DARE per azzerare

    if saldo_1022_pre > 0:
        # Saldo dare positivo: fare AVERE su 1022, DARE su 3900
        entry_1022 = {
            'ref': 'CHIUSURA-1022-STAGING-2024',
            'lines': [
                {
                    'account_code': '3900',
                    'debit': abs(saldo_1022_pre),
                    'credit': 0
                },
                {
                    'account_code': '1022',
                    'debit': 0,
                    'credit': abs(saldo_1022_pre)
                }
            ]
        }
    else:
        # Saldo avere negativo: fare DARE su 1022, AVERE su 3900
        entry_1022 = {
            'ref': 'CHIUSURA-1022-STAGING-2024',
            'lines': [
                {
                    'account_code': '1022',
                    'debit': abs(saldo_1022_pre),
                    'credit': 0
                },
                {
                    'account_code': '3900',
                    'debit': 0,
                    'credit': abs(saldo_1022_pre)
                }
            ]
        }

    move_id_1022 = create_closing_entry(models, uid, account_ids, entry_1022)

    # CHIUSURA 1023
    # Stesso principio

    if saldo_1023_pre > 0:
        # Saldo dare positivo: fare AVERE su 1023, DARE su 3900
        entry_1023 = {
            'ref': 'CHIUSURA-1023-STAGING-2024',
            'lines': [
                {
                    'account_code': '3900',
                    'debit': abs(saldo_1023_pre),
                    'credit': 0
                },
                {
                    'account_code': '1023',
                    'debit': 0,
                    'credit': abs(saldo_1023_pre)
                }
            ]
        }
    else:
        # Saldo avere negativo: fare DARE su 1023, AVERE su 3900
        entry_1023 = {
            'ref': 'CHIUSURA-1023-STAGING-2024',
            'lines': [
                {
                    'account_code': '1023',
                    'debit': abs(saldo_1023_pre),
                    'credit': 0
                },
                {
                    'account_code': '3900',
                    'debit': 0,
                    'credit': abs(saldo_1023_pre)
                }
            ]
        }

    move_id_1023 = create_closing_entry(models, uid, account_ids, entry_1023)

    # VERIFICA POST-CHIUSURA
    print(f"\n{'='*70}")
    print("SALDI POST-CHIUSURA")
    print(f"{'='*70}\n")

    saldo_1022_post = get_account_balance(models, uid, account_ids['1022'])
    saldo_1023_post = get_account_balance(models, uid, account_ids['1023'])
    saldo_3900_post = get_account_balance(models, uid, account_ids['3900'])

    print(f"  Konto 1022: {format_amount(saldo_1022_post)}")
    print(f"  Konto 1023: {format_amount(saldo_1023_post)}")
    print(f"  Konto 3900: {format_amount(saldo_3900_post)}")

    # Verifica zero (al centesimo)
    success = True

    if abs(saldo_1022_post) > Decimal('0.01'):
        print(f"\n[ERRORE] Konto 1022 non e' a zero!")
        success = False
    else:
        print(f"\n[OK] Konto 1022 AZZERATO!")

    if abs(saldo_1023_post) > Decimal('0.01'):
        print(f"[ERRORE] Konto 1023 non e' a zero!")
        success = False
    else:
        print(f"[OK] Konto 1023 AZZERATO!")

    # REPORT FINALE
    print(f"\n{'='*70}")
    print("REPORT FINALE")
    print(f"{'='*70}\n")

    print(f"[DATA] Data operazione: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[ENV] Environment: STAGING")
    print(f"\n[MOVES] Registrazioni create:")
    print(f"        1. CHIUSURA-1022-STAGING-2024 (Move ID: {move_id_1022})")
    print(f"        2. CHIUSURA-1023-STAGING-2024 (Move ID: {move_id_1023})")

    print(f"\n[MOVIMENTI] Movimenti contabili:")
    print(f"            Konto 1022: {format_amount(saldo_1022_pre)} -> {format_amount(saldo_1022_post)}")
    print(f"            Konto 1023: {format_amount(saldo_1023_pre)} -> {format_amount(saldo_1023_post)}")
    print(f"            Konto 3900: {format_amount(saldo_3900_pre)} -> {format_amount(saldo_3900_post)}")

    delta_3900 = saldo_3900_post - saldo_3900_pre
    print(f"\n[IMPATTO] Impatto su Konto 3900 (Differences):")
    print(f"          Delta: {format_amount(delta_3900)}")
    print(f"          (Differenza netta tra 1022 e 1023)")

    if success:
        print(f"\n{'='*70}")
        print("[SUCCESS] CHIUSURA COMPLETATA CON SUCCESSO!")
        print(f"{'='*70}\n")
        print("[OK] Entrambi i konti sono ora a CHF 0.00 (al centesimo)")
        print("[OK] Pronto per reporting commercialista")
        print("[INFO] Staging environment - Safe to verify!\n")
    else:
        print(f"\n{'='*70}")
        print("[FAIL] CHIUSURA FALLITA - VERIFICA NECESSARIA")
        print(f"{'='*70}\n")

    return success

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERRORE] ERRORE CRITICO: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
