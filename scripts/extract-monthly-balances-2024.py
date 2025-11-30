#!/usr/bin/env python3
"""
Estrae i saldi mensili di tutti i conti bancari per ogni mese del 2024 da Odoo staging
"""

import xmlrpc.client
import json
from datetime import datetime, date
from decimal import Decimal
import os

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Conti da analizzare
ACCOUNT_CODES = [
    "1024",   # UBS CHF 278-122087.01J
    "1025",   # EUR-UBS 278-122087.60A
    "1026",   # CHF-CRS PRINCIPALE 3977497-51
    "1034",   # UBS CHF 278-122087.02U
    "10230",  # USD-UBS 278-122087.61V
    "10224",  # UBS CHF COVID-KONTO
    "1021",   # Bank Suspense Account
    # Carte di credito
    "10213", "10214", "10215", "10216",
    "10210", "10211", "10212",
    "1028", "1029"
]

# Date di fine mese per il 2024
MONTH_ENDS_2024 = [
    "2024-01-31",
    "2024-02-29",
    "2024-03-31",
    "2024-04-30",
    "2024-05-31",
    "2024-06-30",
    "2024-07-31",
    "2024-08-31",
    "2024-09-30",
    "2024-10-31",
    "2024-11-30",
    "2024-12-31"
]

class DecimalEncoder(json.JSONEncoder):
    """JSON encoder per gestire Decimal"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def connect_odoo():
    """Connette a Odoo e restituisce uid e models"""
    print(f"Connessione a Odoo: {ODOO_URL}")

    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("Autenticazione fallita")

    print(f"Autenticato con UID: {uid}")

    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def get_account_info(models, uid, account_code):
    """Recupera le informazioni del conto"""
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[('code', '=', account_code)]],
        {'fields': ['id', 'code', 'name', 'account_type']}
    )

    if not accounts:
        print(f"  [WARNING] Conto {account_code} non trovato")
        return None

    return accounts[0]

def get_balance_at_date(models, uid, account_id, end_date):
    """
    Calcola il saldo del conto alla data specificata
    Somma tutti i movimenti fino a quella data
    """
    # Cerca tutte le righe contabili fino alla data
    domain = [
        ('account_id', '=', account_id),
        ('date', '<=', end_date),
        ('parent_state', '=', 'posted')  # Solo movimenti validati
    ]

    move_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [domain],
        {'fields': ['date', 'debit', 'credit', 'balance']}
    )

    if not move_lines:
        return {
            'balance': 0.0,
            'debit': 0.0,
            'credit': 0.0,
            'movements': 0
        }

    # Calcola i totali
    total_debit = sum(Decimal(str(line['debit'])) for line in move_lines)
    total_credit = sum(Decimal(str(line['credit'])) for line in move_lines)
    balance = total_debit - total_credit

    return {
        'balance': float(balance),
        'debit': float(total_debit),
        'credit': float(total_credit),
        'movements': len(move_lines)
    }

def extract_monthly_balances():
    """Estrae i saldi mensili per tutti i conti"""
    print("\n" + "="*80)
    print("ESTRAZIONE SALDI MENSILI 2024 - ODOO STAGING")
    print("="*80 + "\n")

    # Connessione a Odoo
    uid, models = connect_odoo()

    # Struttura dati risultato
    result = {
        "extraction_date": datetime.now().isoformat(),
        "odoo_url": ODOO_URL,
        "odoo_db": ODOO_DB,
        "year": 2024,
        "accounts": []
    }

    # Per ogni conto
    for account_code in ACCOUNT_CODES:
        print(f"\n{'='*80}")
        print(f"CONTO: {account_code}")
        print(f"{'='*80}")

        # Recupera info conto
        account_info = get_account_info(models, uid, account_code)

        if not account_info:
            continue

        account_id = account_info['id']
        account_name = account_info['name']

        print(f"ID: {account_id}")
        print(f"Nome: {account_name}")
        print(f"Tipo: {account_info.get('account_type', 'N/A')}")

        # Struttura dati per questo conto
        account_data = {
            "code": account_code,
            "name": account_name,
            "id": account_id,
            "account_type": account_info.get('account_type', 'N/A'),
            "monthly_balances": {}
        }

        # Per ogni fine mese
        print("\nEstrazione saldi mensili...")
        for month_end in MONTH_ENDS_2024:
            balance_data = get_balance_at_date(models, uid, account_id, month_end)
            account_data["monthly_balances"][month_end] = balance_data

            # Formatta il saldo per la visualizzazione
            balance = balance_data['balance']
            sign = "+" if balance >= 0 else ""
            print(f"  {month_end}: {sign}{balance:,.2f} CHF (mov: {balance_data['movements']})")

        result["accounts"].append(account_data)

    return result

def save_results(data, output_path):
    """Salva i risultati in formato JSON"""
    print(f"\n{'='*80}")
    print("SALVATAGGIO RISULTATI")
    print(f"{'='*80}")

    # Crea la directory se non esiste
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Salva JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, cls=DecimalEncoder)

    print(f"\n[OK] File salvato: {output_path}")

    # Statistiche
    print(f"\n{'='*80}")
    print("RIEPILOGO")
    print(f"{'='*80}")
    print(f"Conti analizzati: {len(data['accounts'])}")
    print(f"Mesi analizzati: {len(MONTH_ENDS_2024)}")
    print(f"Data estrazione: {data['extraction_date']}")

    # Mostra ultimo saldo di ogni conto (31/12/2024)
    print(f"\n{'='*80}")
    print("SALDI AL 31/12/2024")
    print(f"{'='*80}")

    total_balance = 0.0
    for account in data['accounts']:
        last_balance = account['monthly_balances'].get('2024-12-31', {}).get('balance', 0)
        total_balance += last_balance
        sign = "+" if last_balance >= 0 else ""
        print(f"{account['code']:>6} - {account['name'][:50]:50} : {sign}{last_balance:>15,.2f} CHF")

    print(f"{'='*80}")
    sign = "+" if total_balance >= 0 else ""
    print(f"{'TOTALE':>58} : {sign}{total_balance:>15,.2f} CHF")
    print(f"{'='*80}")

def main():
    """Funzione principale"""
    try:
        # Estrai i dati
        data = extract_monthly_balances()

        # Salva i risultati
        output_path = r"C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data-estratti\ODOO-BALANCES-2024-CLEAN.json"
        save_results(data, output_path)

        print("\n[OK] ESTRAZIONE COMPLETATA CON SUCCESSO!\n")

    except Exception as e:
        print(f"\n[ERRORE]: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
