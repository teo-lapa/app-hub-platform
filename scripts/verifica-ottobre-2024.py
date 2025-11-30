#!/usr/bin/env python3
"""
VERIFICA COMPLETA OTTOBRE 2024
Confronta riga per riga:
- Estratti bancari (UBS CHF, UBS EUR, Credit Suisse)
- Movimenti Odoo (konto 1024, 1025, 1026)

Genera: REPORT-OTTOBRE-2024.json
"""

import xmlrpc.client
import json
import os
from datetime import datetime
from decimal import Decimal
from collections import defaultdict
from typing import Dict, List, Tuple

# Configurazione Odoo
ODOO_URL = os.getenv('ODOO_URL', 'https://erp.huboapps.com')
ODOO_DB = os.getenv('ODOO_DB', 'hubo-erp-main')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_PASSWORD = os.getenv('ODOO_PASSWORD')

# Periodo
START_DATE = '2024-10-01'
END_DATE = '2024-10-31'

# File estratti
ESTRATTI_FILES = {
    'UBS_CHF': 'c:/Users/lapa/Desktop/Claude Code/app-hub-platform/data-estratti/UBS-CHF-2024-CLEAN.json',
    'UBS_EUR': 'c:/Users/lapa/Desktop/Claude Code/app-hub-platform/data-estratti/UBS-EUR-2024-CLEAN.json',
    'CREDIT_SUISSE': 'c:/Users/lapa/Desktop/Claude Code/app-hub-platform/data-estratti/CREDIT-SUISSE-2024-CLEAN.json'
}

# Mapping Banca -> Konto Odoo
BANK_TO_KONTO = {
    'UBS_CHF': 1024,
    'UBS_EUR': 1025,
    'CREDIT_SUISSE': 1026
}

class OdooClient:
    def __init__(self):
        self.common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        self.uid = None

    def authenticate(self):
        """Autentica su Odoo"""
        print(f"🔐 Autenticazione su {ODOO_URL}...")
        self.uid = self.common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
        if not self.uid:
            raise Exception("Autenticazione fallita")
        print(f"OK Autenticato come UID {self.uid}")
        return self.uid

    def search_read(self, model, domain, fields):
        """Search & Read records"""
        return self.models.execute_kw(
            ODOO_DB, self.uid, ODOO_PASSWORD,
            model, 'search_read',
            [domain],
            {'fields': fields}
        )

    def get_account_moves(self, account_code: int, start_date: str, end_date: str) -> List[Dict]:
        """Recupera movimenti contabili per account"""
        print(f"📊 Recupero movimenti konto {account_code}...")

        # 1. Trova account
        accounts = self.search_read(
            'account.account',
            [('code', '=', str(account_code))],
            ['id', 'code', 'name']
        )

        if not accounts:
            print(f"!  Account {account_code} non trovato")
            return []

        account_id = accounts[0]['id']
        print(f"OK Account trovato: {accounts[0]['name']} (ID: {account_id})")

        # 2. Trova move lines
        domain = [
            ('account_id', '=', account_id),
            ('date', '>=', start_date),
            ('date', '<=', end_date),
            ('parent_state', '=', 'posted')  # Solo registrazioni confermate
        ]

        move_lines = self.search_read(
            'account.move.line',
            domain,
            ['id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
             'move_id', 'partner_id', 'currency_id', 'amount_currency']
        )

        print(f"OK Trovati {len(move_lines)} movimenti")
        return move_lines

def load_bank_statements() -> Dict[str, List[Dict]]:
    """Carica estratti bancari da JSON"""
    statements = {}

    for bank_name, file_path in ESTRATTI_FILES.items():
        print(f"\n📄 Caricamento {bank_name}...")

        if not os.path.exists(file_path):
            print(f"!  File non trovato: {file_path}")
            statements[bank_name] = []
            continue

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Filtra ottobre 2024
        october_txns = []
        for txn in data.get('transactions', []):
            txn_date = txn.get('date', '')
            if START_DATE <= txn_date <= END_DATE:
                october_txns.append(txn)

        statements[bank_name] = october_txns
        print(f"OK {len(october_txns)} transazioni in ottobre 2024")

    return statements

def match_transactions(bank_txns: List[Dict], odoo_moves: List[Dict]) -> Dict:
    """Confronta transazioni bancarie con movimenti Odoo"""

    # Indici per matching
    bank_by_date_amount = defaultdict(list)
    odoo_by_date_amount = defaultdict(list)

    # Indicizza bank transactions
    for txn in bank_txns:
        date = txn.get('date', '')
        amount = abs(float(txn.get('amount', 0)))
        key = (date, round(amount, 2))
        bank_by_date_amount[key].append(txn)

    # Indicizza odoo moves
    for move in odoo_moves:
        date = move.get('date', '')
        # Calcola importo netto (debit - credit)
        debit = float(move.get('debit', 0))
        credit = float(move.get('credit', 0))
        net_amount = abs(debit - credit)
        key = (date, round(net_amount, 2))
        odoo_by_date_amount[key].append(move)

    # Matching
    matched = []
    bank_only = []
    odoo_only = []

    # Trova matches
    all_keys = set(bank_by_date_amount.keys()) | set(odoo_by_date_amount.keys())

    for key in sorted(all_keys):
        date, amount = key
        bank_items = bank_by_date_amount.get(key, [])
        odoo_items = odoo_by_date_amount.get(key, [])

        if bank_items and odoo_items:
            # Match trovato
            matched.append({
                'date': date,
                'amount': amount,
                'bank_count': len(bank_items),
                'odoo_count': len(odoo_items),
                'bank_items': bank_items,
                'odoo_items': odoo_items,
                'status': 'MATCH' if len(bank_items) == len(odoo_items) else 'PARTIAL_MATCH'
            })
        elif bank_items:
            # Solo in banca
            for txn in bank_items:
                bank_only.append({
                    'date': date,
                    'amount': amount,
                    'description': txn.get('description', ''),
                    'reference': txn.get('reference', ''),
                    'full_data': txn
                })
        elif odoo_items:
            # Solo in Odoo
            for move in odoo_items:
                odoo_only.append({
                    'date': date,
                    'amount': amount,
                    'name': move.get('name', ''),
                    'ref': move.get('ref', ''),
                    'move_id': move.get('move_id', [None, ''])[1] if move.get('move_id') else '',
                    'full_data': move
                })

    return {
        'matched': matched,
        'bank_only': bank_only,
        'odoo_only': odoo_only
    }

def calculate_totals(items: List[Dict], amount_field: str = 'amount') -> Dict:
    """Calcola totali"""
    total_debit = 0
    total_credit = 0
    count = len(items)

    for item in items:
        if 'full_data' in item:
            item = item['full_data']

        amount = float(item.get(amount_field, 0))
        if amount > 0:
            total_debit += amount
        else:
            total_credit += abs(amount)

    return {
        'count': count,
        'total_debit': round(total_debit, 2),
        'total_credit': round(total_credit, 2),
        'net': round(total_debit - total_credit, 2)
    }

def main():
    # Fix Windows console encoding
    import sys
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("=" * 80)
    print("VERIFICA COMPLETA OTTOBRE 2024")
    print("=" * 80)
    print(f"Periodo: {START_DATE} -> {END_DATE}")
    print()

    # 1. Carica estratti bancari
    print("\n📥 STEP 1: Caricamento estratti bancari")
    print("-" * 80)
    bank_statements = load_bank_statements()

    # 2. Connetti a Odoo
    print("\n🔌 STEP 2: Connessione a Odoo")
    print("-" * 80)
    odoo = OdooClient()
    odoo.authenticate()

    # 3. Analisi per ogni banca
    print("\n🔍 STEP 3: Verifica riga per riga")
    print("-" * 80)

    results = {}

    for bank_name, bank_txns in bank_statements.items():
        print(f"\n{'=' * 80}")
        print(f"🏦 {bank_name}")
        print(f"{'=' * 80}")

        konto = BANK_TO_KONTO.get(bank_name)
        if not konto:
            print(f"!  Konto non mappato per {bank_name}")
            continue

        # Recupera movimenti Odoo
        odoo_moves = odoo.get_account_moves(konto, START_DATE, END_DATE)

        # Matching
        print(f"\n🔄 Matching transazioni...")
        matching_result = match_transactions(bank_txns, odoo_moves)

        # Calcola totali
        bank_totals = calculate_totals(bank_txns)
        odoo_totals = calculate_totals([m for m in odoo_moves], 'debit')  # Usa debit come base

        # Ricalcola odoo totals correttamente
        odoo_debit = sum(float(m.get('debit', 0)) for m in odoo_moves)
        odoo_credit = sum(float(m.get('credit', 0)) for m in odoo_moves)

        results[bank_name] = {
            'konto': konto,
            'bank_summary': {
                'total_transactions': len(bank_txns),
                'total_debit': bank_totals['total_debit'],
                'total_credit': bank_totals['total_credit'],
                'net': bank_totals['net']
            },
            'odoo_summary': {
                'total_moves': len(odoo_moves),
                'total_debit': round(odoo_debit, 2),
                'total_credit': round(odoo_credit, 2),
                'net': round(odoo_debit - odoo_credit, 2)
            },
            'matching': {
                'matched_count': len(matching_result['matched']),
                'bank_only_count': len(matching_result['bank_only']),
                'odoo_only_count': len(matching_result['odoo_only'])
            },
            'details': matching_result
        }

        # Print summary
        print(f"\n📊 RIEPILOGO {bank_name} (Konto {konto})")
        print(f"  Estratto Conto:")
        print(f"    Transazioni: {len(bank_txns)}")
        print(f"    Entrate:     CHF {bank_totals['total_debit']:>12,.2f}")
        print(f"    Uscite:      CHF {bank_totals['total_credit']:>12,.2f}")
        print(f"    Netto:       CHF {bank_totals['net']:>12,.2f}")
        print(f"\n  Odoo:")
        print(f"    Movimenti:   {len(odoo_moves)}")
        print(f"    Dare:        CHF {odoo_debit:>12,.2f}")
        print(f"    Avere:       CHF {odoo_credit:>12,.2f}")
        print(f"    Netto:       CHF {odoo_debit - odoo_credit:>12,.2f}")
        print(f"\n  Matching:")
        print(f"    OK Matched:       {len(matching_result['matched'])}")
        print(f"    ⚠ Solo Banca:    {len(matching_result['bank_only'])}")
        print(f"    ⚠ Solo Odoo:     {len(matching_result['odoo_only'])}")

        # Mostra differenze se presenti
        diff = abs(bank_totals['net'] - (odoo_debit - odoo_credit))
        if diff > 0.01:
            print(f"\n  !  DIFFERENZA: CHF {diff:,.2f}")

    # 4. Salva report
    print("\n\n💾 STEP 4: Salvataggio report")
    print("-" * 80)

    report = {
        'period': {
            'start_date': START_DATE,
            'end_date': END_DATE,
            'month': 'Ottobre 2024'
        },
        'generated_at': datetime.now().isoformat(),
        'results': results
    }

    output_file = 'c:/Users/lapa/Desktop/Claude Code/app-hub-platform/REPORT-OTTOBRE-2024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"OK Report salvato: {output_file}")

    # 5. Report finale
    print("\n\n" + "=" * 80)
    print("📋 REPORT FINALE OTTOBRE 2024")
    print("=" * 80)

    total_matched = sum(r['matching']['matched_count'] for r in results.values())
    total_bank_only = sum(r['matching']['bank_only_count'] for r in results.values())
    total_odoo_only = sum(r['matching']['odoo_only_count'] for r in results.values())

    print(f"\nOK Totale matched:        {total_matched}")
    print(f"⚠ Totale solo banca:     {total_bank_only}")
    print(f"⚠ Totale solo Odoo:      {total_odoo_only}")

    if total_bank_only > 0:
        print(f"\n!  ATTENZIONE: {total_bank_only} transazioni bancarie non trovate in Odoo")
    if total_odoo_only > 0:
        print(f"!  ATTENZIONE: {total_odoo_only} movimenti Odoo non trovati in banca")

    if total_bank_only == 0 and total_odoo_only == 0:
        print("\n🎉 PERFETTO! Tutti i movimenti sono allineati!")

    print("\n" + "=" * 80)
    print(f"OK Report completo disponibile in: {output_file}")
    print("=" * 80)

if __name__ == '__main__':
    main()
