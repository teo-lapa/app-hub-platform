#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FIX URGENTE: Risolve anomalia "SENZA PARTNER" (CHF 78,995.42)
Identifica i 4 movimenti senza partner e propone correzioni
"""

import xmlrpc.client
import ssl
import json
from datetime import datetime

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

def connect_odoo():
    """Connessione a Odoo"""
    print(f"Connessione a Odoo: {ODOO_URL}")

    context = ssl._create_unverified_context()
    common = xmlrpc.client.ServerProxy(
        f'{ODOO_URL}/xmlrpc/2/common',
        context=context,
        allow_none=True
    )

    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("Autenticazione fallita")

    print(f"Autenticato come UID: {uid}")

    models = xmlrpc.client.ServerProxy(
        f'{ODOO_URL}/xmlrpc/2/object',
        context=context,
        allow_none=True
    )

    return uid, models

def get_account_1100_id(models, uid):
    """Recupera ID account 1100"""
    accounts = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', '1100']]],
        {'fields': ['id', 'code', 'name']}
    )
    return accounts[0]['id'] if accounts else None

def get_moves_senza_partner(models, uid, account_id):
    """Recupera movimenti senza partner"""
    print("\nRecupero movimenti SENZA PARTNER...")

    # Cerca movimenti con partner_id = False
    moves = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['partner_id', '=', False],
            ['parent_state', '=', 'posted'],
            ['date', '<=', '2024-12-31']
        ]],
        {
            'fields': [
                'id', 'date', 'name', 'ref', 'move_id', 'move_name',
                'debit', 'credit', 'balance', 'amount_currency',
                'currency_id', 'journal_id', 'reconciled'
            ],
            'order': 'date asc'
        }
    )

    print(f"Trovati {len(moves)} movimenti senza partner")
    return moves

def analyze_move(models, uid, move_line):
    """Analizza movimento per identificare partner corretto"""
    print(f"\n{'='*80}")
    print(f"ANALISI MOVIMENTO ID: {move_line['id']}")
    print(f"{'='*80}")

    print(f"Data: {move_line['date']}")
    print(f"Descrizione: {move_line['name']}")
    print(f"Riferimento: {move_line.get('ref', 'N/A')}")
    print(f"Dare: CHF {move_line['debit']:,.2f}")
    print(f"Avere: CHF {move_line['credit']:,.2f}")
    print(f"Saldo: CHF {move_line['balance']:,.2f}")

    # Recupera dettagli move completo
    move_id = move_line['move_id'][0] if move_line['move_id'] else None

    if move_id:
        move = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'read',
            [move_id],
            {
                'fields': [
                    'name', 'ref', 'date', 'journal_id', 'partner_id',
                    'invoice_origin', 'invoice_date', 'payment_reference',
                    'line_ids'
                ]
            }
        )

        if move:
            move = move[0]
            print(f"\nMOVIMENTO CONTABILE:")
            print(f"Nome: {move['name']}")
            print(f"Giornale: {move['journal_id'][1] if move.get('journal_id') else 'N/A'}")
            print(f"Partner (header): {move['partner_id'][1] if move.get('partner_id') else 'NESSUNO'}")

            # Analizza altre righe dello stesso movimento
            if move.get('line_ids'):
                other_lines = models.execute_kw(
                    ODOO_DB, uid, ODOO_PASSWORD,
                    'account.move.line', 'read',
                    [move['line_ids']],
                    {
                        'fields': [
                            'id', 'account_id', 'partner_id', 'name',
                            'debit', 'credit', 'balance'
                        ]
                    }
                )

                print(f"\nALTRE RIGHE MOVIMENTO:")
                suggested_partner = None

                for line in other_lines:
                    if line['id'] != move_line['id']:
                        partner_name = line['partner_id'][1] if line.get('partner_id') else 'NESSUNO'
                        print(f"  - Account: {line['account_id'][1] if line.get('account_id') else 'N/A'}")
                        print(f"    Partner: {partner_name}")
                        print(f"    Dare: {line['debit']:.2f}, Avere: {line['credit']:.2f}")

                        # Suggerisci partner dalle altre righe
                        if line.get('partner_id') and not suggested_partner:
                            suggested_partner = line['partner_id']

                if suggested_partner:
                    print(f"\n*** PARTNER SUGGERITO: {suggested_partner[1]} (ID: {suggested_partner[0]}) ***")
                    return {
                        'move_line_id': move_line['id'],
                        'move_id': move_id,
                        'suggested_partner_id': suggested_partner[0],
                        'suggested_partner_name': suggested_partner[1],
                        'balance': move_line['balance'],
                        'date': move_line['date'],
                        'name': move_line['name']
                    }

    return {
        'move_line_id': move_line['id'],
        'move_id': move_id,
        'suggested_partner_id': None,
        'suggested_partner_name': None,
        'balance': move_line['balance'],
        'date': move_line['date'],
        'name': move_line['name']
    }

def main():
    """Esecuzione principale"""
    print("="*80)
    print("FIX URGENTE: SENZA PARTNER (CHF 78,995.42)")
    print("="*80)

    # Connessione
    uid, models = connect_odoo()

    # Recupera account 1100
    account_id = get_account_1100_id(models, uid)
    print(f"\nAccount 1100 ID: {account_id}")

    # Recupera movimenti senza partner
    moves = get_moves_senza_partner(models, uid, account_id)

    if not moves:
        print("\nNessun movimento senza partner trovato!")
        return

    # Analizza ogni movimento
    suggestions = []
    total_balance = 0

    for move in moves:
        suggestion = analyze_move(models, uid, move)
        suggestions.append(suggestion)
        total_balance += suggestion['balance']

    # Report finale
    print("\n" + "="*80)
    print("REPORT FINALE")
    print("="*80)

    print(f"\nTotale movimenti senza partner: {len(moves)}")
    print(f"Saldo totale: CHF {total_balance:,.2f}")

    print("\nSUGGERIMENTI CORREZIONE:")
    for i, sugg in enumerate(suggestions, 1):
        print(f"\n{i}. Movimento ID {sugg['move_line_id']} - CHF {sugg['balance']:,.2f}")
        print(f"   Data: {sugg['date']}")
        print(f"   Descrizione: {sugg['name']}")
        if sugg['suggested_partner_id']:
            print(f"   AZIONE: Assegna a '{sugg['suggested_partner_name']}' (ID: {sugg['suggested_partner_id']})")
        else:
            print(f"   AZIONE: RICHIEDE ANALISI MANUALE (nessun partner suggerito)")

    # Genera SQL per correzioni automatiche
    print("\n" + "="*80)
    print("SQL CORREZIONI AUTOMATICHE")
    print("="*80)
    print("\n-- ATTENZIONE: Eseguire SOLO dopo verifica manuale!\n")

    for sugg in suggestions:
        if sugg['suggested_partner_id']:
            print(f"-- Movimento {sugg['move_line_id']}: {sugg['name']}")
            print(f"UPDATE account_move_line")
            print(f"SET partner_id = {sugg['suggested_partner_id']}")
            print(f"WHERE id = {sugg['move_line_id']};")
            print()

    # Salva JSON
    output = {
        'date_analysis': datetime.now().isoformat(),
        'total_moves': len(moves),
        'total_balance': total_balance,
        'suggestions': suggestions
    }

    json_file = 'c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\fix-senza-partner-analysis.json'
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)

    print(f"\nAnalisi salvata: {json_file}")

    print("\n" + "="*80)
    print("PROSSIMI STEP:")
    print("="*80)
    print("1. Verifica suggerimenti partner")
    print("2. Se OK, esegui SQL o aggiorna manualmente in Odoo:")
    print("   Contabilita > Ricerca movimenti > Modifica partner")
    print("3. Ri-esegui riconciliazione per verificare risoluzione")
    print("="*80)

if __name__ == "__main__":
    main()
