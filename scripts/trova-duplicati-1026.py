#!/usr/bin/env python3
"""
TROVA DUPLICATI KONTO 1026 - Credit Suisse
Analizza tutte le righe del 2024 per trovare duplicati
"""

import os
import sys
import json
import xmlrpc.client
from collections import defaultdict
from datetime import datetime

# Configurazione Odoo
ODOO_URL = os.getenv('ODOO_URL', 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com')
ODOO_DB = os.getenv('ODOO_DB', 'lapadevadmin-lapa-v2-main-7268478')
ODOO_USERNAME = os.getenv('ODOO_ADMIN_EMAIL', 'apphubplatform@lapa.ch')
ODOO_PASSWORD = os.getenv('ODOO_ADMIN_PASSWORD', 'apphubplatform2025')

def connect_odoo():
    """Connessione a Odoo"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    if not uid:
        raise Exception('Autenticazione fallita')
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return models, uid

def get_account_id(models, uid, code='1026'):
    """Ottieni ID account"""
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', code]]],
        {'fields': ['id', 'code', 'name']}
    )
    if not accounts:
        raise Exception(f'Account {code} non trovato')
    return accounts[0]

def get_all_lines_2024(models, uid, account_id):
    """Ottieni tutte le righe 2024"""
    print(f"\nEstrazione tutte le righe 2024 per account {account_id}...")

    domain = [
        ['account_id', '=', account_id],
        ['date', '>=', '2024-01-01'],
        ['date', '<=', '2024-12-31'],
        ['parent_state', '=', 'posted']
    ]

    fields = [
        'id',
        'date',
        'move_id',
        'name',
        'ref',
        'debit',
        'credit',
        'balance',
        'partner_id'
    ]

    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [domain],
        {'fields': fields, 'order': 'date asc, id asc'}
    )

    print(f"Trovate {len(lines)} righe")
    return lines

def find_duplicates(lines):
    """Trova duplicati per chiave (data, descrizione, importo)"""
    print("\nAnalisi duplicati...")

    # Raggruppa per chiave
    by_key = defaultdict(list)

    for line in lines:
        # Chiave: data + name + debit + credit
        key = (
            line['date'],
            (line['name'] or '').strip(),
            line['debit'],
            line['credit']
        )
        by_key[key].append(line)

    # Trova gruppi con piu di una riga
    duplicates = {k: v for k, v in by_key.items() if len(v) > 1}

    print(f"Trovati {len(duplicates)} gruppi di duplicati")

    return duplicates

def analyze_duplicates(duplicates):
    """Analizza duplicati in dettaglio"""
    total_duplicates = 0
    total_amount_duplicated = 0.0

    duplicate_list = []

    for key, group in sorted(duplicates.items(), key=lambda x: len(x[1]), reverse=True):
        date, name, debit, credit = key
        num_copies = len(group)
        total_duplicates += num_copies - 1  # -1 perche uno e l'originale

        # Importo duplicato (num_copies - 1 volte)
        amount = debit if debit > 0 else credit
        duplicated_amount = amount * (num_copies - 1)
        total_amount_duplicated += duplicated_amount

        duplicate_list.append({
            'date': date,
            'name': name,
            'debit': debit,
            'credit': credit,
            'num_copies': num_copies,
            'amount': amount,
            'duplicated_amount': duplicated_amount,
            'line_ids': [l['id'] for l in group],
            'move_ids': [l['move_id'][0] if l['move_id'] else None for l in group]
        })

    return {
        'total_duplicate_groups': len(duplicates),
        'total_duplicate_lines': total_duplicates,
        'total_amount_duplicated': total_amount_duplicated,
        'duplicates': duplicate_list
    }

def print_report(analysis):
    """Stampa report"""
    print("\n" + "=" * 80)
    print("ANALISI DUPLICATI KONTO 1026 - CREDIT SUISSE")
    print("=" * 80)

    print(f"\nGruppi di duplicati trovati:  {analysis['total_duplicate_groups']}")
    print(f"Righe duplicate (da eliminare): {analysis['total_duplicate_lines']}")
    print(f"Importo totale duplicato:       CHF {analysis['total_amount_duplicated']:,.2f}")

    print("\n" + "=" * 80)
    print("TOP 20 DUPLICATI PIU SIGNIFICATIVI")
    print("=" * 80)
    print(f"{'Data':<12} {'Descrizione':<40} {'Importo':>15} {'Copie':>8} {'Totale Dup':>15}")
    print("-" * 80)

    for dup in sorted(analysis['duplicates'], key=lambda x: x['duplicated_amount'], reverse=True)[:20]:
        amount = dup['debit'] if dup['debit'] > 0 else dup['credit']
        sign = 'D' if dup['debit'] > 0 else 'A'
        print(f"{dup['date']:<12} {dup['name'][:40]:<40} {sign} {amount:>13,.2f} {dup['num_copies']:>8} {dup['duplicated_amount']:>15,.2f}")

    print("\n" + "=" * 80)

def generate_delete_script(analysis, account_info):
    """Genera script per eliminare duplicati"""
    print("\n" + "=" * 80)
    print("GENERAZIONE SCRIPT ELIMINAZIONE DUPLICATI")
    print("=" * 80)

    script_lines = []
    script_lines.append("#!/usr/bin/env python3")
    script_lines.append('"""')
    script_lines.append("ELIMINA DUPLICATI KONTO 1026 - Credit Suisse")
    script_lines.append("ATTENZIONE: Questo script elimina righe da Odoo!")
    script_lines.append("Eseguire SOLO dopo verifica manuale dei duplicati")
    script_lines.append('"""')
    script_lines.append("")
    script_lines.append("import os")
    script_lines.append("import xmlrpc.client")
    script_lines.append("")
    script_lines.append(f"ODOO_URL = '{ODOO_URL}'")
    script_lines.append(f"ODOO_DB = '{ODOO_DB}'")
    script_lines.append(f"ODOO_USERNAME = '{ODOO_USERNAME}'")
    script_lines.append(f"ODOO_PASSWORD = '{ODOO_PASSWORD}'")
    script_lines.append("")
    script_lines.append("def connect_odoo():")
    script_lines.append("    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')")
    script_lines.append("    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})")
    script_lines.append("    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')")
    script_lines.append("    return models, uid")
    script_lines.append("")
    script_lines.append("def main():")
    script_lines.append("    print('Connessione a Odoo...')")
    script_lines.append("    models, uid = connect_odoo()")
    script_lines.append("    print('Connesso!')")
    script_lines.append("")
    script_lines.append(f"    # Duplicati identificati: {analysis['total_duplicate_lines']} righe")
    script_lines.append(f"    # Importo duplicato: CHF {analysis['total_amount_duplicated']:,.2f}")
    script_lines.append("")
    script_lines.append("    # Lista line_ids da eliminare (tenendo la prima di ogni gruppo)")
    script_lines.append("    lines_to_delete = [")

    for dup in analysis['duplicates']:
        # Per ogni gruppo, elimina tutte tranne la prima
        line_ids_to_delete = dup['line_ids'][1:]  # Skip first, delete rest
        for line_id in line_ids_to_delete:
            script_lines.append(f"        {line_id},  # {dup['date']} - {dup['name'][:30]}")

    script_lines.append("    ]")
    script_lines.append("")
    script_lines.append(f"    print(f'Righe da eliminare: {{len(lines_to_delete)}}')")
    script_lines.append("    print('ATTENZIONE: Questa operazione NON e reversibile!')")
    script_lines.append("    confirm = input('Digitare SI per confermare eliminazione: ')")
    script_lines.append("")
    script_lines.append("    if confirm != 'SI':")
    script_lines.append("        print('Operazione annullata')")
    script_lines.append("        return")
    script_lines.append("")
    script_lines.append("    print('Eliminazione in corso...')")
    script_lines.append("    for i, line_id in enumerate(lines_to_delete, 1):")
    script_lines.append("        try:")
    script_lines.append("            # Prima unlink la move line")
    script_lines.append("            models.execute_kw(")
    script_lines.append("                ODOO_DB, uid, ODOO_PASSWORD,")
    script_lines.append("                'account.move.line', 'unlink',")
    script_lines.append("                [[line_id]]")
    script_lines.append("            )")
    script_lines.append("            if i % 10 == 0:")
    script_lines.append("                print(f'Eliminate {i}/{len(lines_to_delete)} righe...')")
    script_lines.append("        except Exception as e:")
    script_lines.append("            print(f'ERRORE eliminando line_id {line_id}: {e}')")
    script_lines.append("")
    script_lines.append("    print('Eliminazione completata!')")
    script_lines.append("")
    script_lines.append("if __name__ == '__main__':")
    script_lines.append("    main()")

    script_path = 'c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\scripts\\elimina-duplicati-1026.py'
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(script_lines))

    print(f"Script generato: {script_path}")
    print(f"Righe da eliminare: {analysis['total_duplicate_lines']}")
    print(f"Importo che verra corretto: CHF {analysis['total_amount_duplicated']:,.2f}")

def main():
    print("=" * 80)
    print("TROVA DUPLICATI KONTO 1026 - CREDIT SUISSE")
    print("=" * 80)

    # Connetti
    models, uid = connect_odoo()
    print(f"Connesso a Odoo: {ODOO_USERNAME}")

    # Ottieni account
    account = get_account_id(models, uid, '1026')
    print(f"Account: {account['code']} - {account['name']}")

    # Estrai tutte le righe 2024
    lines = get_all_lines_2024(models, uid, account['id'])

    # Trova duplicati
    duplicates = find_duplicates(lines)

    # Analizza duplicati
    analysis = analyze_duplicates(duplicates)

    # Stampa report
    print_report(analysis)

    # Salva JSON
    output_file = 'c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\DUPLICATI-1026-ANALISI.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)

    print(f"\nAnalisi salvata: {output_file}")

    # Genera script eliminazione
    generate_delete_script(analysis, account)

    print("\n" + "=" * 80)
    print("PROSSIMI STEP:")
    print("=" * 80)
    print("1. Verifica manualmente il file DUPLICATI-1026-ANALISI.json")
    print("2. Se i duplicati sono corretti, esegui:")
    print("   python scripts/elimina-duplicati-1026.py")
    print("3. Dopo eliminazione, riverifica saldo con:")
    print("   python scripts/analizza-dicembre-2024-dettaglio.py")
    print("=" * 80)

if __name__ == '__main__':
    main()
