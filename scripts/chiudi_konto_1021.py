"""
CHIUSURA KONTO 1021 - BANK SUSPENSE ACCOUNT
Porta il saldo residuo (CHF 8,363.98) a un conto appropriato
"""

import xmlrpc.client
from datetime import datetime
import json

# CONFIGURAZIONE ODOO
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

ACCOUNT_1021 = 170  # Bank Suspense Account
ACCOUNT_8399 = None  # Sarà trovato dinamicamente - Other Extraordinary Expenses

def connect_odoo():
    """Connessione a Odoo"""
    try:
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

        if not uid:
            raise Exception("Autenticazione fallita!")

        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        print(f"[OK] Connesso come {ODOO_USERNAME} (UID: {uid})")
        return uid, models

    except Exception as e:
        print(f"[ERRORE] Connessione: {e}")
        return None, None

def get_account_balance(uid, models, account_id):
    """Ottiene il saldo corrente di un account"""
    account = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'read',
        [account_id],
        {'fields': ['code', 'name', 'current_balance']}
    )[0]

    return account

def find_extraordinary_expenses_account(uid, models):
    """Trova il conto 8399 - Other Extraordinary Expenses"""
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', '8399']]],
        {'fields': ['id', 'name', 'code']}
    )

    if not accounts:
        print("[!] Conto 8399 non trovato, cerco alternative...")
        # Cerca conti simili
        accounts = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.account', 'search_read',
            [[['code', 'like', '839%']]],
            {'fields': ['id', 'name', 'code']}
        )

        if accounts:
            print(f"[INFO] Trovati conti alternativi: {[a['code'] + ' - ' + a['name'] for a in accounts]}")

    return accounts[0] if accounts else None

def create_closing_entry(uid, models, amount, account_1021_id, account_8399_id):
    """
    Crea la scrittura di chiusura del konto 1021

    Se il saldo è positivo (CHF 8,363.98):
    - DARE 8399 (Extraordinary Expenses) CHF 8,363.98
    - AVERE 1021 (Bank Suspense) CHF 8,363.98

    Questo porta 1021 a zero e registra come spesa straordinaria
    """

    print(f"\n{'='*80}")
    print(f"CREAZIONE SCRITTURA DI CHIUSURA")
    print(f"{'='*80}")
    print(f"Importo: CHF {amount:,.2f}")
    print(f"DARE:  8399 (Extraordinary Expenses)")
    print(f"AVERE: 1021 (Bank Suspense Account)")

    # Conferma
    print(f"\n[!] Questa operazione chiuderà il konto 1021 a CHF 0.00")
    print(f"[!] Il saldo residuo verrà registrato come spesa straordinaria")

    response = input("\nProcedere? (s/n): ")
    if response.lower() != 's':
        print("[X] Operazione annullata dall'utente")
        return None

    # Trova il journal Miscellaneous Operations
    journals = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.journal', 'search_read',
        [[['code', '=', 'MISC']]],
        {'fields': ['id', 'name']}
    )

    if not journals:
        print("[!] Journal MISC non trovato, uso il primo disponibile...")
        journals = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.journal', 'search_read',
            [[['type', '=', 'general']]],
            {'fields': ['id', 'name'], 'limit': 1}
        )

    journal_id = journals[0]['id']
    print(f"[INFO] Uso journal: {journals[0]['name']} (ID: {journal_id})")

    # Crea la move
    try:
        move_vals = {
            'journal_id': journal_id,
            'date': '2024-12-31',
            'ref': 'Chiusura konto 1021 - Bank Suspense Account',
            'line_ids': [
                (0, 0, {
                    'account_id': account_8399_id,
                    'name': 'Chiusura saldo residuo Bank Suspense Account',
                    'debit': amount,
                    'credit': 0.0,
                }),
                (0, 0, {
                    'account_id': account_1021_id,
                    'name': 'Chiusura saldo residuo Bank Suspense Account',
                    'debit': 0.0,
                    'credit': amount,
                })
            ]
        }

        print(f"\n[INFO] Creo la scrittura contabile...")
        move_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'create',
            [move_vals]
        )

        print(f"[OK] Scrittura creata con ID: {move_id}")

        # Posta la move
        print(f"[INFO] Posto la scrittura...")
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'action_post',
            [[move_id]]
        )

        print(f"[OK] Scrittura postata con successo!")

        # Fetch la move creata
        move = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'read',
            [move_id],
            {'fields': ['name', 'date', 'state', 'ref']}
        )[0]

        return move_id, move

    except Exception as e:
        print(f"[ERRORE] Creazione scrittura fallita: {e}")
        return None, None

def verify_closure(uid, models, account_1021_id):
    """Verifica che il konto 1021 sia effettivamente a zero"""
    account = get_account_balance(uid, models, account_1021_id)

    print(f"\n{'='*80}")
    print(f"VERIFICA FINALE")
    print(f"{'='*80}")
    print(f"Konto 1021 - {account['name']}")
    print(f"Saldo finale: CHF {account['current_balance']:,.2f}")

    if abs(account['current_balance']) < 0.01:
        print(f"\n[OK] KONTO 1021 CHIUSO CON SUCCESSO!")
        return True
    else:
        print(f"\n[!] ATTENZIONE: Il saldo non è zero!")
        return False

def main():
    """Funzione principale"""
    print(f"\n{'='*80}")
    print(f"CHIUSURA KONTO 1021 - BANK SUSPENSE ACCOUNT")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}")

    uid, models = connect_odoo()
    if not uid or not models:
        print("\n[X] Impossibile connettersi a Odoo")
        return

    # Step 1: Verifica saldo attuale konto 1021
    print(f"\n[1/5] Verifica saldo konto 1021...")
    account_1021 = get_account_balance(uid, models, ACCOUNT_1021)
    current_balance = account_1021['current_balance']

    print(f"Konto 1021 - {account_1021['name']}")
    print(f"Saldo attuale: CHF {current_balance:,.2f}")

    if abs(current_balance) < 0.01:
        print(f"\n[OK] Il konto 1021 è già a zero!")
        print(f"Nessuna azione necessaria.")
        return

    # Step 2: Trova il conto di destinazione (8399)
    print(f"\n[2/5] Ricerca conto destinazione (8399)...")
    account_8399 = find_extraordinary_expenses_account(uid, models)

    if not account_8399:
        print(f"[X] Impossibile trovare un conto di destinazione appropriato")
        print(f"[INFO] Creare manualmente il conto 8399 - Other Extraordinary Expenses")
        return

    print(f"[OK] Trovato: {account_8399['code']} - {account_8399['name']}")

    # Step 3: Analizza la natura del saldo
    print(f"\n[3/5] Analisi natura del saldo...")
    if current_balance > 0:
        print(f"Saldo DARE (positivo): registrerò come spesa straordinaria")
        amount = current_balance
    else:
        print(f"Saldo AVERE (negativo): registrerò come provento straordinario")
        amount = abs(current_balance)

    # Step 4: Crea la scrittura di chiusura
    print(f"\n[4/5] Creazione scrittura di chiusura...")
    move_id, move = create_closing_entry(
        uid, models,
        amount,
        ACCOUNT_1021,
        account_8399['id']
    )

    if not move_id:
        print(f"\n[X] Chiusura fallita!")
        return

    # Step 5: Verifica chiusura
    print(f"\n[5/5] Verifica chiusura...")
    success = verify_closure(uid, models, ACCOUNT_1021)

    # Salva report
    report = {
        'timestamp': datetime.now().isoformat(),
        'operation': 'Chiusura Konto 1021',
        'initial_balance': current_balance,
        'closing_amount': amount,
        'destination_account': account_8399['code'],
        'move_id': move_id,
        'move_name': move['name'],
        'move_date': move['date'],
        'success': success
    }

    filename = f"konto-1021-closure-{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Report salvato in: {filename}")

    print(f"\n{'='*80}")
    print(f"RIEPILOGO FINALE")
    print(f"{'='*80}")
    print(f"Konto 1021 saldo iniziale: CHF {current_balance:,.2f}")
    print(f"Importo chiusura:          CHF {amount:,.2f}")
    print(f"Conto destinazione:        {account_8399['code']} - {account_8399['name']}")
    print(f"Move ID:                   {move_id}")
    print(f"Move Name:                 {move['name']}")
    print(f"Status:                    {'CHIUSO' if success else 'ERRORE'}")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()
