"""
VERIFICA SALDO PRECISO KONTO 10901
Prima di procedere con la chiusura finale
"""

import xmlrpc.client
from datetime import datetime

# CONFIGURAZIONE ODOO
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

KONTO_10901 = 1

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

def get_detailed_balance(uid, models, account_id):
    """Calcola saldo dettagliato con analisi movimenti"""

    print(f"\n{'='*80}")
    print(f"ANALISI SALDO KONTO 10901 (Account ID: {account_id})")
    print(f"{'='*80}")

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
                          'journal_id', 'ref', 'move_name'],
                'limit': batch_size,
                'offset': offset,
                'order': 'date asc'
            }
        )

        if not batch:
            break

        all_lines.extend(batch)
        offset += batch_size

    print(f"\nTotale movimenti trovati: {len(all_lines)}")

    # Calcola saldo
    total_debit = sum(line['debit'] for line in all_lines)
    total_credit = sum(line['credit'] for line in all_lines)
    balance = total_debit - total_credit

    print(f"\nDARE totale:   CHF {total_debit:,.2f}")
    print(f"AVERE totale:  CHF {total_credit:,.2f}")
    print(f"{'='*80}")
    print(f"SALDO NETTO:   CHF {balance:,.2f}")
    print(f"{'='*80}")

    # Analizza ultimi 20 movimenti
    print(f"\n{'='*80}")
    print(f"ULTIMI 20 MOVIMENTI:")
    print(f"{'='*80}")

    recent_lines = sorted(all_lines, key=lambda x: x['date'], reverse=True)[:20]

    for idx, line in enumerate(recent_lines, 1):
        journal_name = line['journal_id'][1] if line['journal_id'] else 'N/A'
        date = line['date']
        description = line['name'][:60]
        debit = line['debit']
        credit = line['credit']
        move_id = line['move_id'][0] if line['move_id'] else 'N/A'

        amount = debit if debit > 0 else -credit

        print(f"\n{idx}. Move ID {move_id} | {date}")
        print(f"   Journal: {journal_name}")
        print(f"   {description}")
        print(f"   Importo: CHF {amount:+,.2f}")

    # Raggruppa per tipo (in base al journal o description)
    print(f"\n{'='*80}")
    print(f"RAGGRUPPAMENTO PER TIPO:")
    print(f"{'='*80}")

    categories = {}

    for line in all_lines:
        journal_name = line['journal_id'][1] if line['journal_id'] else 'Unknown'
        description = line['name'].lower()

        # Determina categoria
        if 'cash deposit' in description or 'deposito contante' in description:
            category = 'Cash Deposits'
        elif 'bank transfer' in description or 'bonifico' in description:
            category = 'Bank Transfers'
        elif 'currency' in description or 'cambio' in description or 'fx' in description:
            category = 'FX Operations'
        elif 'credit card' in description or 'carta' in description:
            category = 'Credit Card'
        elif 'riclass' in description:
            category = 'Riclassifiche'
        else:
            category = 'Altri'

        if category not in categories:
            categories[category] = {
                'count': 0,
                'total_debit': 0,
                'total_credit': 0,
                'lines': []
            }

        categories[category]['count'] += 1
        categories[category]['total_debit'] += line['debit']
        categories[category]['total_credit'] += line['credit']
        categories[category]['lines'].append(line)

    for category, data in sorted(categories.items()):
        net = data['total_debit'] - data['total_credit']
        print(f"\n{category}:")
        print(f"  Movimenti: {data['count']}")
        print(f"  DARE:  CHF {data['total_debit']:,.2f}")
        print(f"  AVERE: CHF {data['total_credit']:,.2f}")
        print(f"  NETTO: CHF {net:+,.2f}")

    return balance, all_lines, categories

def main():
    """Funzione principale"""
    print(f"\n{'='*80}")
    print(f"VERIFICA SALDO PRECISO KONTO 10901")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}")

    uid, models = connect_odoo()
    if not uid or not models:
        print("\n[X] Impossibile connettersi a Odoo")
        return

    balance, all_lines, categories = get_detailed_balance(uid, models, KONTO_10901)

    print(f"\n{'='*80}")
    print(f"CONCLUSIONE:")
    print(f"{'='*80}")
    print(f"Saldo attuale Konto 10901: CHF {balance:,.2f}")

    if abs(balance) < 0.01:
        print("[OK] Il saldo è già a CHF 0.00!")
    elif abs(balance) < 100:
        print(f"[!] Saldo piccolo (< CHF 100) - Probabilmente differenze arrotondamento")
    else:
        print(f"[!] Saldo significativo - Richiede riclassificazioni")

    print(f"\nProssimi step:")
    if abs(balance) > 0.01:
        print("1. Eseguire riclassificazioni con allinea_konto_10901_FINALE.py")
        print("2. Verificare saldo finale = CHF 0.00")
    else:
        print("Nessuna azione necessaria - Konto 10901 già allineato")

    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()
