"""
VERIFICA FINALE KONTO 10901

Verifica che il saldo sia effettivamente CHF 0.00

Author: Odoo Integration Master
Date: 2025-11-15
"""

import xmlrpc.client

# CONFIGURAZIONE ODOO
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

KONTO_10901 = 1

class OdooClient:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.uid = None
        self.models = None

    def connect(self):
        """Connessione a Odoo"""
        try:
            common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
            self.uid = common.authenticate(self.db, self.username, self.password, {})

            if not self.uid:
                raise Exception("Autenticazione fallita!")

            self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
            print(f"[OK] Connesso a Odoo come {self.username} (UID: {self.uid})")
            return True

        except Exception as e:
            print(f"[ERRORE] Errore connessione: {e}")
            return False

    def search_read(self, model, domain, fields, **kwargs):
        """Search e read combinati"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain],
            {'fields': fields, **kwargs}
        )

    def execute(self, model, method, *args):
        """Esegue metodo su modello Odoo"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, method, args
        )

def main():
    print("="*80)
    print("VERIFICA FINALE KONTO 10901")
    print("="*80)

    client = OdooClient()
    if not client.connect():
        print("\n[X] ERRORE: Impossibile connettersi a Odoo!")
        return

    print("\nCalcolo saldo finale...")

    # Calcola saldo leggendo tutti i movimenti
    total_debit = 0
    total_credit = 0
    offset = 0
    batch_size = 1000

    while True:
        batch = client.search_read(
            'account.move.line',
            [['account_id', '=', KONTO_10901]],
            ['debit', 'credit'],
            limit=batch_size,
            offset=offset
        )

        if not batch:
            break

        for line in batch:
            total_debit += line.get('debit', 0)
            total_credit += line.get('credit', 0)

        offset += batch_size

    saldo = total_debit - total_credit

    print(f"\n{'='*80}")
    print(f"RISULTATO FINALE:")
    print(f"{'='*80}")
    print(f"Totale DARE:   CHF {total_debit:,.2f}")
    print(f"Totale AVERE:  CHF {total_credit:,.2f}")
    print(f"SALDO FINALE:  CHF {saldo:,.2f}")
    print(f"{'='*80}")

    if abs(saldo) < 0.01:
        print("\n[TARGET][TARGET][TARGET] OBIETTIVO RAGGIUNTO!")
        print("Konto 10901 = CHF 0.00")
        print("="*80)
    else:
        print(f"\n[!] ATTENZIONE: Saldo residuo di CHF {saldo:,.2f}")

    # Mostra ultimi 10 movimenti
    print("\n=== ULTIMI 10 MOVIMENTI ===")
    recent_moves = client.search_read(
        'account.move.line',
        [['account_id', '=', KONTO_10901]],
        ['id', 'date', 'name', 'debit', 'credit', 'balance', 'move_id'],
        limit=10,
        order='id desc'
    )

    for line in recent_moves:
        move_name = line['move_id'][1] if isinstance(line.get('move_id'), list) else 'N/A'
        print(f"ID {line['id']:6d} | {line['date']} | {move_name:40s} | D: {line.get('debit', 0):>10,.2f} | A: {line.get('credit', 0):>10,.2f}")

if __name__ == "__main__":
    main()
