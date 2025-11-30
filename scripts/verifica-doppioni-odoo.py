#!/usr/bin/env python3
"""
VERIFICA DOPPIONI in Odoo - controlla se ci sono transazioni duplicate
"""

import xmlrpc.client
import ssl
from collections import defaultdict

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def find_duplicates(account_code, account_name):
    """Trova duplicati in un account"""

    common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
    uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

    # Get account ID
    accounts = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.account', 'search_read',
        [[['code', '=', account_code]]],
        {'fields': ['id'], 'limit': 1}
    )

    if not accounts:
        print(f"Account {account_code} not found!")
        return

    account_id = accounts[0]['id']

    # Get ALL movements for 2024
    print(f"\n{'=' * 80}")
    print(f"VERIFICA DOPPIONI: {account_code} - {account_name}")
    print(f"{'=' * 80}\n")

    lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['id', 'date', 'debit', 'credit', 'name', 'partner_id', 'move_id']}
    )

    print(f"Totale movimenti 2024: {len(lines)}")

    # Group by date + amount + partner
    groups = defaultdict(list)

    for line in lines:
        amount = line['debit'] - line['credit']
        partner = line.get('partner_id', [False, ''])[0] if line.get('partner_id') else None
        name_val = line.get('name', '')
        desc = (name_val if name_val and isinstance(name_val, str) else '')[:50]

        # Key: date + amount + partner
        key = (line['date'], round(amount, 2), partner)
        groups[key].append({
            'id': line['id'],
            'move_id': line.get('move_id', [False])[0],
            'desc': desc,
            'amount': amount
        })

    # Find duplicates (groups with more than 1 entry)
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}

    if duplicates:
        print(f"\n[!] TROVATI {len(duplicates)} SET DI DOPPIONI!\n")

        total_duplicate_lines = sum(len(v) for v in duplicates.values())
        print(f"Totale righe duplicate: {total_duplicate_lines}")
        print(f"(Ogni set ha 2+ righe identiche)\n")

        # Show top 20
        sorted_dups = sorted(duplicates.items(), key=lambda x: abs(x[0][1]), reverse=True)

        print(f"\nTop 20 doppioni (per importo):\n")
        print(f"{'Data':12} | {'Importo':>15} | {'Partner':10} | {'Count':5} | {'Descrizione'}")
        print("-" * 90)

        for i, (key, entries) in enumerate(sorted_dups[:20]):
            date, amount, partner = key
            count = len(entries)
            desc = entries[0]['desc']
            partner_str = str(partner) if partner else 'N/A'

            print(f"{date:12} | {amount:>15,.2f} | {partner_str:10} | {count:5} | {desc[:40]}")

        # Calculate total amount duplicated
        total_duplicated = sum(abs(key[1]) * (len(entries) - 1) for key, entries in duplicates.items())
        print(f"\n{'=' * 80}")
        print(f"IMPORTO TOTALE DUPLICATO: {total_duplicated:,.2f}")
        print(f"(Questo è l'importo che conta 2+ volte)")
        print(f"{'=' * 80}")

        # Save details to file
        filename = f"DOPPIONI-{account_code}-DETTAGLIO.txt"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"DOPPIONI TROVATI IN {account_code} - {account_name}\n")
            f.write(f"{'=' * 80}\n\n")
            f.write(f"Totale set di doppioni: {len(duplicates)}\n")
            f.write(f"Totale righe duplicate: {total_duplicate_lines}\n\n")

            for key, entries in sorted_dups:
                date, amount, partner = key
                f.write(f"\n{'-' * 80}\n")
                f.write(f"Data: {date} | Importo: {amount:,.2f} | Partner: {partner}\n")
                f.write(f"Trovate {len(entries)} righe identiche:\n\n")

                for entry in entries:
                    f.write(f"  Line ID: {entry['id']:6} | Move ID: {entry['move_id']:6} | {entry['desc']}\n")

        print(f"\nDettagli salvati in: {filename}")

    else:
        print(f"\n[OK] NESSUN DOPPIONE TROVATO!")
        print(f"Tutti i {len(lines)} movimenti sono unici.\n")

    return len(duplicates) if duplicates else 0

def main():
    print("\n" + "=" * 80)
    print("VERIFICA DOPPIONI - Analisi completa konti bancari")
    print("=" * 80)

    # Check main accounts
    accounts_to_check = [
        ('1024', 'UBS-CHF, 278-122087.01J'),
        ('1025', 'EUR-UBS, 278-122087.60A'),
        ('1026', 'CHF-CRS PRINCIPALE, 3977497-51'),
        ('1022', 'Outstanding Receipts'),
        ('1023', 'Outstanding Payments'),
    ]

    total_duplicate_sets = 0

    for code, name in accounts_to_check:
        dup_count = find_duplicates(code, name)
        total_duplicate_sets += dup_count

    print("\n" + "=" * 80)
    print("RIEPILOGO FINALE")
    print("=" * 80)
    print(f"\nTotale konti verificati: {len(accounts_to_check)}")
    print(f"Totale set di doppioni trovati: {total_duplicate_sets}")

    if total_duplicate_sets > 0:
        print(f"\n[!] ATTENZIONE: Trovati doppioni in {total_duplicate_sets} casi!")
        print(f"   Verificare i file DOPPIONI-*-DETTAGLIO.txt per i dettagli.")
    else:
        print(f"\n[OK] OTTIMO: Nessun doppione trovato in nessun konto!")

    print("\n")

if __name__ == "__main__":
    main()
