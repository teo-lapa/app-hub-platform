#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ELIMINAZIONE REGISTRAZIONE "RICORRENTE MERENDA69"
Storna la registrazione MEGA-RETT-FINALE-COMMERCIALISTA-2023
"""

import xmlrpc.client
import ssl
import sys
import io

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
print("ELIMINAZIONE REGISTRAZIONE MERENDA69")
print("=" * 80)

# Connect
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USERNAME, PASSWORD, {})

if not uid:
    print("ERRORE: Autenticazione fallita")
    sys.exit(1)

print(f"\nConnesso come UID: {uid}\n")

models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

# STEP 1: Trova la registrazione "merenda69"
print("STEP 1: Ricerca registrazione merenda69...")

moves = models.execute_kw(DB, uid, PASSWORD,
    'account.move', 'search_read',
    [[
        ['ref', 'ilike', 'merenda69'],
        ['date', '=', '2023-12-31']
    ]],
    {'fields': ['id', 'name', 'ref', 'date', 'state', 'line_ids'], 'limit': 10}
)

if not moves:
    print("ERRORE: Registrazione merenda69 non trovata!")
    print("Provo con riferimento diverso...")

    moves = models.execute_kw(DB, uid, PASSWORD,
        'account.move', 'search_read',
        [[
            ['ref', 'ilike', 'MEGA-RETT-FINALE-COMMERCIALISTA'],
            ['date', '=', '2023-12-31']
        ]],
        {'fields': ['id', 'name', 'ref', 'date', 'state', 'line_ids'], 'limit': 10}
    )

if not moves:
    print("ERRORE: Nessuna registrazione trovata!")
    print("\nProvo ricerca per ammontare CHF 182,651.03...")

    # Cerca nelle move lines
    lines = models.execute_kw(DB, uid, PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['credit', '=', 182651.03],
            ['date', '=', '2023-12-31']
        ]],
        {'fields': ['id', 'move_id', 'name', 'account_id', 'debit', 'credit'], 'limit': 5}
    )

    if lines:
        print(f"\nTrovate {len(lines)} righe con importo CHF 182,651.03:")
        move_ids = set()
        for line in lines:
            move_id = line['move_id'][0]
            move_ids.add(move_id)
            print(f"  - Move ID: {move_id}, Line: {line['name']}, Account: {line['account_id'][1]}")

        # Carica i moves completi
        moves = models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'read',
            [list(move_ids)],
            {'fields': ['id', 'name', 'ref', 'date', 'state', 'line_ids']}
        )

if not moves:
    print("\nERRORE FATALE: Impossibile trovare la registrazione merenda69!")
    sys.exit(1)

# Mostra registrazioni trovate
print(f"\nTrovate {len(moves)} registrazioni:")
for move in moves:
    print(f"\n  Move ID: {move['id']}")
    print(f"  Nome: {move['name']}")
    print(f"  Riferimento: {move.get('ref', 'N/A')}")
    print(f"  Data: {move['date']}")
    print(f"  Stato: {move['state']}")
    print(f"  Righe: {len(move.get('line_ids', []))}")

# Prendi la prima (dovrebbe essere unica)
move_to_delete = moves[0]
move_id = move_to_delete['id']

print(f"\n{'='*80}")
print(f"REGISTRAZIONE DA STORNARE: {move_id}")
print(f"{'='*80}")

# STEP 2: Leggi i dettagli completi
print("\nSTEP 2: Lettura dettagli registrazione...")

line_ids = move_to_delete.get('line_ids', [])
print(f"Righe da stornare: {len(line_ids)}")

lines = models.execute_kw(DB, uid, PASSWORD,
    'account.move.line', 'read',
    [line_ids],
    {'fields': ['id', 'account_id', 'name', 'debit', 'credit', 'partner_id']}
)

print("\nRighe della registrazione:")
for line in lines:
    account_name = line['account_id'][1] if line['account_id'] else 'N/A'
    partner_name = line['partner_id'][1] if line['partner_id'] else 'Nessuno'
    print(f"  - {account_name}: Dare {line['debit']:.2f}, Avere {line['credit']:.2f}")
    print(f"    Partner: {partner_name}, Descrizione: {line['name']}")

# STEP 3: Verifica se è già posted
if move_to_delete['state'] == 'posted':
    print("\nRegistrazione GIA' CONFERMATA (posted)")
    print("Creo registrazione di STORNO...")

    # Get company_id
    company_id = 1  # Default

    # Get journal
    journal = models.execute_kw(DB, uid, PASSWORD,
        'account.journal', 'search_read',
        [[['type', '=', 'general'], ['company_id', '=', company_id]]],
        {'fields': ['id', 'name'], 'limit': 1}
    )

    if not journal:
        print("ERRORE: Journal non trovato")
        sys.exit(1)

    # Crea registrazione di storno (INVERSA)
    storno_lines = []
    for line in lines:
        # Inverti dare e avere
        storno_lines.append((0, 0, {
            'account_id': line['account_id'][0],
            'debit': line['credit'],  # Inverso!
            'credit': line['debit'],   # Inverso!
            'name': f"STORNO {line['name']}",
            'partner_id': line['partner_id'][0] if line['partner_id'] else False,
            'company_id': company_id
        }))

    storno_move = {
        'journal_id': journal[0]['id'],
        'date': '2024-12-31',  # Storno in chiusura 2024
        'ref': f'STORNO-MERENDA69-Move-{move_id}',
        'company_id': company_id,
        'line_ids': storno_lines
    }

    print("\nCreazione registrazione di storno...")
    try:
        storno_id = models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'create', [storno_move]
        )

        print(f"CREATA: Registrazione di storno ID {storno_id}")

        # Post the storno
        models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'action_post', [[storno_id]]
        )

        print(f"POSTED: Storno confermato")

        print(f"\n{'='*80}")
        print(f"SUCCESS!")
        print(f"{'='*80}")
        print(f"\nRegistrazione originale (merenda69): Move ID {move_id}")
        print(f"Registrazione di storno: Move ID {storno_id}")
        print(f"\nImpatto netto: MERENDA69 ELIMINATA")

    except Exception as e:
        print(f"\nERRORE durante creazione storno: {str(e)}")
        sys.exit(1)

else:
    print(f"\nRegistrazione in stato: {move_to_delete['state']}")
    print("Procedo con eliminazione diretta...")

    try:
        # Try to delete (works only if draft)
        models.execute_kw(DB, uid, PASSWORD,
            'account.move', 'unlink', [[move_id]]
        )
        print(f"\nSUCCESS: Registrazione {move_id} ELIMINATA")
    except Exception as e:
        print(f"\nERRORE: {str(e)}")
        print("La registrazione non puo essere eliminata direttamente.")
        print("Devo creare uno storno.")

# STEP 4: Verifica saldi finali
print(f"\n{'='*80}")
print("VERIFICA SALDI FINALI")
print(f"{'='*80}")

conti_da_verificare = ['1021', '1022', '1023']

for code in conti_da_verificare:
    account = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', code]]],
        {'fields': ['id', 'name'], 'limit': 1}
    )

    if account:
        account_id = account[0]['id']

        lines = models.execute_kw(DB, uid, PASSWORD,
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', account_id],
                ['date', '<=', '2024-12-31'],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['debit', 'credit']}
        )

        debit = sum(l['debit'] for l in lines)
        credit = sum(l['credit'] for l in lines)
        saldo = debit - credit

        print(f"\nKonto {code} - {account[0]['name']}")
        print(f"  Saldo: CHF {saldo:,.2f}")

print(f"\n{'='*80}")
print("OPERAZIONE COMPLETATA")
print(f"{'='*80}")
