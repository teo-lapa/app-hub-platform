#!/usr/bin/env python3
"""
Cancella move errati 97146 e 97147
"""

import xmlrpc.client

ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

def main():
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")

    move_ids = [97146, 97147]

    print("Cancellazione move errati...")

    for move_id in move_ids:
        try:
            # Prima button_draft
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move', 'button_draft',
                [[move_id]]
            )
            print(f"  Move {move_id} -> draft")

            # Poi unlink
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move', 'unlink',
                [[move_id]]
            )
            print(f"  Move {move_id} -> CANCELLATO")

        except Exception as e:
            print(f"  ERRORE su {move_id}: {e}")

    print("\nOperazione completata!")

if __name__ == "__main__":
    main()
