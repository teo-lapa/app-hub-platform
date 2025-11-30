#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OUTSTANDING RECONCILIATION - COMPLETE REPORT
=============================================

Genera report completo della riconciliazione konto 1022 e 1023
per il commercialista - chiusura contabile 31.12.2024

Author: Backend Specialist - Outstanding Reconciler
Date: 2025-11-16
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import xmlrpc.client
import ssl
import json
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Tuple
import pandas as pd

# =============================================================================
# CONFIGURAZIONE ODOO STAGING
# =============================================================================

ODOO_CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

# =============================================================================
# CONNESSIONE ODOO
# =============================================================================

def connect_odoo() -> Tuple:
    """Connessione a Odoo staging"""
    print(f"\n{'='*70}")
    print("OUTSTANDING RECONCILIATION - REPORT COMPLETO")
    print(f"{'='*70}\n")

    ssl_context = ssl._create_unverified_context()

    common_url = f"{ODOO_CONFIG['url']}/xmlrpc/2/common"
    common = xmlrpc.client.ServerProxy(common_url, context=ssl_context)

    uid = common.authenticate(
        ODOO_CONFIG['db'],
        ODOO_CONFIG['username'],
        ODOO_CONFIG['password'],
        {}
    )

    if not uid:
        raise Exception("Autenticazione fallita!")

    models_url = f"{ODOO_CONFIG['url']}/xmlrpc/2/object"
    models = xmlrpc.client.ServerProxy(models_url, context=ssl_context)

    print(f"✓ Connesso a Odoo Staging (UID: {uid})")
    print(f"  Database: {ODOO_CONFIG['db']}")
    print(f"  User: {ODOO_CONFIG['username']}\n")

    return uid, models

# =============================================================================
# ANALISI ACCOUNT
# =============================================================================

def get_account_info(uid, models, account_code: str) -> Dict:
    """Ottiene informazioni complete su un account"""

    # Trova account
    account_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.account', 'search',
        [[['code', '=', account_code]]]
    )

    if not account_ids:
        return None

    account_id = account_ids[0]

    # Leggi account
    account = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.account', 'read',
        [account_id],
        {'fields': ['id', 'code', 'name', 'account_type']}
    )[0]

    # Tutte le righe
    all_lines = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['parent_state', '=', 'posted']
        ]],
        {
            'fields': [
                'id', 'date', 'move_id', 'partner_id', 'name', 'ref',
                'debit', 'credit', 'balance', 'reconciled', 'full_reconcile_id'
            ]
        }
    )

    # Statistiche
    total_lines = len(all_lines)
    reconciled_lines = [l for l in all_lines if l['reconciled']]
    unreconciled_lines = [l for l in all_lines if not l['reconciled']]

    total_debit = sum(Decimal(str(l['debit'])) for l in all_lines)
    total_credit = sum(Decimal(str(l['credit'])) for l in all_lines)
    balance = total_debit - total_credit

    reconciled_balance = sum(Decimal(str(l['balance'])) for l in reconciled_lines)
    unreconciled_balance = sum(Decimal(str(l['balance'])) for l in unreconciled_lines)

    return {
        'account': account,
        'total_lines': total_lines,
        'reconciled_count': len(reconciled_lines),
        'unreconciled_count': len(unreconciled_lines),
        'total_debit': total_debit,
        'total_credit': total_credit,
        'balance': balance,
        'reconciled_balance': reconciled_balance,
        'unreconciled_balance': unreconciled_balance,
        'all_lines': all_lines,
        'reconciled_lines': reconciled_lines,
        'unreconciled_lines': unreconciled_lines
    }

# =============================================================================
# ANALISI RICONCILIAZIONI
# =============================================================================

def get_reconciliation_stats(uid, models, account_code: str) -> Dict:
    """Statistiche riconciliazioni per account"""

    # Trova account
    account_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.account', 'search',
        [[['code', '=', account_code]]]
    )

    if not account_ids:
        return {}

    account_id = account_ids[0]

    # Righe riconciliate con full_reconcile_id
    reconciled_lines = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['reconciled', '=', True],
            ['full_reconcile_id', '!=', False]
        ]],
        {'fields': ['id', 'full_reconcile_id', 'balance']}
    )

    # Raggruppa per full_reconcile_id
    reconcile_groups = {}
    for line in reconciled_lines:
        rec_id = line['full_reconcile_id'][0]
        if rec_id not in reconcile_groups:
            reconcile_groups[rec_id] = []
        reconcile_groups[rec_id].append(line)

    total_reconciliations = len(reconcile_groups)
    total_amount_reconciled = sum(abs(Decimal(str(l['balance']))) for l in reconciled_lines)

    return {
        'total_reconciliations': total_reconciliations,
        'total_amount_reconciled': total_amount_reconciled,
        'reconcile_groups': reconcile_groups,
        'reconciled_lines': reconciled_lines
    }

# =============================================================================
# ANALISI REGISTRAZIONI CHIUSURA
# =============================================================================

def get_closing_moves(uid, models) -> List[Dict]:
    """Trova registrazioni di chiusura"""

    # Cerca moves con ref CHIUSURA
    move_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'search',
        [[
            ['ref', 'ilike', 'CHIUSURA-102'],
            ['date', '=', '2024-12-31']
        ]]
    )

    if not move_ids:
        return []

    moves = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move', 'read',
        [move_ids],
        {
            'fields': [
                'id', 'name', 'ref', 'date', 'state', 'journal_id',
                'line_ids'
            ]
        }
    )

    # Per ogni move, leggi le righe
    for move in moves:
        line_ids = move['line_ids']
        lines = models.execute_kw(
            ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
            'account.move.line', 'read',
            [line_ids],
            {
                'fields': [
                    'id', 'account_id', 'name', 'debit', 'credit', 'balance'
                ]
            }
        )
        move['lines_detail'] = lines

    return moves

# =============================================================================
# GENERAZIONE REPORT
# =============================================================================

def format_chf(amount) -> str:
    """Formatta importo CHF"""
    return f"CHF {amount:,.2f}".replace(',', "'")

def print_section(title: str):
    """Stampa sezione"""
    print(f"\n{'='*70}")
    print(title)
    print(f"{'='*70}\n")

def print_account_summary(account_code: str, info: Dict):
    """Stampa summary account"""
    print(f"ACCOUNT: {account_code} - {info['account']['name']}")
    print(f"ID: {info['account']['id']}")
    print(f"Type: {info['account']['account_type']}\n")

    print(f"RIGHE:")
    print(f"  Totale righe: {info['total_lines']}")
    print(f"  Riconciliate: {info['reconciled_count']} ({info['reconciled_count']/max(info['total_lines'],1)*100:.1f}%)")
    print(f"  Non riconciliate: {info['unreconciled_count']} ({info['unreconciled_count']/max(info['total_lines'],1)*100:.1f}%)\n")

    print(f"SALDI:")
    print(f"  Totale Dare: {format_chf(info['total_debit'])}")
    print(f"  Totale Avere: {format_chf(info['total_credit'])}")
    print(f"  Balance: {format_chf(info['balance'])}")
    print(f"  Balance riconciliato: {format_chf(info['reconciled_balance'])}")
    print(f"  Balance NON riconciliato: {format_chf(info['unreconciled_balance'])}\n")

    # Status
    if abs(info['unreconciled_balance']) < Decimal('0.01'):
        print(f"✓ STATUS: SALDO A ZERO - OBIETTIVO RAGGIUNTO!\n")
    else:
        print(f"⚠ STATUS: Saldo non riconciliato = {format_chf(info['unreconciled_balance'])}\n")

def print_reconciliation_summary(account_code: str, stats: Dict):
    """Stampa summary riconciliazioni"""
    print(f"RICONCILIAZIONI ACCOUNT {account_code}:")
    print(f"  Numero riconciliazioni: {stats.get('total_reconciliations', 0)}")
    print(f"  Importo totale riconciliato: {format_chf(stats.get('total_amount_reconciled', 0))}\n")

def print_closing_moves(moves: List[Dict]):
    """Stampa registrazioni chiusura"""
    print_section("REGISTRAZIONI DI CHIUSURA 31.12.2024")

    if not moves:
        print("Nessuna registrazione di chiusura trovata.\n")
        return

    for move in moves:
        print(f"MOVE ID: {move['id']}")
        print(f"  Name: {move['name']}")
        print(f"  Ref: {move['ref']}")
        print(f"  Date: {move['date']}")
        print(f"  State: {move['state']}")
        print(f"  Journal: {move['journal_id'][1] if move['journal_id'] else 'N/A'}\n")

        print(f"  RIGHE:")
        total_debit = Decimal('0')
        total_credit = Decimal('0')

        for line in move['lines_detail']:
            account_name = line['account_id'][1] if line['account_id'] else 'N/A'
            debit = Decimal(str(line['debit']))
            credit = Decimal(str(line['credit']))

            total_debit += debit
            total_credit += credit

            if debit > 0:
                print(f"    [D] {account_name}: {format_chf(debit)}")
            else:
                print(f"    [A] {account_name}: {format_chf(credit)}")

        print(f"\n  TOTALI:")
        print(f"    Totale Dare: {format_chf(total_debit)}")
        print(f"    Totale Avere: {format_chf(total_credit)}")
        print(f"    Quadratura: {'✓ OK' if abs(total_debit - total_credit) < Decimal('0.01') else '✗ ERRORE'}\n")

# =============================================================================
# REPORT JSON E EXCEL
# =============================================================================

def generate_json_report(data: Dict, filename: str):
    """Genera report JSON"""
    filepath = f"C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\{filename}"

    # Converti Decimal a float per JSON
    def decimal_to_float(obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: decimal_to_float(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [decimal_to_float(i) for i in obj]
        return obj

    data_json = decimal_to_float(data)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data_json, f, indent=2, ensure_ascii=False)

    print(f"✓ Report JSON salvato: {filename}")

def generate_excel_report(konto_1022: Dict, konto_1023: Dict, moves: List[Dict], filename: str):
    """Genera report Excel"""
    filepath = f"C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\{filename}"

    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        # Sheet 1: Executive Summary
        summary_data = [
            ['OUTSTANDING RECONCILIATION - EXECUTIVE SUMMARY', ''],
            ['Data report', datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            ['Database', ODOO_CONFIG['db']],
            ['Environment', 'STAGING'],
            ['', ''],
            ['KONTO 1022 - INCASSI IN SOSPESO', ''],
            ['Totale righe', konto_1022['total_lines']],
            ['Righe riconciliate', konto_1022['reconciled_count']],
            ['Righe NON riconciliate', konto_1022['unreconciled_count']],
            ['Balance finale', f"{float(konto_1022['balance']):,.2f}"],
            ['Balance NON riconciliato', f"{float(konto_1022['unreconciled_balance']):,.2f}"],
            ['Status', 'AZZERATO ✓' if abs(konto_1022['balance']) < 0.01 else 'DA VERIFICARE ⚠'],
            ['', ''],
            ['KONTO 1023 - PAGAMENTI IN SOSPESO', ''],
            ['Totale righe', konto_1023['total_lines']],
            ['Righe riconciliate', konto_1023['reconciled_count']],
            ['Righe NON riconciliate', konto_1023['unreconciled_count']],
            ['Balance finale', f"{float(konto_1023['balance']):,.2f}"],
            ['Balance NON riconciliato', f"{float(konto_1023['unreconciled_balance']):,.2f}"],
            ['Status', 'AZZERATO ✓' if abs(konto_1023['balance']) < 0.01 else 'DA VERIFICARE ⚠'],
            ['', ''],
            ['REGISTRAZIONI CHIUSURA', ''],
            ['Numero moves creati', len(moves)],
            ['', ''],
            ['RISULTATO FINALE', ''],
            ['Konto 1022', 'CHF 0.00 ✓' if abs(konto_1022['balance']) < 0.01 else f"CHF {float(konto_1022['balance']):,.2f} ⚠"],
            ['Konto 1023', 'CHF 0.00 ✓' if abs(konto_1023['balance']) < 0.01 else f"CHF {float(konto_1023['balance']):,.2f} ⚠"],
        ]

        df_summary = pd.DataFrame(summary_data, columns=['Metrica', 'Valore'])
        df_summary.to_excel(writer, sheet_name='Executive Summary', index=False)

        # Sheet 2: Konto 1022 Righe Non Riconciliate
        if konto_1022['unreconciled_lines']:
            df_1022 = pd.DataFrame([
                {
                    'ID': l['id'],
                    'Date': l['date'],
                    'Move': l['move_id'][1] if l['move_id'] else '',
                    'Partner': l['partner_id'][1] if l['partner_id'] else 'NO PARTNER',
                    'Name': l['name'],
                    'Ref': l.get('ref', ''),
                    'Debit': l['debit'],
                    'Credit': l['credit'],
                    'Balance': l['balance']
                }
                for l in konto_1022['unreconciled_lines']
            ])
            df_1022.to_excel(writer, sheet_name='1022 Non Riconciliate', index=False)

        # Sheet 3: Konto 1023 Righe Non Riconciliate
        if konto_1023['unreconciled_lines']:
            df_1023 = pd.DataFrame([
                {
                    'ID': l['id'],
                    'Date': l['date'],
                    'Move': l['move_id'][1] if l['move_id'] else '',
                    'Partner': l['partner_id'][1] if l['partner_id'] else 'NO PARTNER',
                    'Name': l['name'],
                    'Ref': l.get('ref', ''),
                    'Debit': l['debit'],
                    'Credit': l['credit'],
                    'Balance': l['balance']
                }
                for l in konto_1023['unreconciled_lines']
            ])
            df_1023.to_excel(writer, sheet_name='1023 Non Riconciliate', index=False)

        # Sheet 4: Registrazioni Chiusura
        if moves:
            closing_data = []
            for move in moves:
                for line in move['lines_detail']:
                    closing_data.append({
                        'Move ID': move['id'],
                        'Move Name': move['name'],
                        'Move Ref': move['ref'],
                        'Date': move['date'],
                        'State': move['state'],
                        'Account': line['account_id'][1] if line['account_id'] else '',
                        'Line Name': line['name'],
                        'Debit': line['debit'],
                        'Credit': line['credit'],
                        'Balance': line['balance']
                    })

            df_closing = pd.DataFrame(closing_data)
            df_closing.to_excel(writer, sheet_name='Registrazioni Chiusura', index=False)

    print(f"✓ Report Excel salvato: {filename}")

# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    """Main execution"""

    # Connetti
    uid, models = connect_odoo()

    # Analizza Konto 1022
    print_section("ANALISI KONTO 1022 - INCASSI IN SOSPESO")
    konto_1022 = get_account_info(uid, models, '1022')
    if konto_1022:
        print_account_summary('1022', konto_1022)
        rec_stats_1022 = get_reconciliation_stats(uid, models, '1022')
        print_reconciliation_summary('1022', rec_stats_1022)
    else:
        print("⚠ Account 1022 non trovato!\n")
        rec_stats_1022 = {}

    # Analizza Konto 1023
    print_section("ANALISI KONTO 1023 - PAGAMENTI IN SOSPESO")
    konto_1023 = get_account_info(uid, models, '1023')
    if konto_1023:
        print_account_summary('1023', konto_1023)
        rec_stats_1023 = get_reconciliation_stats(uid, models, '1023')
        print_reconciliation_summary('1023', rec_stats_1023)
    else:
        print("⚠ Account 1023 non trovato!\n")
        rec_stats_1023 = {}

    # Analizza registrazioni chiusura
    closing_moves = get_closing_moves(uid, models)
    print_closing_moves(closing_moves)

    # Report finale
    print_section("REPORT FINALE - RIEPILOGO ESECUTIVO")

    print("OBIETTIVO: Portare konto 1022 e 1023 a saldo ZERO per chiusura 31.12.2024\n")

    print("RISULTATI:")
    if konto_1022:
        status_1022 = "✓ RAGGIUNTO" if abs(konto_1022['balance']) < Decimal('0.01') else "✗ NON RAGGIUNTO"
        print(f"  Konto 1022: {format_chf(konto_1022['balance'])} - {status_1022}")

    if konto_1023:
        status_1023 = "✓ RAGGIUNTO" if abs(konto_1023['balance']) < Decimal('0.01') else "✗ NON RAGGIUNTO"
        print(f"  Konto 1023: {format_chf(konto_1023['balance'])} - {status_1023}")

    print(f"\nREGISTRAZIONI CHIUSURA:")
    print(f"  Numero moves creati: {len(closing_moves)}")
    for move in closing_moves:
        print(f"    - {move['ref']} (Move ID: {move['id']}, State: {move['state']})")

    # Overall status
    print(f"\n{'='*70}")
    if konto_1022 and konto_1023:
        if abs(konto_1022['balance']) < Decimal('0.01') and abs(konto_1023['balance']) < Decimal('0.01'):
            print("✓✓✓ SUCCESS: ENTRAMBI I KONTI AZZERATI - OBIETTIVO RAGGIUNTO!")
            print(f"{'='*70}\n")
            print("AZIONI COMMERCIALISTA:")
            print("  1. Verificare registrazioni chiusura in Odoo")
            print("  2. Confermare saldi a zero nei report contabili")
            print("  3. Procedere con chiusura contabile 31.12.2024")
            print("  4. Verificare impatto su konto 3900 (Differences)")
        else:
            print("⚠⚠⚠ ATTENZIONE: OBIETTIVO NON COMPLETAMENTE RAGGIUNTO")
            print(f"{'='*70}\n")
            print("AZIONI RICHIESTE:")
            if abs(konto_1022['balance']) >= Decimal('0.01'):
                print(f"  1. Verificare konto 1022 - saldo rimanente: {format_chf(konto_1022['balance'])}")
            if abs(konto_1023['balance']) >= Decimal('0.01'):
                print(f"  2. Verificare konto 1023 - saldo rimanente: {format_chf(konto_1023['balance'])}")

    print()

    # Genera report JSON
    print_section("GENERAZIONE REPORT")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    report_data = {
        'timestamp': timestamp,
        'database': ODOO_CONFIG['db'],
        'environment': 'STAGING',
        'konto_1022': {
            'account_id': konto_1022['account']['id'] if konto_1022 else None,
            'account_name': konto_1022['account']['name'] if konto_1022 else None,
            'total_lines': konto_1022['total_lines'] if konto_1022 else 0,
            'reconciled_count': konto_1022['reconciled_count'] if konto_1022 else 0,
            'unreconciled_count': konto_1022['unreconciled_count'] if konto_1022 else 0,
            'balance': konto_1022['balance'] if konto_1022 else 0,
            'unreconciled_balance': konto_1022['unreconciled_balance'] if konto_1022 else 0,
            'status': 'AZZERATO' if konto_1022 and abs(konto_1022['balance']) < Decimal('0.01') else 'DA VERIFICARE'
        },
        'konto_1023': {
            'account_id': konto_1023['account']['id'] if konto_1023 else None,
            'account_name': konto_1023['account']['name'] if konto_1023 else None,
            'total_lines': konto_1023['total_lines'] if konto_1023 else 0,
            'reconciled_count': konto_1023['reconciled_count'] if konto_1023 else 0,
            'unreconciled_count': konto_1023['unreconciled_count'] if konto_1023 else 0,
            'balance': konto_1023['balance'] if konto_1023 else 0,
            'unreconciled_balance': konto_1023['unreconciled_balance'] if konto_1023 else 0,
            'status': 'AZZERATO' if konto_1023 and abs(konto_1023['balance']) < Decimal('0.01') else 'DA VERIFICARE'
        },
        'closing_moves': [
            {
                'move_id': m['id'],
                'name': m['name'],
                'ref': m['ref'],
                'date': m['date'],
                'state': m['state']
            }
            for m in closing_moves
        ],
        'reconciliation_stats': {
            '1022': rec_stats_1022,
            '1023': rec_stats_1023
        }
    }

    json_filename = f"OUTSTANDING-RECONCILIATION-REPORT-{timestamp}.json"
    generate_json_report(report_data, json_filename)

    # Genera report Excel
    if konto_1022 and konto_1023:
        excel_filename = f"OUTSTANDING-RECONCILIATION-REPORT-{timestamp}.xlsx"
        generate_excel_report(konto_1022, konto_1023, closing_moves, excel_filename)

    print(f"\n✓ Report completo generato!\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[ERRORE] Errore critico: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
