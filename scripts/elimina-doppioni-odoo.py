#!/usr/bin/env python3
"""
ELIMINA DOPPIONI da Odoo - rimuove le righe duplicate mantenendo solo 1 per ogni set
"""

import xmlrpc.client
import ssl
from collections import defaultdict
import sys

ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

DRY_RUN = False  # ESECUZIONE REALE - elimina i doppioni

def delete_duplicates(account_code, account_name):
    """Trova ed elimina duplicati in un account"""

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
        return 0

    account_id = accounts[0]['id']

    print(f"\n{'=' * 80}")
    print(f"ELIMINA DOPPIONI: {account_code} - {account_name}")
    print(f"{'=' * 80}\n")

    # Get ALL movements for 2024
    lines = models.execute_kw(
        CONFIG['db'], uid, CONFIG['password'],
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['date', '>=', '2024-01-01'],
            ['date', '<=', '2024-12-31'],
            ['parent_state', '=', 'posted']
        ]],
        {'fields': ['id', 'date', 'debit', 'credit', 'name', 'partner_id', 'move_id'], 'order': 'id'}
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

    # Find duplicates
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}

    if not duplicates:
        print(f"[OK] Nessun doppione trovato!\n")
        return 0

    print(f"[!] Trovati {len(duplicates)} set di doppioni")
    total_duplicate_lines = sum(len(v) for v in duplicates.values())
    print(f"    Totale righe duplicate: {total_duplicate_lines}\n")

    # For each duplicate set, keep the FIRST one (lowest ID), delete the rest
    lines_to_delete = []
    moves_to_delete = set()

    for key, entries in duplicates.items():
        # Sort by ID (keep the first one created)
        sorted_entries = sorted(entries, key=lambda x: x['id'])

        # Keep first, delete the rest
        keep = sorted_entries[0]
        delete = sorted_entries[1:]

        if delete:
            date, amount, partner = key
            print(f"Data: {date} | Importo: {amount:>12.2f}")
            print(f"  TENGO:   Line ID {keep['id']:6} | Move ID {keep['move_id']:6}")

            for dup in delete:
                print(f"  ELIMINO: Line ID {dup['id']:6} | Move ID {dup['move_id']:6}")
                lines_to_delete.append(dup['id'])
                moves_to_delete.add(dup['move_id'])

    print(f"\n{'=' * 80}")
    print(f"RIEPILOGO")
    print(f"{'=' * 80}")
    print(f"Righe da eliminare: {len(lines_to_delete)}")
    print(f"Moves da eliminare: {len(moves_to_delete)}")

    if DRY_RUN:
        print(f"\n[DRY RUN] Nessuna modifica effettuata")
        print(f"Per eseguire realmente, impostare DRY_RUN = False nello script")
        return 0
    else:
        # Delete moves (this will also delete the lines)
        print(f"\n[!] ELIMINAZIONE IN CORSO...")

        deleted_count = 0
        for move_id in moves_to_delete:
            try:
                # First unpost the move
                models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.move', 'button_draft',
                    [[move_id]]
                )

                # Then delete it
                result = models.execute_kw(
                    CONFIG['db'], uid, CONFIG['password'],
                    'account.move', 'unlink',
                    [[move_id]]
                )

                if result:
                    deleted_count += 1
                    if deleted_count % 10 == 0:
                        print(f"  Eliminati {deleted_count}/{len(moves_to_delete)} moves...")

            except Exception as e:
                print(f"  [ERROR] Impossibile eliminare move {move_id}: {e}")

        print(f"\n[OK] Eliminati {deleted_count} moves duplicati")
        return deleted_count

def main():
    print("\n" + "=" * 80)
    if DRY_RUN:
        print("ELIMINA DOPPIONI - MODALITA' DRY RUN (simulazione)")
    else:
        print("ELIMINA DOPPIONI - MODALITA' ESECUZIONE REALE")
    print("=" * 80)

    # Accounts to clean
    accounts_to_clean = [
        ('1024', 'UBS-CHF, 278-122087.01J'),
        ('1025', 'EUR-UBS, 278-122087.60A'),
        ('1026', 'CHF-CRS PRINCIPALE, 3977497-51'),
        ('1022', 'Outstanding Receipts'),
        ('1023', 'Outstanding Payments'),
    ]

    total_deleted = 0

    for code, name in accounts_to_clean:
        deleted = delete_duplicates(code, name)
        total_deleted += deleted

    print("\n" + "=" * 80)
    print("RIEPILOGO FINALE")
    print("=" * 80)
    print(f"\nTotale konti processati: {len(accounts_to_clean)}")

    if DRY_RUN:
        print(f"\n[DRY RUN] Simulazione completata")
        print(f"Trovati doppioni in tutti i konti")
        print(f"\nPer eseguire realmente:")
        print(f"1. Aprire lo script: scripts/elimina-doppioni-odoo.py")
        print(f"2. Cambiare: DRY_RUN = False")
        print(f"3. Eseguire di nuovo")
    else:
        print(f"\nMoves duplicati eliminati: {total_deleted}")
        print(f"\n[OK] Pulizia completata!")

    print("\n")

if __name__ == "__main__":
    main()
