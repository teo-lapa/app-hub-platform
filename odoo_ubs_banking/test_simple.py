# -*- coding: utf-8 -*-
"""
Script di test semplificato per Windows (senza emoji)
"""

import sys
import config
from odoo_connector import OdooConnector, BankStatementManager

# Forza UTF-8 su Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def test_connection():
    """Test connessione Odoo"""
    print("\n" + "="*70)
    print("TEST CONNESSIONE ODOO")
    print("="*70)

    print(f"\nURL: {config.ODOO_URL}")
    print(f"DB: {config.ODOO_DB}")
    print(f"User: {config.ODOO_USERNAME}")
    print("\nConnessione in corso...")

    odoo = OdooConnector()

    try:
        success = odoo.connect()
        if success:
            print(f"\n[OK] Connessione riuscita!")
            print(f"     UID: {odoo.uid}")
            return odoo
        else:
            print(f"\n[ERRORE] Connessione fallita")
            return None
    except Exception as e:
        print(f"\n[ERRORE] {e}")
        return None


def test_journals(odoo):
    """Test giornali bancari"""
    print("\n" + "="*70)
    print("TEST GIORNALI BANCARI")
    print("="*70)

    manager = BankStatementManager(odoo)
    journals = manager.get_all_bank_journals()

    print(f"\n[OK] Trovati {len(journals)} giornali bancari:")

    for j in journals:
        currency = j['currency_id'][1] if j['currency_id'] else 'N/A'
        is_ubs = 'UBS' in j['name'].upper()
        prefix = ">>> UBS >>>" if is_ubs else "           "
        print(f"{prefix} [{j['id']:3d}] {j['name']:30s} ({j['code']:5s}) - {currency}")

    return manager


def test_ubs_details(manager):
    """Test dettagli UBS"""
    print("\n" + "="*70)
    print("TEST GIORNALI UBS CONFIGURATI")
    print("="*70)

    for key, ubs_info in config.GIORNALI_UBS.items():
        print(f"\n{key}:")
        journal = manager.get_journal_info(ubs_info['id'])

        if journal:
            print(f"  [OK] Giornale trovato")
            print(f"       ID: {journal['id']}")
            print(f"       Nome: {journal['name']}")
            print(f"       Codice: {journal['code']}")
            if journal['bank_account_id']:
                print(f"       IBAN: {journal['bank_account_id'][1]}")
        else:
            print(f"  [ERRORE] Giornale ID {ubs_info['id']} non trovato")


def test_movements(manager):
    """Test movimenti recenti"""
    print("\n" + "="*70)
    print("TEST MOVIMENTI BANCARI RECENTI")
    print("="*70)

    print(f"\nUltimi 10 movimenti su {config.DEFAULT_JOURNAL_NAME}:\n")

    movements = manager.get_recent_movements(config.DEFAULT_JOURNAL_ID, limit=10)

    if not movements:
        print("[ATTENZIONE] Nessun movimento trovato")
        return

    total = 0
    for m in movements:
        partner = m['partner_id'][1] if m['partner_id'] else "N/A"
        reconciled = "[R]" if m['is_reconciled'] else "[ ]"
        amount_sign = "+" if m['amount'] > 0 else "-"

        print(f"{reconciled} {m['date']} {amount_sign} CHF {abs(m['amount']):>10.2f} | {partner[:40]}")
        print(f"    {m['payment_ref'][:70]}")

        total += m['amount']

    print(f"\n{'-'*70}")
    print(f"TOTALE: CHF {total:>10.2f}")


def test_fields(odoo):
    """Test struttura campi"""
    print("\n" + "="*70)
    print("TEST STRUTTURA CAMPI")
    print("="*70)

    fields = odoo.get_fields('account.bank.statement.line')

    important_fields = [
        'date', 'journal_id', 'payment_ref', 'amount',
        'partner_id', 'partner_name', 'ref'
    ]

    print("\nCampi principali per import:\n")

    for field_name in important_fields:
        if field_name in fields:
            field = fields[field_name]
            required = "[OBBLIGATORIO]" if field.get('required') else ""
            readonly = "[READONLY]" if field.get('readonly') else ""
            field_type = field.get('type', 'unknown')
            description = field.get('string', field_name)

            print(f"  {field_name:20s} ({field_type:15s}) {description}")
            if required or readonly:
                print(f"    {required} {readonly}")


def run_all_tests():
    """Esegue tutti i test"""
    print("\n" + "="*70)
    print(" TEST INTEGRAZIONE ODOO + UBS BANKING")
    print("="*70)

    # Test 1
    odoo = test_connection()
    if not odoo:
        print("\n[ERRORE] Impossibile procedere senza connessione")
        return

    # Test 2
    manager = test_journals(odoo)

    # Test 3
    test_ubs_details(manager)

    # Test 4
    test_movements(manager)

    # Test 5
    test_fields(odoo)

    # Riepilogo
    print("\n" + "="*70)
    print(" TUTTI I TEST COMPLETATI")
    print("="*70)
    print("\nPROSSIMI PASSI:")
    print("  1. Esporta CSV dalla tua UBS e-banking")
    print("  2. Esegui: python test_import.py")
    print("  3. Verifica anteprima e conferma import\n")


if __name__ == "__main__":
    run_all_tests()
