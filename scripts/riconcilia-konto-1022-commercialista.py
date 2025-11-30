#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RICONCILIAZIONE KONTO 1022 - OUTSTANDING RECEIPTS
Commercialista Svizzero - Approccio sistematico riga per riga
"""

import sys
import io
import xmlrpc.client
from datetime import datetime
from collections import defaultdict
import json

# Fix encoding per Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "lapa201180"

def connect_odoo():
    """Connessione a Odoo"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def get_account_id(models, uid, code):
    """Ottieni ID account da codice"""
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.account', 'search',
        [[['code', '=', code]]]
    )
    return account_ids[0] if account_ids else None

def get_unreconciled_lines(models, uid, account_id):
    """Estrai tutte le righe non riconciliate del konto 1022"""
    print(f"\n{'='*80}")
    print(f"ESTRAZIONE RIGHE NON RICONCILIATE - KONTO 1022")
    print(f"{'='*80}\n")

    # Cerca righe non riconciliate
    line_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_id],
            ['reconciled', '=', False],
            ['parent_state', '=', 'posted']  # Solo movimenti confermati
        ]]
    )

    if not line_ids:
        print("✓ Nessuna riga non riconciliata trovata - Konto già riconciliato!")
        return []

    # Leggi dettagli completi
    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'read',
        [line_ids],
        {
            'fields': [
                'id', 'name', 'ref', 'date', 'move_id', 'move_name',
                'debit', 'credit', 'balance', 'amount_currency',
                'partner_id', 'account_id', 'journal_id',
                'reconciled', 'full_reconcile_id', 'matching_number'
            ]
        }
    )

    print(f"Trovate {len(lines)} righe non riconciliate\n")

    # Calcola saldo
    total_debit = sum(line['debit'] for line in lines)
    total_credit = sum(line['credit'] for line in lines)
    balance = total_debit - total_credit

    print(f"SALDO KONTO 1022:")
    print(f"  Dare:   CHF {total_debit:,.2f}")
    print(f"  Avere:  CHF {total_credit:,.2f}")
    print(f"  Saldo:  CHF {balance:,.2f}")
    print(f"{'-'*80}\n")

    return lines

def find_matching_line(models, uid, line, all_accounts=False):
    """
    Trova movimento opposto per una riga
    - Stessa data (±3 giorni)
    - Importo opposto (debit vs credit)
    - Stesso partner (se presente)
    """
    from datetime import datetime, timedelta

    # Importo da cercare (segno opposto)
    target_debit = line['credit'] if line['credit'] > 0 else 0
    target_credit = line['debit'] if line['debit'] > 0 else 0

    # Range date (±3 giorni)
    line_date = datetime.strptime(line['date'], '%Y-%m-%d')
    date_from = (line_date - timedelta(days=3)).strftime('%Y-%m-%d')
    date_to = (line_date + timedelta(days=3)).strftime('%Y-%m-%d')

    # Domain base
    domain = [
        ['reconciled', '=', False],
        ['parent_state', '=', 'posted'],
        ['date', '>=', date_from],
        ['date', '<=', date_to],
        ['id', '!=', line['id']],  # Escludi la riga stessa
    ]

    # Se non cerchiamo in tutti i conti, escludi 1022
    if not all_accounts:
        domain.append(['account_id', '!=', line['account_id'][0]])

    # Aggiungi partner se presente
    if line['partner_id']:
        domain.append(['partner_id', '=', line['partner_id'][0]])

    # Cerca movimento opposto
    if target_debit > 0:
        domain.append(['debit', '=', target_debit])
    elif target_credit > 0:
        domain.append(['credit', '=', target_credit])

    match_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'search',
        [domain],
        {'limit': 1}
    )

    if not match_ids:
        return None

    # Leggi dettagli match
    matches = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'read',
        [match_ids],
        {
            'fields': [
                'id', 'name', 'ref', 'date', 'move_name',
                'debit', 'credit', 'account_id', 'partner_id'
            ]
        }
    )

    return matches[0] if matches else None

def reconcile_lines(models, uid, line_ids):
    """Riconcilia un set di righe usando API Odoo"""
    try:
        # Usa il metodo reconcile su account.move.line
        result = models.execute_kw(
            ODOO_DB, uid, ODOO_PASS,
            'account.move.line', 'reconcile',
            [line_ids],
            {}
        )
        return True, result
    except Exception as e:
        return False, str(e)

def main():
    """Main riconciliazione"""
    print("\n" + "="*80)
    print("RICONCILIAZIONE SISTEMATICA KONTO 1022 - OUTSTANDING RECEIPTS")
    print("Commercialista Svizzero - Approccio riga per riga")
    print("="*80 + "\n")

    # Connessione
    print("Connessione a Odoo...")
    uid, models = connect_odoo()
    print(f"✓ Connesso come UID: {uid}\n")

    # Get account ID
    account_1022_id = get_account_id(models, uid, '1022')
    if not account_1022_id:
        print("✗ ERRORE: Konto 1022 non trovato!")
        return

    print(f"✓ Konto 1022 ID: {account_1022_id}\n")

    # Estrai righe non riconciliate
    unreconciled = get_unreconciled_lines(models, uid, account_1022_id)

    if not unreconciled:
        return

    # Statistiche
    stats = {
        'total': len(unreconciled),
        'reconciled': 0,
        'not_found': 0,
        'errors': 0
    }

    not_reconciled = []

    print(f"\n{'='*80}")
    print("INIZIO RICONCILIAZIONE RIGA PER RIGA")
    print(f"{'='*80}\n")

    # Processa ogni riga
    for idx, line in enumerate(unreconciled, 1):
        print(f"\n[{idx}/{len(unreconciled)}] Riga ID {line['id']}")
        print(f"  Move: {line['move_name']}")
        print(f"  Data: {line['date']}")
        print(f"  Dare: CHF {line['debit']:,.2f} | Avere: CHF {line['credit']:,.2f}")
        print(f"  Partner: {line['partner_id'][1] if line['partner_id'] else 'N/A'}")
        print(f"  Descrizione: {line['name']}")

        # Cerca controparte
        match = find_matching_line(models, uid, line, all_accounts=True)

        if match:
            print(f"\n  ✓ MATCH TROVATO:")
            print(f"    ID: {match['id']}")
            print(f"    Move: {match['move_name']}")
            print(f"    Konto: {match['account_id'][1]}")
            print(f"    Data: {match['date']}")
            print(f"    Dare: CHF {match['debit']:,.2f} | Avere: CHF {match['credit']:,.2f}")

            # Riconcilia
            print(f"\n  → Riconciliazione in corso...")
            success, result = reconcile_lines(models, uid, [line['id'], match['id']])

            if success:
                print(f"  ✓ RICONCILIATO con successo!")
                stats['reconciled'] += 1
            else:
                print(f"  ✗ ERRORE riconciliazione: {result}")
                stats['errors'] += 1
                not_reconciled.append({
                    'line': line,
                    'match': match,
                    'reason': f"Errore API: {result}"
                })
        else:
            print(f"\n  ✗ Nessuna controparte trovata")
            stats['not_found'] += 1
            not_reconciled.append({
                'line': line,
                'match': None,
                'reason': 'Nessuna controparte trovata'
            })

        print(f"{'-'*80}")

    # REPORT FINALE
    print(f"\n\n{'='*80}")
    print("REPORT FINALE RICONCILIAZIONE KONTO 1022")
    print(f"{'='*80}\n")

    print(f"STATISTICHE:")
    print(f"  Totale righe processate:  {stats['total']}")
    print(f"  ✓ Riconciliate:           {stats['reconciled']}")
    print(f"  ✗ Non trovate:            {stats['not_found']}")
    print(f"  ⚠ Errori:                 {stats['errors']}")
    print(f"\n  Percentuale successo: {(stats['reconciled']/stats['total']*100):.1f}%")

    # Verifica saldo residuo
    print(f"\n{'-'*80}")
    print("VERIFICA SALDO RESIDUO:")
    print(f"{'-'*80}\n")

    final_unreconciled = get_unreconciled_lines(models, uid, account_1022_id)

    if final_unreconciled:
        print(f"\n⚠ ANCORA {len(final_unreconciled)} RIGHE NON RICONCILIATE\n")

        print("RIGHE RESIDUE CON SPIEGAZIONE:\n")
        for item in not_reconciled:
            line = item['line']
            print(f"  ID {line['id']} | {line['move_name']} | {line['date']}")
            print(f"    Importo: CHF {line['debit'] or -line['credit']:,.2f}")
            print(f"    Partner: {line['partner_id'][1] if line['partner_id'] else 'N/A'}")
            print(f"    Motivo: {item['reason']}")
            print(f"    Descrizione: {line['name']}")

            # Suggerimento
            if item['reason'] == 'Nessuna controparte trovata':
                print(f"    💡 SUGGERIMENTO: Verificare se è un errore contabile o serve storno")
            print()
    else:
        print("\n✓✓✓ KONTO 1022 COMPLETAMENTE RICONCILIATO! ✓✓✓")
        print("    Saldo: CHF 0.00")

    # Salva report JSON
    report = {
        'timestamp': datetime.now().isoformat(),
        'konto': '1022',
        'stats': stats,
        'not_reconciled': not_reconciled
    }

    report_file = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\report_1022_riconciliazione_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n✓ Report salvato: {report_file}")
    print(f"\n{'='*80}\n")

if __name__ == '__main__':
    main()
