"""
ANALISI DETTAGLIATA KONTO 10901

Analizza lo stato del Konto 10901 e identifica tutti i conti necessari
per le riclassificazioni.

Author: Odoo Integration Master
Date: 2025-11-15
"""

import xmlrpc.client
import csv

# CONFIGURAZIONE ODOO
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

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
    print("ANALISI DETTAGLIATA KONTO 10901")
    print("="*80)

    client = OdooClient()
    if not client.connect():
        print("\n[X] ERRORE: Impossibile connettersi a Odoo!")
        return

    # 1. Cerca tutti i journal usati nei CSV
    print("\n=== STEP 1: RICERCA JOURNAL ===")

    # Leggi i journal dai CSV
    journals_from_csv = set()

    # Cash deposits
    with open('konto-10901-v2-cash_deposit.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            journals_from_csv.add(row['Journal'])

    # Bank transfers
    with open('konto-10901-v2-bank_transfer_internal.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            journals_from_csv.add(row['Journal'])

    print(f"\nJournal trovati nei CSV ({len(journals_from_csv)}):")
    for journal in sorted(journals_from_csv):
        print(f"  - {journal}")

    # Cerca i journal su Odoo
    print("\n=== STEP 2: RICERCA JOURNAL SU ODOO ===")

    try:
        journals = client.search_read(
            'account.journal',
            [],
            ['id', 'name', 'code', 'type', 'default_account_id']
        )

        print(f"\nTrovati {len(journals)} journal su Odoo:")
        journal_map = {}

        for j in journals:
            default_account = j.get('default_account_id')
            account_info = f"Account ID: {default_account[0]}" if default_account else "No default account"
            print(f"  ID {j['id']:3d} | {j.get('code', 'N/A'):10s} | {j['name']:50s} | Type: {j.get('type', 'N/A'):10s} | {account_info}")

            # Mappa journal per matching
            journal_map[j['name']] = j

    except Exception as e:
        print(f"[X] ERRORE nella ricerca journal: {e}")
        journals = []
        journal_map = {}

    # 3. Cerca account che iniziano con 1020 (conti bancari)
    print("\n=== STEP 3: RICERCA CONTI BANCARI (1020.xxx) ===")

    try:
        # Cerca con search invece di search_read per evitare problemi di permessi
        account_ids = client.execute(
            'account.account',
            'search',
            [['code', '=like', '1020%']]
        )

        print(f"\nTrovati {len(account_ids)} account IDs che iniziano con 1020:")
        print(f"IDs: {account_ids}")

        # Prova a leggere i nomi tramite name_get
        if account_ids:
            try:
                account_names = client.execute('account.account', 'name_get', account_ids)
                print("\nDettagli account:")
                for acc_id, acc_name in account_names:
                    print(f"  ID {acc_id:4d} | {acc_name}")
            except Exception as e:
                print(f"[X] Impossibile leggere dettagli account: {e}")

    except Exception as e:
        print(f"[X] ERRORE nella ricerca account bancari: {e}")

    # 4. Cerca account Cash (1001)
    print("\n=== STEP 4: RICERCA CONTO CASH (1001) ===")

    try:
        cash_ids = client.execute(
            'account.account',
            'search',
            [['code', '=', '1001']]
        )

        if cash_ids:
            print(f"\nTrovato account Cash: ID {cash_ids[0]}")

            try:
                cash_name = client.execute('account.account', 'name_get', cash_ids)
                print(f"Nome: {cash_name[0][1]}")
            except:
                pass
        else:
            print("[X] Conto Cash (1001) non trovato!")

    except Exception as e:
        print(f"[X] ERRORE nella ricerca Cash account: {e}")

    # 5. Cerca Konto 10901
    print("\n=== STEP 5: VERIFICA KONTO 10901 ===")

    try:
        konto_ids = client.execute(
            'account.account',
            'search',
            [['code', '=', '10901']]
        )

        if konto_ids:
            print(f"\nTrovato Konto 10901: ID {konto_ids[0]}")

            # Cerca move lines
            move_lines = client.search_read(
                'account.move.line',
                [['account_id', '=', konto_ids[0]]],
                ['id', 'date', 'debit', 'credit', 'balance'],
                limit=20,
                order='date desc'
            )

            print(f"\nTrovati {len(move_lines)} movimenti (ultimi 20):")

            total_debit = 0
            total_credit = 0

            for line in move_lines[:10]:
                debit = line.get('debit', 0)
                credit = line.get('credit', 0)
                balance = line.get('balance', 0)
                total_debit += debit
                total_credit += credit

                print(f"  {line['date']} | DARE: {debit:>10,.2f} | AVERE: {credit:>10,.2f} | Saldo: {balance:>10,.2f}")

            # Conta tutti i movimenti
            all_move_count = client.execute(
                'account.move.line',
                'search_count',
                [['account_id', '=', konto_ids[0]]]
            )

            print(f"\nTotale movimenti su Konto 10901: {all_move_count}")

            # Calcola saldo leggendo tutti i movimenti in batch
            print("\nCalcolo saldo completo...")

            offset = 0
            batch_size = 1000
            grand_total_debit = 0
            grand_total_credit = 0

            while True:
                batch = client.search_read(
                    'account.move.line',
                    [['account_id', '=', konto_ids[0]]],
                    ['debit', 'credit'],
                    limit=batch_size,
                    offset=offset
                )

                if not batch:
                    break

                for line in batch:
                    grand_total_debit += line.get('debit', 0)
                    grand_total_credit += line.get('credit', 0)

                offset += batch_size
                print(f"  Processati {offset} movimenti...")

            saldo_finale = grand_total_debit - grand_total_credit

            print(f"\n=== SALDO KONTO 10901 ===")
            print(f"Totale DARE:   CHF {grand_total_debit:,.2f}")
            print(f"Totale AVERE:  CHF {grand_total_credit:,.2f}")
            print(f"SALDO NETTO:   CHF {saldo_finale:,.2f}")

        else:
            print("[X] Konto 10901 non trovato!")

    except Exception as e:
        print(f"[X] ERRORE: {e}")

    print("\n" + "="*80)

if __name__ == "__main__":
    main()
