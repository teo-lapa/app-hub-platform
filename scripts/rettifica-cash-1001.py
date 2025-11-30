#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RETTIFICA KONTO 1001 CASH - ALLINEAMENTO TARGET COMMERCIALISTA

Obiettivo: Portare saldo Cash da CHF 285,796.79 a CHF ~90,000
Delta: CHF -195,797

Registrazione contabile:
- Dare: 3900 (Changes in inventories) CHF 195,797
- Avere: 1001 (Cash) CHF 195,797
"""

import sys
import io
import xmlrpc.client
from datetime import datetime
from decimal import Decimal

# Fix encoding per Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Parametri rettifica
SALDO_TARGET = 90000.00

# Codici conti
CONTO_CASH = "1001"  # Cash
CONTO_INVENTORIES = "3900"  # Changes in inventories

def connect_odoo():
    """Connette ad Odoo e restituisce common, uid, models"""
    print(f"🔌 Connessione a Odoo: {ODOO_URL}")

    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("❌ Autenticazione fallita!")

    print(f"✅ Autenticato come UID: {uid}")

    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    return common, uid, models

def get_account_id(models, uid, code):
    """Recupera ID account dal codice"""
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[('code', '=', code)]]
    )

    if not account_ids:
        raise Exception(f"❌ Account {code} non trovato!")

    account = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'read',
        [account_ids[0]], {'fields': ['id', 'code', 'name']}
    )

    print(f"  📊 {code} - {account[0]['name']} (ID: {account[0]['id']})")
    return account[0]['id']

def get_account_balance(models, uid, account_code):
    """Recupera saldo account corrente"""
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[('code', '=', account_code)]]
    )

    if not account_ids:
        return None

    account = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'read',
        [account_ids[0]], {'fields': ['id', 'code', 'name']}
    )[0]

    # Calcola saldo da account.move.line
    move_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[('account_id', '=', account_ids[0]), ('parent_state', '=', 'posted')]],
        {'fields': ['debit', 'credit']}
    )

    balance = sum(line['debit'] - line['credit'] for line in move_lines)
    account['balance'] = balance

    return account

def get_journal_id(models, uid):
    """Recupera ID del journal Miscellaneous Operations"""
    journal_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.journal', 'search',
        [[('type', '=', 'general')]]
    )

    if not journal_ids:
        raise Exception("❌ Journal Miscellaneous Operations non trovato!")

    journal = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.journal', 'read',
        [journal_ids[0]], {'fields': ['id', 'name', 'code']}
    )

    print(f"  📖 Journal: {journal[0]['name']} ({journal[0]['code']})")
    return journal[0]['id']

def create_adjustment_move(models, uid):
    """Crea registrazione di rettifica"""

    print("\n" + "="*60)
    print("📝 CREAZIONE REGISTRAZIONE RETTIFICA CASH")
    print("="*60)

    # Recupera account IDs
    print("\n🔍 Recupero conti...")
    account_cash_id = get_account_id(models, uid, CONTO_CASH)
    account_inventories_id = get_account_id(models, uid, CONTO_INVENTORIES)
    journal_id = get_journal_id(models, uid)

    # Verifica saldo attuale
    print("\n💰 Verifica saldo attuale...")
    cash_account = get_account_balance(models, uid, CONTO_CASH)
    if not cash_account:
        print("❌ Impossibile recuperare saldo Cash")
        return None

    saldo_attuale = cash_account['balance']
    importo_rettifica = saldo_attuale - SALDO_TARGET

    print(f"  Saldo attuale 1001: CHF {saldo_attuale:,.2f}")
    print(f"  Target commercialista: CHF {SALDO_TARGET:,.2f}")
    print(f"  Rettifica necessaria: CHF {importo_rettifica:,.2f}")

    # Prepara move
    move_data = {
        'date': '2024-12-31',
        'ref': 'RETTIFICA-CASH-2024',
        'journal_id': journal_id,
        'state': 'draft',
        'line_ids': [
            # Dare: 3900 (Changes in inventories)
            (0, 0, {
                'account_id': account_inventories_id,
                'name': 'Rettifica saldo Cash per chiusura 2024 - allineamento target commercialista',
                'debit': round(importo_rettifica, 2),
                'credit': 0.0,
            }),
            # Avere: 1001 (Cash)
            (0, 0, {
                'account_id': account_cash_id,
                'name': 'Rettifica saldo Cash per chiusura 2024 - allineamento target commercialista',
                'debit': 0.0,
                'credit': round(importo_rettifica, 2),
            }),
        ]
    }

    print("\n📋 Dettagli registrazione:")
    print(f"  Data: 31.12.2024")
    print(f"  Riferimento: RETTIFICA-CASH-2024")
    print(f"  Importo: CHF {importo_rettifica:,.2f}")
    print(f"  ")
    print(f"  Dare  → 3900 (Changes in inventories): CHF {importo_rettifica:,.2f}")
    print(f"  Avere → 1001 (Cash): CHF {importo_rettifica:,.2f}")
    print("\n✓ Creazione automatica (no conferma interattiva)")

    # Crea move
    print("\n⏳ Creazione in corso...")
    move_id = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'create',
        [move_data]
    )

    print(f"✅ Registrazione creata: ID {move_id}")

    # Post move
    print("📮 Validazione registrazione...")
    models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'action_post',
        [[move_id]]
    )

    print("✅ Registrazione validata!")

    return move_id, saldo_attuale, importo_rettifica

def verify_final_balance(models, uid):
    """Verifica saldo finale Cash"""
    print("\n" + "="*60)
    print("🔍 VERIFICA SALDO FINALE")
    print("="*60)

    cash_account = get_account_balance(models, uid, CONTO_CASH)

    if not cash_account:
        print("❌ Impossibile verificare saldo")
        return False

    saldo_finale = cash_account['balance']
    delta = abs(saldo_finale - SALDO_TARGET)

    print(f"\n💰 Saldo finale 1001 Cash: CHF {saldo_finale:,.2f}")
    print(f"🎯 Target commercialista: CHF {SALDO_TARGET:,.2f}")
    print(f"📊 Delta: CHF {delta:,.2f}")

    if delta <= 100:
        print("✅ Saldo allineato al target!")
        return True
    else:
        print(f"⚠️  Saldo fuori target (tolleranza ±100)")
        return False

def generate_report(models, uid, move_id, saldo_iniziale, importo_rettifica):
    """Genera report finale"""
    print("\n" + "="*60)
    print("📊 REPORT RETTIFICA CASH - KONTO 1001")
    print("="*60)

    # Recupera move details
    if move_id:
        move = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'read',
            [move_id], {'fields': ['name', 'date', 'ref', 'state', 'line_ids']}
        )[0]

        print(f"\n📝 Registrazione Contabile:")
        print(f"  ID: {move_id}")
        print(f"  Numero: {move['name']}")
        print(f"  Data: {move['date']}")
        print(f"  Riferimento: {move['ref']}")
        print(f"  Stato: {move['state']}")

    # Saldo finale
    cash_account = get_account_balance(models, uid, CONTO_CASH)
    if cash_account:
        print(f"\n💰 Saldo Finale:")
        print(f"  Konto 1001 (Cash): CHF {cash_account['balance']:,.2f}")

    print(f"\n📈 Riepilogo Operazione:")
    print(f"  Saldo iniziale: CHF {saldo_iniziale:,.2f}")
    print(f"  Rettifica: CHF -{importo_rettifica:,.2f}")
    print(f"  Saldo finale: CHF {cash_account['balance']:,.2f}")
    print(f"  Target: CHF {SALDO_TARGET:,.2f}")

    delta = abs(cash_account['balance'] - SALDO_TARGET)
    if delta <= 100:
        print(f"\n✅ OPERAZIONE COMPLETATA CON SUCCESSO")
    else:
        print(f"\n⚠️  ATTENZIONE: Saldo fuori target")

    print("\n" + "="*60)

def main():
    """Funzione principale"""
    print("\n" + "="*60)
    print("🏦 RETTIFICA KONTO 1001 CASH")
    print("="*60)
    print(f"\nSaldo target: CHF {SALDO_TARGET:,.2f}")

    try:
        # Connessione
        common, uid, models = connect_odoo()

        # Crea rettifica
        result = create_adjustment_move(models, uid)

        if not result:
            print("\n❌ Rettifica non eseguita")
            return

        move_id, saldo_iniziale, importo_rettifica = result

        # Verifica saldo
        verify_final_balance(models, uid)

        # Report
        generate_report(models, uid, move_id, saldo_iniziale, importo_rettifica)

        print("\n🎉 Processo completato!")

    except Exception as e:
        print(f"\n❌ ERRORE: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
