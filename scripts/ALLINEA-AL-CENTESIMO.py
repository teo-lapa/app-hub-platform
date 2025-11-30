#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ALLINEAMENTO CONTABILITÀ AL CENTESIMO - ESECUZIONE DIRETTA
Allinea i conti Odoo al centesimo come richiesto dal commercialista
"""

import xmlrpc.client
import ssl
from datetime import datetime

# Disable SSL verification
ssl._create_default_https_context = ssl._create_unverified_context

# Configurazione
URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
USERNAME = 'paul@lapa.ch'
PASSWORD = 'lapa201180'

def main():
    print('='*80)
    print('ALLINEAMENTO CONTABILITA AL CENTESIMO - ESECUZIONE DIRETTA')
    print('='*80)
    print(f'Timestamp: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print()

    # Connetti
    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
    uid = common.authenticate(DB, USERNAME, PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

    print(f'Autenticato - UID: {uid}')
    print()

    # ========================================================================
    # AZIONE 1: CHIUSURA KONTO 1099 TRANSFERKONTO
    # Target: CHF -60,842.41 → CHF 0.00
    # ========================================================================

    print('AZIONE 1: CHIUSURA KONTO 1099 TRANSFERKONTO')
    print('-'*80)

    # Trova account 1099
    acc_1099 = models.execute_kw(DB, uid, PASSWORD, 'account.account', 'search_read',
        [[['code', '=', '1099']]],
        {'fields': ['id', 'name', 'company_id'], 'limit': 1})

    if not acc_1099:
        print('ERRORE: Conto 1099 non trovato')
        return

    company_id = acc_1099[0]['company_id'][0] if acc_1099[0]['company_id'] else 1
    print(f'Conto 1099: {acc_1099[0]["name"]} (Company ID: {company_id})')

    # Trova conto patrimonio netto (stessa company)
    equity = models.execute_kw(DB, uid, PASSWORD, 'account.account', 'search_read',
        [[['account_type', '=', 'equity'], ['company_id', '=', company_id]]],
        {'fields': ['id', 'code', 'name'], 'limit': 1})

    if not equity:
        print('ERRORE: Nessun conto patrimonio netto trovato')
        return

    print(f'Conto Equity: {equity[0]["code"]} - {equity[0]["name"]}')

    # Trova journal generale (stessa company)
    journal = models.execute_kw(DB, uid, PASSWORD, 'account.journal', 'search_read',
        [[['type', '=', 'general'], ['company_id', '=', company_id]]],
        {'fields': ['id', 'name'], 'limit': 1})

    if not journal:
        print('ERRORE: Nessun journal generale trovato')
        return

    print(f'Journal: {journal[0]["name"]}')
    print()

    # Crea registrazione di chiusura
    print('Creazione registrazione di chiusura...')

    move_vals = {
        'journal_id': journal[0]['id'],
        'date': '2024-12-31',
        'ref': 'Chiusura Transferkonto 1099 su Patrimonio Netto',
        'company_id': company_id,
        'line_ids': [
            (0, 0, {
                'account_id': acc_1099[0]['id'],
                'debit': 60842.41,
                'credit': 0.00,
                'name': 'Chiusura Transferkonto 1099',
                'company_id': company_id
            }),
            (0, 0, {
                'account_id': equity[0]['id'],
                'debit': 0.00,
                'credit': 60842.41,
                'name': 'Contropartita su Patrimonio Netto',
                'company_id': company_id
            })
        ]
    }

    try:
        move_id = models.execute_kw(DB, uid, PASSWORD, 'account.move', 'create', [move_vals])
        print(f'Registrazione creata - ID: {move_id}')

        # Conferma registrazione
        models.execute_kw(DB, uid, PASSWORD, 'account.move', 'action_post', [[move_id]])
        print(f'Registrazione confermata')
        print()

    except Exception as e:
        print(f'ERRORE durante creazione: {str(e)}')
        return

    # Verifica saldo finale
    print('VERIFICA SALDO FINALE KONTO 1099')
    print('-'*80)

    move_lines = models.execute_kw(DB, uid, PASSWORD, 'account.move.line', 'search_read',
        [[['account_id', '=', acc_1099[0]['id']], ['parent_state', '=', 'posted']]],
        {'fields': ['debit', 'credit']})

    debit_tot = sum(float(l['debit']) for l in move_lines)
    credit_tot = sum(float(l['credit']) for l in move_lines)
    balance = debit_tot - credit_tot

    print(f'Dare totale:   CHF {debit_tot:>15,.2f}')
    print(f'Avere totale:  CHF {credit_tot:>15,.2f}')
    print(f'SALDO FINALE:  CHF {balance:>15,.2f}')
    print()

    if abs(balance) < 0.01:
        print('SUCCESS: Konto 1099 allineato a CHF 0.00 (al centesimo)')
        print('1/5 CONTI ALLINEATI')
    else:
        print(f'ATTENZIONE: Saldo non zero = CHF {balance:,.2f}')

    print()
    print('='*80)
    print('AZIONE 1 COMPLETATA')
    print('='*80)
    print()

    # ========================================================================
    # REPORT FINALE STATO
    # ========================================================================

    print('STATO ALLINEAMENTO CONTABILITA')
    print('='*80)
    print()

    conti = {
        '1001': 'Cash',
        '1022': 'Outstanding Receipts',
        '1023': 'Outstanding Payments',
        '10901': 'Liquiditaetstransfer',
        '1099': 'Transferkonto'
    }

    for code, name in conti.items():
        acc = models.execute_kw(DB, uid, PASSWORD, 'account.account', 'search_read',
            [[['code', '=', code]]],
            {'fields': ['id'], 'limit': 1})

        if acc:
            lines = models.execute_kw(DB, uid, PASSWORD, 'account.move.line', 'search_read',
                [[['account_id', '=', acc[0]['id']], ['parent_state', '=', 'posted']]],
                {'fields': ['debit', 'credit']})

            debit = sum(float(l['debit']) for l in lines)
            credit = sum(float(l['credit']) for l in lines)
            bal = debit - credit

            status = 'ALLINEATO' if abs(bal) < 0.01 else 'DA FARE'
            symbol = '✓' if abs(bal) < 0.01 else '✗'

            print(f'{code:6} {name:25} CHF {bal:>15,.2f}  [{symbol}] {status}')

    print()
    print('='*80)
    print('FINE ALLINEAMENTO')
    print('='*80)

if __name__ == '__main__':
    main()
