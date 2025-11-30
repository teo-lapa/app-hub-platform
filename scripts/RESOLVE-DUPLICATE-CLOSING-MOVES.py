#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RESOLVE DUPLICATE CLOSING MOVES
================================

Analizza e risolve la situazione con multiple registrazioni di chiusura
(alcune POSTED, alcune DRAFT)
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import xmlrpc.client
import ssl
from decimal import Decimal

ODOO_CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def connect():
    ssl_context = ssl._create_unverified_context()
    common = xmlrpc.client.ServerProxy(f"{ODOO_CONFIG['url']}/xmlrpc/2/common", context=ssl_context)
    uid = common.authenticate(ODOO_CONFIG['db'], ODOO_CONFIG['username'], ODOO_CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{ODOO_CONFIG['url']}/xmlrpc/2/object", context=ssl_context)
    return uid, models

def format_chf(amount):
    return f"CHF {amount:,.2f}".replace(',', "'")

def analyze_all_closing_moves(uid, models):
    """Analizza TUTTE le registrazioni di chiusura"""

    move_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'search',
        [[['ref', 'ilike', 'CHIUSURA-102']]]
    )

    moves = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'read',
        [move_ids],
        {'fields': ['id', 'name', 'ref', 'date', 'state', 'line_ids', 'create_date']}
    )

    # Raggruppa per ref (1022 vs 1023)
    moves_1022 = [m for m in moves if '1022' in m['ref']]
    moves_1023 = [m for m in moves if '1023' in m['ref']]

    return moves_1022, moves_1023, moves

def get_move_details(uid, models, move):
    """Ottiene dettagli completi move incluse righe"""

    line_ids = move['line_ids']
    lines = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'read',
        [line_ids],
        {'fields': ['account_id', 'debit', 'credit', 'balance']}
    )

    move['lines_detail'] = lines

    # Trova importo chiusura (amount su konto 1022/1023)
    closing_amount = Decimal('0')
    for line in lines:
        account_code = line['account_id'][1].split()[0] if line['account_id'] else ''
        if account_code in ['1022', '1023']:
            # Prendi il valore assoluto della riga
            if line['debit'] > 0:
                closing_amount = Decimal(str(line['debit']))
            else:
                closing_amount = Decimal(str(line['credit']))
            break

    move['closing_amount'] = closing_amount

    return move

def get_current_balance(uid, models, account_code):
    """Ottiene saldo attuale POSTED"""

    account_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.account', 'search',
        [[['code', '=', account_code]]]
    )

    if not account_ids:
        return None

    account_id = account_ids[0]

    lines = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['debit', 'credit']}
    )

    total_debit = sum(Decimal(str(l['debit'])) for l in lines)
    total_credit = sum(Decimal(str(l['credit'])) for l in lines)
    balance = total_debit - total_credit

    return balance

def main():
    print("\n" + "="*70)
    print("RESOLVE DUPLICATE CLOSING MOVES")
    print("="*70 + "\n")

    uid, models = connect()
    print("✓ Connesso\n")

    # Analizza tutti i moves
    moves_1022, moves_1023, all_moves = analyze_all_closing_moves(uid, models)

    print("="*70)
    print("SITUAZIONE ATTUALE")
    print("="*70 + "\n")

    print(f"Trovati {len(all_moves)} moves di chiusura totali:")
    print(f"  • Moves per 1022: {len(moves_1022)}")
    print(f"  • Moves per 1023: {len(moves_1023)}\n")

    # Analizza moves 1022
    print("="*70)
    print("MOVES PER KONTO 1022")
    print("="*70 + "\n")

    for move in sorted(moves_1022, key=lambda x: x['create_date']):
        move_details = get_move_details(uid, models, move)

        print(f"Move ID: {move['id']}")
        print(f"  Name: {move['name']}")
        print(f"  Ref: {move['ref']}")
        print(f"  State: {move['state']}")
        print(f"  Date: {move['date']}")
        print(f"  Create Date: {move['create_date']}")
        print(f"  Closing Amount: {format_chf(move_details['closing_amount'])}")
        print()

    # Analizza moves 1023
    print("="*70)
    print("MOVES PER KONTO 1023")
    print("="*70 + "\n")

    for move in sorted(moves_1023, key=lambda x: x['create_date']):
        move_details = get_move_details(uid, models, move)

        print(f"Move ID: {move['id']}")
        print(f"  Name: {move['name']}")
        print(f"  Ref: {move['ref']}")
        print(f"  State: {move['state']}")
        print(f"  Date: {move['date']}")
        print(f"  Create Date: {move['create_date']}")
        print(f"  Closing Amount: {format_chf(move_details['closing_amount'])}")
        print()

    # Saldi attuali
    print("="*70)
    print("SALDI ATTUALI (POSTED)")
    print("="*70 + "\n")

    balance_1022 = get_current_balance(uid, models, '1022')
    balance_1023 = get_current_balance(uid, models, '1023')

    print(f"Konto 1022: {format_chf(balance_1022)}")
    print(f"Konto 1023: {format_chf(balance_1023)}\n")

    # STRATEGIA
    print("="*70)
    print("STRATEGIA RISOLUTIVA")
    print("="*70 + "\n")

    print("PROBLEMA IDENTIFICATO:")
    print("  • Ci sono MULTIPLE registrazioni di chiusura")
    print("  • Alcune sono POSTED, altre DRAFT")
    print("  • Questo causa confusione sui saldi\n")

    print("SOLUZIONE PROPOSTA:")
    print("  1. CANCELLARE le registrazioni DRAFT (non ancora finalizzate)")
    print("  2. VERIFICARE se le registrazioni POSTED sono corrette")
    print("  3. Se POSTED non sufficiente, CREARE NUOVA registrazione complementare")
    print("  4. AZZERARE completamente i saldi\n")

    print("AZIONI SPECIFICHE:\n")

    # Identifica cosa fare
    posted_1022 = [m for m in moves_1022 if m['state'] == 'posted']
    draft_1022 = [m for m in moves_1022 if m['state'] == 'draft']

    posted_1023 = [m for m in moves_1023 if m['state'] == 'posted']
    draft_1023 = [m for m in moves_1023 if m['state'] == 'draft']

    print(f"KONTO 1022:")
    print(f"  • {len(posted_1022)} POSTED moves (mantieni)")
    print(f"  • {len(draft_1022)} DRAFT moves (da cancellare)")
    print(f"  • Saldo rimanente: {format_chf(balance_1022)}")

    if abs(balance_1022) >= Decimal('0.01'):
        print(f"  • SERVE registrazione complementare per: {format_chf(abs(balance_1022))}\n")
    else:
        print(f"  • GIÀ a ZERO - nessuna azione necessaria\n")

    print(f"KONTO 1023:")
    print(f"  • {len(posted_1023)} POSTED moves (mantieni)")
    print(f"  • {len(draft_1023)} DRAFT moves (da cancellare)")
    print(f"  • Saldo rimanente: {format_chf(balance_1023)}")

    if abs(balance_1023) >= Decimal('0.01'):
        print(f"  • SERVE registrazione complementare per: {format_chf(abs(balance_1023))}\n")
    else:
        print(f"  • GIÀ a ZERO - nessuna azione necessaria\n")

    # ESECUZIONE
    print("="*70)
    print("ESECUZIONE AZIONI")
    print("="*70 + "\n")

    # 1. Cancella DRAFT
    print("STEP 1: Cancellazione DRAFT moves\n")

    draft_to_delete = draft_1022 + draft_1023

    if draft_to_delete:
        for move in draft_to_delete:
            print(f"Cancellando Move {move['id']} ({move['ref']})...")
            try:
                # Prima cancella le righe
                models.execute_kw(
                    ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
                    'account.move.line', 'unlink',
                    [move['line_ids']]
                )

                # Poi cancella il move
                models.execute_kw(
                    ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
                    'account.move', 'unlink',
                    [[move['id']]]
                )

                print(f"  ✓ Cancellato con successo\n")

            except Exception as e:
                print(f"  ✗ ERRORE: {e}\n")
    else:
        print("  • Nessun DRAFT move da cancellare\n")

    # 2. Verifica saldi dopo cancellazione
    balance_1022_after = get_current_balance(uid, models, '1022')
    balance_1023_after = get_current_balance(uid, models, '1023')

    print("STEP 2: Verifica saldi dopo cancellazione DRAFT\n")
    print(f"  Konto 1022: {format_chf(balance_1022_after)}")
    print(f"  Konto 1023: {format_chf(balance_1023_after)}\n")

    # 3. Crea registrazioni complementari SE necessario
    print("STEP 3: Registrazioni complementari\n")

    def create_complementary_closing(account_code, balance):
        """Crea registrazione complementare per azzerare saldo"""

        if abs(balance) < Decimal('0.01'):
            print(f"  Konto {account_code}: GIÀ a zero - skip\n")
            return None

        print(f"  Creando registrazione complementare per {account_code}...")

        # Trova account IDs
        account_1 = models.execute_kw(
            ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
            'account.account', 'search',
            [[['code', '=', account_code]]]
        )[0]

        account_3900 = models.execute_kw(
            ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
            'account.account', 'search',
            [[['code', '=', '3900']]]
        )[0]

        # Determina dare/avere
        # Se balance > 0 (Dare > Avere), devo fare AVERE per azzerare
        # Se balance < 0 (Avere > Dare), devo fare DARE per azzerare

        if balance > 0:
            # Saldo dare: fare AVERE su account, DARE su 3900
            line_1_debit = 0
            line_1_credit = float(abs(balance))
            line_2_debit = float(abs(balance))
            line_2_credit = 0
        else:
            # Saldo avere: fare DARE su account, AVERE su 3900
            line_1_debit = float(abs(balance))
            line_1_credit = 0
            line_2_debit = 0
            line_2_credit = float(abs(balance))

        move_vals = {
            'journal_id': 1,  # Miscellaneous
            'date': '2024-12-31',
            'ref': f'CHIUSURA-COMPLEMENTARE-{account_code}-2024',
            'line_ids': [
                (0, 0, {
                    'account_id': account_1,
                    'name': f'Chiusura complementare {account_code}',
                    'debit': line_1_debit,
                    'credit': line_1_credit
                }),
                (0, 0, {
                    'account_id': account_3900,
                    'name': f'Chiusura complementare {account_code}',
                    'debit': line_2_debit,
                    'credit': line_2_credit
                })
            ]
        }

        try:
            move_id = models.execute_kw(
                ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
                'account.move', 'create',
                [move_vals]
            )

            print(f"    ✓ Move creato: ID {move_id}")

            # POST
            models.execute_kw(
                ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
                'account.move', 'action_post',
                [[move_id]]
            )

            print(f"    ✓ Move POSTED con successo\n")

            return move_id

        except Exception as e:
            print(f"    ✗ ERRORE: {e}\n")
            return None

    # Crea registrazioni complementari
    comp_1022 = create_complementary_closing('1022', balance_1022_after)
    comp_1023 = create_complementary_closing('1023', balance_1023_after)

    # VERIFICA FINALE
    print("="*70)
    print("VERIFICA FINALE")
    print("="*70 + "\n")

    balance_1022_final = get_current_balance(uid, models, '1022')
    balance_1023_final = get_current_balance(uid, models, '1023')

    print(f"SALDI FINALI (POSTED):")
    print(f"  Konto 1022: {format_chf(balance_1022_final)}")
    print(f"  Konto 1023: {format_chf(balance_1023_final)}\n")

    # Status
    if abs(balance_1022_final) < Decimal('0.01') and abs(balance_1023_final) < Decimal('0.01'):
        print("="*70)
        print("✓✓✓ SUCCESS: ENTRAMBI I KONTI AZZERATI!")
        print("="*70 + "\n")
        print("OBIETTIVO RAGGIUNTO:")
        print("  • Konto 1022 (Outstanding Receipts): CHF 0.00")
        print("  • Konto 1023 (Outstanding Payments): CHF 0.00")
        print("\n✓ Pronto per chiusura contabile 31.12.2024\n")
    else:
        print("="*70)
        print("⚠ ATTENZIONE: Saldi non completamente azzerati")
        print("="*70 + "\n")

if __name__ == "__main__":
    main()
