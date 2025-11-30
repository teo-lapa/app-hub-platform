#!/usr/bin/env python3
"""
VERIFICA FINALE STAGING - Chiusura Contabile 2024
Controlla TUTTI i conti chiave e genera report completo
"""

import xmlrpc.client
import json
from datetime import datetime
from collections import defaultdict

# Configurazione Odoo Staging
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Conti chiave da verificare
CONTI_CHIAVE = {
    '1099': 'Transferkonto',
    '10901': 'Liquiditätstransfer',
    '1022': 'Outstanding Receipts',
    '1023': 'Outstanding Payments',
    '1001': 'Cash',
    # Conti bancari
    '1002': 'PostFinance CHF',
    '1003': 'UBS CHF',
    '1004': 'UBS EUR',
    '1005': 'Raiffeisen CHF',
    '1006': 'Credit Suisse CHF',
    '1010': 'PostFinance EUR',
    '1011': 'UBS USD',
    '1012': 'PostFinance USD'
}

def connect_odoo():
    """Connessione a Odoo"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def get_account_balance(models, uid, account_code, date_to='2024-12-31'):
    """Ottieni saldo di un conto a una data"""
    try:
        # Cerca account
        account_ids = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.account', 'search',
            [[('code', '=', account_code)]]
        )

        if not account_ids:
            return None, f"Account {account_code} not found"

        # Leggi account
        account = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.account', 'read',
            [account_ids],
            {'fields': ['name', 'code']}
        )[0]

        # Cerca movimenti 2024
        move_lines = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move.line', 'search_read',
            [[
                ('account_id', '=', account_ids[0]),
                ('date', '<=', date_to),
                ('parent_state', '=', 'posted')
            ]],
            {'fields': ['date', 'name', 'debit', 'credit', 'move_id']}
        )

        # Calcola totali
        total_debit = sum(line['debit'] for line in move_lines)
        total_credit = sum(line['credit'] for line in move_lines)
        balance = total_debit - total_credit

        return {
            'code': account['code'],
            'name': account['name'],
            'balance': balance,
            'total_debit': total_debit,
            'total_credit': total_credit,
            'move_count': len(move_lines),
            'last_movement': max([line['date'] for line in move_lines]) if move_lines else None
        }, None

    except Exception as e:
        return None, str(e)

def get_trial_balance(models, uid, date_to='2024-12-31'):
    """Genera trial balance completo"""
    try:
        # Tutti gli account con movimenti 2024
        move_lines = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move.line', 'search_read',
            [[
                ('date', '<=', date_to),
                ('parent_state', '=', 'posted')
            ]],
            {'fields': ['account_id', 'debit', 'credit']}
        )

        # Aggrega per account
        balances = defaultdict(lambda: {'debit': 0, 'credit': 0})
        for line in move_lines:
            account_id = line['account_id'][0]
            balances[account_id]['debit'] += line['debit']
            balances[account_id]['credit'] += line['credit']

        # Leggi nomi account
        account_ids = list(balances.keys())
        accounts = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.account', 'read',
            [account_ids],
            {'fields': ['code', 'name']}
        )

        # Crea trial balance
        trial_balance = []
        for account in accounts:
            account_id = account['id']
            debit = balances[account_id]['debit']
            credit = balances[account_id]['credit']
            balance = debit - credit

            trial_balance.append({
                'code': account['code'],
                'name': account['name'],
                'debit': debit,
                'credit': credit,
                'balance': balance
            })

        # Ordina per codice
        trial_balance.sort(key=lambda x: x['code'])

        return trial_balance, None

    except Exception as e:
        return None, str(e)

def check_unbalanced_moves(models, uid, date_from='2024-01-01', date_to='2024-12-31'):
    """Trova registrazioni sbilanciate"""
    try:
        moves = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'search_read',
            [[
                ('date', '>=', date_from),
                ('date', '<=', date_to),
                ('state', '=', 'posted')
            ]],
            {'fields': ['name', 'date', 'amount_total', 'line_ids']}
        )

        unbalanced = []
        for move in moves:
            # Leggi righe
            lines = models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'account.move.line', 'read',
                [move['line_ids']],
                {'fields': ['debit', 'credit']}
            )

            total_debit = sum(line['debit'] for line in lines)
            total_credit = sum(line['credit'] for line in lines)
            diff = abs(total_debit - total_credit)

            if diff > 0.01:  # Più di 1 centesimo
                unbalanced.append({
                    'move_id': move['id'],
                    'name': move['name'],
                    'date': move['date'],
                    'total_debit': total_debit,
                    'total_credit': total_credit,
                    'difference': diff
                })

        return unbalanced, None

    except Exception as e:
        return None, str(e)

def main():
    print("=" * 80)
    print("VERIFICA FINALE STAGING - Chiusura Contabile 2024")
    print("=" * 80)
    print()

    # Connessione
    print("Connessione a Odoo staging...")
    uid, models = connect_odoo()
    print(f"OK Connesso come UID: {uid}")
    print()

    # 1. VERIFICA CONTI CHIAVE
    print("=" * 80)
    print("1. VERIFICA CONTI CHIAVE")
    print("=" * 80)
    print()

    conti_result = {}
    errors = []

    for code, name in CONTI_CHIAVE.items():
        print(f"Verificando {code} - {name}...", end=' ')
        result, error = get_account_balance(models, uid, code)

        if error:
            print(f"ERROR: {error}")
            errors.append(f"{code}: {error}")
        else:
            conti_result[code] = result
            balance = result['balance']

            # Check status
            if code in ['1099', '10901', '1022', '1023']:
                # Dovrebbero essere zero
                if abs(balance) < 0.01:
                    print(f"OK CHF {balance:,.2f} (OK - ZERO)")
                else:
                    print(f"WARNING CHF {balance:,.2f} (DEVE ESSERE ZERO!)")
                    errors.append(f"{code} non è zero: CHF {balance:,.2f}")
            elif code == '1001':
                # Cash ~90,000
                if 80000 <= balance <= 100000:
                    print(f"OK CHF {balance:,.2f} (OK - Range realistico)")
                else:
                    print(f"WARNING CHF {balance:,.2f} (Verifica se realistico)")
            else:
                # Conti bancari - mostra solo
                print(f"  CHF {balance:,.2f}")

    print()

    # 2. TRIAL BALANCE
    print("=" * 80)
    print("2. TRIAL BALANCE COMPLETO")
    print("=" * 80)
    print()

    trial_balance, error = get_trial_balance(models, uid)
    if error:
        print(f"ERROR: {error}")
        errors.append(f"Trial Balance: {error}")
    else:
        total_debit = sum(item['debit'] for item in trial_balance)
        total_credit = sum(item['credit'] for item in trial_balance)
        diff = abs(total_debit - total_credit)

        print(f"Totale DARE:  CHF {total_debit:,.2f}")
        print(f"Totale AVERE: CHF {total_credit:,.2f}")
        print(f"Differenza:   CHF {diff:,.2f}")

        if diff < 0.01:
            print("OK QUADRATURA OK")
        else:
            print(f"ERROR QUADRATURA SBILANCIATA di CHF {diff:,.2f}")
            errors.append(f"Trial Balance sbilanciato: CHF {diff:,.2f}")

    print()

    # 3. REGISTRAZIONI SBILANCIATE
    print("=" * 80)
    print("3. REGISTRAZIONI SBILANCIATE")
    print("=" * 80)
    print()

    unbalanced, error = check_unbalanced_moves(models, uid)
    if error:
        print(f"ERROR: {error}")
        errors.append(f"Check unbalanced: {error}")
    else:
        if unbalanced:
            print(f"ERROR Trovate {len(unbalanced)} registrazioni sbilanciate:")
            for move in unbalanced[:10]:  # Prime 10
                print(f"  - Move {move['move_id']}: {move['name']} - Diff: CHF {move['difference']:,.2f}")
            errors.append(f"{len(unbalanced)} registrazioni sbilanciate")
        else:
            print("OK Nessuna registrazione sbilanciata")

    print()

    # 4. SALVA REPORT JSON
    report = {
        'timestamp': datetime.now().isoformat(),
        'database': ODOO_DB,
        'conti_chiave': conti_result,
        'trial_balance': {
            'total_debit': total_debit if trial_balance else 0,
            'total_credit': total_credit if trial_balance else 0,
            'difference': diff if trial_balance else 0,
            'balanced': diff < 0.01 if trial_balance else False
        },
        'unbalanced_moves': len(unbalanced) if unbalanced else 0,
        'errors': errors,
        'status': 'OK' if not errors else 'ERRORS'
    }

    report_file = 'report-finale-staging-verifica.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print()
    print(f"Report salvato: {report_file}")
    print()

    if errors:
        print(f"ERROR STATUS: ERRORI TROVATI ({len(errors)})")
        print()
        print("ERRORI DA RISOLVERE:")
        for i, error in enumerate(errors, 1):
            print(f"{i}. {error}")
    else:
        print("OK STATUS: TUTTO OK - PRONTO PER PRODUCTION")

    print()
    print("=" * 80)

if __name__ == '__main__':
    main()
