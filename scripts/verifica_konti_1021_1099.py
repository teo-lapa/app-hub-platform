"""
VERIFICA SALDI KONTI 1021 (Banca in transito) e 1099 (Girokonti)
Analisi completa per chiusura 2024
"""

import xmlrpc.client
from datetime import datetime
import json

# CONFIGURAZIONE ODOO
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

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

def analyze_account(uid, models, account_code, account_name):
    """Analizza un singolo account"""

    print(f"\n{'='*80}")
    print(f"ANALISI KONTO {account_code} - {account_name}")
    print(f"{'='*80}")

    # Trova l'account
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id', 'name', 'code', 'current_balance']}
    )

    if not accounts:
        print(f"[!] Account {account_code} non trovato!")
        return None

    account = accounts[0]
    account_id = account['id']
    current_balance = account['current_balance']

    print(f"\nAccount ID: {account_id}")
    print(f"Nome: {account['name']}")
    print(f"Saldo corrente: CHF {current_balance:,.2f}")

    # Fetch tutti i movimenti
    all_lines = []
    offset = 0
    batch_size = 1000

    while True:
        batch = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move.line', 'search_read',
            [[['account_id', '=', account_id]]],
            {
                'fields': ['id', 'move_id', 'date', 'name', 'debit', 'credit',
                          'journal_id', 'ref', 'move_name', 'reconciled',
                          'full_reconcile_id', 'partner_id'],
                'limit': batch_size,
                'offset': offset,
                'order': 'date asc'
            }
        )

        if not batch:
            break

        all_lines.extend(batch)
        offset += batch_size

    print(f"\nTotale movimenti: {len(all_lines)}")

    # Calcola statistiche
    total_debit = sum(line['debit'] for line in all_lines)
    total_credit = sum(line['credit'] for line in all_lines)
    balance = total_debit - total_credit

    # Movimenti riconciliati vs non riconciliati
    reconciled = [l for l in all_lines if l['reconciled']]
    unreconciled = [l for l in all_lines if not l['reconciled']]

    print(f"\nDARE totale:       CHF {total_debit:,.2f}")
    print(f"AVERE totale:      CHF {total_credit:,.2f}")
    print(f"SALDO CALCOLATO:   CHF {balance:,.2f}")
    print(f"\nMovimenti riconciliati:     {len(reconciled)}")
    print(f"Movimenti NON riconciliati: {len(unreconciled)}")

    # Analizza movimenti non riconciliati
    if unreconciled:
        print(f"\n{'='*80}")
        print(f"MOVIMENTI NON RICONCILIATI (primi 20):")
        print(f"{'='*80}")

        unreconciled_sorted = sorted(unreconciled, key=lambda x: abs(x['debit'] - x['credit']), reverse=True)[:20]

        for idx, line in enumerate(unreconciled_sorted, 1):
            journal_name = line['journal_id'][1] if line['journal_id'] else 'N/A'
            date = line['date']
            description = line['name'][:60]
            amount = line['debit'] if line['debit'] > 0 else -line['credit']
            move_id = line['move_id'][0] if line['move_id'] else 'N/A'

            print(f"\n{idx}. Move ID {move_id} | {date}")
            print(f"   Journal: {journal_name}")
            print(f"   {description}")
            print(f"   Importo: CHF {amount:+,.2f}")

    # Raggruppa per anno
    by_year = {}
    for line in all_lines:
        year = line['date'][:4]
        if year not in by_year:
            by_year[year] = {'count': 0, 'debit': 0, 'credit': 0, 'lines': []}

        by_year[year]['count'] += 1
        by_year[year]['debit'] += line['debit']
        by_year[year]['credit'] += line['credit']
        by_year[year]['lines'].append(line)

    print(f"\n{'='*80}")
    print(f"RAGGRUPPAMENTO PER ANNO:")
    print(f"{'='*80}")

    for year in sorted(by_year.keys()):
        data = by_year[year]
        net = data['debit'] - data['credit']
        print(f"\n{year}:")
        print(f"  Movimenti: {data['count']}")
        print(f"  DARE:  CHF {data['debit']:,.2f}")
        print(f"  AVERE: CHF {data['credit']:,.2f}")
        print(f"  NETTO: CHF {net:+,.2f}")

    # Raggruppa per journal
    by_journal = {}
    for line in all_lines:
        journal_name = line['journal_id'][1] if line['journal_id'] else 'Unknown'
        if journal_name not in by_journal:
            by_journal[journal_name] = {'count': 0, 'debit': 0, 'credit': 0}

        by_journal[journal_name]['count'] += 1
        by_journal[journal_name]['debit'] += line['debit']
        by_journal[journal_name]['credit'] += line['credit']

    print(f"\n{'='*80}")
    print(f"RAGGRUPPAMENTO PER JOURNAL:")
    print(f"{'='*80}")

    for journal, data in sorted(by_journal.items(), key=lambda x: abs(x[1]['debit'] - x[1]['credit']), reverse=True)[:10]:
        net = data['debit'] - data['credit']
        print(f"\n{journal}:")
        print(f"  Movimenti: {data['count']}")
        print(f"  NETTO: CHF {net:+,.2f}")

    return {
        'account_id': account_id,
        'account_code': account_code,
        'account_name': account['name'],
        'current_balance': current_balance,
        'calculated_balance': balance,
        'total_movements': len(all_lines),
        'reconciled_movements': len(reconciled),
        'unreconciled_movements': len(unreconciled),
        'total_debit': total_debit,
        'total_credit': total_credit,
        'by_year': {year: {'count': data['count'], 'net': data['debit'] - data['credit']} for year, data in by_year.items()},
        'unreconciled_lines': unreconciled
    }

def main():
    """Funzione principale"""
    print(f"\n{'='*80}")
    print(f"VERIFICA KONTI 1021 e 1099")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}")

    uid, models = connect_odoo()
    if not uid or not models:
        print("\n[X] Impossibile connettersi a Odoo")
        return

    # Analizza 1021
    result_1021 = analyze_account(uid, models, '1021', 'Banca in transito')

    # Analizza 1099
    result_1099 = analyze_account(uid, models, '1099', 'Girokonti')

    # Verifica anche 10901 per completezza
    result_10901 = analyze_account(uid, models, '10901', 'Liquiditätstransfer')

    # Verifica 1001 Cash
    result_1001 = analyze_account(uid, models, '1001', 'Cash')

    # Riepilogo finale
    print(f"\n{'='*80}")
    print(f"RIEPILOGO FINALE")
    print(f"{'='*80}")

    results = [
        ('10901', result_10901),
        ('1021', result_1021),
        ('1099', result_1099),
        ('1001', result_1001)
    ]

    for code, result in results:
        if result:
            status = "OK" if abs(result['current_balance']) < 0.01 else "DA CHIUDERE"
            symbol = "[OK]" if status == "OK" else "[!!]"
            print(f"\n{symbol} Konto {code}: CHF {result['current_balance']:,.2f} [{status}]")
            if result['unreconciled_movements'] > 0:
                print(f"  -> {result['unreconciled_movements']} movimenti non riconciliati")

    # Salva report JSON
    report = {
        'timestamp': datetime.now().isoformat(),
        'accounts': {
            '10901': result_10901,
            '1021': result_1021,
            '1099': result_1099,
            '1001': result_1001
        }
    }

    # Rimuovi le linee dettagliate dal JSON (troppo grande)
    for acc in report['accounts'].values():
        if acc and 'unreconciled_lines' in acc:
            acc['unreconciled_sample'] = acc['unreconciled_lines'][:10]  # Solo primi 10
            del acc['unreconciled_lines']

    filename = f"konti-transfer-analysis-{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Report salvato in: {filename}")

    print(f"\n{'='*80}")
    print(f"PROSSIMI STEP:")
    print(f"{'='*80}")

    if result_10901 and abs(result_10901['current_balance']) > 0.01:
        print("1. Chiudere konto 10901 con script allinea_konto_10901_FINALE.py")

    if result_1021 and abs(result_1021['current_balance']) > 0.01:
        print("2. Riconciliare konto 1021 con bank statements")
        print("   - Verificare movimenti non riconciliati")
        print("   - Matchare con transazioni bancarie")

    if result_1099 and abs(result_1099['current_balance']) > 0.01:
        print("3. Analizzare e chiudere konto 1099")

    if all(r and abs(r['current_balance']) < 0.01 for _, r in results[:3]):
        print("\n[OK] Tutti i konti di trasferimento sono GIÀ a CHF 0.00!")
        print("Nessuna azione necessaria.")

    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()
