#!/usr/bin/env python3
"""
AGENTE AGOSTO 2024 - Verifica completa riga per riga
Periodo: 01/08/2024 - 31/08/2024
Konti: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse)
"""

import json
import os
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any
import xmlrpc.client
from dotenv import load_dotenv

# Carica variabili da .env.local
load_dotenv('.env.local')

# Configurazione Odoo
ODOO_URL = os.getenv('ODOO_URL', 'https://erp.hubdrate.com')
ODOO_DB = os.getenv('ODOO_DB', 'hubdrate')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_PASSWORD = os.getenv('ODOO_PASSWORD')

def connect_odoo():
    """Connessione a Odoo"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def parse_date(date_str: str) -> datetime:
    """Parse date in vari formati"""
    formats = [
        '%d/%m/%Y',
        '%Y-%m-%d',
        '%d.%m.%Y',
        '%Y/%m/%d'
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    raise ValueError(f"Formato data non riconosciuto: {date_str}")

def is_august_2024(date_str: str) -> bool:
    """Verifica se la data è in agosto 2024"""
    try:
        dt = parse_date(date_str)
        return dt.year == 2024 and dt.month == 8
    except:
        return False

def load_ubs_eur_transactions():
    """Carica transazioni UBS EUR"""
    file_path = 'data-estratti/UBS-EUR-2024-TRANSACTIONS.json'
    print(f"\nCaricamento {file_path}...")

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    august_txs = []

    # Itera su tutte le transazioni
    if isinstance(data, dict) and 'transactions' in data:
        transactions = data['transactions']
    elif isinstance(data, list):
        transactions = data
    else:
        print(f"Formato dati non riconosciuto: {type(data)}")
        return august_txs

    for tx in transactions:
        if is_august_2024(tx.get('date', '')):
            august_txs.append({
                'konto': '1025',
                'bank': 'UBS EUR',
                'date': tx.get('date'),
                'description': tx.get('description', ''),
                'amount': float(tx.get('amount', 0)),
                'balance': float(tx.get('balance', 0)),
                'value_date': tx.get('value_date', ''),
                'raw': tx
            })

    print(f"Trovate {len(august_txs)} transazioni agosto 2024")
    return august_txs

def search_ubs_chf_csv():
    """Cerca il file CSV UBS CHF Q3 (contiene agosto)"""
    possible_paths = [
        'data-estratti/UBS CHF 1.7-30.9.2024.csv',
        'data-estratti/UBS-CHF-Q3-2024.csv',
        'data-estratti/csv/UBS CHF 1.7-30.9.2024.csv',
        '../data-estratti/UBS CHF 1.7-30.9.2024.csv'
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return path

    # Cerca in tutte le subdirectory
    for root, dirs, files in os.walk('data-estratti'):
        for file in files:
            if 'UBS' in file and 'CHF' in file and '.csv' in file:
                if '1.7' in file or 'Q3' in file or 'Jul' in file:
                    return os.path.join(root, file)

    return None

def load_ubs_chf_transactions():
    """Carica transazioni UBS CHF da CSV"""
    csv_path = search_ubs_chf_csv()

    if not csv_path:
        print("\nATTENZIONE: File CSV UBS CHF Q3 non trovato!")
        print("Cerco file JSON alternativo...")

        # Prova con JSON se esiste
        json_path = 'data-estratti/UBS-CHF-Q3-2024-TRANSACTIONS.json'
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                august_txs = []
                for tx in data:
                    if is_august_2024(tx.get('date', '')):
                        august_txs.append({
                            'konto': '1024',
                            'bank': 'UBS CHF',
                            'date': tx.get('date'),
                            'description': tx.get('description', ''),
                            'amount': float(tx.get('amount', 0)),
                            'balance': float(tx.get('balance', 0)),
                            'raw': tx
                        })
                print(f"Trovate {len(august_txs)} transazioni agosto 2024 (da JSON)")
                return august_txs

        return []

    print(f"\nCaricamento {csv_path}...")
    august_txs = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Salta header
    for line in lines[1:]:
        parts = line.strip().split(',')
        if len(parts) < 3:
            continue

        date = parts[0].strip('"')
        if is_august_2024(date):
            august_txs.append({
                'konto': '1024',
                'bank': 'UBS CHF',
                'date': date,
                'description': parts[1].strip('"') if len(parts) > 1 else '',
                'amount': float(parts[2].strip('"').replace("'", "")) if len(parts) > 2 else 0,
                'balance': float(parts[3].strip('"').replace("'", "")) if len(parts) > 3 else 0,
                'raw': line
            })

    print(f"Trovate {len(august_txs)} transazioni agosto 2024")
    return august_txs

def get_odoo_moves_august_2024(uid, models):
    """Fetch movimenti Odoo per agosto 2024 sui konti 1024, 1025, 1026"""
    print("\nRecupero movimenti Odoo agosto 2024...")

    # Cerca account IDs
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', 'in', ['1024', '1025', '1026']]]],
        {'fields': ['id', 'code', 'name']}
    )

    account_map = {acc['code']: acc['id'] for acc in account_ids}
    print(f"Account trovati: {account_map}")

    # Fetch move lines
    move_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', 'in', list(account_map.values())],
            ['date', '>=', '2024-08-01'],
            ['date', '<=', '2024-08-31']
        ]],
        {'fields': ['id', 'date', 'name', 'ref', 'debit', 'credit', 'balance', 'account_id', 'move_id', 'partner_id']}
    )

    print(f"Trovate {len(move_lines)} righe Odoo agosto 2024")

    # Mappa account_id → code
    id_to_code = {v: k for k, v in account_map.items()}

    odoo_moves = []
    for ml in move_lines:
        account_id = ml['account_id'][0] if isinstance(ml['account_id'], list) else ml['account_id']
        konto = id_to_code.get(account_id, 'UNKNOWN')

        odoo_moves.append({
            'konto': konto,
            'date': ml['date'],
            'description': ml['name'] or '',
            'ref': ml.get('ref', ''),
            'debit': ml['debit'],
            'credit': ml['credit'],
            'balance': ml['balance'],
            'move_id': ml['move_id'][0] if isinstance(ml['move_id'], list) else ml['move_id'],
            'partner': ml['partner_id'][1] if ml['partner_id'] else '',
            'raw': ml
        })

    return odoo_moves

def analyze_differences(bank_txs: List[Dict], odoo_moves: List[Dict], konto: str):
    """Analizza differenze tra banca e Odoo per un konto"""
    print(f"\n{'='*80}")
    print(f"ANALISI KONTO {konto}")
    print(f"{'='*80}")

    # Filtra per konto
    bank_konto = [tx for tx in bank_txs if tx['konto'] == konto]
    odoo_konto = [mv for mv in odoo_moves if mv['konto'] == konto]

    print(f"\nTransazioni banca: {len(bank_konto)}")
    print(f"Movimenti Odoo:    {len(odoo_konto)}")

    # Totali
    bank_total = sum(tx['amount'] for tx in bank_konto)
    odoo_total = sum((mv['debit'] - mv['credit']) for mv in odoo_konto)

    print(f"\nTotale movimenti banca: {bank_total:,.2f}")
    print(f"Totale movimenti Odoo:  {odoo_total:,.2f}")
    print(f"Differenza:             {abs(bank_total - odoo_total):,.2f}")

    # Raggruppa per data
    bank_by_date = defaultdict(list)
    odoo_by_date = defaultdict(list)

    for tx in bank_konto:
        bank_by_date[tx['date']].append(tx)

    for mv in odoo_konto:
        odoo_by_date[mv['date']].append(mv)

    # Confronto giorno per giorno
    all_dates = sorted(set(list(bank_by_date.keys()) + list(odoo_by_date.keys())))

    differences = []

    print(f"\n{'Data':<12} {'Banca':<15} {'Odoo':<15} {'Diff':<15} {'Status'}")
    print("-" * 80)

    for date in all_dates:
        bank_sum = sum(tx['amount'] for tx in bank_by_date.get(date, []))
        odoo_sum = sum((mv['debit'] - mv['credit']) for mv in odoo_by_date.get(date, []))
        diff = abs(bank_sum - odoo_sum)

        status = "OK" if diff < 0.01 else "DIFF"
        symbol = "OK" if diff < 0.01 else "XX"

        print(f"{date:<12} {bank_sum:>14,.2f} {odoo_sum:>14,.2f} {diff:>14,.2f} {status} {symbol}")

        if diff >= 0.01:
            differences.append({
                'date': date,
                'bank_total': bank_sum,
                'odoo_total': odoo_sum,
                'difference': diff,
                'bank_count': len(bank_by_date.get(date, [])),
                'odoo_count': len(odoo_by_date.get(date, [])),
                'bank_txs': bank_by_date.get(date, []),
                'odoo_mvs': odoo_by_date.get(date, [])
            })

    return {
        'konto': konto,
        'bank_count': len(bank_konto),
        'odoo_count': len(odoo_konto),
        'bank_total': bank_total,
        'odoo_total': odoo_total,
        'total_diff': abs(bank_total - odoo_total),
        'dates_with_diff': len(differences),
        'differences': differences
    }

def main():
    """Main execution"""
    print("="*80)
    print("VERIFICA AGOSTO 2024 - RICONCILIAZIONE BANCARIA")
    print("="*80)
    print(f"Data esecuzione: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Carica dati banca
    print("\n[1/4] Caricamento transazioni bancarie...")
    ubs_eur_txs = load_ubs_eur_transactions()
    ubs_chf_txs = load_ubs_chf_transactions()

    all_bank_txs = ubs_eur_txs + ubs_chf_txs

    print(f"\nTotale transazioni bancarie agosto 2024: {len(all_bank_txs)}")
    print(f"  - UBS EUR (1025): {len(ubs_eur_txs)}")
    print(f"  - UBS CHF (1024): {len(ubs_chf_txs)}")

    # Connetti Odoo
    print("\n[2/4] Connessione a Odoo...")
    try:
        uid, models = connect_odoo()
        print(f"Connesso come UID: {uid}")
    except Exception as e:
        print(f"ERRORE connessione Odoo: {e}")
        print("\nProseguo con analisi solo dati bancari...")
        uid, models = None, None

    # Fetch Odoo moves
    odoo_moves = []
    if uid and models:
        print("\n[3/4] Recupero movimenti Odoo...")
        try:
            odoo_moves = get_odoo_moves_august_2024(uid, models)
        except Exception as e:
            print(f"ERRORE recupero Odoo: {e}")

    # Analisi
    print("\n[4/4] Analisi e confronto...")

    results = {}

    # Analizza ogni konto
    for konto in ['1024', '1025', '1026']:
        bank_txs_konto = [tx for tx in all_bank_txs if tx['konto'] == konto]

        if not bank_txs_konto and konto != '1026':
            print(f"\nSKIP Konto {konto}: nessuna transazione bancaria")
            continue

        if konto == '1026':
            print(f"\n{'='*80}")
            print(f"KONTO 1026 - CREDIT SUISSE")
            print(f"{'='*80}")
            print("NOTA: File CSV non disponibile per Credit Suisse")
            print("TODO: Estrarre dati da PDF o richiedere CSV")
            results[konto] = {
                'status': 'DATA_MISSING',
                'message': 'CSV Credit Suisse non disponibile'
            }
            continue

        result = analyze_differences(bank_txs_konto, odoo_moves, konto)
        results[konto] = result

    # Report finale
    print("\n" + "="*80)
    print("REPORT FINALE AGOSTO 2024")
    print("="*80)

    report = {
        'period': 'Agosto 2024',
        'date_from': '2024-08-01',
        'date_to': '2024-08-31',
        'execution_date': datetime.now().isoformat(),
        'konti_analyzed': list(results.keys()),
        'summary': {},
        'details': results
    }

    for konto, result in results.items():
        if isinstance(result, dict) and 'status' in result:
            print(f"\nKonto {konto}: {result['message']}")
            continue

        print(f"\nKonto {konto}:")
        print(f"  Transazioni banca: {result['bank_count']}")
        print(f"  Movimenti Odoo:    {result['odoo_count']}")
        print(f"  Totale banca:      {result['bank_total']:,.2f}")
        print(f"  Totale Odoo:       {result['odoo_total']:,.2f}")
        print(f"  Differenza:        {result['total_diff']:,.2f}")
        print(f"  Date con diff:     {result['dates_with_diff']}")

        if result['total_diff'] < 0.01:
            print(f"  Status: [OK] PERFETTO")
        elif result['total_diff'] < 1.00:
            print(f"  Status: [WARN] ARROTONDAMENTI")
        else:
            print(f"  Status: [ERROR] DISCREPANZE")

    # Salva report
    output_file = 'REPORT-AGOSTO-2024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\nReport salvato: {output_file}")

    # Export dettagli differenze
    if any(r.get('dates_with_diff', 0) > 0 for r in results.values() if isinstance(r, dict) and 'dates_with_diff' in r):
        diff_file = 'AGOSTO-2024-DIFFERENZE-DETTAGLIATE.json'

        detailed_diffs = {}
        for konto, result in results.items():
            if isinstance(result, dict) and 'differences' in result and result['differences']:
                detailed_diffs[konto] = result['differences']

        with open(diff_file, 'w', encoding='utf-8') as f:
            json.dump(detailed_diffs, f, indent=2, ensure_ascii=False)

        print(f"Differenze dettagliate: {diff_file}")

if __name__ == '__main__':
    main()
