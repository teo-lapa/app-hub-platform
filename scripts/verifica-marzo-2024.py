#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VERIFICA COMPLETA MARZO 2024 - Riga per Riga
Confronta estratti conto JSON vs Odoo per tutti i konti bancari

Periodo: 01/03/2024 - 31/03/2024
Konti: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)
"""

import os
import sys
import json
import xmlrpc.client
from datetime import datetime, date
from decimal import Decimal
from collections import defaultdict
from typing import Dict, List, Any, Optional

# ============================================================================
# CONFIGURAZIONE ODOO
# ============================================================================

ODOO_URL = os.getenv('ODOO_URL', 'https://greenbay.odoo.com')
ODOO_DB = os.getenv('ODOO_DB', 'greenbay')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_PASSWORD = os.getenv('ODOO_PASSWORD')

PERIODO_START = '2024-03-01'
PERIODO_END = '2024-03-31'

# Mapping konti: account_id -> account_code
ACCOUNT_MAPPING = {
    1024: '1024',  # UBS CHF
    1025: '1025',  # UBS EUR
    1026: '1026',  # Credit Suisse CHF
}

# File JSON estratti conto
JSON_FILES = {
    '1024': 'data-estratti/UBS-CHF-2024-CLEAN.json',
    '1025': 'data-estratti/UBS-EUR-2024-CLEAN.json',
    '1026': 'data-estratti/CREDIT-SUISSE-2024-CLEAN.json',
}

# ============================================================================
# ODOO CLIENT
# ============================================================================

class OdooClient:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.uid = None
        self.common = None
        self.models = None

    def connect(self):
        """Connessione a Odoo"""
        print(f"[*] Connessione a Odoo: {self.url}")
        print(f"   Database: {self.db}")
        print(f"   Username: {self.username}")

        self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')

        self.uid = self.common.authenticate(
            self.db, self.username, self.password, {}
        )

        if not self.uid:
            raise Exception("[ERROR] Autenticazione fallita")

        print(f"[OK] Autenticato con UID: {self.uid}\n")
        return self.uid

    def search_read(self, model: str, domain: list, fields: list, limit=None):
        """Search and read records"""
        kwargs = {'fields': fields}
        if limit:
            kwargs['limit'] = limit

        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain],
            kwargs
        )

    def read(self, model: str, ids: list, fields: list):
        """Read records by IDs"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'read',
            [ids],
            {'fields': fields}
        )

# ============================================================================
# PARSERS ESTRATTI CONTO
# ============================================================================

def load_json_statement(filepath: str, account_code: str) -> List[Dict]:
    """Carica e filtra movimenti da file JSON per marzo 2024"""
    print(f"\n[*] Caricamento {filepath}")

    if not os.path.exists(filepath):
        print(f"   [!] File non trovato")
        return []

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Filtra movimenti marzo 2024
    movements = []
    for mov in data.get('movements', []):
        mov_date = mov.get('date', '')
        if mov_date >= PERIODO_START and mov_date <= PERIODO_END:
            movements.append({
                'date': mov_date,
                'description': mov.get('description', '').strip(),
                'amount': Decimal(str(mov.get('amount', 0))),
                'balance': Decimal(str(mov.get('balance', 0))) if mov.get('balance') else None,
                'account_code': account_code,
                'currency': mov.get('currency', 'CHF'),
                'source_file': os.path.basename(filepath)
            })

    print(f"   [OK] Trovati {len(movements)} movimenti marzo 2024")
    return movements

# ============================================================================
# VERIFICA MOVIMENTI
# ============================================================================

def fetch_odoo_movements(client: OdooClient, account_code: str) -> List[Dict]:
    """Recupera tutti i movimenti contabili da Odoo per un konto"""
    print(f"\n[*] Recupero movimenti Odoo per konto {account_code}")

    # Trova account_id
    accounts = client.search_read(
        'account.account',
        [('code', '=', account_code)],
        ['id', 'name', 'code']
    )

    if not accounts:
        print(f"   [ERROR] Account {account_code} non trovato in Odoo")
        return []

    account_id = accounts[0]['id']
    account_name = accounts[0]['name']
    print(f"   Account: {account_name} (ID: {account_id})")

    # Fetch move lines
    domain = [
        ('account_id', '=', account_id),
        ('date', '>=', PERIODO_START),
        ('date', '<=', PERIODO_END),
    ]

    move_lines = client.search_read(
        'account.move.line',
        domain,
        ['id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
         'move_id', 'partner_id', 'currency_id']
    )

    print(f"   [OK] Trovati {len(move_lines)} movimenti Odoo")

    # Trasforma in formato uniforme
    movements = []
    for line in move_lines:
        amount = Decimal(str(line['credit'])) - Decimal(str(line['debit']))

        movements.append({
            'id': line['id'],
            'date': line['date'],
            'description': (line.get('name') or '').strip(),
            'ref': (line.get('ref') or '').strip(),
            'amount': amount,
            'balance': Decimal(str(line.get('balance', 0))),
            'move_id': line['move_id'][0] if line.get('move_id') else None,
            'partner_id': line['partner_id'][0] if line.get('partner_id') else None,
            'account_code': account_code
        })

    return movements

def normalize_text(text: str) -> str:
    """Normalizza testo per confronto"""
    if not text:
        return ''

    # Lowercase
    text = text.lower()

    # Rimuovi caratteri speciali
    import re
    text = re.sub(r'[^\w\s-]', ' ', text)

    # Normalizza spazi
    text = ' '.join(text.split())

    return text

def match_movements(json_movs: List[Dict], odoo_movs: List[Dict]) -> Dict:
    """Cerca di matchare movimenti JSON con Odoo"""

    results = {
        'matched': [],
        'json_only': [],
        'odoo_only': [],
        'conflicts': []
    }

    # Crea indici per matching veloce
    json_by_date = defaultdict(list)
    for mov in json_movs:
        json_by_date[mov['date']].append(mov)

    odoo_by_date = defaultdict(list)
    for mov in odoo_movs:
        odoo_by_date[mov['date']].append(mov)

    # Trova tutte le date
    all_dates = sorted(set(list(json_by_date.keys()) + list(odoo_by_date.keys())))

    matched_json = set()
    matched_odoo = set()

    # Matching per data
    for mov_date in all_dates:
        json_list = json_by_date.get(mov_date, [])
        odoo_list = odoo_by_date.get(mov_date, [])

        # Prova matching esatto per data e importo
        for json_mov in json_list:
            if id(json_mov) in matched_json:
                continue

            for odoo_mov in odoo_list:
                if id(odoo_mov) in matched_odoo:
                    continue

                # Match esatto: data + importo (con tolleranza centesimi)
                if abs(json_mov['amount'] - odoo_mov['amount']) < Decimal('0.01'):
                    results['matched'].append({
                        'date': mov_date,
                        'json': json_mov,
                        'odoo': odoo_mov,
                        'match_type': 'exact',
                        'amount_diff': json_mov['amount'] - odoo_mov['amount']
                    })
                    matched_json.add(id(json_mov))
                    matched_odoo.add(id(odoo_mov))
                    break

    # Movimenti solo in JSON
    for mov in json_movs:
        if id(mov) not in matched_json:
            results['json_only'].append(mov)

    # Movimenti solo in Odoo
    for mov in odoo_movs:
        if id(mov) not in matched_odoo:
            results['odoo_only'].append(mov)

    return results

# ============================================================================
# REPORT GENERATOR
# ============================================================================

def generate_report(all_results: Dict) -> Dict:
    """Genera report completo verifica marzo 2024"""

    report = {
        'periodo': {
            'start': PERIODO_START,
            'end': PERIODO_END
        },
        'timestamp': datetime.now().isoformat(),
        'konti': {},
        'summary': {
            'total_matched': 0,
            'total_json_only': 0,
            'total_odoo_only': 0,
            'total_conflicts': 0,
            'konti_ok': [],
            'konti_warnings': [],
            'konti_errors': []
        }
    }

    for account_code, results in all_results.items():
        matched = results['matched']
        json_only = results['json_only']
        odoo_only = results['odoo_only']
        conflicts = results['conflicts']

        # Calcola totali
        json_total = sum(m['amount'] for m in results['json_movements'])
        odoo_total = sum(m['amount'] for m in results['odoo_movements'])

        konto_report = {
            'account_code': account_code,
            'counts': {
                'json_movements': len(results['json_movements']),
                'odoo_movements': len(results['odoo_movements']),
                'matched': len(matched),
                'json_only': len(json_only),
                'odoo_only': len(odoo_only),
                'conflicts': len(conflicts)
            },
            'totals': {
                'json_total': float(json_total),
                'odoo_total': float(odoo_total),
                'difference': float(json_total - odoo_total)
            },
            'matched_movements': [
                {
                    'date': m['date'],
                    'amount': float(m['json']['amount']),
                    'description_json': m['json']['description'],
                    'description_odoo': m['odoo']['description'],
                    'odoo_id': m['odoo']['id']
                }
                for m in matched
            ],
            'json_only_movements': [
                {
                    'date': m['date'],
                    'amount': float(m['amount']),
                    'description': m['description'],
                    'source_file': m.get('source_file', '')
                }
                for m in json_only
            ],
            'odoo_only_movements': [
                {
                    'date': m['date'],
                    'amount': float(m['amount']),
                    'description': m['description'],
                    'ref': m.get('ref', ''),
                    'odoo_id': m['id']
                }
                for m in odoo_only
            ]
        }

        # Status
        if len(json_only) == 0 and len(odoo_only) == 0 and abs(json_total - odoo_total) < Decimal('0.01'):
            konto_report['status'] = 'OK'
            report['summary']['konti_ok'].append(account_code)
        elif len(json_only) > 0 or len(odoo_only) > 0:
            konto_report['status'] = 'WARNING'
            report['summary']['konti_warnings'].append(account_code)
        else:
            konto_report['status'] = 'ERROR'
            report['summary']['konti_errors'].append(account_code)

        report['konti'][account_code] = konto_report

        # Update summary
        report['summary']['total_matched'] += len(matched)
        report['summary']['total_json_only'] += len(json_only)
        report['summary']['total_odoo_only'] += len(odoo_only)
        report['summary']['total_conflicts'] += len(conflicts)

    return report

def print_summary(report: Dict):
    """Stampa summary report a console"""

    print("\n" + "="*80)
    print("REPORT VERIFICA MARZO 2024")
    print("="*80)

    print(f"\nPeriodo: {report['periodo']['start']} -> {report['periodo']['end']}")
    print(f"Timestamp: {report['timestamp']}")

    summary = report['summary']

    print("\n" + "-"*80)
    print("RIEPILOGO GENERALE")
    print("-"*80)

    print(f"\n[OK] Movimenti matchati:     {summary['total_matched']}")
    print(f"[*]  Solo in JSON:           {summary['total_json_only']}")
    print(f"[*]  Solo in Odoo:           {summary['total_odoo_only']}")
    print(f"[!]  Conflitti:              {summary['total_conflicts']}")

    print(f"\n[OK] Konti OK:       {len(summary['konti_ok'])} -> {summary['konti_ok']}")
    print(f"[!]  Konti Warning:  {len(summary['konti_warnings'])} -> {summary['konti_warnings']}")
    print(f"[X]  Konti Errori:   {len(summary['konti_errors'])} -> {summary['konti_errors']}")

    # Dettaglio per konto
    for account_code, konto_data in report['konti'].items():
        print("\n" + "="*80)
        print(f"KONTO {account_code} - {konto_data['status']}")
        print("="*80)

        counts = konto_data['counts']
        totals = konto_data['totals']

        print(f"\nConteggi:")
        print(f"   JSON:    {counts['json_movements']} movimenti")
        print(f"   Odoo:    {counts['odoo_movements']} movimenti")
        print(f"   Matched: {counts['matched']}")
        print(f"   Solo JSON: {counts['json_only']}")
        print(f"   Solo Odoo: {counts['odoo_only']}")

        print(f"\nTotali:")
        print(f"   JSON:       {totals['json_total']:>15,.2f}")
        print(f"   Odoo:       {totals['odoo_total']:>15,.2f}")
        print(f"   Differenza: {totals['difference']:>15,.2f}")

        # Solo JSON
        if counts['json_only'] > 0:
            print(f"\n[*] SOLO IN JSON ({counts['json_only']} movimenti):")
            for mov in konto_data['json_only_movements'][:10]:
                print(f"   {mov['date']} | {mov['amount']:>12,.2f} | {mov['description'][:60]}")
            if counts['json_only'] > 10:
                print(f"   ... e altri {counts['json_only'] - 10} movimenti")

        # Solo Odoo
        if counts['odoo_only'] > 0:
            print(f"\n[*] SOLO IN ODOO ({counts['odoo_only']} movimenti):")
            for mov in konto_data['odoo_only_movements'][:10]:
                print(f"   {mov['date']} | {mov['amount']:>12,.2f} | {mov['description'][:60]}")
            if counts['odoo_only'] > 10:
                print(f"   ... e altri {counts['odoo_only'] - 10} movimenti")

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("\n" + "="*80)
    print("VERIFICA COMPLETA MARZO 2024 - Riga per Riga")
    print("="*80)

    # Verifica credenziali
    if not ODOO_USERNAME or not ODOO_PASSWORD:
        print("[ERROR] Credenziali Odoo mancanti!")
        print("   Imposta: ODOO_USERNAME e ODOO_PASSWORD")
        sys.exit(1)

    # Connetti a Odoo
    client = OdooClient()
    client.connect()

    all_results = {}

    # Verifica ogni konto
    for account_code, json_file in JSON_FILES.items():
        print("\n" + "="*80)
        print(f"KONTO {account_code}")
        print("="*80)

        # Carica JSON
        json_movements = load_json_statement(json_file, account_code)

        # Carica Odoo
        odoo_movements = fetch_odoo_movements(client, account_code)

        # Match
        print(f"\n[*] Matching movimenti...")
        results = match_movements(json_movements, odoo_movements)

        # Salva risultati
        results['json_movements'] = json_movements
        results['odoo_movements'] = odoo_movements
        all_results[account_code] = results

        print(f"\n   [OK] Matched: {len(results['matched'])}")
        print(f"   [*]  Solo JSON: {len(results['json_only'])}")
        print(f"   [*]  Solo Odoo: {len(results['odoo_only'])}")
        print(f"   [!]  Conflitti: {len(results['conflicts'])}")

    # Genera report
    print("\n" + "="*80)
    print("Generazione report...")
    print("="*80)

    report = generate_report(all_results)

    # Salva JSON
    output_file = 'REPORT-MARZO-2024.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Report salvato: {output_file}")

    # Stampa summary
    print_summary(report)

    print("\n" + "="*80)
    print("[OK] VERIFICA COMPLETATA")
    print("="*80)
    print(f"\nReport completo: {output_file}")

if __name__ == '__main__':
    main()
