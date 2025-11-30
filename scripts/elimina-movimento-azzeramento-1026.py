#!/usr/bin/env python3
"""
ELIMINA MOVIMENTO AZZERAMENTO 2023 - BNK3/2024/00867
Move ID: 58103
Data: 03/06/2024
Importo: CHF 132,834.54

ATTENZIONE: Questo script elimina un movimento contabile!
Eseguire SOLO dopo approvazione del commercialista.
"""

import os
import xmlrpc.client

ODOO_URL = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
ODOO_DB = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
ODOO_USERNAME = os.getenv('ODOO_ADMIN_EMAIL', 'apphubplatform@lapa.ch')
ODOO_PASSWORD = os.getenv('ODOO_ADMIN_PASSWORD', 'apphubplatform2025')

MOVE_ID_TO_DELETE = 58103
MOVE_NAME = 'BNK3/2024/00867'

def connect_odoo():
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return models, uid

def main():
    print("=" * 80)
    print("ELIMINAZIONE MOVIMENTO AZZERAMENTO 2023")
    print("=" * 80)
    print(f"Move ID: {MOVE_ID_TO_DELETE}")
    print(f"Move Name: {MOVE_NAME}")
    print(f"Data: 03/06/2024")
    print(f"Importo: CHF 132,834.54")
    print("=" * 80)

    print("\nATTENZIONE: Questa operazione NON e reversibile!")
    print("Il movimento verra eliminato DEFINITIVAMENTE da Odoo.")
    print("\nVerifica:")
    print("1. Hai approvazione del commercialista?")
    print("2. Hai fatto backup del database?")
    print("3. Sei sicuro che questo movimento e errato?")

    confirm1 = input("\nDigita 'ELIMINA' per confermare: ")
    if confirm1 != 'ELIMINA':
        print("Operazione annullata")
        return

    confirm2 = input("Sei ASSOLUTAMENTE SICURO? Digita 'SI CONFERMO': ")
    if confirm2 != 'SI CONFERMO':
        print("Operazione annullata")
        return

    # Connetti
    models, uid = connect_odoo()
    print(f"\nConnesso a Odoo")

    # Verifica movimento esiste
    moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'search_read',
        [[['id', '=', MOVE_ID_TO_DELETE]]],
        {'fields': ['id', 'name', 'date', 'state', 'line_ids']}
    )

    if not moves:
        print(f"ERRORE: Movimento {MOVE_ID_TO_DELETE} non trovato")
        return

    move = moves[0]
    print(f"\nMovimento trovato:")
    print(f"  ID: {move['id']}")
    print(f"  Name: {move['name']}")
    print(f"  Data: {move['date']}")
    print(f"  Stato: {move['state']}")
    print(f"  Righe: {len(move['line_ids'])}")

    if move['name'] != MOVE_NAME:
        print(f"ERRORE: Nome movimento non corrisponde!")
        print(f"  Atteso: {MOVE_NAME}")
        print(f"  Trovato: {move['name']}")
        return

    # Se posted, prima button_draft
    if move['state'] == 'posted':
        print("\nMovimento in stato 'posted', metto in draft...")
        try:
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move', 'button_draft',
                [[MOVE_ID_TO_DELETE]]
            )
            print("Movimento messo in draft")
        except Exception as e:
            print(f"ERRORE mettendo in draft: {e}")
            print("Tentativo eliminazione diretta...")

    # Elimina
    print(f"\nEliminazione movimento {MOVE_ID_TO_DELETE}...")
    try:
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'unlink',
            [[MOVE_ID_TO_DELETE]]
        )
        print("Movimento eliminato con successo!")
    except Exception as e:
        print(f"ERRORE durante eliminazione: {e}")
        return

    # Verifica eliminazione
    print("\nVerifica eliminazione...")
    check = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'search_read',
        [[['id', '=', MOVE_ID_TO_DELETE]]],
        {'fields': ['id']}
    )

    if not check:
        print("Movimento eliminato correttamente!")
    else:
        print("ATTENZIONE: Movimento ancora presente in Odoo!")

    # Verifica nuovo saldo konto 1026
    print("\nCalcolo nuovo saldo konto 1026...")
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', '1026']]],
        {'fields': ['id']}
    )

    if accounts:
        account_id = accounts[0]['id']

        # Saldo al 31/12/2024
        lines = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', account_id],
                ['date', '<=', '2024-12-31'],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['debit', 'credit']}
        )

        from decimal import Decimal
        balance = Decimal('0')
        for line in lines:
            balance += Decimal(str(line['debit'])) - Decimal(str(line['credit']))

        print(f"\nNuovo saldo konto 1026 al 31/12/2024:")
        print(f"  Saldo ODOO:  CHF {balance:>15,.2f}")
        print(f"  Saldo BANCA: CHF {24897.72:>15,.2f}")
        diff = balance - Decimal('24897.72')
        print(f"  Differenza:  CHF {diff:>15,.2f}")

        print("\n" + "=" * 80)
        print("OPERAZIONE COMPLETATA")
        print("=" * 80)
        print(f"Saldo corretto di: CHF 132,834.54")
        print(f"Differenza residua: CHF {diff:,.2f}")
        print("\nProssimi step:")
        print("1. Verificare rettifica apertura gennaio (+CHF 50,903.87)")
        print("2. Analizzare movimenti DARE feb-apr (CHF 160,000)")
        print("3. Rieseguire: python scripts/analizza-dicembre-2024-dettaglio.py")

if __name__ == '__main__':
    main()
