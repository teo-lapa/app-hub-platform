# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
ODOO INTEGRATION MASTER - Riconciliazione AVANZATA Konto 1023
==============================================================

STRATEGIA AVANZATA per riconciliare Outstanding Payments:

1. EXACT MATCH: Payment = Invoice (stesso importo, stesso partner)
2. PARTIAL PAYMENTS: Un payment copre più invoices
3. MULTIPLE PAYMENTS: Più payments coprono una invoice
4. DATE MATCHING: Riconcilia per data + partner quando importi non matchano
5. MANUAL REVIEW: Righe che richiedono revisione manuale

Author: Odoo Integration Master
Date: 2025-11-15
"""

import sys
import io

# Fix encoding per Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import xmlrpc.client
import ssl
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import json

ODOO_CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

class AdvancedReconciliation:
    """Riconciliazione avanzata con gestione edge cases"""

    def __init__(self, config: Dict):
        self.config = config
        self.uid = None
        self.models = None
        self.common = None

        # Statistiche dettagliate
        self.stats = {
            'exact_match': 0,
            'partial_payment': 0,
            'multiple_payments': 0,
            'date_match': 0,
            'manual_review': 0,
            'errors': 0,
            'amount_reconciled': 0.0
        }

        # Report per categoria
        self.reports = {
            'exact': [],
            'partial': [],
            'multiple': [],
            'date_match': [],
            'manual': []
        }

    def connect(self) -> bool:
        """Connessione XML-RPC"""
        try:
            print(f"\n{'='*70}")
            print("ADVANCED RECONCILIATION - Konto 1023")
            print(f"{'='*70}\n")

            ssl_context = ssl._create_unverified_context()

            common_url = f"{self.config['url']}/xmlrpc/2/common"
            self.common = xmlrpc.client.ServerProxy(common_url, context=ssl_context)

            self.uid = self.common.authenticate(
                self.config['db'],
                self.config['username'],
                self.config['password'],
                {}
            )

            if not self.uid:
                return False

            models_url = f"{self.config['url']}/xmlrpc/2/object"
            self.models = xmlrpc.client.ServerProxy(models_url, context=ssl_context)

            print(f"✓ Connesso (UID: {self.uid})\n")
            return True

        except Exception as e:
            print(f"ERRORE connessione: {e}")
            return False

    def get_unreconciled_lines(self) -> Tuple[List[Dict], List[Dict]]:
        """
        Estrae righe non riconciliate separate per tipo:
        - PAYMENTS (debit > 0): Pagamenti effettuati
        - INVOICES (credit > 0): Fatture da pagare
        """
        try:
            # Cerca conto 1023
            account_ids = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.account', 'search',
                [[['code', '=', '1023']]]
            )

            if not account_ids:
                return [], []

            account_id = account_ids[0]

            # Tutte le righe non riconciliate
            domain = [
                ['account_id', '=', account_id],
                ['reconciled', '=', False],
                ['parent_state', '=', 'posted']
            ]

            line_ids = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'search',
                [domain]
            )

            lines = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'read',
                [line_ids],
                {
                    'fields': [
                        'id', 'name', 'date', 'debit', 'credit', 'balance',
                        'partner_id', 'move_id', 'payment_id', 'ref', 'amount_residual'
                    ]
                }
            )

            # Separa payments e invoices
            payments = [l for l in lines if l['debit'] > 0]
            invoices = [l for l in lines if l['credit'] > 0]

            print(f"Righe non riconciliate:")
            print(f"  Payments (debit): {len(payments)}")
            print(f"  Invoices (credit): {len(invoices)}")
            print(f"  Totale: {len(lines)}\n")

            return payments, invoices

        except Exception as e:
            print(f"ERRORE estrazione: {e}")
            return [], []

    def exact_match(self, payments: List[Dict], invoices: List[Dict]) -> None:
        """
        STRATEGIA 1: EXACT MATCH
        Payment = Invoice (stesso importo, stesso partner)
        """
        print(f"\n{'='*70}")
        print("STRATEGIA 1: EXACT MATCH")
        print(f"{'='*70}\n")

        matched = 0

        for payment in payments:
            partner_id = payment['partner_id'][0] if payment['partner_id'] else None
            if not partner_id:
                continue

            payment_amount = payment['debit']

            # Cerca invoice con stesso partner e importo
            for invoice in invoices:
                invoice_partner = invoice['partner_id'][0] if invoice['partner_id'] else None
                invoice_amount = invoice['credit']

                # MATCH!
                if (invoice_partner == partner_id and
                    abs(payment_amount - invoice_amount) < 0.01):  # Tolleranza 1 centesimo

                    print(f"✓ MATCH trovato:")
                    print(f"  Payment: {payment['move_id'][1]} - CHF {payment_amount:.2f}")
                    print(f"  Invoice: {invoice['move_id'][1]} - CHF {invoice_amount:.2f}")
                    print(f"  Partner: {payment['partner_id'][1]}\n")

                    # Riconcilia
                    try:
                        self.models.execute_kw(
                            self.config['db'], self.uid, self.config['password'],
                            'account.move.line', 'reconcile',
                            [[payment['id'], invoice['id']]]
                        )

                        matched += 1
                        self.stats['exact_match'] += 1
                        self.stats['amount_reconciled'] += payment_amount

                        self.reports['exact'].append({
                            'payment_id': payment['id'],
                            'invoice_id': invoice['id'],
                            'partner': payment['partner_id'][1],
                            'amount': payment_amount,
                            'status': 'RECONCILED'
                        })

                        # Rimuovi invoice dalla lista
                        invoices.remove(invoice)
                        break

                    except Exception as e:
                        print(f"  ERRORE riconciliazione: {e}\n")
                        self.stats['errors'] += 1

        print(f"{'='*70}")
        print(f"EXACT MATCH completato: {matched} riconciliazioni")
        print(f"{'='*70}\n")

    def partial_payments(self, payments: List[Dict], invoices: List[Dict]) -> None:
        """
        STRATEGIA 2: PARTIAL PAYMENTS
        Un payment copre più invoices dello stesso partner
        """
        print(f"\n{'='*70}")
        print("STRATEGIA 2: PARTIAL PAYMENTS")
        print(f"{'='*70}\n")

        # Raggruppa invoices per partner
        invoices_by_partner = defaultdict(list)
        for inv in invoices:
            if inv['partner_id']:
                invoices_by_partner[inv['partner_id'][0]].append(inv)

        matched = 0

        for payment in payments:
            partner_id = payment['partner_id'][0] if payment['partner_id'] else None
            if not partner_id or partner_id not in invoices_by_partner:
                continue

            payment_amount = payment['debit']
            partner_invoices = invoices_by_partner[partner_id]

            # Cerca combinazione di invoices che matchano il payment
            # (Semplificato: somma invoices fino a raggiungere payment amount)
            selected_invoices = []
            remaining = payment_amount

            for inv in sorted(partner_invoices, key=lambda x: x['date']):
                inv_amount = inv['credit']
                if inv_amount <= remaining + 0.01:  # Tolleranza
                    selected_invoices.append(inv)
                    remaining -= inv_amount

                    if abs(remaining) < 0.01:  # Match completo
                        break

            # Se abbiamo match
            if selected_invoices and abs(remaining) < 0.01:
                print(f"✓ PARTIAL PAYMENT trovato:")
                print(f"  Payment: {payment['move_id'][1]} - CHF {payment_amount:.2f}")
                print(f"  Invoices ({len(selected_invoices)}):")
                for inv in selected_invoices:
                    print(f"    - {inv['move_id'][1]} - CHF {inv['credit']:.2f}")
                print(f"  Partner: {payment['partner_id'][1]}\n")

                # Riconcilia
                try:
                    line_ids = [payment['id']] + [inv['id'] for inv in selected_invoices]
                    self.models.execute_kw(
                        self.config['db'], self.uid, self.config['password'],
                        'account.move.line', 'reconcile',
                        [line_ids]
                    )

                    matched += 1
                    self.stats['partial_payment'] += 1
                    self.stats['amount_reconciled'] += payment_amount

                    self.reports['partial'].append({
                        'payment_id': payment['id'],
                        'invoice_ids': [inv['id'] for inv in selected_invoices],
                        'partner': payment['partner_id'][1],
                        'amount': payment_amount,
                        'num_invoices': len(selected_invoices),
                        'status': 'RECONCILED'
                    })

                    # Rimuovi invoices riconciliate
                    for inv in selected_invoices:
                        if inv in invoices:
                            invoices.remove(inv)
                        invoices_by_partner[partner_id].remove(inv)

                except Exception as e:
                    print(f"  ERRORE riconciliazione: {e}\n")
                    self.stats['errors'] += 1

        print(f"{'='*70}")
        print(f"PARTIAL PAYMENTS completato: {matched} riconciliazioni")
        print(f"{'='*70}\n")

    def date_range_match(self, payments: List[Dict], invoices: List[Dict]) -> None:
        """
        STRATEGIA 3: DATE RANGE MATCH
        Riconcilia per partner + data vicina (± 7 giorni)
        quando importi sono simili (± 5%)
        """
        print(f"\n{'='*70}")
        print("STRATEGIA 3: DATE RANGE MATCH")
        print(f"{'='*70}\n")

        matched = 0

        for payment in payments[:50]:  # Limita a 50 per test
            partner_id = payment['partner_id'][0] if payment['partner_id'] else None
            if not partner_id:
                continue

            payment_amount = payment['debit']
            payment_date = datetime.strptime(payment['date'], '%Y-%m-%d')

            # Cerca invoices con data vicina e importo simile
            for invoice in invoices:
                invoice_partner = invoice['partner_id'][0] if invoice['partner_id'] else None
                if invoice_partner != partner_id:
                    continue

                invoice_amount = invoice['credit']
                invoice_date = datetime.strptime(invoice['date'], '%Y-%m-%d')

                # Check date range (± 7 giorni)
                date_diff = abs((payment_date - invoice_date).days)
                if date_diff > 7:
                    continue

                # Check amount similarity (± 5%)
                amount_diff_pct = abs(payment_amount - invoice_amount) / payment_amount * 100
                if amount_diff_pct > 5:
                    continue

                print(f"✓ DATE MATCH trovato:")
                print(f"  Payment: {payment['move_id'][1]} - CHF {payment_amount:.2f} ({payment['date']})")
                print(f"  Invoice: {invoice['move_id'][1]} - CHF {invoice_amount:.2f} ({invoice['date']})")
                print(f"  Diff: {date_diff} giorni, {amount_diff_pct:.1f}% importo")
                print(f"  Partner: {payment['partner_id'][1]}\n")

                # Riconcilia
                try:
                    self.models.execute_kw(
                        self.config['db'], self.uid, self.config['password'],
                        'account.move.line', 'reconcile',
                        [[payment['id'], invoice['id']]]
                    )

                    matched += 1
                    self.stats['date_match'] += 1
                    self.stats['amount_reconciled'] += payment_amount

                    self.reports['date_match'].append({
                        'payment_id': payment['id'],
                        'invoice_id': invoice['id'],
                        'partner': payment['partner_id'][1],
                        'amount': payment_amount,
                        'date_diff_days': date_diff,
                        'amount_diff_pct': amount_diff_pct,
                        'status': 'RECONCILED'
                    })

                    invoices.remove(invoice)
                    break

                except Exception as e:
                    print(f"  ERRORE riconciliazione: {e}\n")
                    self.stats['errors'] += 1

        print(f"{'='*70}")
        print(f"DATE MATCH completato: {matched} riconciliazioni")
        print(f"{'='*70}\n")

    def generate_manual_review_list(self, payments: List[Dict], invoices: List[Dict]) -> None:
        """Genera lista righe per revisione manuale"""
        print(f"\n{'='*70}")
        print("MANUAL REVIEW LIST")
        print(f"{'='*70}\n")

        print(f"Payments rimanenti: {len(payments)}")
        print(f"Invoices rimanenti: {len(invoices)}\n")

        # Aggiungi a report
        for p in payments:
            self.reports['manual'].append({
                'type': 'PAYMENT',
                'id': p['id'],
                'move': p['move_id'][1],
                'partner': p['partner_id'][1] if p['partner_id'] else 'NO PARTNER',
                'amount': p['debit'],
                'date': p['date'],
                'reason': 'Nessun match trovato - revisione manuale richiesta'
            })

        for i in invoices:
            self.reports['manual'].append({
                'type': 'INVOICE',
                'id': i['id'],
                'move': i['move_id'][1],
                'partner': i['partner_id'][1] if i['partner_id'] else 'NO PARTNER',
                'amount': i['credit'],
                'date': i['date'],
                'reason': 'Nessun match trovato - revisione manuale richiesta'
            })

        self.stats['manual_review'] = len(payments) + len(invoices)

    def generate_excel_report(self) -> None:
        """Genera report Excel multi-sheet"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"riconciliazione_advanced_{timestamp}.xlsx"
            filepath = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\{filename}"

            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                # Sheet 1: Summary
                summary = pd.DataFrame([
                    ['Exact Match', self.stats['exact_match']],
                    ['Partial Payments', self.stats['partial_payment']],
                    ['Date Match', self.stats['date_match']],
                    ['Manual Review', self.stats['manual_review']],
                    ['Errori', self.stats['errors']],
                    ['', ''],
                    ['Importo Riconciliato (CHF)', f"{self.stats['amount_reconciled']:,.2f}"]
                ], columns=['Categoria', 'Count'])
                summary.to_excel(writer, sheet_name='Summary', index=False)

                # Sheet 2-6: Dettagli per categoria
                for category in ['exact', 'partial', 'date_match', 'manual']:
                    if self.reports[category]:
                        df = pd.DataFrame(self.reports[category])
                        df.to_excel(writer, sheet_name=category.title(), index=False)

            print(f"✓ Report Excel generato: {filename}\n")

        except Exception as e:
            print(f"ERRORE generazione report: {e}")

    def print_final_summary(self) -> None:
        """Summary finale"""
        print(f"\n{'='*70}")
        print("FINAL SUMMARY - ADVANCED RECONCILIATION")
        print(f"{'='*70}\n")

        total_reconciled = (self.stats['exact_match'] +
                          self.stats['partial_payment'] +
                          self.stats['date_match'])

        print("RICONCILIAZIONI PER STRATEGIA:")
        print(f"  1. Exact Match: {self.stats['exact_match']}")
        print(f"  2. Partial Payments: {self.stats['partial_payment']}")
        print(f"  3. Date Match: {self.stats['date_match']}")
        print(f"\nTotale riconciliate: {total_reconciled}")
        print(f"Importo riconciliato: CHF {self.stats['amount_reconciled']:,.2f}")
        print(f"\nRevisione manuale richiesta: {self.stats['manual_review']}")
        print(f"Errori: {self.stats['errors']}")
        print(f"\n{'='*70}\n")

def main():
    """Main execution"""
    reconciler = AdvancedReconciliation(ODOO_CONFIG)

    # Connetti
    if not reconciler.connect():
        return

    # Estrai righe
    payments, invoices = reconciler.get_unreconciled_lines()
    if not payments and not invoices:
        print("Nessuna riga da riconciliare!")
        return

    # Strategia 1: Exact Match
    reconciler.exact_match(payments.copy(), invoices.copy())

    # Strategia 2: Partial Payments
    reconciler.partial_payments(payments.copy(), invoices.copy())

    # Strategia 3: Date Match
    reconciler.date_range_match(payments.copy(), invoices.copy())

    # Manual Review List
    # Ri-estrai righe rimanenti
    payments_remaining, invoices_remaining = reconciler.get_unreconciled_lines()
    reconciler.generate_manual_review_list(payments_remaining, invoices_remaining)

    # Report Excel
    reconciler.generate_excel_report()

    # Summary
    reconciler.print_final_summary()

    print("✓ Processo completato!\n")

if __name__ == "__main__":
    main()
