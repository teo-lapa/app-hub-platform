#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test rapido connessione Odoo 17
================================

Verifica:
1. Connessione XML-RPC
2. Autenticazione
3. Accesso al conto 1023
4. Count righe non riconciliate
"""

import sys
import io
import xmlrpc.client
import ssl

# Fix encoding per Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Config
url = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
db = 'lapadevadmin-lapa-v2-staging-2406-25408900'
username = 'paul@lapa.ch'
password = 'lapa201180'

print(f"\n{'='*70}")
print("TEST CONNESSIONE ODOO 17")
print(f"{'='*70}\n")

try:
    # 1. Connessione
    print("1. Connessione XML-RPC...")
    ssl_context = ssl._create_unverified_context()
    common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common', context=ssl_context)
    print(f"   ✓ Endpoint comune raggiunto\n")

    # 2. Autenticazione
    print("2. Autenticazione...")
    uid = common.authenticate(db, username, password, {})
    if not uid:
        print("   ✗ ERRORE: Autenticazione fallita!")
        exit(1)
    print(f"   ✓ Autenticato con successo (UID: {uid})\n")

    # 3. Models endpoint
    print("3. Connessione models...")
    models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object', context=ssl_context)
    print(f"   ✓ Endpoint models raggiunto\n")

    # 4. Test accesso dati
    print("4. Test accesso dati...")
    partner_count = models.execute_kw(db, uid, password,
        'res.partner', 'search_count', [[]])
    print(f"   ✓ Partners nel sistema: {partner_count}\n")

    # 5. Cerca conto 1023
    print("5. Ricerca conto 1023 Outstanding Payments...")
    account_ids = models.execute_kw(db, uid, password,
        'account.account', 'search',
        [[['code', '=', '1023']]])

    if not account_ids:
        print("   ⚠ Conto 1023 non trovato per codice, cerco per nome...")
        account_ids = models.execute_kw(db, uid, password,
            'account.account', 'search',
            [[['name', 'ilike', 'Outstanding Payment']]])

    if account_ids:
        account = models.execute_kw(db, uid, password,
            'account.account', 'read',
            [account_ids[0]], {'fields': ['id', 'code', 'name', 'reconcile']})

        print(f"   ✓ Trovato conto:")
        print(f"     ID: {account[0]['id']}")
        print(f"     Code: {account[0]['code']}")
        print(f"     Name: {account[0]['name']}")
        print(f"     Reconcile: {account[0]['reconcile']}\n")

        # 6. Count righe non riconciliate
        print("6. Conteggio righe non riconciliate...")
        unreconciled_count = models.execute_kw(db, uid, password,
            'account.move.line', 'search_count',
            [[
                ['account_id', '=', account[0]['id']],
                ['reconciled', '=', False],
                ['parent_state', '=', 'posted']
            ]])

        print(f"   ✓ Righe non riconciliate: {unreconciled_count}\n")

        # 7. Sample righe
        if unreconciled_count > 0:
            print("7. Caricamento sample righe (prime 5)...")
            sample_ids = models.execute_kw(db, uid, password,
                'account.move.line', 'search',
                [[
                    ['account_id', '=', account[0]['id']],
                    ['reconciled', '=', False],
                    ['parent_state', '=', 'posted']
                ]], {'limit': 5})

            sample_lines = models.execute_kw(db, uid, password,
                'account.move.line', 'read',
                [sample_ids],
                {'fields': ['id', 'name', 'date', 'debit', 'credit', 'balance', 'partner_id']})

            print(f"\n   Sample righe non riconciliate:")
            print(f"   {'ID':<10} {'Partner':<30} {'Date':<12} {'Debit':<12} {'Credit':<12} {'Balance':<12}")
            print(f"   {'-'*90}")

            for line in sample_lines:
                partner = line['partner_id'][1] if line['partner_id'] else 'NO PARTNER'
                print(f"   {line['id']:<10} {partner[:28]:<30} {line['date']:<12} "
                      f"{line['debit']:>10.2f}  {line['credit']:>10.2f}  {line['balance']:>10.2f}")

            print()

    else:
        print("   ✗ Conto 1023 non trovato!")
        print("   Mostra primi 10 conti disponibili:\n")

        all_accounts = models.execute_kw(db, uid, password,
            'account.account', 'search_read',
            [[]], {'fields': ['code', 'name'], 'limit': 10})

        for acc in all_accounts:
            print(f"     {acc['code']:<10} {acc['name']}")
        print()

    # Summary
    print(f"{'='*70}")
    print("CONNESSIONE TEST COMPLETATO CON SUCCESSO!")
    print(f"{'='*70}\n")

    print("Prossimo step: Esegui riconciliazione con:")
    print("  python riconcilia-konto-1023.py")
    print()

except Exception as e:
    print(f"\n✗ ERRORE: {e}\n")
    print("Verifica:")
    print("  - URL Odoo corretto")
    print("  - Credenziali valide")
    print("  - Database accessibile")
    print("  - Permessi utente sufficienti")
    print()
    exit(1)
