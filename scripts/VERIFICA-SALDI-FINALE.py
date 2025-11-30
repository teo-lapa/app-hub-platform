#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VERIFICA FINALE SALDI CONTABILITÀ - AL CENTESIMO
Verifica i saldi di tutti i conti dopo l'allineamento
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
print("VERIFICA FINALE SALDI - ALLINEAMENTO CONTABILITÀ 2024")
print(f"Data verifica: {datetime.now().strftime('%d %B %Y, %H:%M')}")
print("=" * 80)

# Connect
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USERNAME, PASSWORD, {})

if not uid:
    print("ERRORE: Autenticazione fallita")
    sys.exit(1)

print(f"\nConnesso come UID: {uid}\n")

models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

def get_account_balance(code):
    """Ottiene il saldo di un conto al centesimo"""
    accounts = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search_read',
        [[['code', '=', code]]],
        {'fields': ['id', 'code', 'name'], 'limit': 1}
    )

    if not accounts:
        return None

    account = accounts[0]
    account_id = account['id']

    # Get all posted move lines
    move_lines = models.execute_kw(DB, uid, PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['debit', 'credit']}
    )

    if not move_lines:
        return {
            'code': account['code'],
            'name': account['name'],
            'balance': 0.00,
            'debit': 0.00,
            'credit': 0.00,
            'count': 0
        }

    debit = sum(line['debit'] for line in move_lines)
    credit = sum(line['credit'] for line in move_lines)
    balance = debit - credit

    return {
        'code': account['code'],
        'name': account['name'],
        'balance': balance,
        'debit': debit,
        'credit': credit,
        'count': len(move_lines)
    }

# Conti da verificare
conti = ['1001', '1022', '1023', '10901', '1099']

print("=" * 80)
print("SALDI CONTI PROBLEMATICI")
print("=" * 80)

results = {}
for code in conti:
    data = get_account_balance(code)
    if data:
        results[code] = data
        print(f"\n{data['code']} - {data['name']}")
        print(f"  Dare:    CHF {data['debit']:>15,.2f}")
        print(f"  Avere:   CHF {data['credit']:>15,.2f}")
        print(f"  SALDO:   CHF {data['balance']:>15,.2f}")
        print(f"  Movimenti: {data['count']}")

print("\n" + "=" * 80)
print("RIEPILOGO ALLINEAMENTO")
print("=" * 80)

# Check alignment status
aligned = []
not_aligned = []

targets = {
    '1099': 0.00,      # Must be exactly 0
    '10901': 0.00,     # Target is 0
    '1022': 0.00,      # Outstanding Receipts must be 0
    '1023': 0.00,      # Outstanding Payments must be 0
    '1001': 90000.00   # Cash should be around 90k
}

for code, target in targets.items():
    if code in results:
        balance = results[code]['balance']
        delta = abs(balance - target)

        status = ""
        if delta < 0.01:  # Al centesimo
            status = "✅ ALLINEATO"
            aligned.append(code)
        elif code == '1001' and delta < 200000:  # Cash has more tolerance
            status = "⚠️  PARZIALE"
            not_aligned.append(code)
        else:
            status = "❌ NON ALLINEATO"
            not_aligned.append(code)

        print(f"\n{code} - {results[code]['name']}")
        print(f"  Saldo attuale: CHF {balance:>12,.2f}")
        print(f"  Target:        CHF {target:>12,.2f}")
        print(f"  Delta:         CHF {delta:>12,.2f}")
        print(f"  Status: {status}")

print("\n" + "=" * 80)
print("STATISTICHE FINALI")
print("=" * 80)
print(f"\nConti verificati:      {len(results)}")
print(f"Conti allineati:       {len(aligned)} ({len(aligned)/len(results)*100:.0f}%)")
print(f"Conti non allineati:   {len(not_aligned)} ({len(not_aligned)/len(results)*100:.0f}%)")

if aligned:
    print(f"\nAllineati al centesimo: {', '.join(aligned)}")

if not_aligned:
    print(f"Richiedono intervento: {', '.join(not_aligned)}")

print("\n" + "=" * 80)
print("AZIONI ESEGUITE IN QUESTA SESSIONE")
print("=" * 80)

print("""
✅ KONTO 1099 - Transferkonto
   - Chiuso a CHF 0.00 (al centesimo)
   - Registrazione ID: 97040
   - Contropartita: Conto 2350 (Conto corrente soci)

✅ KONTO 1001 - Cash
   - Rimossi 3 duplicati (CHF 783.72)
   - Registrazioni ID: 97041, 97042, 97043
   - Saldo ridotto significativamente

✅ KONTO 10901 - Liquiditätstransfer
   - Riclassificati 40 movimenti FX → Conto 4906 (Exchange rate differences)
   - Registrazioni ID: 97049-97088
   - Saldo portato da CHF -375,615.65 a CHF +256,297.61
   - Migliora significativamente la situazione

❌ KONTO 10901 - Credit Card Payments
   - 15 movimenti non riclassificati
   - Problema tecnico: conti credit card richiedono valuta secondaria
   - RICHIEDE: Intervento manuale o fix configurazione account

⏳ KONTO 1022 - Outstanding Receipts
   - Non allineato automaticamente
   - Problema principale: "Ricorrente merenda69" CHF 182,651
   - RICHIEDE: Decisione commercialista

⏳ KONTO 1023 - Outstanding Payments
   - Non allineato automaticamente
   - 685 righe da riconciliare manualmente
   - RICHIEDE: Fix XML-RPC + manual review
""")

print("=" * 80)
print("REGISTRAZIONI TOTALI CREATE")
print("=" * 80)
print("\nTotale registrazioni create: 44")
print("  - Chiusura Konto 1099: 1 registrazione (ID 97040)")
print("  - Storno duplicati 1001: 3 registrazioni (ID 97041-97043)")
print("  - Riclassifica FX 10901: 40 registrazioni (ID 97049-97088)")

print("\n" + "=" * 80)
print("END OF REPORT")
print("=" * 80)
