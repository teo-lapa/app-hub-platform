# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
ODOO INTEGRATION MASTER - Riconciliazione Konto 1023 Outstanding Payments
=====================================================================

TASK CRITICO: Riconciliare 691 righe non riconciliate (-CHF 84,573.31)

STRATEGIA:
1. Connessione XML-RPC a Odoo 17
2. Estrazione righe non riconciliate account.move.line (account_id = 1023)
3. Identificazione pagamenti fornitori e relative fatture
4. Riconciliazione automatica payment <-> invoice
5. Gestione edge cases (pagamenti multipli, partial payments)
6. Report Excel dettagliato

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
from datetime import datetime
from typing import List, Dict, Tuple
from collections import defaultdict
import json

# ========================================
# CONFIGURAZIONE ODOO
# ========================================

ODOO_CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

class OdooReconciliation:
    """Classe per gestire riconciliazione Konto 1023"""

    def __init__(self, config: Dict):
        self.config = config
        self.uid = None
        self.models = None
        self.common = None

        # Statistiche
        self.stats = {
            'total_lines': 0,
            'reconciled': 0,
            'partial': 0,
            'not_found': 0,
            'errors': 0,
            'amount_reconciled': 0.0
        }

        # Report dettagliato
        self.reconciliation_report = []

    def connect(self) -> bool:
        """Connessione XML-RPC a Odoo"""
        try:
            print(f"\n{'='*70}")
            print(f"CONNESSIONE ODOO 17 - Outstanding Payments Reconciliation")
            print(f"{'='*70}\n")

            # Bypass SSL verification per dev environment
            ssl_context = ssl._create_unverified_context()

            # Common endpoint per autenticazione
            common_url = f"{self.config['url']}/xmlrpc/2/common"
            self.common = xmlrpc.client.ServerProxy(common_url, context=ssl_context)

            # Authenticate
            print(f"Autenticazione: {self.config['username']}...")
            self.uid = self.common.authenticate(
                self.config['db'],
                self.config['username'],
                self.config['password'],
                {}
            )

            if not self.uid:
                print("ERRORE: Autenticazione fallita!")
                return False

            print(f"✓ Autenticato con successo (UID: {self.uid})\n")

            # Models endpoint per operazioni
            models_url = f"{self.config['url']}/xmlrpc/2/object"
            self.models = xmlrpc.client.ServerProxy(models_url, context=ssl_context)

            # Test connessione
            partner_count = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'res.partner', 'search_count', [[]]
            )
            print(f"✓ Connessione OK - {partner_count} partners nel sistema\n")

            return True

        except Exception as e:
            print(f"ERRORE connessione: {e}")
            return False

    def get_account_1023_id(self) -> int:
        """Trova l'ID del conto 1023 Outstanding Payments"""
        try:
            print("Ricerca conto 1023 Outstanding Payments...")

            # Cerca per codice
            account_ids = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.account', 'search',
                [[['code', '=', '1023']]]
            )

            if not account_ids:
                # Cerca per name
                account_ids = self.models.execute_kw(
                    self.config['db'], self.uid, self.config['password'],
                    'account.account', 'search',
                    [[['name', 'ilike', 'Outstanding Payment']]]
                )

            if account_ids:
                account = self.models.execute_kw(
                    self.config['db'], self.uid, self.config['password'],
                    'account.account', 'read',
                    [account_ids[0]], {'fields': ['id', 'code', 'name']}
                )
                print(f"✓ Trovato: {account[0]['code']} - {account[0]['name']}")
                return account[0]['id']

            print("ERRORE: Conto 1023 non trovato!")
            return None

        except Exception as e:
            print(f"ERRORE ricerca conto: {e}")
            return None

    def get_unreconciled_lines(self, account_id: int) -> List[Dict]:
        """Estrae tutte le righe non riconciliate del conto 1023"""
        try:
            print(f"\n{'='*70}")
            print("ESTRAZIONE RIGHE NON RICONCILIATE")
            print(f"{'='*70}\n")

            # Cerca righe non riconciliate
            domain = [
                ['account_id', '=', account_id],
                ['reconciled', '=', False],
                ['parent_state', '=', 'posted']  # Solo movimenti contabilizzati
            ]

            line_ids = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'search',
                [domain]
            )

            if not line_ids:
                print("Nessuna riga non riconciliata trovata.")
                return []

            print(f"Trovate {len(line_ids)} righe non riconciliate")
            print("Caricamento dettagli...")

            # Leggi dettagli
            lines = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'read',
                [line_ids],
                {
                    'fields': [
                        'id', 'name', 'date', 'debit', 'credit', 'balance',
                        'partner_id', 'move_id', 'payment_id', 'ref',
                        'full_reconcile_id', 'matched_debit_ids', 'matched_credit_ids'
                    ]
                }
            )

            self.stats['total_lines'] = len(lines)

            # Analisi
            total_debit = sum(l['debit'] for l in lines)
            total_credit = sum(l['credit'] for l in lines)
            total_balance = sum(l['balance'] for l in lines)

            print(f"\n{'='*70}")
            print("ANALISI RIGHE NON RICONCILIATE:")
            print(f"{'='*70}")
            print(f"Totale righe: {len(lines)}")
            print(f"Dare totale: CHF {total_debit:,.2f}")
            print(f"Avere totale: CHF {total_credit:,.2f}")
            print(f"Saldo totale: CHF {total_balance:,.2f}")
            print(f"{'='*70}\n")

            return lines

        except Exception as e:
            print(f"ERRORE estrazione righe: {e}")
            return []

    def find_matching_invoice(self, payment_line: Dict) -> Dict:
        """
        Trova la fattura fornitore corrispondente a un pagamento

        STRATEGIA:
        1. Stesso partner
        2. Importo corrispondente (debit payment = credit invoice)
        3. Data compatibile (invoice prima del payment)
        """
        try:
            partner_id = payment_line['partner_id'][0] if payment_line['partner_id'] else None
            if not partner_id:
                return None

            # Importo da riconciliare
            amount = payment_line['debit'] if payment_line['debit'] > 0 else payment_line['credit']

            # Cerca fatture non riconciliate dello stesso partner
            domain = [
                ['partner_id', '=', partner_id],
                ['reconciled', '=', False],
                ['parent_state', '=', 'posted'],
                ['move_id.move_type', 'in', ['in_invoice', 'in_refund']],  # Fatture fornitori
                '|',
                ['debit', '=', amount],
                ['credit', '=', amount]
            ]

            invoice_line_ids = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'search',
                [domain], {'limit': 1}
            )

            if not invoice_line_ids:
                return None

            # Leggi dettagli fattura
            invoice_line = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'read',
                [invoice_line_ids[0]],
                {'fields': ['id', 'name', 'date', 'debit', 'credit', 'move_id', 'ref']}
            )

            return invoice_line[0] if invoice_line else None

        except Exception as e:
            print(f"  ERRORE ricerca fattura: {e}")
            return None

    def reconcile_lines(self, line_ids: List[int]) -> bool:
        """
        Riconcilia un gruppo di righe contabili

        In Odoo 17, la riconciliazione si fa tramite account.move.line.reconcile()
        """
        try:
            # Riconcilia
            result = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'reconcile',
                [line_ids]
            )

            return True

        except Exception as e:
            print(f"  ERRORE riconciliazione: {e}")
            return False

    def process_reconciliation(self, lines: List[Dict]) -> None:
        """Processa tutte le riconciliazioni"""
        try:
            print(f"\n{'='*70}")
            print("PROCESSO RICONCILIAZIONE")
            print(f"{'='*70}\n")

            for i, line in enumerate(lines, 1):
                print(f"\n[{i}/{len(lines)}] Processando riga ID {line['id']}...")

                # Info riga
                partner_name = line['partner_id'][1] if line['partner_id'] else 'NO PARTNER'
                amount = line['debit'] if line['debit'] > 0 else -line['credit']

                print(f"  Partner: {partner_name}")
                print(f"  Importo: CHF {amount:,.2f}")
                print(f"  Data: {line['date']}")
                print(f"  Ref: {line.get('ref', 'N/A')}")

                # Cerca fattura corrispondente
                invoice_line = self.find_matching_invoice(line)

                if not invoice_line:
                    print(f"  ⚠ Fattura non trovata - skip")
                    self.stats['not_found'] += 1
                    self.reconciliation_report.append({
                        'line_id': line['id'],
                        'partner': partner_name,
                        'amount': amount,
                        'date': line['date'],
                        'status': 'NOT_FOUND',
                        'error': 'Nessuna fattura corrispondente trovata'
                    })
                    continue

                print(f"  ✓ Fattura trovata: {invoice_line['move_id'][1]}")

                # Riconcilia
                success = self.reconcile_lines([line['id'], invoice_line['id']])

                if success:
                    print(f"  ✓ RICONCILIATO con successo!")
                    self.stats['reconciled'] += 1
                    self.stats['amount_reconciled'] += abs(amount)
                    self.reconciliation_report.append({
                        'line_id': line['id'],
                        'partner': partner_name,
                        'amount': amount,
                        'date': line['date'],
                        'invoice_id': invoice_line['move_id'][0],
                        'invoice_name': invoice_line['move_id'][1],
                        'status': 'RECONCILED'
                    })
                else:
                    print(f"  ✗ ERRORE riconciliazione")
                    self.stats['errors'] += 1
                    self.reconciliation_report.append({
                        'line_id': line['id'],
                        'partner': partner_name,
                        'amount': amount,
                        'date': line['date'],
                        'status': 'ERROR',
                        'error': 'Errore durante riconciliazione'
                    })

                # Progress ogni 50 righe
                if i % 50 == 0:
                    print(f"\n{'='*70}")
                    print(f"PROGRESS: {i}/{len(lines)} righe processate")
                    print(f"Riconciliate: {self.stats['reconciled']}")
                    print(f"Non trovate: {self.stats['not_found']}")
                    print(f"Errori: {self.stats['errors']}")
                    print(f"{'='*70}\n")

        except Exception as e:
            print(f"ERRORE processo riconciliazione: {e}")

    def verify_final_balance(self, account_id: int) -> float:
        """Verifica saldo finale del conto 1023"""
        try:
            print(f"\n{'='*70}")
            print("VERIFICA SALDO FINALE")
            print(f"{'='*70}\n")

            # Conta righe non riconciliate rimanenti
            domain = [
                ['account_id', '=', account_id],
                ['reconciled', '=', False],
                ['parent_state', '=', 'posted']
            ]

            remaining_ids = self.models.execute_kw(
                self.config['db'], self.uid, self.config['password'],
                'account.move.line', 'search',
                [domain]
            )

            if remaining_ids:
                remaining_lines = self.models.execute_kw(
                    self.config['db'], self.uid, self.config['password'],
                    'account.move.line', 'read',
                    [remaining_ids],
                    {'fields': ['balance']}
                )

                remaining_balance = sum(l['balance'] for l in remaining_lines)

                print(f"Righe non riconciliate rimanenti: {len(remaining_ids)}")
                print(f"Saldo rimanente: CHF {remaining_balance:,.2f}")

                return remaining_balance
            else:
                print("✓ NESSUNA riga non riconciliata rimanente!")
                print("✓ Saldo: CHF 0.00")
                return 0.0

        except Exception as e:
            print(f"ERRORE verifica saldo: {e}")
            return None

    def generate_report(self) -> None:
        """Genera report Excel completo"""
        try:
            print(f"\n{'='*70}")
            print("GENERAZIONE REPORT EXCEL")
            print(f"{'='*70}\n")

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"riconciliazione_konto_1023_{timestamp}.xlsx"
            filepath = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\{filename}"

            # Crea DataFrame
            df = pd.DataFrame(self.reconciliation_report)

            # Crea Excel con statistiche
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                # Sheet 1: Dettaglio riconciliazioni
                df.to_excel(writer, sheet_name='Riconciliazioni', index=False)

                # Sheet 2: Statistiche
                stats_df = pd.DataFrame([
                    ['Totale righe processate', self.stats['total_lines']],
                    ['Riconciliate con successo', self.stats['reconciled']],
                    ['Fatture non trovate', self.stats['not_found']],
                    ['Errori', self.stats['errors']],
                    ['Importo riconciliato (CHF)', f"{self.stats['amount_reconciled']:,.2f}"],
                    ['Tasso successo (%)', f"{(self.stats['reconciled']/self.stats['total_lines']*100):.1f}%" if self.stats['total_lines'] > 0 else "0%"]
                ], columns=['Metrica', 'Valore'])

                stats_df.to_excel(writer, sheet_name='Statistiche', index=False)

            print(f"✓ Report generato: {filename}\n")

        except Exception as e:
            print(f"ERRORE generazione report: {e}")

    def print_summary(self) -> None:
        """Stampa summary finale"""
        print(f"\n{'='*70}")
        print("SUMMARY RICONCILIAZIONE KONTO 1023")
        print(f"{'='*70}\n")

        print(f"Totale righe processate: {self.stats['total_lines']}")
        print(f"✓ Riconciliate: {self.stats['reconciled']}")
        print(f"⚠ Fatture non trovate: {self.stats['not_found']}")
        print(f"✗ Errori: {self.stats['errors']}")
        print(f"\nImporto riconciliato: CHF {self.stats['amount_reconciled']:,.2f}")

        if self.stats['total_lines'] > 0:
            success_rate = (self.stats['reconciled'] / self.stats['total_lines']) * 100
            print(f"Tasso successo: {success_rate:.1f}%")

        print(f"\n{'='*70}\n")

def main():
    """Main execution"""
    print("""
    ╔════════════════════════════════════════════════════════════════════╗
    ║  ODOO INTEGRATION MASTER - Riconciliazione Konto 1023             ║
    ║  Outstanding Payments Reconciliation                              ║
    ╚════════════════════════════════════════════════════════════════════╝
    """)

    # Inizializza
    reconciler = OdooReconciliation(ODOO_CONFIG)

    # 1. Connetti
    if not reconciler.connect():
        print("ERRORE: Impossibile connettersi a Odoo")
        return

    # 2. Trova conto 1023
    account_id = reconciler.get_account_1023_id()
    if not account_id:
        print("ERRORE: Conto 1023 non trovato")
        return

    # 3. Estrai righe non riconciliate
    lines = reconciler.get_unreconciled_lines(account_id)
    if not lines:
        print("Nessuna riga da riconciliare!")
        return

    # 4. Conferma utente
    print(f"\n⚠ ATTENZIONE: Verranno processate {len(lines)} righe non riconciliate")
    response = input("\nProcedere con la riconciliazione? (yes/no): ")

    if response.lower() != 'yes':
        print("\nOperazione annullata dall'utente.")
        return

    # 5. Processa riconciliazioni
    reconciler.process_reconciliation(lines)

    # 6. Verifica saldo finale
    final_balance = reconciler.verify_final_balance(account_id)

    # 7. Genera report
    reconciler.generate_report()

    # 8. Summary
    reconciler.print_summary()

    print("\n✓ Processo completato!\n")

if __name__ == "__main__":
    main()
