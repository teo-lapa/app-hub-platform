#!/usr/bin/env python3
"""
CHIUSURA KONTO 1022 E 1023 A ZERO
==================================

Obiettivo: Portare Outstanding Receipts (1022) e Outstanding Payments (1023) a CHF 0.00

Strategia:
- Konto 1022 (CHF 148,549.24) → Storno su conto 3900 (differenze)
- Konto 1023 (CHF -84,573.31) → Chiusura su conto 3900

Data registrazione: 31.12.2024
"""

import xmlrpc.client
from datetime import datetime
from decimal import Decimal

# Odoo Connection
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Conti
KONTO_1022 = "1022"  # Outstanding Receipts
KONTO_1023 = "1023"  # Outstanding Payments
KONTO_3900 = "3900"  # Differenze / Rettifiche

# Data chiusura
DATA_CHIUSURA = "2024-12-31"

class OdooConnection:
    def __init__(self, url, db, username, password):
        self.url = url
        self.db = db
        self.username = username
        self.password = password
        self.uid = None
        self.models = None

    def connect(self):
        """Connetti ad Odoo"""
        print(f"\n[*] Connessione a Odoo...")
        print(f"   URL: {self.url}")
        print(f"   DB: {self.db}")

        common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
        self.uid = common.authenticate(self.db, self.username, self.password, {})

        if not self.uid:
            raise Exception("[ERRORE] Autenticazione fallita!")

        print(f"[OK] Autenticato! UID: {self.uid}")

        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
        return self.models

    def execute(self, model, method, domain=None, fields=None, **kwargs):
        """Esegui chiamata Odoo"""
        args = []
        if domain is not None:
            args.append(domain)

        params = {}
        if fields is not None:
            params['fields'] = fields
        params.update(kwargs)

        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, method, args, params
        )

def get_account_id(odoo, account_code):
    """Ottieni ID account da codice"""
    accounts = odoo.execute(
        'account.account',
        'search_read',
        domain=[('code', '=', account_code)],
        fields=['id', 'name', 'code'],
        limit=1
    )

    if not accounts:
        raise Exception(f"[ERRORE] Account {account_code} non trovato!")

    return accounts[0]

def get_account_balance(odoo, account_code):
    """Ottieni saldo attuale account"""
    account = get_account_id(odoo, account_code)
    account_id = account['id']

    # Leggi saldo da account
    account_data = odoo.execute(
        'account.account', 'read',
        [account_id],
        {'fields': ['balance', 'debit', 'credit']}
    )

    if account_data:
        balance = account_data[0].get('balance', 0.0)
        debit = account_data[0].get('debit', 0.0)
        credit = account_data[0].get('credit', 0.0)
        return {
            'balance': balance,
            'debit': debit,
            'credit': credit,
            'account_id': account_id,
            'account_code': account['code'],
            'account_name': account['name']
        }

    return None

def get_journal_id(odoo):
    """Ottieni journal per registrazioni varie"""
    # Cerca journal "Varie" o "Diverse" o primo disponibile
    journals = odoo.execute(
        'account.journal',
        'search_read',
        domain=[('type', '=', 'general')],
        fields=['id', 'name', 'code'],
        limit=1
    )

    if not journals:
        raise Exception("[ERRORE] Nessun journal generale trovato!")

    return journals[0]

def create_closing_entry(odoo, account_from, account_to, amount, description):
    """
    Crea registrazione di chiusura

    Args:
        account_from: Account da chiudere (dict con id, code, name)
        account_to: Account di rettifica (dict con id, code, name)
        amount: Importo da stornare
        description: Descrizione registrazione
    """
    print(f"\n[*] Creazione registrazione di chiusura...")
    print(f"   Da: {account_from['code']} - {account_from['name']}")
    print(f"   A: {account_to['code']} - {account_to['name']}")
    print(f"   Importo: CHF {amount:,.2f}")
    print(f"   Descrizione: {description}")

    journal = get_journal_id(odoo)

    # Determina dare/avere in base al segno dell'importo
    # Se amount > 0, l'account ha saldo DARE → dobbiamo mettere in AVERE per chiudere
    # Se amount < 0, l'account ha saldo AVERE → dobbiamo mettere in DARE per chiudere

    if amount > 0:
        # Saldo positivo (DARE) → chiudiamo con AVERE
        line_account_from = {
            'account_id': account_from['id'],
            'name': description,
            'debit': 0.0,
            'credit': abs(amount),
        }
        line_account_to = {
            'account_id': account_to['id'],
            'name': description,
            'debit': abs(amount),
            'credit': 0.0,
        }
    else:
        # Saldo negativo (AVERE) → chiudiamo con DARE
        line_account_from = {
            'account_id': account_from['id'],
            'name': description,
            'debit': abs(amount),
            'credit': 0.0,
        }
        line_account_to = {
            'account_id': account_to['id'],
            'name': description,
            'debit': 0.0,
            'credit': abs(amount),
        }

    # Crea account.move
    move_vals = {
        'journal_id': journal['id'],
        'date': DATA_CHIUSURA,
        'ref': f"CHIUSURA {account_from['code']}",
        'line_ids': [
            (0, 0, line_account_from),
            (0, 0, line_account_to),
        ]
    }

    try:
        move_id = odoo.execute('account.move', 'create', move_vals)
        print(f"[OK] Registrazione creata! Move ID: {move_id}")

        # Posta la registrazione
        odoo.execute('account.move', 'action_post', [move_id])
        print(f"[OK] Registrazione postata!")

        return move_id

    except Exception as e:
        print(f"[ERRORE] Errore creazione registrazione: {str(e)}")
        raise

def main():
    print("=" * 80)
    print("CHIUSURA KONTO 1022 E 1023 A ZERO")
    print("=" * 80)

    # Connetti a Odoo
    odoo_conn = OdooConnection(ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD)
    odoo = odoo_conn.connect()

    # --- STEP 1: Verifica saldi attuali ---
    print("\n" + "=" * 80)
    print("STEP 1: VERIFICA SALDI ATTUALI")
    print("=" * 80)

    balance_1022 = get_account_balance(odoo_conn, KONTO_1022)
    balance_1023 = get_account_balance(odoo_conn, KONTO_1023)

    print(f"\nKonto 1022 (Outstanding Receipts):")
    print(f"  Saldo: CHF {balance_1022['balance']:,.2f}")
    print(f"  Dare: CHF {balance_1022['debit']:,.2f}")
    print(f"  Avere: CHF {balance_1022['credit']:,.2f}")

    print(f"\nKonto 1023 (Outstanding Payments):")
    print(f"  Saldo: CHF {balance_1023['balance']:,.2f}")
    print(f"  Dare: CHF {balance_1023['debit']:,.2f}")
    print(f"  Avere: CHF {balance_1023['credit']:,.2f}")

    # Verifica se già a zero
    if abs(balance_1022['balance']) < 0.01 and abs(balance_1023['balance']) < 0.01:
        print("\n[OK] I conti sono gia' a zero!")
        return

    # Ottieni account 3900
    account_3900 = get_account_id(odoo_conn, KONTO_3900)
    account_1022 = get_account_id(odoo_conn, KONTO_1022)
    account_1023 = get_account_id(odoo_conn, KONTO_1023)

    print(f"\nAccount rettifica: {account_3900['code']} - {account_3900['name']}")

    # --- STEP 2: Chiudi Konto 1022 ---
    move_ids = []

    if abs(balance_1022['balance']) >= 0.01:
        print("\n" + "=" * 80)
        print("STEP 2: CHIUSURA KONTO 1022")
        print("=" * 80)

        move_id = create_closing_entry(
            odoo_conn,
            account_from=account_1022,
            account_to=account_3900,
            amount=balance_1022['balance'],
            description=f"Chiusura Outstanding Receipts 2024 - Rettifica saldo CHF {balance_1022['balance']:,.2f}"
        )
        move_ids.append(('1022', move_id))

    # --- STEP 3: Chiudi Konto 1023 ---
    if abs(balance_1023['balance']) >= 0.01:
        print("\n" + "=" * 80)
        print("STEP 3: CHIUSURA KONTO 1023")
        print("=" * 80)

        move_id = create_closing_entry(
            odoo_conn,
            account_from=account_1023,
            account_to=account_3900,
            amount=balance_1023['balance'],
            description=f"Chiusura Outstanding Payments 2024 - Rettifica saldo CHF {balance_1023['balance']:,.2f}"
        )
        move_ids.append(('1023', move_id))

    # --- STEP 4: Verifica finale ---
    print("\n" + "=" * 80)
    print("STEP 4: VERIFICA FINALE")
    print("=" * 80)

    balance_1022_final = get_account_balance(odoo_conn, KONTO_1022)
    balance_1023_final = get_account_balance(odoo_conn, KONTO_1023)

    print(f"\nKonto 1022 (Outstanding Receipts):")
    print(f"  Saldo finale: CHF {balance_1022_final['balance']:,.2f}")

    print(f"\nKonto 1023 (Outstanding Payments):")
    print(f"  Saldo finale: CHF {balance_1023_final['balance']:,.2f}")

    # --- REPORT FINALE ---
    print("\n" + "=" * 80)
    print("REPORT FINALE")
    print("=" * 80)

    print(f"\nData chiusura: {DATA_CHIUSURA}")
    print(f"\nRegistrazioni create:")
    for account, move_id in move_ids:
        print(f"  - Konto {account}: Move ID {move_id}")

    print(f"\nSALDI FINALI:")
    print(f"  Konto 1022: CHF {balance_1022_final['balance']:,.2f} {'[OK]' if abs(balance_1022_final['balance']) < 0.01 else '[ERRORE]'}")
    print(f"  Konto 1023: CHF {balance_1023_final['balance']:,.2f} {'[OK]' if abs(balance_1023_final['balance']) < 0.01 else '[ERRORE]'}")

    if abs(balance_1022_final['balance']) < 0.01 and abs(balance_1023_final['balance']) < 0.01:
        print("\n" + "=" * 80)
        print("[OK] CHIUSURA COMPLETATA CON SUCCESSO!")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("[ATTENZIONE] I saldi non sono ancora a zero")
        print("=" * 80)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[ERRORE] {str(e)}")
        import traceback
        traceback.print_exc()
