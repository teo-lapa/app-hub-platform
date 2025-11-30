#!/usr/bin/env python3
"""
CHIUSURA KONTO 1022 E 1023 A ZERO
==================================

Obiettivo: Portare Outstanding Receipts (1022) e Outstanding Payments (1023) a CHF 0.00

Strategia:
- Konto 1022 (CHF 148,549.24) -> Storno su conto 3900 (differenze)
- Konto 1023 (CHF -84,573.31) -> Chiusura su conto 3900

Data registrazione: 31.12.2024
"""

import xmlrpc.client

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

def connect_odoo():
    """Connetti ad Odoo e ritorna uid e models"""
    print("\n[*] Connessione a Odoo...")
    print(f"   URL: {ODOO_URL}")
    print(f"   DB: {ODOO_DB}")

    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("[ERRORE] Autenticazione fallita!")

    print(f"[OK] Autenticato! UID: {uid}")

    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def get_account(models, uid, account_code):
    """Ottieni account da codice"""
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[('code', '=', account_code)]],
        {'fields': ['id', 'name', 'code', 'current_balance'], 'limit': 1}
    )

    if not accounts:
        raise Exception(f"[ERRORE] Account {account_code} non trovato!")

    account = accounts[0]
    # Rinomina current_balance -> balance per compatibilita'
    account['balance'] = account.get('current_balance', 0.0)
    return account

def get_journal(models, uid):
    """Ottieni journal generale"""
    journals = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.journal', 'search_read',
        [[('type', '=', 'general')]],
        {'fields': ['id', 'name', 'code'], 'limit': 1}
    )

    if not journals:
        raise Exception("[ERRORE] Nessun journal generale trovato!")

    return journals[0]

def create_closing_move(models, uid, journal, account_from, account_to, amount, description):
    """Crea registrazione di chiusura"""
    print(f"\n[*] Creazione registrazione di chiusura...")
    print(f"   Da: {account_from['code']} - {account_from['name']}")
    print(f"   A: {account_to['code']} - {account_to['name']}")
    print(f"   Importo: CHF {amount:,.2f}")

    # Determina dare/avere
    # Se amount > 0, account ha saldo DARE -> chiudiamo con AVERE
    # Se amount < 0, account ha saldo AVERE -> chiudiamo con DARE
    if amount > 0:
        line_from = {
            'account_id': account_from['id'],
            'name': description,
            'debit': 0.0,
            'credit': abs(amount),
        }
        line_to = {
            'account_id': account_to['id'],
            'name': description,
            'debit': abs(amount),
            'credit': 0.0,
        }
    else:
        line_from = {
            'account_id': account_from['id'],
            'name': description,
            'debit': abs(amount),
            'credit': 0.0,
        }
        line_to = {
            'account_id': account_to['id'],
            'name': description,
            'debit': 0.0,
            'credit': abs(amount),
        }

    move_vals = {
        'journal_id': journal['id'],
        'date': DATA_CHIUSURA,
        'ref': f"CHIUSURA {account_from['code']}",
        'line_ids': [
            (0, 0, line_from),
            (0, 0, line_to),
        ]
    }

    try:
        move_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'create',
            [move_vals]
        )
        print(f"[OK] Registrazione creata! Move ID: {move_id}")

        # Posta la registrazione
        models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'action_post',
            [[move_id]]
        )
        print(f"[OK] Registrazione postata!")

        return move_id

    except Exception as e:
        print(f"[ERRORE] {str(e)}")
        raise

def main():
    print("=" * 80)
    print("CHIUSURA KONTO 1022 E 1023 A ZERO")
    print("=" * 80)

    # Connetti
    uid, models = connect_odoo()

    # --- STEP 1: Verifica saldi attuali ---
    print("\n" + "=" * 80)
    print("STEP 1: VERIFICA SALDI ATTUALI")
    print("=" * 80)

    account_1022 = get_account(models, uid, KONTO_1022)
    account_1023 = get_account(models, uid, KONTO_1023)
    account_3900 = get_account(models, uid, KONTO_3900)

    print(f"\nKonto 1022 (Outstanding Receipts):")
    print(f"  Saldo: CHF {account_1022['balance']:,.2f}")

    print(f"\nKonto 1023 (Outstanding Payments):")
    print(f"  Saldo: CHF {account_1023['balance']:,.2f}")

    # Verifica se gia' a zero
    if abs(account_1022['balance']) < 0.01 and abs(account_1023['balance']) < 0.01:
        print("\n[OK] I conti sono gia' a zero!")
        return

    print(f"\nAccount rettifica: {account_3900['code']} - {account_3900['name']}")

    # Ottieni journal
    journal = get_journal(models, uid)
    print(f"Journal: {journal['code']} - {journal['name']}")

    # --- STEP 2 e 3: Chiusura ---
    move_ids = []

    if abs(account_1022['balance']) >= 0.01:
        print("\n" + "=" * 80)
        print("STEP 2: CHIUSURA KONTO 1022")
        print("=" * 80)

        move_id = create_closing_move(
            models, uid, journal,
            account_from=account_1022,
            account_to=account_3900,
            amount=account_1022['balance'],
            description=f"Chiusura Outstanding Receipts 2024 - Rettifica CHF {account_1022['balance']:,.2f}"
        )
        move_ids.append(('1022', move_id))

    if abs(account_1023['balance']) >= 0.01:
        print("\n" + "=" * 80)
        print("STEP 3: CHIUSURA KONTO 1023")
        print("=" * 80)

        move_id = create_closing_move(
            models, uid, journal,
            account_from=account_1023,
            account_to=account_3900,
            amount=account_1023['balance'],
            description=f"Chiusura Outstanding Payments 2024 - Rettifica CHF {account_1023['balance']:,.2f}"
        )
        move_ids.append(('1023', move_id))

    # --- STEP 4: Verifica finale ---
    print("\n" + "=" * 80)
    print("STEP 4: VERIFICA FINALE")
    print("=" * 80)

    account_1022_final = get_account(models, uid, KONTO_1022)
    account_1023_final = get_account(models, uid, KONTO_1023)

    print(f"\nKonto 1022 (Outstanding Receipts):")
    print(f"  Saldo finale: CHF {account_1022_final['balance']:,.2f}")

    print(f"\nKonto 1023 (Outstanding Payments):")
    print(f"  Saldo finale: CHF {account_1023_final['balance']:,.2f}")

    # --- REPORT FINALE ---
    print("\n" + "=" * 80)
    print("REPORT FINALE")
    print("=" * 80)

    print(f"\nData chiusura: {DATA_CHIUSURA}")
    print(f"\nRegistrazioni create:")
    for account, move_id in move_ids:
        print(f"  - Konto {account}: Move ID {move_id}")

    print(f"\nSALDI FINALI:")
    print(f"  Konto 1022: CHF {account_1022_final['balance']:,.2f} {'[OK]' if abs(account_1022_final['balance']) < 0.01 else '[ERRORE]'}")
    print(f"  Konto 1023: CHF {account_1023_final['balance']:,.2f} {'[OK]' if abs(account_1023_final['balance']) < 0.01 else '[ERRORE]'}")

    if abs(account_1022_final['balance']) < 0.01 and abs(account_1023_final['balance']) < 0.01:
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
