#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Investigate Critical Movement: "Ricorrente merenda69" - CHF 182,651.03

This script investigates the largest unreconciled entry in Account 1022
"""

import xmlrpc.client
import ssl
from datetime import datetime
import json
import sys
import io
import pandas as pd

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Odoo credentials
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"


class OdooClient:
    def __init__(self, url, db, username, password):
        self.url = url
        self.db = db
        self.username = username
        self.password = password
        self.uid = None
        self.ssl_context = ssl._create_unverified_context()
        self.common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common', context=self.ssl_context)
        self.models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object', context=self.ssl_context)

    def authenticate(self):
        self.uid = self.common.authenticate(self.db, self.username, self.password, {})
        if not self.uid:
            raise Exception("Authentication failed!")
        return self.uid

    def execute(self, model, method, *args, **kwargs):
        return self.models.execute_kw(self.db, self.uid, self.password, model, method, args, kwargs)

    def search_read(self, model, domain, fields, limit=None, order=None):
        args = [domain]
        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit
        if order:
            kwargs['order'] = order
        return self.execute(model, 'search_read', *args, **kwargs)


def main():
    print("="*80)
    print("INVESTIGATION: Ricorrente merenda69 - CHF 182,651.03")
    print("="*80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Connect
    client = OdooClient(ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD)
    client.authenticate()
    print("✅ Connected to Odoo\n")

    # Find the line
    print("🔍 Searching for 'Ricorrente merenda69'...")

    lines = client.search_read(
        'account.move.line',
        [('name', 'ilike', 'merenda69')],
        ['id', 'name', 'ref', 'date', 'partner_id', 'debit', 'credit',
         'account_id', 'move_id', 'move_name', 'journal_id', 'reconciled',
         'full_reconcile_id', 'matched_debit_ids', 'matched_credit_ids']
    )

    if not lines:
        print("❌ Line not found!")
        return 1

    print(f"✅ Found {len(lines)} line(s)\n")

    for line in lines:
        print("="*80)
        print("LINE DETAILS")
        print("="*80)
        print(f"ID: {line['id']}")
        print(f"Name: {line['name']}")
        print(f"Move: {line['move_name']}")
        print(f"Date: {line['date']}")
        print(f"Debit: CHF {line['debit']:,.2f}")
        print(f"Credit: CHF {line['credit']:,.2f}")
        print(f"Account: {line['account_id'][1] if line['account_id'] else 'N/A'}")
        print(f"Partner: {line['partner_id'][1] if line['partner_id'] else 'N/A'}")
        print(f"Journal: {line['journal_id'][1] if line['journal_id'] else 'N/A'}")
        print(f"Reconciled: {line['reconciled']}")

        # Get full move details
        print("\n" + "="*80)
        print("FULL MOVE DETAILS")
        print("="*80)

        move_id = line['move_id'][0]
        moves = client.search_read(
            'account.move',
            [('id', '=', move_id)],
            ['id', 'name', 'ref', 'date', 'journal_id', 'state', 'move_type',
             'partner_id', 'amount_total', 'narration', 'line_ids']
        )

        if moves:
            move = moves[0]
            print(f"Move ID: {move['id']}")
            print(f"Move Name: {move['name']}")
            print(f"Move Type: {move['move_type']}")
            print(f"State: {move['state']}")
            print(f"Journal: {move['journal_id'][1] if move['journal_id'] else 'N/A'}")
            print(f"Partner: {move['partner_id'][1] if move['partner_id'] else 'N/A'}")
            print(f"Amount Total: CHF {move['amount_total']:,.2f}")
            print(f"Narration: {move['narration'] or 'N/A'}")

            # Get all lines of the move
            print("\n" + "="*80)
            print("ALL MOVE LINES")
            print("="*80)

            move_lines = client.search_read(
                'account.move.line',
                [('move_id', '=', move_id)],
                ['id', 'name', 'account_id', 'debit', 'credit', 'partner_id'],
                order='id asc'
            )

            total_debit = 0
            total_credit = 0

            print(f"{'ID':>6} | {'Account':50} | {'Debit':>12} | {'Credit':>12} | Partner")
            print("-" * 100)

            for ml in move_lines:
                account_name = ml['account_id'][1] if ml['account_id'] else 'N/A'
                partner_name = ml['partner_id'][1] if ml['partner_id'] else 'N/A'
                print(f"{ml['id']:6d} | {account_name:50s} | {ml['debit']:12,.2f} | {ml['credit']:12,.2f} | {partner_name}")
                total_debit += ml['debit']
                total_credit += ml['credit']

            print("-" * 100)
            print(f"{'TOTALS':>57} | {total_debit:12,.2f} | {total_credit:12,.2f}")
            print(f"\nBalance: CHF {total_debit - total_credit:,.2f}")

            if abs(total_debit - total_credit) > 0.01:
                print("⚠️  WARNING: Move is not balanced!")

        # Search for related invoices/payments in same period
        print("\n" + "="*80)
        print("SEARCHING FOR RELATED TRANSACTIONS (Dec 2023)")
        print("="*80)

        # Find all moves in December 2023 with significant amounts
        related_moves = client.search_read(
            'account.move',
            [
                ('date', '>=', '2023-12-01'),
                ('date', '<=', '2023-12-31'),
                ('state', '=', 'posted'),
                '|',
                ('amount_total', '>=', 1000),
                ('amount_total', '<=', -1000)
            ],
            ['id', 'name', 'date', 'move_type', 'partner_id', 'amount_total'],
            limit=50,
            order='amount_total desc'
        )

        print(f"\nFound {len(related_moves)} large transactions in December 2023:\n")
        print(f"{'Move Name':20} | {'Date':12} | {'Type':15} | {'Amount':>15} | Partner")
        print("-" * 100)

        for rm in related_moves[:20]:
            partner = rm['partner_id'][1] if rm['partner_id'] else 'N/A'
            print(f"{rm['name']:20} | {rm['date']:12} | {rm['move_type']:15} | {rm['amount_total']:15,.2f} | {partner}")

        # Search for journal entries with "ricorrente" or "merenda"
        print("\n" + "="*80)
        print("SEARCHING FOR SIMILAR RECURRING ENTRIES")
        print("="*80)

        similar_lines = client.search_read(
            'account.move.line',
            ['|', ('name', 'ilike', 'ricorrente'), ('name', 'ilike', 'merenda')],
            ['id', 'name', 'date', 'debit', 'credit', 'account_id'],
            limit=20,
            order='date desc'
        )

        print(f"\nFound {len(similar_lines)} similar entries:\n")
        for sl in similar_lines:
            account = sl['account_id'][1] if sl['account_id'] else 'N/A'
            print(f"{sl['name']:30} | {sl['date']:12} | Debit: {sl['debit']:12,.2f} | Credit: {sl['credit']:12,.2f} | {account}")

    # RECOMMENDATIONS
    print("\n" + "="*80)
    print("RECOMMENDATIONS")
    print("="*80)

    print("\n1. NATURA DEL MOVIMENTO:")
    print("   - 'Ricorrente merenda69' suggerisce un movimento ricorrente automatico")
    print("   - Data 2023-12-31 indica possibile adjustment di fine anno")
    print("   - Importo CHF 182,651.03 è molto significativo (97% del saldo 1022)")

    print("\n2. POSSIBILI CAUSE:")
    print("   - Adjustment automatico di fine anno per riconciliare differenze")
    print("   - Movimento di chiusura/apertura contabile 2023")
    print("   - Accantonamento o provisioning automatico")
    print("   - Errore in script di migrazione/import dati")

    print("\n3. AZIONI SUGGERITE:")
    print("   a) Verificare con il commercialista la natura del movimento")
    print("   b) Se è un adjustment legittimo:")
    print("      - Creare riconciliazione manuale con contropartite corrette")
    print("      - Oppure stornare e ricreare con riferimenti corretti")
    print("   c) Se è un errore:")
    print("      - Stornare il movimento (button_draft + unlink)")
    print("      - Re-import dati corretti")

    print("\n4. CODICE PER STORNO (SE AUTORIZZATO):")
    print("""
    # ATTENZIONE: Eseguire SOLO se autorizzato dal commercialista!

    from odoo_client import OdooClient
    client = OdooClient(...)
    client.authenticate()

    move_id = """ + str(move_id) + """

    # Reset to draft
    client.execute('account.move', 'button_draft', [[move_id]])

    # Delete move (will delete all lines)
    client.execute('account.move', 'unlink', [[move_id]])

    print("✅ Move deleted")
    """)

    print("\n" + "="*80)
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    return 0


if __name__ == "__main__":
    exit(main())
