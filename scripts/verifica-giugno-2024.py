#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VERIFICA COMPLETA GIUGNO 2024 - Riga per Riga
Analizza tutti i movimenti bancari di giugno 2024 e verifica riconciliazione con Odoo

Konti analizzati:
- 1024: UBS CHF (CH02 0027 8278 1220 8701 J)
- 1025: UBS EUR (CH25 0027 8278 1220 8760 A)
- 1026: Credit Suisse CHF (3977497-51)

Periodo: 01/06/2024 - 30/06/2024
"""

import sys
import io
import json
import xmlrpc.client
from datetime import datetime, date
from decimal import Decimal
from collections import defaultdict
from pathlib import Path
import os

# Fix encoding per Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Configurazione Odoo
ODOO_URL = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
ODOO_DB = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
ODOO_USERNAME = os.getenv('ODOO_USERNAME', 'apphubplatform@lapa.ch')
ODOO_PASSWORD = os.getenv('ODOO_PASSWORD', 'apphubplatform2025')

class OdooClient:
    """Client XML-RPC per Odoo"""

    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.uid = None
        self.models = None

    def connect(self):
        """Connessione e autenticazione"""
        if not self.username or not self.password:
            print("⚠ Credenziali Odoo non configurate - Modalità solo analisi bancaria")
            return False

        try:
            common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common', allow_none=True)
            self.uid = common.authenticate(self.db, self.username, self.password, {})

            if not self.uid:
                raise Exception("Autenticazione fallita")

            self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object', allow_none=True)
            print(f"✓ Connesso a Odoo come UID {self.uid}")
            return True

        except Exception as e:
            print(f"⚠ Errore connessione Odoo: {e}")
            print("  Continuo con analisi solo dati bancari")
            return False

    def search_read(self, model, domain, fields=None):
        """Cerca e leggi records"""
        try:
            return self.models.execute_kw(
                self.db, self.uid, self.password,
                model, 'search_read',
                [domain],
                {'fields': fields} if fields else {}
            )
        except Exception as e:
            print(f"✗ Errore search_read {model}: {e}")
            return []

    def get_account_moves(self, account_code, date_from, date_to):
        """Recupera movimenti contabili per conto e periodo"""

        # Prima cerca l'account
        accounts = self.search_read(
            'account.account',
            [('code', '=', account_code)],
            ['id', 'name', 'code', 'currency_id']
        )

        if not accounts:
            print(f"✗ Account {account_code} non trovato")
            return []

        account = accounts[0]
        print(f"✓ Account trovato: {account['code']} - {account['name']}")

        # Cerca movimenti nel periodo
        moves = self.search_read(
            'account.move.line',
            [
                ('account_id', '=', account['id']),
                ('date', '>=', date_from),
                ('date', '<=', date_to),
                ('parent_state', '=', 'posted')  # Solo movimenti confermati
            ],
            [
                'id', 'date', 'name', 'ref', 'partner_id',
                'debit', 'credit', 'balance', 'currency_id',
                'move_id', 'amount_currency'
            ]
        )

        print(f"✓ Trovati {len(moves)} movimenti Odoo")
        return moves

def load_json(filepath):
    """Carica file JSON"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"✗ Errore lettura {filepath}: {e}")
        return None

def filter_june_transactions(transactions):
    """Filtra solo transazioni di giugno 2024"""
    june_txs = []

    for tx in transactions:
        tx_date = tx.get('date', '')
        if tx_date.startswith('2024-06'):
            june_txs.append(tx)

    return june_txs

def analyze_bank_account(account_name, account_code, transactions_file, odoo_client):
    """Analizza singolo conto bancario"""

    print(f"\n{'='*80}")
    print(f"ANALISI: {account_name} (Konto {account_code})")
    print(f"{'='*80}")

    # Carica transazioni bancarie
    data = load_json(transactions_file)
    if not data:
        print(f"✗ Impossibile caricare {transactions_file}")
        return None

    all_transactions = data.get('transactions', [])
    june_txs = filter_june_transactions(all_transactions)

    print(f"\n📊 TRANSAZIONI BANCARIE GIUGNO 2024")
    print(f"Totale transazioni banca: {len(june_txs)}")

    if not june_txs:
        print("⚠ Nessuna transazione trovata per giugno 2024")
        return None

    # Calcola statistiche bancarie
    total_debit = sum(abs(tx.get('debit', 0)) for tx in june_txs if tx.get('debit', 0) < 0)
    total_credit = sum(tx.get('credit', 0) for tx in june_txs if tx.get('credit', 0) > 0)

    # Saldo iniziale e finale
    june_txs_sorted = sorted(june_txs, key=lambda x: x['date'])

    # Il primo movimento ha il balance che include il movimento stesso
    # Quindi saldo iniziale = balance primo movimento - amount primo movimento
    if june_txs_sorted:
        first_tx = june_txs_sorted[0]
        last_tx = june_txs_sorted[-1]

        opening_balance = first_tx.get('balance', 0) - first_tx.get('amount', 0)
        closing_balance = last_tx.get('balance', 0)
    else:
        opening_balance = 0
        closing_balance = 0

    print(f"\nSaldo iniziale (01/06/2024): {opening_balance:,.2f}")
    print(f"Totale Dare (uscite):        {total_debit:,.2f}")
    print(f"Totale Avere (entrate):      {total_credit:,.2f}")
    print(f"Saldo finale (30/06/2024):   {closing_balance:,.2f}")
    print(f"Variazione:                  {closing_balance - opening_balance:,.2f}")

    # Recupera movimenti Odoo (se connesso)
    print(f"\n📊 MOVIMENTI ODOO GIUGNO 2024")

    odoo_moves = []
    if odoo_client and odoo_client.uid:
        odoo_moves = odoo_client.get_account_moves(account_code, '2024-06-01', '2024-06-30')
    else:
        print("⚠ Odoo non connesso - Solo analisi dati bancari")

    if not odoo_moves and odoo_client and odoo_client.uid:
        print("⚠ Nessun movimento Odoo trovato")
        return {
            'account': account_name,
            'code': account_code,
            'bank_transactions': len(june_txs),
            'odoo_moves': 0,
            'bank_opening': opening_balance,
            'bank_closing': closing_balance,
            'bank_debit': total_debit,
            'bank_credit': total_credit,
            'odoo_debit': 0,
            'odoo_credit': 0,
            'reconciliation_gap': len(june_txs),
            'status': 'CRITICO - Nessun movimento in Odoo'
        }

    # Calcola totali Odoo (se disponibili)
    if odoo_moves:
        odoo_total_debit = sum(m.get('debit', 0) for m in odoo_moves)
        odoo_total_credit = sum(m.get('credit', 0) for m in odoo_moves)

        print(f"Totale movimenti Odoo:       {len(odoo_moves)}")
        print(f"Totale Dare Odoo:            {odoo_total_debit:,.2f}")
        print(f"Totale Avere Odoo:           {odoo_total_credit:,.2f}")

        # Confronto
        print(f"\n📊 CONFRONTO BANCA vs ODOO")
        debit_diff = abs(total_debit - odoo_total_debit)
        credit_diff = abs(total_credit - odoo_total_credit)

        print(f"Differenza Dare:             {debit_diff:,.2f}")
        print(f"Differenza Avere:            {credit_diff:,.2f}")
        print(f"Gap movimenti:               {len(june_txs) - len(odoo_moves)}")
    else:
        odoo_total_debit = 0
        odoo_total_credit = 0
        debit_diff = 0
        credit_diff = 0
        print("⚠ Nessun dato Odoo disponibile")

    # Matching dettagliato
    print(f"\n{'='*80}")
    print(f"ANALISI RIGA PER RIGA")
    print(f"{'='*80}")

    matched = 0
    unmatched_bank = []
    unmatched_odoo = list(odoo_moves)  # Copia per rimuovere match

    for i, bank_tx in enumerate(june_txs_sorted, 1):
        tx_date = bank_tx.get('date', '')
        tx_amount = bank_tx.get('amount', 0)
        tx_debit = abs(bank_tx.get('debit', 0)) if bank_tx.get('debit', 0) < 0 else 0
        tx_credit = bank_tx.get('credit', 0) if bank_tx.get('credit', 0) > 0 else 0
        tx_desc = bank_tx.get('description', '')[:60]

        # Cerca match in Odoo per data e importo
        match_found = None
        for odoo_move in unmatched_odoo:
            odoo_date = odoo_move.get('date', '')
            odoo_debit = odoo_move.get('debit', 0)
            odoo_credit = odoo_move.get('credit', 0)

            # Match esatto su data e importo
            if (odoo_date == tx_date and
                abs(odoo_debit - tx_debit) < 0.01 and
                abs(odoo_credit - tx_credit) < 0.01):
                match_found = odoo_move
                break

        if match_found:
            matched += 1
            unmatched_odoo.remove(match_found)
            print(f"✓ [{i:3d}] {tx_date} | {tx_amount:>12,.2f} | {tx_desc}")
        else:
            unmatched_bank.append(bank_tx)
            print(f"✗ [{i:3d}] {tx_date} | {tx_amount:>12,.2f} | {tx_desc} | NON TROVATO IN ODOO")

    # Movimenti Odoo non matchati
    if unmatched_odoo:
        print(f"\n⚠ MOVIMENTI ODOO NON MATCHATI: {len(unmatched_odoo)}")
        for odoo_move in unmatched_odoo[:20]:  # Primi 20
            odoo_date = odoo_move.get('date', '')
            odoo_amount = odoo_move.get('debit', 0) - odoo_move.get('credit', 0)
            odoo_ref = odoo_move.get('ref', '') or odoo_move.get('name', '')
            print(f"  {odoo_date} | {odoo_amount:>12,.2f} | {odoo_ref[:60]}")

    # Riepilogo finale
    print(f"\n{'='*80}")
    print(f"RIEPILOGO")
    print(f"{'='*80}")
    print(f"Movimenti bancari:           {len(june_txs)}")
    print(f"Movimenti Odoo:              {len(odoo_moves)}")
    print(f"Match esatti:                {matched}")
    print(f"Non riconciliati (banca):    {len(unmatched_bank)}")
    print(f"Non riconciliati (Odoo):     {len(unmatched_odoo)}")

    reconciliation_rate = (matched / len(june_txs) * 100) if june_txs else 0
    print(f"Tasso riconciliazione:       {reconciliation_rate:.1f}%")

    if reconciliation_rate >= 95:
        status = "OTTIMO"
    elif reconciliation_rate >= 80:
        status = "BUONO"
    elif reconciliation_rate >= 50:
        status = "ACCETTABILE"
    else:
        status = "CRITICO"

    print(f"Status:                      {status}")

    return {
        'account': account_name,
        'code': account_code,
        'bank_transactions': len(june_txs),
        'odoo_moves': len(odoo_moves),
        'matched': matched,
        'unmatched_bank': len(unmatched_bank),
        'unmatched_odoo': len(unmatched_odoo),
        'reconciliation_rate': reconciliation_rate,
        'bank_opening': opening_balance,
        'bank_closing': closing_balance,
        'bank_debit': total_debit,
        'bank_credit': total_credit,
        'odoo_debit': odoo_total_debit,
        'odoo_credit': odoo_total_credit,
        'debit_diff': debit_diff,
        'credit_diff': credit_diff,
        'status': status,
        'unmatched_bank_details': unmatched_bank[:50],  # Prime 50 per report
        'unmatched_odoo_details': unmatched_odoo[:50]
    }

def main():
    """Main execution"""

    print("\n" + "="*80)
    print("VERIFICA COMPLETA GIUGNO 2024 - Riga per Riga")
    print("="*80)
    print(f"Periodo: 01/06/2024 - 30/06/2024")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Connetti a Odoo (opzionale)
    odoo = OdooClient()
    odoo_connected = odoo.connect()

    # Path base
    base_path = Path(__file__).parent.parent / 'data-estratti'

    # Account da analizzare
    accounts = [
        {
            'name': 'UBS EUR',
            'code': '1025',
            'file': base_path / 'UBS-EUR-2024-TRANSACTIONS.json'
        },
        # UBS CHF e Credit Suisse richiedono file transazioni che non abbiamo
        # Li aggiungeremo quando disponibili
    ]

    results = []

    for account in accounts:
        if not account['file'].exists():
            print(f"\n⚠ File non trovato: {account['file']}")
            continue

        result = analyze_bank_account(
            account['name'],
            account['code'],
            account['file'],
            odoo
        )

        if result:
            results.append(result)

    # Report finale JSON
    report = {
        'analysis_date': datetime.now().isoformat(),
        'period': {
            'from': '2024-06-01',
            'to': '2024-06-30'
        },
        'accounts_analyzed': len(results),
        'results': results,
        'summary': {
            'total_bank_transactions': sum(r['bank_transactions'] for r in results),
            'total_odoo_moves': sum(r['odoo_moves'] for r in results),
            'total_matched': sum(r['matched'] for r in results),
            'total_unmatched_bank': sum(r['unmatched_bank'] for r in results),
            'total_unmatched_odoo': sum(r['unmatched_odoo'] for r in results),
            'overall_reconciliation_rate': (
                sum(r['matched'] for r in results) /
                sum(r['bank_transactions'] for r in results) * 100
            ) if sum(r['bank_transactions'] for r in results) > 0 else 0
        }
    }

    # Salva report
    report_path = Path(__file__).parent.parent / 'REPORT-GIUGNO-2024.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n{'='*80}")
    print(f"REPORT SALVATO: {report_path}")
    print(f"{'='*80}")

    # Summary finale
    print(f"\n📊 SUMMARY COMPLESSIVO GIUGNO 2024")
    print(f"Account analizzati:          {len(results)}")
    print(f"Transazioni bancarie totali: {report['summary']['total_bank_transactions']}")
    print(f"Movimenti Odoo totali:       {report['summary']['total_odoo_moves']}")
    print(f"Match esatti:                {report['summary']['total_matched']}")
    print(f"Tasso riconciliazione:       {report['summary']['overall_reconciliation_rate']:.1f}%")

    print("\n✓ Analisi completata!")

if __name__ == '__main__':
    main()
