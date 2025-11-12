"""
Script di test completo per connessione Odoo e verifica struttura contabile
"""

import config
from odoo_connector import OdooConnector, BankStatementManager
from datetime import datetime
import json


def test_connection():
    """Test connessione base a Odoo"""
    print("\n" + "="*70)
    print("TEST 1: CONNESSIONE ODOO")
    print("="*70)

    odoo = OdooConnector()
    success = odoo.connect()

    if success:
        print(f"✅ Connessione riuscita!")
        print(f"   URL: {config.ODOO_URL}")
        print(f"   DB: {config.ODOO_DB}")
        print(f"   User: {config.ODOO_USERNAME}")
        print(f"   UID: {odoo.uid}")
        return odoo
    else:
        print(f"❌ Connessione fallita!")
        return None


def test_bank_journals(odoo: OdooConnector):
    """Test recupero giornali bancari"""
    print("\n" + "="*70)
    print("TEST 2: GIORNALI BANCARI")
    print("="*70)

    manager = BankStatementManager(odoo)
    journals = manager.get_all_bank_journals()

    print(f"\n📁 Trovati {len(journals)} giornali bancari:\n")

    for j in journals:
        currency = j['currency_id'][1] if j['currency_id'] else 'N/A'
        bank_account = j['bank_account_id'][1] if j['bank_account_id'] else 'N/A'

        # Evidenzia giornali UBS
        is_ubs = 'UBS' in j['name'].upper()
        prefix = "🏦 UBS →" if is_ubs else "  "

        print(f"{prefix} [{j['id']:3d}] {j['name']:30s} ({j['code']:5s}) | {currency:5s} | {bank_account}")

    return manager


def test_ubs_journals(manager: BankStatementManager):
    """Test dettagli giornali UBS"""
    print("\n" + "="*70)
    print("TEST 3: DETTAGLI GIORNALI UBS CONFIGURATI")
    print("="*70)

    for key, ubs_info in config.GIORNALI_UBS.items():
        print(f"\n🏦 {key}:")
        journal = manager.get_journal_info(ubs_info['id'])

        if journal:
            print(f"   ✅ Giornale trovato")
            print(f"   ID: {journal['id']}")
            print(f"   Nome: {journal['name']}")
            print(f"   Codice: {journal['code']}")
            print(f"   Tipo: {journal['type']}")

            if journal['currency_id']:
                print(f"   Valuta: {journal['currency_id'][1]}")

            if journal['bank_account_id']:
                print(f"   IBAN: {journal['bank_account_id'][1]}")
        else:
            print(f"   ❌ Giornale ID {ubs_info['id']} non trovato!")


def test_recent_movements(manager: BankStatementManager):
    """Test recupero movimenti recenti"""
    print("\n" + "="*70)
    print("TEST 4: MOVIMENTI BANCARI RECENTI")
    print("="*70)

    print(f"\n📊 Ultimi 10 movimenti su {config.DEFAULT_JOURNAL_NAME}:\n")

    movements = manager.get_recent_movements(config.DEFAULT_JOURNAL_ID, limit=10)

    if not movements:
        print("   ⚠️  Nessun movimento trovato")
        return

    total = 0
    for m in movements:
        partner = m['partner_id'][1] if m['partner_id'] else "N/A"
        journal = m['journal_id'][1] if m['journal_id'] else "N/A"
        reconciled = "✓" if m['is_reconciled'] else "✗"
        amount_icon = "📗" if m['amount'] > 0 else "📕"

        print(f"[{reconciled}] {m['date']} {amount_icon} CHF {m['amount']:>10.2f} | {partner[:40]:40s}")
        print(f"    {m['payment_ref'][:70]}")
        print()

        total += m['amount']

    print(f"{'─'*70}")
    print(f"TOTALE: CHF {total:>10.2f}")


def test_fields_structure(odoo: OdooConnector):
    """Test struttura campi account.bank.statement.line"""
    print("\n" + "="*70)
    print("TEST 5: STRUTTURA CAMPI MOVIMENTI BANCARI")
    print("="*70)

    fields = odoo.get_fields('account.bank.statement.line')

    # Filtra solo campi importanti
    important_fields = [
        'date', 'journal_id', 'payment_ref', 'amount', 'partner_id',
        'partner_name', 'account_number', 'ref', 'transaction_type',
        'move_id', 'is_reconciled'
    ]

    print("\n📋 Campi disponibili per import movimenti:\n")

    for field_name in important_fields:
        if field_name in fields:
            field = fields[field_name]
            required = "✓ OBBLIGATORIO" if field.get('required') else ""
            readonly = "🔒 READONLY" if field.get('readonly') else ""
            field_type = field.get('type', 'unknown')
            description = field.get('string', field_name)

            print(f"  {field_name:20s} ({field_type:15s}) - {description}")
            if required:
                print(f"    {required}")
            if readonly:
                print(f"    {readonly}")
            print()


def test_create_test_movement(manager: BankStatementManager, odoo: OdooConnector):
    """Test creazione movimento di test"""
    print("\n" + "="*70)
    print("TEST 6: CREAZIONE MOVIMENTO DI TEST (SIMULATO)")
    print("="*70)

    test_movement = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'journal_id': config.DEFAULT_JOURNAL_ID,
        'payment_ref': '🧪 TEST - Movimento di prova da script Python',
        'amount': 0.01,  # 1 centesimo per test
        'partner_name': 'Test Partner',
        'ref': 'TEST-' + datetime.now().strftime('%Y%m%d-%H%M%S')
    }

    print("\n📝 Dati movimento test:")
    print(json.dumps(test_movement, indent=2, ensure_ascii=False))

    # Chiedi conferma
    print("\n⚠️  ATTENZIONE: Questo creerà un movimento REALE in Odoo staging!")
    response = input("   Vuoi procedere? (yes/no): ")

    if response.lower() == 'yes':
        try:
            line_id = manager.create_statement_line(test_movement)
            print(f"\n✅ Movimento creato con successo!")
            print(f"   ID: {line_id}")

            # Rileggi il movimento
            print(f"\n🔍 Verifica movimento creato...")
            created = odoo.search_read(
                'account.bank.statement.line',
                [['id', '=', line_id]],
                fields=['date', 'payment_ref', 'amount', 'journal_id', 'move_id', 'is_reconciled']
            )

            if created:
                m = created[0]
                print(f"\n📄 Movimento verificato:")
                print(json.dumps(m, indent=2, ensure_ascii=False, default=str))

                # Opzione elimina
                print(f"\n⚠️  Vuoi eliminare il movimento test?")
                response = input("   (yes/no): ")

                if response.lower() == 'yes':
                    odoo.unlink('account.bank.statement.line', [line_id])
                    print(f"   ✅ Movimento eliminato")
                else:
                    print(f"   ℹ️  Movimento mantenuto con ID {line_id}")

        except Exception as e:
            print(f"\n❌ Errore creazione movimento: {e}")
    else:
        print("\n   ℹ️  Test annullato")


def run_all_tests():
    """Esegue tutti i test"""
    print("\n" + "="*70)
    print("TEST COMPLETO INTEGRAZIONE ODOO + UBS BANKING")
    print("="*70)

    # Test 1: Connessione
    odoo = test_connection()
    if not odoo:
        print("\n❌ Test interrotti: impossibile connettersi a Odoo")
        return

    # Test 2: Giornali bancari
    manager = test_bank_journals(odoo)

    # Test 3: Dettagli UBS
    test_ubs_journals(manager)

    # Test 4: Movimenti recenti
    test_recent_movements(manager)

    # Test 5: Struttura campi
    test_fields_structure(odoo)

    # Test 6: Creazione movimento (opzionale)
    print("\n" + "="*70)
    print("TEST 6: CREAZIONE MOVIMENTO DI TEST")
    print("="*70)
    print("\n⚠️  Saltato. Per testare, decommentare chiamata in run_all_tests()")
    # test_create_test_movement(manager, odoo)

    # Riepilogo finale
    print("\n" + "="*70)
    print("✅ TUTTI I TEST COMPLETATI")
    print("="*70)
    print("\n📝 PROSSIMI PASSI:")
    print("   1. Esporta un file CSV dalla tua UBS e-banking")
    print("   2. Esegui: python ubs_csv_importer.py <file.csv>")
    print("   3. Verifica l'anteprima e conferma import")
    print("\n")


if __name__ == "__main__":
    run_all_tests()
