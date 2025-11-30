#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RICLASSIFICAZIONE KONTO 10901 - PAGAMENTI CREDIT CARD
Sposta i pagamenti credit card dal conto 10901 al conto 10803 (UBS Kreditkarte)
"""

import xmlrpc.client
import ssl
import sys
import io
import csv

# Fix encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Odoo connection
URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
USERNAME = "paul@lapa.ch"
PASSWORD = "lapa201180"

# Disable SSL verification
ssl._create_default_https_context = ssl._create_unverified_context

print("=" * 80)
print("RICLASSIFICAZIONE KONTO 10901 - PAGAMENTI CREDIT CARD")
print("=" * 80)

# Connect
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USERNAME, PASSWORD, {})

if not uid:
    print("ERRORE: Autenticazione fallita")
    sys.exit(1)

print(f"Connesso come UID: {uid}")

models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

# Get company_id
acc_10901 = models.execute_kw(DB, uid, PASSWORD,
    'account.account', 'search_read',
    [[['code', '=', '10901']]],
    {'fields': ['id', 'name', 'code', 'company_id'], 'limit': 1}
)

if not acc_10901:
    print("ERRORE: Conto 10901 non trovato")
    sys.exit(1)

company_id = acc_10901[0]['company_id'][0] if acc_10901[0]['company_id'] else 1
print(f"Company ID: {company_id}")
print(f"Conto origine: {acc_10901[0]['code']} - {acc_10901[0]['name']}")

# Get conto 10803 (UBS Kreditkarte)
acc_cc = models.execute_kw(DB, uid, PASSWORD,
    'account.account', 'search_read',
    [[['code', '=', '10803'], ['company_id', '=', company_id]]],
    {'fields': ['id', 'name', 'code'], 'limit': 1}
)

if not acc_cc:
    print("ERRORE: Conto 10803 (UBS Kreditkarte) non trovato")
    print("Cerco conti credit card alternativi...")
    # Try to find credit card accounts
    acc_cc = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['name', 'ilike', 'credit'], ['company_id', '=', company_id]]],
        {'fields': ['id', 'name', 'code'], 'limit': 5}
    )
    if acc_cc:
        print(f"Trovati {len(acc_cc)} conti credit card:")
        for acc in acc_cc:
            print(f"  {acc.get('code', 'N/A')} - {acc.get('name', 'Unknown')}")
        # Use first one
        acc_cc = [acc_cc[0]]
    else:
        print("ERRORE: Nessun conto credit card trovato")
        sys.exit(1)

print(f"Conto destinazione: {acc_cc[0].get('code', 'N/A')} - {acc_cc[0].get('name', 'Unknown')}")

# Read CSV file with Credit Card transactions
csv_file = 'C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\konto-10901-v2-credit_card_payment.csv'

print(f"\nLettura file CSV: {csv_file}")

cc_line_ids = []
with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        line_id = int(row['ID'])
        cc_line_ids.append(line_id)

print(f"Trovati {len(cc_line_ids)} pagamenti Credit Card da riclassificare")

# Get Miscellaneous journal
journal = models.execute_kw(DB, uid, PASSWORD,
    'account.journal', 'search_read',
    [[['type', '=', 'general'], ['company_id', '=', company_id]]],
    {'fields': ['id', 'name'], 'limit': 1}
)

if not journal:
    print("ERRORE: Journal Miscellaneous non trovato")
    sys.exit(1)

print(f"\nJournal: {journal[0]['name']}")

# Process Credit Card lines
riclassificate = 0
errori = 0
move_ids_created = []

print(f"\n{'='*80}")
print(f"INIZIO RICLASSIFICAZIONE")
print(f"{'='*80}")

for line_id in cc_line_ids:
    try:
        # Get line details
        line = models.execute_kw(DB, uid, PASSWORD,
            'account.move.line', 'read',
            [[line_id]],
            {'fields': ['id', 'date', 'name', 'debit', 'credit', 'account_id', 'move_id']}
        )

        if not line:
            print(f"Riga {line_id}: Non trovata")
            errori += 1
            continue

        line = line[0]
        debit = line['debit']
        credit = line['credit']
        description = line['name'] if line['name'] else 'Credit Card Payment'
        date = line['date']

        print(f"\nRiga {line_id}: {description[:50]}")
        print(f"  Data: {date}")
        print(f"  Dare: {debit:.2f}, Avere: {credit:.2f}")

        # Create reclassification entry
        move_vals = {
            'journal_id': journal[0]['id'],
            'date': '2024-12-31',
            'ref': f'Riclassificazione CC - Konto 10901 -> 10803 (Riga {line_id})',
            'company_id': company_id,
            'line_ids': []
        }

        # If original was debit on 10901, we need to:
        # - Credit 10901 (reverse it)
        # - Debit 10803 (move it there)
        if debit > 0:
            move_vals['line_ids'].append((0, 0, {
                'account_id': acc_10901[0]['id'],
                'debit': 0.00,
                'credit': debit,
                'name': f'Storno CC da 10901 - {description[:40]}',
                'company_id': company_id
            }))
            move_vals['line_ids'].append((0, 0, {
                'account_id': acc_cc[0]['id'],
                'debit': debit,
                'credit': 0.00,
                'name': f'Riclassifica CC su 10803 - {description[:40]}',
                'company_id': company_id
            }))

        # If original was credit on 10901:
        # - Debit 10901 (reverse it)
        # - Credit 10803 (move it there)
        elif credit > 0:
            move_vals['line_ids'].append((0, 0, {
                'account_id': acc_10901[0]['id'],
                'debit': credit,
                'credit': 0.00,
                'name': f'Storno CC da 10901 - {description[:40]}',
                'company_id': company_id
            }))
            move_vals['line_ids'].append((0, 0, {
                'account_id': acc_cc[0]['id'],
                'debit': 0.00,
                'credit': credit,
                'name': f'Riclassifica CC su 10803 - {description[:40]}',
                'company_id': company_id
            }))

        # Create and post the move
        move_id = models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'create', [move_vals]
        )

        models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'action_post', [[move_id]]
        )

        print(f"  CREATA: Registrazione {move_id}")
        move_ids_created.append(move_id)
        riclassificate += 1

    except Exception as e:
        print(f"  ERRORE: {str(e)}")
        errori += 1

print(f"\n{'='*80}")
print(f"VERIFICA SALDO KONTO 10901 DOPO RICLASSIFICAZIONE")
print(f"{'='*80}")

# Calculate new balance
move_lines = models.execute_kw(DB, uid, PASSWORD,
    'account.move.line', 'search_read',
    [[
        ['account_id', '=', acc_10901[0]['id']],
        ['date', '<=', '2024-12-31'],
        ['parent_state', '=', 'posted']
    ]],
    {'fields': ['debit', 'credit']}
)

debit_total = sum(line['debit'] for line in move_lines)
credit_total = sum(line['credit'] for line in move_lines)
saldo_finale = debit_total - credit_total

print(f"\nDare totale:   CHF {debit_total:>15,.2f}")
print(f"Avere totale:  CHF {credit_total:>15,.2f}")
print(f"SALDO FINALE:  CHF {saldo_finale:>15,.2f}")

print(f"\n{'='*80}")
print(f"RIEPILOGO RICLASSIFICAZIONE CREDIT CARD")
print(f"{'='*80}")
print(f"Movimenti da riclassificare: {len(cc_line_ids)}")
print(f"Movimenti riclassificati:    {riclassificate}")
print(f"Errori:                      {errori}")
print(f"Registrazioni create:        {len(move_ids_created)}")

if riclassificate > 0:
    print(f"\nSUCCESS: {riclassificate} pagamenti Credit Card riclassificati da 10901 a 10803")
else:
    print(f"\nWARNING: Nessun pagamento riclassificato")

print(f"\nRegistrazioni create: {', '.join(map(str, move_ids_created))}")
