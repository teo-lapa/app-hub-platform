#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CREDIT SUISSE INVESTIGATOR - Analisi discrepanza CHF 436K

OBIETTIVO: Trovare perché Odoo mostra CHF 461,453.70 invece di CHF 24,897.72
DISCREPANZA: CHF 436,555.98 ECCESSO

Connessione a Odoo staging per analisi completa del konto 1026 (Credit Suisse)
"""

import sys
import io

# Force UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import xmlrpc.client
import json
from datetime import datetime
from collections import defaultdict, Counter
from typing import Dict, List, Any, Tuple
import os

# Configurazione Odoo (da .env.local - STAGING perché menzionato nel task)
# ATTENZIONE: Le credenziali in .env.local sono per MAIN, non staging
# Ma il task dice "staging URL": https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
# Userò le credenziali main ma proverò prima a vedere cosa c'è

ODOO_URL = "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-main-7268478"
ODOO_USERNAME = "apphubplatform@lapa.ch"
ODOO_PASSWORD = "apphubplatform2025"

# Dati attesi
EXPECTED_BALANCE = 24897.72
ODOO_CURRENT_BALANCE = 461453.70
DISCREPANCY = 436555.98

class OdooInvestigator:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.uid = None
        self.models = None

        self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')

    def authenticate(self):
        """Connessione a Odoo"""
        print(f"\n{'='*80}")
        print(f"CREDIT SUISSE INVESTIGATOR - Connessione a Odoo")
        print(f"{'='*80}")
        print(f"URL: {self.url}")
        print(f"DB: {self.db}")
        print(f"User: {self.username}")

        try:
            self.uid = self.common.authenticate(self.db, self.username, self.password, {})
            if not self.uid:
                raise Exception("Autenticazione fallita - credenziali errate")

            self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
            print(f"[OK] Autenticazione OK - UID: {self.uid}\n")
            return True

        except Exception as e:
            print(f"[ERROR] Errore autenticazione: {str(e)}\n")
            return False

    def find_account_1026(self):
        """Trova il conto 1026 (Credit Suisse)"""
        print(f"{'='*80}")
        print("STEP 1: Ricerca account 1026 (Credit Suisse)")
        print(f"{'='*80}")

        try:
            accounts = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.account', 'search_read',
                [[['code', '=', '1026']]],
                {'fields': ['id', 'code', 'name', 'currency_id', 'account_type']}
            )

            if not accounts:
                print("[ERROR] Account 1026 NON TROVATO!")
                return None

            account = accounts[0]
            print(f"[OK] Account trovato:")
            print(f"  ID: {account['id']}")
            print(f"  Code: {account['code']}")
            print(f"  Name: {account['name']}")
            print(f"  Currency: {account.get('currency_id', 'N/A')}")
            print(f"  Type: {account.get('account_type', 'N/A')}\n")

            return account['id']

        except Exception as e:
            print(f"[ERROR] Errore ricerca account: {str(e)}\n")
            return None

    def get_all_movements_2024(self, account_id: int) -> List[Dict]:
        """Estrai TUTTI i movimenti del konto 1026 nel 2024"""
        print(f"{'='*80}")
        print("STEP 2: Estrazione movimenti 2024")
        print(f"{'='*80}")

        try:
            domain = [
                ['account_id', '=', account_id],
                ['date', '>=', '2024-01-01'],
                ['date', '<=', '2024-12-31'],
                ['parent_state', '=', 'posted']  # Solo movimenti confermati
            ]

            fields = [
                'id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
                'partner_id', 'move_id', 'journal_id', 'company_id',
                'currency_id', 'amount_currency', 'display_name'
            ]

            print(f"Query: account_id={account_id}, year=2024, state=posted")

            lines = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move.line', 'search_read',
                [domain],
                {'fields': fields, 'order': 'date asc, id asc'}
            )

            print(f"[OK] Trovati {len(lines)} movimenti\n")
            return lines

        except Exception as e:
            print(f"[ERROR] Errore estrazione movimenti: {str(e)}\n")
            return []

    def calculate_balance(self, lines: List[Dict]) -> Dict[str, Any]:
        """Calcola saldo e statistiche"""
        print(f"{'='*80}")
        print("STEP 3: Calcolo saldo e statistiche")
        print(f"{'='*80}")

        total_debit = sum(line['debit'] for line in lines)
        total_credit = sum(line['credit'] for line in lines)
        balance = total_debit - total_credit

        print(f"  Totale Dare (Debit):  CHF {total_debit:,.2f}")
        print(f"  Totale Avere (Credit): CHF {total_credit:,.2f}")
        print(f"  Saldo Calcolato:       CHF {balance:,.2f}")
        print(f"  Saldo Atteso:          CHF {EXPECTED_BALANCE:,.2f}")
        print(f"  Saldo Odoo Attuale:    CHF {ODOO_CURRENT_BALANCE:,.2f}")
        print(f"  Differenza vs Atteso:  CHF {balance - EXPECTED_BALANCE:,.2f}\n")

        return {
            'total_debit': total_debit,
            'total_credit': total_credit,
            'balance_calculated': balance,
            'balance_expected': EXPECTED_BALANCE,
            'balance_odoo_current': ODOO_CURRENT_BALANCE,
            'difference_vs_expected': balance - EXPECTED_BALANCE,
            'difference_vs_odoo': balance - ODOO_CURRENT_BALANCE
        }

    def find_duplicates(self, lines: List[Dict]) -> List[Dict]:
        """Trova movimenti duplicati (stessa data, importo, partner)"""
        print(f"{'='*80}")
        print("STEP 4: Ricerca duplicati")
        print(f"{'='*80}")

        # Crea signature per ogni movimento
        signatures = defaultdict(list)

        for line in lines:
            # Signature: data + debit + credit + partner
            partner_id = line['partner_id'][0] if line['partner_id'] else 0
            sig = f"{line['date']}|{line['debit']}|{line['credit']}|{partner_id}"
            signatures[sig].append(line)

        # Trova duplicati
        duplicates = []
        for sig, items in signatures.items():
            if len(items) > 1:
                duplicates.append({
                    'signature': sig,
                    'count': len(items),
                    'total_amount': sum(item['debit'] - item['credit'] for item in items),
                    'items': items
                })

        duplicates.sort(key=lambda x: abs(x['total_amount']), reverse=True)

        print(f"  Trovati {len(duplicates)} set di duplicati")

        if duplicates:
            print(f"\n  Top 10 duplicati per importo:")
            for i, dup in enumerate(duplicates[:10], 1):
                print(f"    {i}. {dup['count']} movimenti identici - CHF {dup['total_amount']:,.2f}")
                print(f"       Signature: {dup['signature']}")
                print(f"       IDs: {[item['id'] for item in dup['items']]}")

        print()
        return duplicates

    def find_large_movements(self, lines: List[Dict], threshold: float = 50000) -> List[Dict]:
        """Trova movimenti molto grandi (> threshold)"""
        print(f"{'='*80}")
        print(f"STEP 5: Ricerca movimenti > CHF {threshold:,.0f}")
        print(f"{'='*80}")

        large = []
        for line in lines:
            amount = abs(line['debit'] - line['credit'])
            if amount > threshold:
                large.append({
                    'id': line['id'],
                    'date': line['date'],
                    'amount': amount,
                    'debit': line['debit'],
                    'credit': line['credit'],
                    'partner': line['partner_id'][1] if line['partner_id'] else 'N/A',
                    'ref': line['ref'] or '',
                    'name': line['name'] or '',
                    'journal': line['journal_id'][1] if line['journal_id'] else 'N/A'
                })

        large.sort(key=lambda x: x['amount'], reverse=True)

        print(f"  Trovati {len(large)} movimenti grandi")

        if large:
            print(f"\n  Top 20 movimenti per importo:")
            for i, mov in enumerate(large[:20], 1):
                print(f"    {i}. ID {mov['id']} - {mov['date']} - CHF {mov['amount']:,.2f}")
                print(f"       Partner: {mov['partner']}")
                print(f"       Journal: {mov['journal']}")
                print(f"       Ref: {mov['ref']}")
                print(f"       Name: {mov['name'][:60]}")

        print()
        return large

    def find_anomalies(self, lines: List[Dict]) -> Dict[str, List]:
        """Trova anomalie varie"""
        print(f"{'='*80}")
        print("STEP 6: Ricerca altre anomalie")
        print(f"{'='*80}")

        anomalies = {
            'no_partner': [],
            'no_ref': [],
            'strange_journal': [],
            'zero_amount': [],
            'same_debit_credit': []
        }

        for line in lines:
            # Senza partner
            if not line['partner_id']:
                anomalies['no_partner'].append(line)

            # Senza riferimento
            if not line['ref']:
                anomalies['no_ref'].append(line)

            # Importo zero
            if line['debit'] == 0 and line['credit'] == 0:
                anomalies['zero_amount'].append(line)

            # Debit = Credit (molto strano)
            if line['debit'] > 0 and line['debit'] == line['credit']:
                anomalies['same_debit_credit'].append(line)

        print(f"  Movimenti senza partner: {len(anomalies['no_partner'])}")
        print(f"  Movimenti senza ref: {len(anomalies['no_ref'])}")
        print(f"  Movimenti con importo zero: {len(anomalies['zero_amount'])}")
        print(f"  Movimenti con debit=credit: {len(anomalies['same_debit_credit'])}\n")

        return anomalies

    def analyze_journals(self, lines: List[Dict]) -> Dict[str, Any]:
        """Analizza distribuzione per journal"""
        print(f"{'='*80}")
        print("STEP 7: Analisi journals")
        print(f"{'='*80}")

        journal_stats = defaultdict(lambda: {'count': 0, 'debit': 0, 'credit': 0, 'balance': 0})

        for line in lines:
            journal_name = line['journal_id'][1] if line['journal_id'] else 'N/A'
            journal_stats[journal_name]['count'] += 1
            journal_stats[journal_name]['debit'] += line['debit']
            journal_stats[journal_name]['credit'] += line['credit']
            journal_stats[journal_name]['balance'] += line['debit'] - line['credit']

        print(f"  Journal utilizzati: {len(journal_stats)}\n")

        # Ordina per balance assoluto
        sorted_journals = sorted(
            journal_stats.items(),
            key=lambda x: abs(x[1]['balance']),
            reverse=True
        )

        print(f"  Distribuzione per journal:")
        for journal, stats in sorted_journals:
            print(f"    {journal}:")
            print(f"      Movimenti: {stats['count']}")
            print(f"      Balance: CHF {stats['balance']:,.2f}")
            print(f"      Debit: CHF {stats['debit']:,.2f}")
            print(f"      Credit: CHF {stats['credit']:,.2f}")

        print()
        return dict(journal_stats)

    def generate_correction_plan(self,
                                duplicates: List[Dict],
                                large: List[Dict],
                                anomalies: Dict,
                                balance_info: Dict) -> Dict[str, Any]:
        """Genera piano di correzione"""
        print(f"{'='*80}")
        print("STEP 8: Piano di correzione")
        print(f"{'='*80}")

        plan = {
            'critical_issues': [],
            'suspicious_movements': [],
            'recommended_actions': [],
            'sql_queries': []
        }

        # Analisi discrepanza
        diff = balance_info['difference_vs_expected']
        target_diff = DISCREPANCY

        print(f"  ANALISI DISCREPANZA:")
        print(f"  Saldo calcolato: CHF {balance_info['balance_calculated']:,.2f}")
        print(f"  Saldo atteso: CHF {EXPECTED_BALANCE:,.2f}")
        print(f"  Differenza: CHF {diff:,.2f}")
        print(f"  Target da rimuovere: CHF {target_diff:,.2f}\n")

        # Se ci sono duplicati che coprono la discrepanza
        if duplicates:
            total_dup_amount = sum(abs(d['total_amount']) for d in duplicates)
            print(f"  Importo totale duplicati: CHF {total_dup_amount:,.2f}")

            if abs(total_dup_amount - target_diff) < 1000:  # Tolleranza CHF 1000
                plan['critical_issues'].append({
                    'type': 'DUPLICATES_MATCH_DISCREPANCY',
                    'description': f'I duplicati totalizzano CHF {total_dup_amount:,.2f}, molto vicino alla discrepanza di CHF {target_diff:,.2f}',
                    'severity': 'CRITICAL',
                    'action': 'Eliminare i movimenti duplicati identificati'
                })

        # Movimenti grandi sospetti
        for mov in large[:5]:  # Top 5
            plan['suspicious_movements'].append({
                'id': mov['id'],
                'date': mov['date'],
                'amount': mov['amount'],
                'partner': mov['partner'],
                'reason': f'Importo molto grande: CHF {mov["amount"]:,.2f}'
            })

        # Raccomandazioni
        if duplicates:
            dup_ids = []
            for dup in duplicates:
                # Tieni il primo, elimina gli altri
                dup_ids.extend([item['id'] for item in dup['items'][1:]])

            plan['recommended_actions'].append({
                'action': 'DELETE_DUPLICATES',
                'description': f'Eliminare {len(dup_ids)} movimenti duplicati',
                'affected_ids': dup_ids,
                'impact_amount': sum(abs(d['total_amount']) for d in duplicates)
            })

            # SQL per eliminazione
            plan['sql_queries'].append({
                'type': 'DELETE',
                'description': 'Elimina movimenti duplicati',
                'query': f"DELETE FROM account_move_line WHERE id IN ({','.join(map(str, dup_ids[:100]))});"
            })

        print(f"  Azioni raccomandate: {len(plan['recommended_actions'])}")
        print(f"  Query SQL preparate: {len(plan['sql_queries'])}\n")

        return plan

    def run_investigation(self) -> Dict[str, Any]:
        """Esegue l'investigazione completa"""

        if not self.authenticate():
            return {'error': 'Autenticazione fallita'}

        # 1. Trova account 1026
        account_id = self.find_account_1026()
        if not account_id:
            return {'error': 'Account 1026 non trovato'}

        # 2. Estrai tutti i movimenti
        lines = self.get_all_movements_2024(account_id)
        if not lines:
            return {'error': 'Nessun movimento trovato'}

        # 3. Calcola saldo
        balance_info = self.calculate_balance(lines)

        # 4. Trova duplicati
        duplicates = self.find_duplicates(lines)

        # 5. Trova movimenti grandi
        large_movements = self.find_large_movements(lines)

        # 6. Trova anomalie
        anomalies = self.find_anomalies(lines)

        # 7. Analizza journals
        journal_stats = self.analyze_journals(lines)

        # 8. Piano di correzione
        correction_plan = self.generate_correction_plan(
            duplicates, large_movements, anomalies, balance_info
        )

        # Prepara report finale
        report = {
            'metadata': {
                'investigation_date': datetime.now().isoformat(),
                'odoo_url': self.url,
                'odoo_db': self.db,
                'account_id': account_id,
                'account_code': '1026',
                'year': 2024
            },
            'expected_data': {
                'bank': 'Credit Suisse',
                'account_numbers': ['3977497-51', '3977497-51-1'],
                'balance_real': EXPECTED_BALANCE,
                'balance_odoo_current': ODOO_CURRENT_BALANCE,
                'discrepancy_target': DISCREPANCY
            },
            'analysis_results': {
                'total_movements': len(lines),
                'balance_info': balance_info,
                'duplicates_found': len(duplicates),
                'duplicates_details': duplicates[:20] if duplicates else [],
                'large_movements_found': len(large_movements),
                'large_movements_top20': large_movements[:20],
                'anomalies': {
                    'no_partner_count': len(anomalies['no_partner']),
                    'no_ref_count': len(anomalies['no_ref']),
                    'zero_amount_count': len(anomalies['zero_amount']),
                    'same_debit_credit_count': len(anomalies['same_debit_credit'])
                },
                'journal_distribution': journal_stats
            },
            'correction_plan': correction_plan,
            'raw_movements_sample': lines[:50]  # Primi 50 per reference
        }

        return report

def main():
    """Main execution"""

    print(f"\n{'#'*80}")
    print(f"# CREDIT SUISSE INVESTIGATOR - DISCREPANZA CHF 436K")
    print(f"#{'#'*80}\n")
    print(f"Target: Trovare perché Odoo ha CHF 461K invece di CHF 25K")
    print(f"Discrepanza: CHF 436,555.98 ECCESSO\n")

    investigator = OdooInvestigator()
    report = investigator.run_investigation()

    # Salva report
    output_path = r'C:\Users\lapa\Desktop\Claude Code\app-hub-platform\REPORT-CREDIT-SUISSE-DISCREPANZA.json'

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n{'='*80}")
    print(f"REPORT SALVATO")
    print(f"{'='*80}")
    print(f"Path: {output_path}")
    print(f"Size: {os.path.getsize(output_path):,} bytes\n")

    # Summary finale
    if 'error' not in report:
        print(f"{'='*80}")
        print(f"SUMMARY ESECUTIVO")
        print(f"{'='*80}")
        print(f"Movimenti analizzati: {report['analysis_results']['total_movements']}")
        print(f"Saldo calcolato: CHF {report['analysis_results']['balance_info']['balance_calculated']:,.2f}")
        print(f"Saldo atteso: CHF {EXPECTED_BALANCE:,.2f}")
        print(f"Differenza: CHF {report['analysis_results']['balance_info']['difference_vs_expected']:,.2f}")
        print(f"Duplicati trovati: {report['analysis_results']['duplicates_found']}")
        print(f"Movimenti grandi (>50K): {report['analysis_results']['large_movements_found']}")
        print(f"Azioni correttive: {len(report['correction_plan']['recommended_actions'])}\n")

if __name__ == '__main__':
    main()
