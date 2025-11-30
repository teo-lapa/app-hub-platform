#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ESECUZIONE ALLINEAMENTO KONTO 1001 - RIMOZIONE DUPLICATI
Rimuove i 3 duplicati identificati per ridurre il saldo Cash
"""

import xmlrpc.client
import ssl
import sys
import io
from datetime import datetime

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
print("ALLINEAMENTO KONTO 1001 CASH - RIMOZIONE DUPLICATI")
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
acc_1001 = models.execute_kw(DB, uid, PASSWORD,
    'account.account', 'search_read',
    [[['code', '=', '1001']]],
    {'fields': ['id', 'name', 'company_id'], 'limit': 1}
)

if not acc_1001:
    print("ERRORE: Conto 1001 non trovato")
    sys.exit(1)

company_id = acc_1001[0]['company_id'][0] if acc_1001[0]['company_id'] else 1
print(f"Company ID: {company_id}")

# Get Miscellaneous journal
journal = models.execute_kw(DB, uid, PASSWORD,
    'account.journal', 'search_read',
    [[['type', '=', 'general'], ['company_id', '=', company_id]]],
    {'fields': ['id', 'name'], 'limit': 1}
)

if not journal:
    print("ERRORE: Journal Miscellaneous non trovato")
    sys.exit(1)

print(f"Journal: {journal[0]['name']}")

# Get conto 3900 (Difference/Adjustment account)
acc_3900 = models.execute_kw(DB, uid, PASSWORD,
    'account.account', 'search_read',
    [[['code', '=', '3900'], ['company_id', '=', company_id]]],
    {'fields': ['id', 'name', 'code'], 'limit': 1}
)

if not acc_3900:
    print("AVVISO: Conto 3900 non trovato, cerco alternative...")
    # Try finding any expense/difference account
    acc_3900 = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['account_type', '=', 'expense'], ['company_id', '=', company_id]]],
        {'fields': ['id', 'name', 'code'], 'limit': 1}
    )

if not acc_3900:
    print("ERRORE: Nessun conto contropartita trovato")
    sys.exit(1)

acc_code = acc_3900[0].get('code', 'N/A')
acc_name = acc_3900[0].get('name', 'Unknown')
print(f"Conto contropartita: {acc_code} - {acc_name}")

# Duplicati da rimuovere
duplicati = [
    {
        'partner': 'Nuraghets',
        'amount': 400.00,
        'description': 'Storno duplicato pagamento Nuraghets (ID 523317/522654)'
    },
    {
        'partner': 'DL Services',
        'amount': 174.25,
        'description': 'Storno duplicato pagamento DL Services (ID 234764/234762)'
    },
    {
        'partner': "Emma's Cafe",
        'amount': 209.47,
        'description': "Storno duplicato pagamento Emma's Cafe (ID 503096/115978)"
    }
]

print("\n" + "=" * 80)
print("CREAZIONE REGISTRAZIONI DI STORNO DUPLICATI")
print("=" * 80)

move_ids_created = []
total_stornato = 0

for dup in duplicati:
    print(f"\n Storno duplicato {dup['partner']}: CHF {dup['amount']:.2f}")

    try:
        move_vals = {
            'journal_id': journal[0]['id'],
            'date': '2024-12-31',
            'ref': f"Storno duplicato {dup['partner']}",
            'company_id': company_id,
            'line_ids': [
                (0, 0, {
                    'account_id': acc_1001[0]['id'],
                    'debit': 0.00,
                    'credit': dup['amount'],
                    'name': dup['description'],
                    'company_id': company_id
                }),
                (0, 0, {
                    'account_id': acc_3900[0]['id'],
                    'debit': dup['amount'],
                    'credit': 0.00,
                    'name': f"Contropartita storno {dup['partner']}",
                    'company_id': company_id
                })
            ]
        }

        move_id = models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'create', [move_vals]
        )

        # Post the move
        models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'action_post', [[move_id]]
        )

        print(f"   CREATA: Registrazione ID {move_id}")
        print(f"   POSTED: Registrazione confermata")

        move_ids_created.append(move_id)
        total_stornato += dup['amount']

    except Exception as e:
        print(f"   ERRORE: {str(e)}")

print("\n" + "=" * 80)
print("VERIFICA SALDO FINALE KONTO 1001")
print("=" * 80)

# Calculate new balance
move_lines = models.execute_kw(DB, uid, PASSWORD,
    'account.move.line', 'search_read',
    [[
        ['account_id', '=', acc_1001[0]['id']],
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
print(f"\nDuplicati stornati: CHF {total_stornato:.2f}")
print(f"Registrazioni create: {len(move_ids_created)}")

if len(move_ids_created) == 3:
    print("\n" + "=" * 80)
    print("SUCCESS: 3/3 DUPLICATI STORNATI")
    print("=" * 80)
else:
    print(f"\nAVVISO: Solo {len(move_ids_created)}/3 duplicati stornati")

print(f"\nSaldo precedente: CHF 386,336.67")
print(f"Saldo attuale:    CHF {saldo_finale:,.2f}")
print(f"Differenza:       CHF {386336.67 - saldo_finale:,.2f}")
