#!/usr/bin/env python3
"""
ELIMINA DUPLICATI KONTO 1026 - Credit Suisse
ATTENZIONE: Questo script elimina righe da Odoo!
Eseguire SOLO dopo verifica manuale dei duplicati
"""

import os
import xmlrpc.client

ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478'
ODOO_USERNAME = 'apphubplatform@lapa.ch'
ODOO_PASSWORD = 'apphubplatform2025'

def connect_odoo():
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return models, uid

def main():
    print('Connessione a Odoo...')
    models, uid = connect_odoo()
    print('Connesso!')

    # Duplicati identificati: 4 righe
    # Importo duplicato: CHF 5,301.30

    # Lista line_ids da eliminare (tenendo la prima di ogni gruppo)
    lines_to_delete = [
        264598,  # 2024-08-08 - 07.08.2024 12:43 BP TS Kemptth
        264764,  # 2024-08-08 - 07.08.2024 17:51 Coop TS Netst
        277635,  # 2024-08-08 - 07.08.2024 08:08 Coop TS Embra
        328697,  # 2024-11-28 - LAPA   FINEST ITALIAN FOOD GMB
    ]

    print(f'Righe da eliminare: {len(lines_to_delete)}')
    print('ATTENZIONE: Questa operazione NON e reversibile!')
    confirm = input('Digitare SI per confermare eliminazione: ')

    if confirm != 'SI':
        print('Operazione annullata')
        return

    print('Eliminazione in corso...')
    for i, line_id in enumerate(lines_to_delete, 1):
        try:
            # Prima unlink la move line
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move.line', 'unlink',
                [[line_id]]
            )
            if i % 10 == 0:
                print(f'Eliminate {i}/{len(lines_to_delete)} righe...')
        except Exception as e:
            print(f'ERRORE eliminando line_id {line_id}: {e}')

    print('Eliminazione completata!')

if __name__ == '__main__':
    main()