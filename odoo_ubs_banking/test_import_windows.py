"""
Test import CSV UBS per Windows (senza emoji)
"""
import sys
import os

# Forza output UTF-8
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from ubs_csv_importer import UBSCSVParser, UBSImporter
from odoo_connector import OdooConnector
import config

def test_import_dry_run():
    """Test import in modalità simulazione"""
    csv_file = 'esempio_ubs.csv'

    print("\n" + "="*70)
    print("TEST IMPORTAZIONE MOVIMENTI BANCARI UBS -> ODOO")
    print("="*70 + "\n")

    # Verifica file esiste
    if not os.path.exists(csv_file):
        print(f"[ERRORE] File non trovato: {csv_file}")
        return False

    print(f"[OK] File trovato: {csv_file}")

    # Test 1: Parsing CSV
    print("\n--- TEST 1: PARSING CSV ---")
    try:
        parser = UBSCSVParser(csv_file)
        header_info, transactions = parser.parse()

        print(f"[OK] CSV parsato correttamente")
        print(f"     Encoding: {parser.encoding}")
        print(f"     Transazioni trovate: {len(transactions)}")

        if 'IBAN' in header_info:
            print(f"     IBAN: {header_info['IBAN']}")
        if 'Whrg.' in header_info:
            print(f"     Valuta: {header_info['Whrg.']}")

    except Exception as e:
        print(f"[ERRORE] Parsing fallito: {e}")
        return False

    # Test 2: Connessione Odoo
    print("\n--- TEST 2: CONNESSIONE ODOO ---")
    try:
        import xmlrpc.client

        url = config.ODOO_URL
        db = config.ODOO_DB
        username = config.ODOO_USERNAME
        password = config.ODOO_PASSWORD

        common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
        uid = common.authenticate(db, username, password, {})

        if uid:
            print(f"[OK] Connesso a Odoo come UID {uid}")
            print(f"     URL: {url}")
            print(f"     DB: {db}")
            print(f"     User: {username}")
            models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')
        else:
            print("[ERRORE] Autenticazione fallita")
            return False
    except Exception as e:
        print(f"[ERRORE] Connessione fallita: {e}")
        return False

    # Test 3: Simulazione import (dry-run)
    print("\n--- TEST 3: SIMULAZIONE IMPORT ---")
    print("Modalita: DRY RUN (nessun dato salvato)")
    print("-"*70)

    for i, trans in enumerate(transactions, 1):
        amount_str = f"{trans['amount']:>10.2f}"
        symbol = "+" if trans['amount'] > 0 else "-"
        print(f"{i}. [{symbol}] {trans['date']} | CHF {amount_str:>12} | {trans['payment_ref'][:50]}")

    print("-"*70)
    print(f"\n[OK] Simulazione completata")
    print(f"     Totale movimenti: {len(transactions)}")

    # Calcola totali
    entrate = sum(t['amount'] for t in transactions if t['amount'] > 0)
    uscite = sum(t['amount'] for t in transactions if t['amount'] < 0)
    netto = entrate + uscite

    print(f"\n--- RIEPILOGO IMPORTI ---")
    print(f"     Entrate totali:  CHF {entrate:>12.2f}")
    print(f"     Uscite totali:   CHF {uscite:>12.2f}")
    print(f"     Saldo netto:     CHF {netto:>12.2f}")

    print("\n" + "="*70)
    print("TEST COMPLETATO CON SUCCESSO!")
    print("="*70)
    print("\nPer salvare realmente in Odoo, usa: python ubs_csv_importer.py esempio_ubs.csv --save")
    print("(Richiede fix emoji per Windows)")

    return True

if __name__ == "__main__":
    success = test_import_dry_run()
    sys.exit(0 if success else 1)
