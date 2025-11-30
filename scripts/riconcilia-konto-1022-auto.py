#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RICONCILIAZIONE AUTOMATICA KONTO 1022
Tenta riconciliazioni automatiche usando funzioni Odoo
"""

import sys
import io
import xmlrpc.client
from datetime import datetime
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

def try_auto_reconcile_widget(models, uid, line_id):
    """
    Usa il widget di riconciliazione automatica di Odoo
    """
    try:
        # Get suggestions from reconciliation widget
        result = models.execute_kw(
            ODOO_DB, uid, ODOO_PASS,
            'account.reconciliation.widget', 'get_bank_statement_line_data',
            [[line_id]],
            {}
        )
        return True, result
    except Exception as e:
        return False, str(e)

def try_auto_reconcile_line(models, uid, line_id):
    """
    Prova riconciliazione automatica usando action_reconcile
    """
    try:
        # Cerca righe correlate automaticamente
        result = models.execute_kw(
            ODOO_DB, uid, ODOO_PASS,
            'account.move.line', 'auto_reconcile_lines',
            [[line_id]],
            {}
        )
        return True, result
    except Exception as e:
        # Prova metodo alternativo
        try:
            result = models.execute_kw(
                ODOO_DB, uid, ODOO_PASS,
                'account.move.line', 'reconcile',
                [[line_id]],
                {'writeoff_acc_id': False, 'writeoff_journal_id': False}
            )
            return True, result
        except Exception as e2:
            return False, str(e2)

def write_off_small_amounts(models, uid, lines, threshold=1.0):
    """
    Write-off di importi piccoli (< threshold CHF)
    """
    small_lines = [l for l in lines if abs(l['debit'] or l['credit']) < threshold]

    if not small_lines:
        return 0, []

    print(f"\n{'='*80}")
    print(f"WRITE-OFF IMPORTI PICCOLI (< CHF {threshold})")
    print(f"{'='*80}\n")

    print(f"Trovate {len(small_lines)} righe con importo < CHF {threshold}\n")

    written_off = []
    for line in small_lines[:10]:  # Max 10 per test
        amount = line['debit'] or line['credit']
        print(f"Riga {line['id']}: CHF {amount:.2f} - {line['name'][:50]}")

        # TODO: Implementare write-off quando abbiamo write-off account
        # Per ora solo report
        written_off.append(line)

    return len(written_off), written_off

def main():
    """Main"""
    print("\n" + "="*80)
    print("RICONCILIAZIONE AUTOMATICA KONTO 1022")
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

    # Estrai righe non riconciliate
    line_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_1022_id],
            ['reconciled', '=', False],
            ['parent_state', '=', 'posted']
        ]]
    )

    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'read',
        [line_ids],
        {
            'fields': [
                'id', 'name', 'date', 'move_name',
                'debit', 'credit', 'partner_id'
            ]
        }
    )

    print(f"Trovate {len(lines)} righe non riconciliate\n")

    # Statistiche
    stats = {
        'total': len(lines),
        'auto_reconciled': 0,
        'written_off': 0,
        'failed': 0
    }

    # 1. TENTATIVO RICONCILIAZIONE AUTOMATICA SU RIGHE GRANDI
    print(f"\n{'='*80}")
    print("TENTATIVO RICONCILIAZIONE AUTOMATICA")
    print(f"{'='*80}\n")

    large_lines = [l for l in lines if (l['debit'] or l['credit']) >= 100]
    print(f"Righe con importo >= CHF 100: {len(large_lines)}\n")

    for line in large_lines[:5]:  # Test su prime 5
        amount = line['debit'] or line['credit']
        print(f"\nRiga {line['id']}: CHF {amount:,.2f}")
        print(f"  {line['name'][:60]}")

        # Tentativo auto-riconciliazione
        success, result = try_auto_reconcile_line(models, uid, line['id'])

        if success:
            print(f"  ✓ Riconciliato automaticamente")
            stats['auto_reconciled'] += 1
        else:
            print(f"  ✗ Fallito: {result[:80]}")
            stats['failed'] += 1

    # 2. WRITE-OFF IMPORTI PICCOLI
    written_off_count, written_off = write_off_small_amounts(models, uid, lines, threshold=1.0)
    stats['written_off'] = written_off_count

    # REPORT FINALE
    print(f"\n\n{'='*80}")
    print("RISULTATI")
    print(f"{'='*80}\n")

    print(f"Righe totali:          {stats['total']}")
    print(f"✓ Auto-riconciliate:   {stats['auto_reconciled']}")
    print(f"✓ Write-off (report):  {stats['written_off']}")
    print(f"✗ Fallite:             {stats['failed']}")
    print(f"Rimanenti:             {stats['total'] - stats['auto_reconciled'] - stats['written_off']}")

    # Salva report
    report = {
        'timestamp': datetime.now().isoformat(),
        'stats': stats
    }

    report_file = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\report_1022_auto_reconcile_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Report salvato: {report_file}")
    print(f"\n{'='*80}\n")

if __name__ == '__main__':
    main()
