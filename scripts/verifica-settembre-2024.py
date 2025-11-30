#!/usr/bin/env python3
"""
VERIFICA COMPLETA SETTEMBRE 2024
================================
Analisi riga per riga degli estratti bancari di settembre 2024
e confronto con Odoo per i konti 1024, 1025, 1026.

AUTORE: Backend Specialist - Claude Code
DATA: 2025-11-16
"""

import json
import os
import sys
from datetime import datetime
from decimal import Decimal
from collections import defaultdict
import xmlrpc.client
from pathlib import Path

# Carica .env se esiste
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
except ImportError:
    print("Warning: python-dotenv not installed, using environment variables only")
except Exception as e:
    print(f"Warning: Could not load .env: {e}")

# ============================================================================
# CONFIGURAZIONE ODOO
# ============================================================================
ODOO_URL = os.getenv('ODOO_URL', 'https://erp.lapaindustriale.com')
ODOO_DB = os.getenv('ODOO_DB', 'lapa_prod_master')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_PASSWORD = os.getenv('ODOO_PASSWORD')

# ============================================================================
# KONTI DA VERIFICARE
# ============================================================================
KONTI = {
    '1024': {
        'name': 'CHF-UBS PRINCIPALE',
        'account': '0278 00122087.01',
        'iban': 'CH02 0027 8278 1220 8701 J',
        'currency': 'CHF',
        'file': 'UBS-CHF-2024-CLEAN.json',
        'transactions_source': 'Q3'  # Q3 include luglio-settembre
    },
    '1025': {
        'name': 'EUR-UBS',
        'account': '0278 00122087.60',
        'iban': 'CH25 0027 8278 1220 8760 A',
        'currency': 'EUR',
        'file': 'UBS-EUR-2024-TRANSACTIONS.json',
        'transactions_source': 'H2'  # H2 include luglio-dicembre
    },
    '1026': {
        'name': 'CHF-CRS PRINCIPALE',
        'account': '3977497-51',
        'currency': 'CHF',
        'file': 'CREDIT-SUISSE-2024-CLEAN.json',
        'transactions_source': None  # Non abbiamo transazioni dettagliate
    }
}

# ============================================================================
# FUNZIONI ODOO
# ============================================================================
def odoo_connect():
    """Connessione a Odoo tramite XML-RPC"""
    print("\n[ODOO] Connecting...")

    if not ODOO_USERNAME or not ODOO_PASSWORD:
        raise Exception("ODOO_USERNAME and ODOO_PASSWORD environment variables required")

    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common', allow_none=True)
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("Authentication failed")

    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object', allow_none=True)
    print(f"[ODOO] Connected as UID {uid}")

    return models, uid

def get_odoo_account_balance(models, uid, account_code, date_from, date_to):
    """Recupera saldo e movimenti da Odoo per un periodo"""

    # 1. Trova account
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[('code', '=', account_code)]]
    )

    if not account_ids:
        return None, []

    account_id = account_ids[0]

    # 2. Cerca movimenti nel periodo
    move_line_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search',
        [[
            ('account_id', '=', account_id),
            ('date', '>=', date_from),
            ('date', '<=', date_to),
            ('parent_state', '=', 'posted')  # Solo movimenti confermati
        ]]
    )

    if not move_line_ids:
        return Decimal('0.00'), []

    # 3. Leggi dettagli movimenti
    move_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'read',
        [move_line_ids],
        {'fields': ['date', 'name', 'ref', 'debit', 'credit', 'balance', 'move_id']}
    )

    # 4. Calcola saldo del periodo
    total_debit = sum(Decimal(str(ml['debit'])) for ml in move_lines)
    total_credit = sum(Decimal(str(ml['credit'])) for ml in move_lines)
    period_balance = total_debit - total_credit

    return period_balance, move_lines

def get_odoo_balance_at_date(models, uid, account_code, date):
    """Recupera saldo Odoo a una data specifica"""

    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[('code', '=', account_code)]]
    )

    if not account_ids:
        return None

    account_id = account_ids[0]

    # Tutti i movimenti fino a quella data
    move_line_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search',
        [[
            ('account_id', '=', account_id),
            ('date', '<=', date),
            ('parent_state', '=', 'posted')
        ]]
    )

    if not move_line_ids:
        return Decimal('0.00')

    move_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'read',
        [move_line_ids],
        {'fields': ['debit', 'credit']}
    )

    total_debit = sum(Decimal(str(ml['debit'])) for ml in move_lines)
    total_credit = sum(Decimal(str(ml['credit'])) for ml in move_lines)

    return total_debit - total_credit

# ============================================================================
# ANALISI ESTRATTI BANCARI
# ============================================================================
def analyze_ubs_chf_september(base_path):
    """Analizza UBS CHF per settembre 2024"""

    file_path = os.path.join(base_path, 'data-estratti', 'UBS-CHF-2024-CLEAN.json')

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Saldo fine agosto (inizio settembre)
    saldo_inizio = Decimal(str(data['monthly_balances']['2024-08']['ending_balance']))

    # Saldo fine settembre
    saldo_fine = Decimal(str(data['monthly_balances']['2024-09']['ending_balance']))

    # Variazione
    variazione = saldo_fine - saldo_inizio

    # Info Q3
    q3_info = next(q for q in data['quarters'] if q['period'] == 'Q3')

    return {
        'konto': '1024',
        'account': data['account'],
        'iban': data['iban'],
        'currency': data['currency'],
        'saldo_01_09': saldo_inizio,
        'saldo_30_09': saldo_fine,
        'variazione': variazione,
        'transactions_q3': q3_info['transactions'],
        'source': file_path
    }

def analyze_ubs_eur_september(base_path):
    """Analizza UBS EUR per settembre 2024 - carica solo settembre"""

    file_path = os.path.join(base_path, 'data-estratti', 'UBS-EUR-2024-TRANSACTIONS.json')

    print(f"\n[EUR] Loading transactions from {file_path}...")

    # Carica file JSON
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Il file ha struttura: {"transactions": [...]}
    all_transactions = data.get('transactions', [])

    # Filtra solo settembre 2024
    september_transactions = []

    for tx in all_transactions:
        # Prova diversi nomi campo per la data
        tx_date = tx.get('booking_date') or tx.get('date') or tx.get('value_date')
        if tx_date and tx_date.startswith('2024-09'):
            september_transactions.append(tx)

    print(f"[EUR] Found {len(september_transactions)} transactions in September 2024")

    # Carica anche il file clean per i saldi
    clean_file = os.path.join(base_path, 'data-estratti', 'UBS-EUR-2024-CLEAN.json')
    with open(clean_file, 'r', encoding='utf-8') as f:
        clean_data = json.load(f)

    saldo_fine_agosto = Decimal(str(clean_data['monthly_balances_2024']['2024-08']['balance']))
    saldo_fine_settembre = Decimal(str(clean_data['monthly_balances_2024']['2024-09']['balance']))

    # Calcola totali movimenti settembre
    total_debits = Decimal('0.00')
    total_credits = Decimal('0.00')

    for tx in september_transactions:
        amount = Decimal(str(tx.get('amount', 0)))
        if amount > 0:
            total_credits += amount
        else:
            total_debits += abs(amount)

    variazione_calcolata = total_credits - total_debits
    variazione_saldi = saldo_fine_settembre - saldo_fine_agosto

    return {
        'konto': '1025',
        'account': clean_data['account_number'],
        'iban': clean_data['iban'],
        'currency': clean_data['currency'],
        'saldo_01_09': saldo_fine_agosto,
        'saldo_30_09': saldo_fine_settembre,
        'variazione_saldi': variazione_saldi,
        'variazione_movimenti': variazione_calcolata,
        'num_transactions': len(september_transactions),
        'total_credits': total_credits,
        'total_debits': total_debits,
        'transactions': september_transactions,
        'source': file_path,
        'match': abs(variazione_calcolata - variazione_saldi) < Decimal('0.01')
    }

def analyze_credit_suisse_september(base_path):
    """Analizza Credit Suisse - non abbiamo dettagli settembre"""

    file_path = os.path.join(base_path, 'data-estratti', 'CREDIT-SUISSE-2024-CLEAN.json')

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return {
        'konto': '1026',
        'account': '3977497-51',
        'currency': 'CHF',
        'saldo_31_12': Decimal(str(data['summary']['total_balance_chf'])),
        'note': 'No detailed transactions available for September',
        'status': 'INCOMPLETE',
        'source': file_path
    }

# ============================================================================
# REPORT GENERATION
# ============================================================================
def generate_report(bank_data, odoo_data):
    """Genera report finale di confronto"""

    report = {
        'period': 'September 2024',
        'date_from': '2024-09-01',
        'date_to': '2024-09-30',
        'generated_at': datetime.now().isoformat(),
        'accounts': {}
    }

    for konto_code in ['1024', '1025', '1026']:
        bank = bank_data.get(konto_code, {})
        odoo = odoo_data.get(konto_code, {})

        report['accounts'][konto_code] = {
            'name': KONTI[konto_code]['name'],
            'currency': KONTI[konto_code]['currency'],
            'bank_statement': bank,
            'odoo': odoo,
            'reconciliation': {}
        }

        # Calcola differenze
        if bank and odoo and 'saldo_30_09' in bank and 'balance' in odoo:
            bank_balance = bank['saldo_30_09']
            odoo_balance = odoo['balance']
            diff = odoo_balance - bank_balance

            report['accounts'][konto_code]['reconciliation'] = {
                'bank_balance': float(bank_balance),
                'odoo_balance': float(odoo_balance),
                'difference': float(diff),
                'match': abs(diff) < Decimal('0.01'),
                'status': 'OK' if abs(diff) < Decimal('0.01') else 'DISCREPANCY'
            }

    return report

# ============================================================================
# MAIN
# ============================================================================
def main():
    """Main execution flow"""

    print("=" * 80)
    print("VERIFICA SETTEMBRE 2024 - AGENTE RIGA PER RIGA")
    print("=" * 80)

    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # 1. ANALIZZA ESTRATTI BANCARI
    print("\n[STEP 1] Analyzing bank statements...")

    bank_data = {}

    try:
        print("\n[1024] UBS CHF...")
        bank_data['1024'] = analyze_ubs_chf_september(base_path)
        print(f"  Saldo 01/09: CHF {bank_data['1024']['saldo_01_09']:,.2f}")
        print(f"  Saldo 30/09: CHF {bank_data['1024']['saldo_30_09']:,.2f}")
        print(f"  Variazione:  CHF {bank_data['1024']['variazione']:,.2f}")
    except Exception as e:
        print(f"  ERROR: {e}")

    try:
        print("\n[1025] UBS EUR...")
        bank_data['1025'] = analyze_ubs_eur_september(base_path)
        print(f"  Saldo 01/09: EUR {bank_data['1025']['saldo_01_09']:,.2f}")
        print(f"  Saldo 30/09: EUR {bank_data['1025']['saldo_30_09']:,.2f}")
        print(f"  Variazione (saldi):     EUR {bank_data['1025']['variazione_saldi']:,.2f}")
        print(f"  Variazione (movimenti): EUR {bank_data['1025']['variazione_movimenti']:,.2f}")
        print(f"  Transazioni: {bank_data['1025']['num_transactions']}")
        print(f"  Match: {bank_data['1025']['match']}")
    except Exception as e:
        print(f"  ERROR: {e}")

    try:
        print("\n[1026] Credit Suisse...")
        bank_data['1026'] = analyze_credit_suisse_september(base_path)
        print(f"  Status: {bank_data['1026']['status']}")
        print(f"  Note: {bank_data['1026']['note']}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # 2. VERIFICA ODOO
    print("\n[STEP 2] Querying Odoo...")

    odoo_data = {}

    try:
        models, uid = odoo_connect()

        for konto_code in ['1024', '1025', '1026']:
            print(f"\n[{konto_code}] {KONTI[konto_code]['name']}...")

            # Saldo al 30/09/2024
            balance_30_09 = get_odoo_balance_at_date(models, uid, konto_code, '2024-09-30')

            # Movimenti settembre
            period_balance, move_lines = get_odoo_account_balance(
                models, uid, konto_code, '2024-09-01', '2024-09-30'
            )

            odoo_data[konto_code] = {
                'balance': balance_30_09,
                'period_movement': period_balance,
                'num_move_lines': len(move_lines),
                'move_lines': move_lines
            }

            print(f"  Saldo 30/09: {balance_30_09:,.2f} {KONTI[konto_code]['currency']}")
            print(f"  Movimenti periodo: {period_balance:,.2f}")
            print(f"  Righe contabili: {len(move_lines)}")

    except Exception as e:
        print(f"\n[ODOO ERROR] {e}")
        print("Continuando con soli dati bancari...")

    # 3. GENERA REPORT
    print("\n[STEP 3] Generating report...")

    report = generate_report(bank_data, odoo_data)

    # Salva report
    report_file = os.path.join(base_path, 'REPORT-SETTEMBRE-2024.json')
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\nReport saved to: {report_file}")

    # 4. PRINT SUMMARY
    print("\n" + "=" * 80)
    print("SUMMARY - SEPTEMBER 2024")
    print("=" * 80)

    for konto_code in ['1024', '1025', '1026']:
        acc = report['accounts'][konto_code]
        print(f"\n[{konto_code}] {acc['name']} ({acc['currency']})")
        print("-" * 40)

        if 'reconciliation' in acc and acc['reconciliation']:
            rec = acc['reconciliation']
            print(f"  Bank balance:  {acc['currency']} {rec['bank_balance']:,.2f}")
            print(f"  Odoo balance:  {acc['currency']} {rec['odoo_balance']:,.2f}")
            print(f"  Difference:    {acc['currency']} {rec['difference']:,.2f}")
            print(f"  Status:        {rec['status']}")
        else:
            print("  Status: INCOMPLETE - Missing data")

    print("\n" + "=" * 80)
    print("DONE")
    print("=" * 80)

if __name__ == '__main__':
    main()
