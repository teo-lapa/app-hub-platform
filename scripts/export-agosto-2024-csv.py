#!/usr/bin/env python3
"""
Export transazioni agosto 2024 UBS EUR in formato CSV per import Odoo
"""

import json
import csv
from datetime import datetime

def main():
    print("Export transazioni agosto 2024 UBS EUR...")

    # Carica report differenze
    with open('AGOSTO-2024-DIFFERENZE-DETTAGLIATE.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Estrai transazioni konto 1025
    transactions = []

    for day_data in data['1025']:
        for tx in day_data['bank_txs']:
            transactions.append({
                'date': tx['date'],
                'value_date': tx.get('value_date', tx['date']),
                'partner_name': tx['raw'].get('partner_name', '').strip('"'),
                'description': tx['description'],
                'amount': tx['amount'],
                'debit': abs(tx['amount']) if tx['amount'] < 0 else 0,
                'credit': tx['amount'] if tx['amount'] > 0 else 0,
                'balance': tx['balance'],
                'currency': 'EUR',
                'account_code': '1025',
                'line_number': tx['raw'].get('line_number', '')
            })

    # Ordina per data
    transactions.sort(key=lambda x: (x['date'], x['line_number']))

    # Export CSV
    output_file = 'AGOSTO-2024-UBS-EUR-IMPORT.csv'

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'date', 'value_date', 'partner_name', 'description',
            'amount', 'debit', 'credit', 'balance', 'currency',
            'account_code', 'line_number'
        ]

        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(transactions)

    print(f"\nExport completato: {output_file}")
    print(f"Transazioni esportate: {len(transactions)}")
    print(f"\nRiepilogo:")
    print(f"  Totale dare:  {sum(t['debit'] for t in transactions):,.2f} EUR")
    print(f"  Totale avere: {sum(t['credit'] for t in transactions):,.2f} EUR")
    print(f"  Saldo netto:  {sum(t['amount'] for t in transactions):,.2f} EUR")

    # Export JSON strutturato per Odoo API
    odoo_payload = []

    for tx in transactions:
        # Determina tipo movimento
        if 'FX' in tx['description'] and 'Forward' in tx['description']:
            move_type = 'FX_EXCHANGE'
            journal = 'BANK_EUR'
        elif 'e-banking-Sammelauftrag' in tx['description'] or 'e-banking-Vergütungsauftrag' in tx['description']:
            move_type = 'PAYMENT'
            journal = 'BANK_EUR'
        else:
            move_type = 'OTHER'
            journal = 'BANK_EUR'

        odoo_payload.append({
            'date': tx['date'],
            'journal_id': journal,  # Da mappare a journal_id reale
            'ref': f"UBS EUR {tx['date']} - Line {tx['line_number']}",
            'line_ids': [
                {
                    'account_id': 1025,  # Da mappare a account.id reale
                    'name': tx['description'][:64],
                    'debit': tx['debit'],
                    'credit': tx['credit'],
                    'partner_id': None,  # TODO: mapping partner
                    'currency_id': 2,  # EUR - da verificare ID
                    'amount_currency': tx['amount'],
                },
                # Contropartita (da determinare in base al tipo)
            ],
            'state': 'draft',
            '_metadata': {
                'import_source': 'UBS EUR August 2024',
                'bank_line_number': tx['line_number'],
                'bank_balance_after': tx['balance'],
                'move_type': move_type
            }
        })

    odoo_json_file = 'AGOSTO-2024-UBS-EUR-ODOO-PAYLOAD.json'
    with open(odoo_json_file, 'w', encoding='utf-8') as f:
        json.dump(odoo_payload, f, indent=2, ensure_ascii=False)

    print(f"\nPayload Odoo: {odoo_json_file}")

    # Summary report
    print("\n" + "="*60)
    print("SUMMARY PER TIPOLOGIA")
    print("="*60)

    fx_txs = [t for t in transactions if 'FX' in t['description'] and 'Forward' in t['description']]
    payment_txs = [t for t in transactions if 'e-banking' in t['description']]
    other_txs = [t for t in transactions if t not in fx_txs and t not in payment_txs]

    print(f"\nFX Forward (CHF->EUR):")
    print(f"  Transazioni: {len(fx_txs)}")
    print(f"  Totale EUR:  {sum(t['amount'] for t in fx_txs):,.2f}")

    print(f"\nPagamenti fornitori:")
    print(f"  Transazioni: {len(payment_txs)}")
    print(f"  Totale EUR:  {sum(t['amount'] for t in payment_txs):,.2f}")

    print(f"\nAltri movimenti:")
    print(f"  Transazioni: {len(other_txs)}")
    print(f"  Totale EUR:  {sum(t['amount'] for t in other_txs):,.2f}")

if __name__ == '__main__':
    main()
