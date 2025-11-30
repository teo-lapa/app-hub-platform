"""
VERIFICA STATO KONTO 10901 CON ADMIN

Verifica lo stato effettivo del Konto 10901 usando credenziali admin
e cerca i conti bancari corretti.

Author: Odoo Integration Master
Date: 2025-11-15
"""

import xmlrpc.client
from decimal import Decimal

# CONFIGURAZIONE ODOO - ADMIN
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "admin"  # Cambiato ad admin
ODOO_PASSWORD = "admin"  # Password admin

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

    def search_read(self, model, domain, fields):
        """Search e read combinati"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain],
            {'fields': fields}
        )

def main():
    print("="*80)
    print("VERIFICA STATO KONTO 10901")
    print("="*80)

    client = OdooClient()
    if not client.connect():
        print("\n[X] ERRORE: Impossibile connettersi a Odoo!")
        return

    # Cerca Konto 10901
    print("\n=== RICERCA KONTO 10901 ===")
    accounts_10901 = client.search_read(
        'account.account',
        [['code', '=', '10901']],
        ['id', 'code', 'name', 'current_balance', 'balance']
    )

    if accounts_10901:
        account = accounts_10901[0]
        print(f"\nKonto 10901 trovato:")
        print(f"  ID: {account['id']}")
        print(f"  Codice: {account['code']}")
        print(f"  Nome: {account['name']}")
        print(f"  Saldo corrente: CHF {account.get('current_balance', 0):,.2f}")
        print(f"  Balance: CHF {account.get('balance', 0):,.2f}")

        account_id = account['id']
    else:
        print("[X] Konto 10901 NON TROVATO!")
        return

    # Cerca movimenti su Konto 10901
    print("\n=== MOVIMENTI SU KONTO 10901 ===")
    move_lines = client.search_read(
        'account.move.line',
        [['account_id', '=', account_id]],
        ['id', 'date', 'name', 'debit', 'credit', 'balance', 'move_id']
    )

    print(f"\nTrovati {len(move_lines)} movimenti contabili")

    if move_lines:
        print("\nUltimi 10 movimenti:")
        for line in move_lines[-10:]:
            debit = line.get('debit', 0)
            credit = line.get('credit', 0)
            balance = line.get('balance', 0)
            move_name = line['move_id'][1] if isinstance(line.get('move_id'), list) else 'N/A'
            print(f"  {line['date']} | {move_name:30s} | DARE: {debit:>10,.2f} | AVERE: {credit:>10,.2f} | Saldo: {balance:>10,.2f}")

    # Calcola saldo totale
    total_debit = sum(line.get('debit', 0) for line in move_lines)
    total_credit = sum(line.get('credit', 0) for line in move_lines)
    net_balance = total_debit - total_credit

    print(f"\n=== RIEPILOGO KONTO 10901 ===")
    print(f"Totale DARE:   CHF {total_debit:,.2f}")
    print(f"Totale AVERE:  CHF {total_credit:,.2f}")
    print(f"SALDO NETTO:   CHF {net_balance:,.2f}")

    # Cerca tutti i conti bancari
    print("\n=== RICERCA CONTI BANCARI ===")
    bank_accounts = client.search_read(
        'account.account',
        [['code', 'ilike', '1020']],
        ['id', 'code', 'name', 'current_balance']
    )

    print(f"\nTrovati {len(bank_accounts)} conti bancari:")
    for acc in bank_accounts:
        print(f"  ID {acc['id']:4d} | {acc['code']:20s} | {acc['name']:50s} | CHF {acc.get('current_balance', 0):>12,.2f}")

    # Cerca conto Cash
    print("\n=== RICERCA CONTO CASH ===")
    cash_accounts = client.search_read(
        'account.account',
        [['code', '=', '1001']],
        ['id', 'code', 'name', 'current_balance']
    )

    if cash_accounts:
        for acc in cash_accounts:
            print(f"  ID {acc['id']:4d} | {acc['code']:20s} | {acc['name']:50s} | CHF {acc.get('current_balance', 0):>12,.2f}")
    else:
        print("[X] Nessun conto Cash (1001) trovato!")

    print("\n" + "="*80)

if __name__ == "__main__":
    main()
