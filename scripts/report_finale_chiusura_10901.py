"""
REPORT FINALE CHIUSURA KONTO 10901
Analisi completa delle riclassificazioni eseguite
"""

import xmlrpc.client
from datetime import datetime
import json

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
        return uid, models
    except Exception as e:
        print(f"[ERRORE] Connessione: {e}")
        return None, None

def analyze_reclassifications(uid, models):
    """Analizza tutte le riclassificazioni eseguite"""

    print(f"\n{'='*80}")
    print(f"ANALISI RICLASSIFICAZIONI KONTO 10901")
    print(f"{'='*80}")

    # Cerca tutte le riclassifiche (ref contiene 'RICLASS')
    riclass_moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'search_read',
        [[['ref', 'ilike', 'RICLASS']]],
        {
            'fields': ['id', 'name', 'ref', 'date', 'journal_id', 'state', 'line_ids'],
            'order': 'date asc'
        }
    )

    print(f"\nTrovate {len(riclass_moves)} registrazioni di riclassifica")

    # Categorizza per tipo
    categories = {
        'CASH': [],
        'BANK': [],
        'FX': [],
        'CREDITCARD': [],
        'OTHER': []
    }

    total_amounts = {
        'CASH': 0,
        'BANK': 0,
        'FX': 0,
        'CREDITCARD': 0,
        'OTHER': 0
    }

    for move in riclass_moves:
        ref = move.get('ref', '')

        if 'CASH' in ref:
            category = 'CASH'
        elif 'BANK' in ref:
            category = 'BANK'
        elif 'FX' in ref:
            category = 'FX'
        elif 'CREDITCARD' in ref or 'CC' in ref:
            category = 'CREDITCARD'
        else:
            category = 'OTHER'

        # Fetch line details
        line_ids = move.get('line_ids', [])
        if line_ids:
            lines = models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move.line', 'read',
                [line_ids],
                {'fields': ['account_id', 'name', 'debit', 'credit']}
            )

            # Trova l'importo dalla line Konto 10901
            for line in lines:
                if line['account_id'][0] == KONTO_10901:
                    amount = line['debit'] if line['debit'] > 0 else -line['credit']
                    total_amounts[category] += abs(amount)
                    break

        categories[category].append({
            'move_id': move['id'],
            'name': move['name'],
            'ref': ref,
            'date': move['date'],
            'state': move['state']
        })

    # Report per categoria
    print(f"\n{'='*80}")
    print("RICLASSIFICAZIONI PER CATEGORIA:")
    print(f"{'='*80}")

    for cat_name, cat_moves in categories.items():
        if cat_moves:
            print(f"\n{cat_name}:")
            print(f"  Numero registrazioni: {len(cat_moves)}")
            print(f"  Importo totale: CHF {total_amounts[cat_name]:,.2f}")
            print(f"  Move IDs: {[m['move_id'] for m in cat_moves]}")

    return riclass_moves, categories, total_amounts

def find_closure_move(uid, models):
    """Trova la registrazione di chiusura finale"""

    print(f"\n{'='*80}")
    print("RICERCA REGISTRAZIONE CHIUSURA FINALE")
    print(f"{'='*80}")

    # Cerca move con ref 'CHIUSURA-KONTO-10901'
    closure_moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'search_read',
        [[['ref', 'ilike', 'CHIUSURA-KONTO-10901']]],
        {
            'fields': ['id', 'name', 'ref', 'date', 'journal_id', 'state', 'line_ids'],
            'order': 'date desc',
            'limit': 1
        }
    )

    if not closure_moves:
        # Cerca per descrizione
        print("Ricerca per descrizione alternativa...")
        closure_moves = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', KONTO_10901],
                ['name', 'ilike', 'Chiusura finale']
            ]],
            {
                'fields': ['id', 'move_id', 'name', 'date', 'debit', 'credit'],
                'order': 'date desc',
                'limit': 1
            }
        )

        if closure_moves:
            move_id = closure_moves[0]['move_id'][0]
            closure_move = models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move', 'read',
                [[move_id]],
                {'fields': ['id', 'name', 'ref', 'date', 'journal_id', 'state', 'line_ids']}
            )[0]

            amount = closure_moves[0]['debit'] if closure_moves[0]['debit'] > 0 else closure_moves[0]['credit']

            print(f"\n[OK] Trovata registrazione di chiusura:")
            print(f"  Move ID: {closure_move['id']}")
            print(f"  Move Name: {closure_move['name']}")
            print(f"  Data: {closure_move['date']}")
            print(f"  Importo: CHF {amount:,.2f}")
            print(f"  Stato: {closure_move['state']}")

            return closure_move, amount

    elif closure_moves:
        closure_move = closure_moves[0]

        # Fetch lines per trovare importo
        line_ids = closure_move.get('line_ids', [])
        lines = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move.line', 'read',
            [line_ids],
            {'fields': ['account_id', 'debit', 'credit']}
        )

        amount = 0
        for line in lines:
            if line['account_id'][0] == KONTO_10901:
                amount = line['debit'] if line['debit'] > 0 else line['credit']
                break

        print(f"\n[OK] Trovata registrazione di chiusura:")
        print(f"  Move ID: {closure_move['id']}")
        print(f"  Move Name: {closure_move['name']}")
        print(f"  Data: {closure_move['date']}")
        print(f"  Importo: CHF {amount:,.2f}")
        print(f"  Stato: {closure_move['state']}")

        return closure_move, amount

    print("[!] Nessuna registrazione di chiusura trovata")
    return None, 0

def verify_final_balance(uid, models):
    """Verifica saldo finale"""

    print(f"\n{'='*80}")
    print("VERIFICA SALDO FINALE")
    print(f"{'='*80}")

    all_lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[['account_id', '=', KONTO_10901]]],
        {'fields': ['debit', 'credit']}
    )

    total_debit = sum(line['debit'] for line in all_lines)
    total_credit = sum(line['credit'] for line in all_lines)
    balance = total_debit - total_credit

    print(f"\nDARE totale:   CHF {total_debit:,.2f}")
    print(f"AVERE totale:  CHF {total_credit:,.2f}")
    print(f"{'='*80}")
    print(f"SALDO FINALE:  CHF {balance:,.2f}")
    print(f"{'='*80}")

    if abs(balance) < 0.01:
        print("\n[OK][OK][OK] OBIETTIVO RAGGIUNTO!")
        print("Konto 10901 è stato portato a CHF 0.00")
    else:
        print(f"\n[!] ATTENZIONE: Saldo residuo di CHF {balance:,.2f}")

    return balance

def generate_summary_report(riclass_moves, categories, total_amounts, closure_move, closure_amount, final_balance):
    """Genera report finale riepilogativo"""

    report = {
        'data_report': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'konto_10901': {
            'saldo_finale': round(final_balance, 2),
            'status': 'CHIUSO' if abs(final_balance) < 0.01 else 'APERTO'
        },
        'riclassificazioni': {
            'totale_registrazioni': len(riclass_moves),
            'per_categoria': {
                cat: {
                    'numero': len(moves),
                    'importo': round(total_amounts[cat], 2),
                    'move_ids': [m['move_id'] for m in moves]
                }
                for cat, moves in categories.items() if moves
            }
        },
        'chiusura_finale': {
            'move_id': closure_move['id'] if closure_move else None,
            'move_name': closure_move['name'] if closure_move else None,
            'data': closure_move['date'] if closure_move else None,
            'importo': round(closure_amount, 2) if closure_amount else 0,
            'stato': closure_move['state'] if closure_move else None
        }
    }

    # Salva JSON
    json_filename = f"report_finale_chiusura_10901_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Report JSON salvato: {json_filename}")

    # Salva TXT leggibile
    txt_filename = f"report_finale_chiusura_10901_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

    with open(txt_filename, 'w', encoding='utf-8') as f:
        f.write("="*80 + "\n")
        f.write("REPORT FINALE CHIUSURA KONTO 10901\n")
        f.write("="*80 + "\n\n")
        f.write(f"Data report: {report['data_report']}\n")
        f.write(f"Saldo finale Konto 10901: CHF {report['konto_10901']['saldo_finale']:,.2f}\n")
        f.write(f"Status: {report['konto_10901']['status']}\n\n")

        f.write("="*80 + "\n")
        f.write("RICLASSIFICAZIONI ESEGUITE\n")
        f.write("="*80 + "\n\n")

        for cat, data in report['riclassificazioni']['per_categoria'].items():
            f.write(f"{cat}:\n")
            f.write(f"  Numero registrazioni: {data['numero']}\n")
            f.write(f"  Importo totale: CHF {data['importo']:,.2f}\n")
            f.write(f"  Move IDs: {data['move_ids']}\n\n")

        f.write("="*80 + "\n")
        f.write("CHIUSURA FINALE\n")
        f.write("="*80 + "\n\n")

        if closure_move:
            f.write(f"Move ID: {report['chiusura_finale']['move_id']}\n")
            f.write(f"Move Name: {report['chiusura_finale']['move_name']}\n")
            f.write(f"Data: {report['chiusura_finale']['data']}\n")
            f.write(f"Importo: CHF {report['chiusura_finale']['importo']:,.2f}\n")
            f.write(f"Stato: {report['chiusura_finale']['stato']}\n")
        else:
            f.write("Nessuna registrazione di chiusura trovata\n")

        f.write("\n" + "="*80 + "\n")
        if abs(final_balance) < 0.01:
            f.write("RISULTATO: SUCCESSO - Konto 10901 portato a CHF 0.00\n")
        else:
            f.write(f"RISULTATO: INCOMPLETO - Saldo residuo CHF {final_balance:,.2f}\n")
        f.write("="*80 + "\n")

    print(f"[OK] Report TXT salvato: {txt_filename}")

    return json_filename, txt_filename

def main():
    """Funzione principale"""

    print("\n" + "="*80)
    print("REPORT FINALE CHIUSURA KONTO 10901")
    print("="*80)

    uid, models = connect_odoo()
    if not uid or not models:
        return

    # 1. Analizza riclassificazioni
    riclass_moves, categories, total_amounts = analyze_reclassifications(uid, models)

    # 2. Trova chiusura finale
    closure_move, closure_amount = find_closure_move(uid, models)

    # 3. Verifica saldo finale
    final_balance = verify_final_balance(uid, models)

    # 4. Genera report
    json_file, txt_file = generate_summary_report(
        riclass_moves, categories, total_amounts,
        closure_move, closure_amount, final_balance
    )

    print("\n" + "="*80)
    print("REPORT COMPLETATO")
    print("="*80)
    print(f"Files generati:")
    print(f"  - {json_file}")
    print(f"  - {txt_file}")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
