#!/usr/bin/env python3
"""
AGENTE GENNAIO 2024 - Verifica completa riga per riga
Confronta transazioni JSON vs Odoo per gennaio 2024
"""

import os
import sys
import json
import xmlrpc.client
from datetime import datetime
from collections import defaultdict
from decimal import Decimal

# Configurazione Odoo STAGING
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "apphubplatform@lapa.ch"
ODOO_PASSWORD = "apphubplatform2025"

# Mapping konti bancari
KONTI = {
    "1024": {"name": "UBS CHF", "file": None},  # Estratto da Odoo direttamente
    "1025": {"name": "UBS EUR", "file": "data-estratti/UBS-EUR-2024-TRANSACTIONS.json"},
    "1026": {"name": "Credit Suisse", "file": None}  # Non disponibile
}

def connect_odoo():
    """Connessione a Odoo"""
    print(f"\n🔌 Connessione a Odoo...")
    print(f"   URL: {ODOO_URL}")
    print(f"   DB: {ODOO_DB}")
    print(f"   User: {ODOO_USERNAME}")

    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("❌ Autenticazione fallita")

    print(f"   ✅ Autenticato! UID: {uid}")

    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def get_account_id(models, uid, konto_code):
    """Ottieni l'ID dell'account Odoo dal codice"""
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search',
        [[['code', '=', konto_code]]]
    )

    if not account_ids:
        print(f"   ⚠️  Konto {konto_code} non trovato in Odoo")
        return None

    return account_ids[0]

def get_odoo_transactions(models, uid, account_id, date_from, date_to):
    """Estrai transazioni Odoo per un account e periodo"""
    print(f"   📊 Caricamento transazioni Odoo...")

    # Cerca nelle account.move.line
    domain = [
        ['account_id', '=', account_id],
        ['date', '>=', date_from],
        ['date', '<=', date_to],
        ['parent_state', '=', 'posted']  # Solo movimenti validati
    ]

    move_line_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search',
        [domain]
    )

    if not move_line_ids:
        print(f"   ⚠️  Nessuna transazione trovata")
        return []

    # Leggi i dettagli
    fields = ['date', 'name', 'debit', 'credit', 'balance', 'partner_id', 'move_id', 'ref']
    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'read',
        [move_line_ids, fields]
    )

    print(f"   ✅ Caricate {len(lines)} transazioni")
    return lines

def load_json_transactions(file_path, date_from, date_to):
    """Carica transazioni JSON per un periodo"""
    if not file_path:
        print(f"   ⚠️  Nessun file JSON disponibile (usa solo Odoo)")
        return []

    print(f"   📄 Caricamento da {file_path}...")

    if not os.path.exists(file_path):
        print(f"   ⚠️  File non trovato: {file_path}")
        return []

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Filtra transazioni del periodo
    transactions = []
    if 'transactions' in data:
        for tx in data['transactions']:
            tx_date = tx.get('date', '')
            if date_from <= tx_date <= date_to:
                transactions.append(tx)

    print(f"   ✅ Trovate {len(transactions)} transazioni in JSON")
    return transactions

def normalize_amount(amount):
    """Normalizza importo per confronto"""
    if amount is None:
        return Decimal('0.00')
    return Decimal(str(amount)).quantize(Decimal('0.01'))

def find_duplicates(odoo_lines):
    """Trova duplicati in Odoo (stessa data + importo + partner)"""
    print(f"   🔍 Ricerca duplicati...")

    # Raggruppa per data + importo
    groups = defaultdict(list)
    for line in odoo_lines:
        amount = normalize_amount(line['debit']) - normalize_amount(line['credit'])
        key = (line['date'], float(amount))
        groups[key].append(line)

    # Trova gruppi con più di 1 transazione
    duplicates = []
    for key, lines in groups.items():
        if len(lines) > 1:
            duplicates.append({
                'date': key[0],
                'amount': key[1],
                'count': len(lines),
                'lines': lines
            })

    print(f"   {'✅' if not duplicates else '⚠️'}  Trovati {len(duplicates)} gruppi di duplicati")
    return duplicates

def match_transactions(json_txs, odoo_lines):
    """Confronta transazioni JSON vs Odoo"""
    print(f"   🔄 Matching transazioni...")

    matched = []
    missing_in_odoo = []
    extra_in_odoo = list(odoo_lines)  # Copia per rimuovere quelli matched

    for json_tx in json_txs:
        json_date = json_tx.get('date')
        json_amount = normalize_amount(json_tx.get('amount', 0))

        # Cerca match in Odoo
        found = False
        for i, odoo_line in enumerate(extra_in_odoo):
            odoo_date = odoo_line['date']
            odoo_amount = normalize_amount(odoo_line['debit']) - normalize_amount(odoo_line['credit'])

            # Match per data e importo (tolleranza 0.01)
            if odoo_date == json_date and abs(odoo_amount - json_amount) < Decimal('0.02'):
                matched.append({
                    'json': json_tx,
                    'odoo': odoo_line
                })
                extra_in_odoo.pop(i)
                found = True
                break

        if not found:
            missing_in_odoo.append(json_tx)

    print(f"   ✅ Matched: {len(matched)}")
    print(f"   {'⚠️' if missing_in_odoo else '✅'}  Mancanti in Odoo: {len(missing_in_odoo)}")
    print(f"   {'⚠️' if extra_in_odoo else '✅'}  Extra in Odoo: {len(extra_in_odoo)}")

    return matched, missing_in_odoo, extra_in_odoo

def calculate_balance(transactions, opening_balance):
    """Calcola saldo finale da transazioni"""
    balance = Decimal(str(opening_balance))
    for tx in sorted(transactions, key=lambda x: x.get('date', '')):
        balance += normalize_amount(tx.get('amount', 0))
    return float(balance)

def analyze_account(models, uid, konto_code, date_from, date_to):
    """Analizza un singolo konto"""
    print(f"\n{'='*80}")
    print(f"📊 ANALISI KONTO {konto_code} - {KONTI[konto_code]['name']}")
    print(f"{'='*80}")

    # 1. Ottieni account ID
    account_id = get_account_id(models, uid, konto_code)
    if not account_id:
        return None

    # 2. Carica transazioni Odoo
    odoo_lines = get_odoo_transactions(models, uid, account_id, date_from, date_to)

    # 3. Carica transazioni JSON
    json_file = KONTI[konto_code]['file']
    json_txs = load_json_transactions(json_file, date_from, date_to)

    # 4. Trova duplicati in Odoo
    duplicates = find_duplicates(odoo_lines)

    # 5. Match transazioni
    matched, missing, extra = match_transactions(json_txs, odoo_lines)

    # 6. Report
    result = {
        'konto': konto_code,
        'name': KONTI[konto_code]['name'],
        'period': f"{date_from} / {date_to}",
        'summary': {
            'json_transactions': len(json_txs),
            'odoo_transactions': len(odoo_lines),
            'matched': len(matched),
            'missing_in_odoo': len(missing),
            'extra_in_odoo': len(extra),
            'duplicates_found': len(duplicates)
        },
        'duplicates': duplicates,
        'missing_in_odoo': missing,
        'extra_in_odoo': [
            {
                'id': line['id'],
                'date': line['date'],
                'description': line['name'],
                'debit': float(line['debit']),
                'credit': float(line['credit']),
                'amount': float(normalize_amount(line['debit']) - normalize_amount(line['credit'])),
                'partner': line['partner_id'][1] if line['partner_id'] else None,
                'move_id': line['move_id'][0] if line['move_id'] else None
            }
            for line in extra
        ]
    }

    # Calcola saldi se abbiamo info JSON
    if json_txs and 'opening_balance' in json_txs[0]:
        json_opening = json_txs[0].get('opening_balance', 0)
        json_closing = calculate_balance(json_txs, json_opening)

        odoo_opening = float(odoo_lines[0]['balance']) if odoo_lines else 0
        odoo_closing = float(odoo_lines[-1]['balance']) if odoo_lines else 0

        result['balances'] = {
            'json_opening': json_opening,
            'json_closing': json_closing,
            'odoo_opening': odoo_opening,
            'odoo_closing': odoo_closing,
            'difference': odoo_closing - json_closing
        }

    return result

def print_summary(results):
    """Stampa riepilogo finale"""
    print(f"\n{'='*80}")
    print(f"📋 RIEPILOGO FINALE - GENNAIO 2024")
    print(f"{'='*80}\n")

    total_json = 0
    total_odoo = 0
    total_duplicates = 0
    total_missing = 0
    total_extra = 0

    for res in results:
        if not res:
            continue

        print(f"🏦 {res['konto']} - {res['name']}")
        print(f"   Transazioni JSON: {res['summary']['json_transactions']}")
        print(f"   Transazioni Odoo: {res['summary']['odoo_transactions']}")
        print(f"   Matched: {res['summary']['matched']}")
        print(f"   Mancanti in Odoo: {res['summary']['missing_in_odoo']}")
        print(f"   Extra in Odoo: {res['summary']['extra_in_odoo']}")
        print(f"   Duplicati trovati: {res['summary']['duplicates_found']}")

        if 'balances' in res:
            print(f"   Saldo JSON fine gennaio: {res['balances']['json_closing']:.2f}")
            print(f"   Saldo Odoo fine gennaio: {res['balances']['odoo_closing']:.2f}")
            print(f"   Differenza: {res['balances']['difference']:.2f}")

        print()

        total_json += res['summary']['json_transactions']
        total_odoo += res['summary']['odoo_transactions']
        total_duplicates += res['summary']['duplicates_found']
        total_missing += res['summary']['missing_in_odoo']
        total_extra += res['summary']['extra_in_odoo']

    print(f"{'='*80}")
    print(f"TOTALE COMPLESSIVO:")
    print(f"   JSON: {total_json} transazioni")
    print(f"   Odoo: {total_odoo} transazioni")
    print(f"   Duplicati: {total_duplicates}")
    print(f"   Mancanti: {total_missing}")
    print(f"   Extra: {total_extra}")
    print(f"{'='*80}\n")

def main():
    """Main function"""
    print("="*80)
    print("🚀 AGENTE GENNAIO 2024 - Verifica Completa")
    print("="*80)

    # Periodo gennaio 2024
    date_from = "2024-01-01"
    date_to = "2024-01-31"

    print(f"\n📅 Periodo: {date_from} → {date_to}")

    try:
        # Connessione Odoo
        uid, models = connect_odoo()

        # Analizza ogni konto
        results = []
        for konto_code in ['1024', '1025']:  # Solo UBS per ora
            result = analyze_account(models, uid, konto_code, date_from, date_to)
            results.append(result)

        # Stampa riepilogo
        print_summary(results)

        # Salva report
        report_file = "REPORT-GENNAIO-2024.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump({
                'date': datetime.now().isoformat(),
                'period': f"{date_from} / {date_to}",
                'results': results
            }, f, indent=2, ensure_ascii=False)

        print(f"💾 Report salvato in: {report_file}")

        # Stampa dettagli duplicati
        for res in results:
            if not res or not res['duplicates']:
                continue

            print(f"\n{'='*80}")
            print(f"⚠️  DUPLICATI IN {res['konto']} - {res['name']}")
            print(f"{'='*80}\n")

            for dup in res['duplicates']:
                print(f"📅 Data: {dup['date']}")
                print(f"💰 Importo: {dup['amount']:.2f}")
                print(f"🔢 Occorrenze: {dup['count']}")
                print(f"   Dettagli:")
                for line in dup['lines']:
                    partner = line['partner_id'][1] if line['partner_id'] else 'N/A'
                    print(f"   - ID {line['id']}: {line['name'][:50]} | Partner: {partner}")
                print()

        # Stampa transazioni mancanti
        for res in results:
            if not res or not res['missing_in_odoo']:
                continue

            print(f"\n{'='*80}")
            print(f"❌ MANCANTI IN ODOO - {res['konto']} - {res['name']}")
            print(f"{'='*80}\n")

            for tx in res['missing_in_odoo'][:10]:  # Prime 10
                print(f"📅 {tx.get('date')} | 💰 {tx.get('amount', 0):.2f} | {tx.get('description', 'N/A')[:60]}")

            if len(res['missing_in_odoo']) > 10:
                print(f"\n   ... e altre {len(res['missing_in_odoo']) - 10} transazioni")

        print(f"\n✅ Analisi completata!")

    except Exception as e:
        print(f"\n❌ Errore: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
