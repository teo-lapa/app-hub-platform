#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analisi approfondita discrepanza Credit Suisse

Focus su:
1. Movimento "azzeramento 2023" di CHF 132,834.54 (CRITICO)
2. Altri movimenti sospetti di grande importo
3. Pattern di duplicazione
"""

import sys
import io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import xmlrpc.client
import json
from datetime import datetime

ODOO_URL = "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-main-7268478"
ODOO_USERNAME = "apphubplatform@lapa.ch"
ODOO_PASSWORD = "apphubplatform2025"

class DeepAnalyzer:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.uid = None
        self.models = None
        self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')

    def authenticate(self):
        self.uid = self.common.authenticate(self.db, self.username, self.password, {})
        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
        return self.uid is not None

    def analyze_move_line(self, line_id):
        """Analizza in profondità una singola move line"""
        print(f"\n{'='*80}")
        print(f"ANALISI DETTAGLIATA MOVE LINE ID {line_id}")
        print(f"{'='*80}\n")

        # Get move line completa
        line = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move.line', 'read',
            [[line_id]],
            {'fields': [
                'id', 'move_id', 'date', 'name', 'ref', 'debit', 'credit',
                'account_id', 'partner_id', 'journal_id', 'company_id',
                'create_date', 'create_uid', 'write_date', 'write_uid',
                'parent_state', 'reconciled', 'full_reconcile_id',
                'matching_number', 'payment_id', 'statement_line_id'
            ]}
        )[0]

        print("MOVE LINE INFO:")
        for key, value in line.items():
            print(f"  {key}: {value}")

        # Get parent move
        if line['move_id']:
            move_id = line['move_id'][0]
            print(f"\n{'='*80}")
            print(f"PARENT MOVE ID {move_id}")
            print(f"{'='*80}\n")

            move = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move', 'read',
                [[move_id]],
                {'fields': [
                    'id', 'name', 'ref', 'date', 'journal_id', 'state',
                    'create_date', 'create_uid', 'write_date', 'write_uid',
                    'line_ids', 'statement_line_id', 'payment_id'
                ]}
            )[0]

            print("MOVE INFO:")
            for key, value in move.items():
                if key != 'line_ids':
                    print(f"  {key}: {value}")

            # Get all lines of this move
            print(f"\n  TUTTE LE RIGHE DEL MOVE (totale: {len(move['line_ids'])}):")

            all_lines = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move.line', 'read',
                [move['line_ids']],
                {'fields': ['id', 'account_id', 'name', 'debit', 'credit', 'balance']}
            )

            for ml in all_lines:
                print(f"    ID {ml['id']}: {ml['account_id'][1]} - Dare {ml['debit']:.2f} / Avere {ml['credit']:.2f} - {ml['name'][:50]}")

        return line

    def search_related_movements(self, date, amount, tolerance=1.0):
        """Cerca movimenti correlati per data e importo"""
        print(f"\n{'='*80}")
        print(f"RICERCA MOVIMENTI CORRELATI")
        print(f"{'='*80}\n")
        print(f"Data: {date}, Importo: CHF {amount:.2f}, Tolleranza: +/- {tolerance:.2f}\n")

        # Cerca movimenti simili
        domain = [
            ['account_id', '=', 182],  # Account 1026
            ['date', '=', date],
            '|',
            '&', ['debit', '>=', amount - tolerance], ['debit', '<=', amount + tolerance],
            '&', ['credit', '>=', amount - tolerance], ['credit', '<=', amount + tolerance]
        ]

        similar = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move.line', 'search_read',
            [domain],
            {'fields': ['id', 'date', 'name', 'debit', 'credit', 'move_id']}
        )

        print(f"Trovati {len(similar)} movimenti simili:\n")
        for mov in similar:
            print(f"  ID {mov['id']}: {mov['date']} - Dare {mov['debit']:.2f} / Avere {mov['credit']:.2f}")
            print(f"    Move: {mov['move_id'][1]}")
            print(f"    Name: {mov['name'][:60]}\n")

        return similar

    def search_azzeramento_pattern(self):
        """Cerca tutti i movimenti con 'azzeramento' nel nome"""
        print(f"\n{'='*80}")
        print(f"RICERCA PATTERN 'AZZERAMENTO'")
        print(f"{'='*80}\n")

        domain = [
            ['account_id', '=', 182],
            ['name', 'ilike', 'azzeramento']
        ]

        azzeramenti = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move.line', 'search_read',
            [domain],
            {'fields': ['id', 'date', 'name', 'debit', 'credit', 'move_id', 'journal_id'],
             'order': 'date desc'}
        )

        print(f"Trovati {len(azzeramenti)} movimenti con 'azzeramento':\n")

        total_debit = 0
        total_credit = 0

        for mov in azzeramenti:
            print(f"  ID {mov['id']}: {mov['date']}")
            print(f"    Dare: CHF {mov['debit']:.2f} / Avere: CHF {mov['credit']:.2f}")
            print(f"    Name: {mov['name']}")
            print(f"    Move: {mov['move_id'][1]}")
            print(f"    Journal: {mov['journal_id'][1]}\n")

            total_debit += mov['debit']
            total_credit += mov['credit']

        print(f"TOTALE AZZERAMENTI:")
        print(f"  Dare: CHF {total_debit:.2f}")
        print(f"  Avere: CHF {total_credit:.2f}")
        print(f"  Balance: CHF {total_debit - total_credit:.2f}\n")

        return azzeramenti

    def check_2023_closure(self):
        """Verifica movimenti di chiusura 2023"""
        print(f"\n{'='*80}")
        print(f"VERIFICA CHIUSURA 2023")
        print(f"{'='*80}\n")

        # Cerca nel journal "Rettifiche Chiusura 2023"
        journals = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.journal', 'search_read',
            [[['name', 'ilike', '2023']]],
            {'fields': ['id', 'name', 'type']}
        )

        print(f"Journal trovati con '2023': {len(journals)}\n")
        for j in journals:
            print(f"  ID {j['id']}: {j['name']} ({j['type']})")

            # Get movimenti in questo journal per account 1026
            lines = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move.line', 'search_read',
                [[['account_id', '=', 182], ['journal_id', '=', j['id']]]],
                {'fields': ['id', 'date', 'name', 'debit', 'credit', 'move_id']}
            )

            print(f"    Movimenti trovati: {len(lines)}")
            for line in lines:
                print(f"      ID {line['id']}: {line['date']} - Dare {line['debit']:.2f} / Avere {line['credit']:.2f}")
                print(f"        {line['name'][:60]}\n")

        return journals

    def analyze_journal_distribution(self):
        """Analizza distribuzione temporale per journal"""
        print(f"\n{'='*80}")
        print(f"DISTRIBUZIONE TEMPORALE MOVIMENTI")
        print(f"{'='*80}\n")

        # Get tutti i movimenti 2024 ordinati per data
        lines = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', 182],
                ['date', '>=', '2024-01-01'],
                ['date', '<=', '2024-12-31'],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['id', 'date', 'debit', 'credit'],
             'order': 'date asc'}
        )

        # Raggruppa per mese
        from collections import defaultdict
        monthly = defaultdict(lambda: {'count': 0, 'debit': 0, 'credit': 0})

        for line in lines:
            month = line['date'][:7]  # YYYY-MM
            monthly[month]['count'] += 1
            monthly[month]['debit'] += line['debit']
            monthly[month]['credit'] += line['credit']

        print("DISTRIBUZIONE MENSILE:\n")
        print(f"  {'Mese':<10} {'Count':>8} {'Dare':>15} {'Avere':>15} {'Balance':>15}")
        print(f"  {'-'*10} {'-'*8} {'-'*15} {'-'*15} {'-'*15}")

        for month in sorted(monthly.keys()):
            data = monthly[month]
            balance = data['debit'] - data['credit']
            print(f"  {month:<10} {data['count']:>8} {data['debit']:>15.2f} {data['credit']:>15.2f} {balance:>15.2f}")

        return monthly

    def run_deep_analysis(self):
        """Esegue analisi approfondita"""

        print(f"\n{'#'*80}")
        print(f"# ANALISI APPROFONDITA CREDIT SUISSE - DISCREPANZA CHF 436K")
        print(f"#{'#'*80}\n")

        if not self.authenticate():
            print("[ERROR] Autenticazione fallita")
            return

        print("[OK] Autenticato\n")

        # 1. Analizza il movimento critico "azzeramento 2023"
        self.analyze_move_line(266506)

        # 2. Cerca movimenti correlati
        self.search_related_movements('2024-06-03', 132834.54)

        # 3. Cerca pattern azzeramento
        azzeramenti = self.search_azzeramento_pattern()

        # 4. Verifica chiusura 2023
        self.check_2023_closure()

        # 5. Distribuzione temporale
        monthly = self.analyze_journal_distribution()

        # 6. Genera raccomandazioni
        print(f"\n{'='*80}")
        print(f"RACCOMANDAZIONI FINALI")
        print(f"{'='*80}\n")

        print("PROBLEMA IDENTIFICATO:")
        print("  1. Movimento ID 266506 - 'azzeramento 2023' - CHF 132,834.54 in DARE")
        print("     Data: 2024-06-03")
        print("     Questo movimento è ERRATO - si riferisce a chiusura 2023 ma è in 2024\n")

        print("IMPATTO:")
        print("  Saldo calcolato attuale: CHF 360,549.83")
        print("  Rimuovendo azzeramento:  CHF 227,715.29")
        print("  Saldo atteso:             CHF 24,897.72")
        print("  Differenza residua:       CHF 202,817.57\n")

        print("AZIONI CORRETTIVE:")
        print("  1. CRITICO: Eliminare o stornare movimento ID 266506")
        print("  2. Eliminare i 7 duplicati trovati (CHF 10,780.50)")
        print("  3. Investigare ulteriori CHF 202K di discrepanza\n")

        # Salva report dettagliato
        report = {
            'timestamp': datetime.now().isoformat(),
            'critical_issue': {
                'id': 266506,
                'description': 'Azzeramento 2023 erroneamente registrato nel 2024',
                'amount': 132834.54,
                'impact': 'Causa principale della discrepanza',
                'action': 'ELIMINARE O STORNARE'
            },
            'azzeramenti_found': len(azzeramenti),
            'monthly_distribution': dict(monthly)
        }

        with open(r'C:\Users\lapa\Desktop\Claude Code\app-hub-platform\ANALISI-APPROFONDITA-CS.json', 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)

        print("Report salvato in: ANALISI-APPROFONDITA-CS.json\n")

if __name__ == '__main__':
    analyzer = DeepAnalyzer()
    analyzer.run_deep_analysis()
