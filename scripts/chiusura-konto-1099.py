#!/usr/bin/env python3
"""
AUTOMAZIONE CHIUSURA KONTO 1099 TRANSFERKONTO

Chiude il conto 1099 (CHF -60,842.41) su Patrimonio Netto
Movimenti del 31.01.2024 - Correzioni post-migrazione 2023

@author Process Automator
@date 2025-11-15
"""

import odoorpc
from datetime import date

# ============================================================================
# CONFIGURAZIONE
# ============================================================================

ODOO_HOST = 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
ODOO_USER = 'paul@lapa.ch'
ODOO_PASS = 'lapa201180'

# ============================================================================
# FUNZIONI
# ============================================================================

def print_separator(char='=', length=60):
    """Stampa separatore"""
    print(char * length)

def print_step(step_num, title):
    """Stampa titolo step"""
    print(f"\n📊 STEP {step_num}: {title}\n")
    print_separator()

# ============================================================================
# MAIN
# ============================================================================

def main():
    print_separator()
    print("  AUTOMAZIONE CHIUSURA KONTO 1099 TRANSFERKONTO")
    print_separator()

    # ========================================================================
    # CONNESSIONE
    # ========================================================================

    print("\n🔐 Connessione a Odoo...")
    try:
        odoo = odoorpc.ODOO(ODOO_HOST, protocol='jsonrpc+ssl', port=443)
        odoo.login(ODOO_DB, ODOO_USER, ODOO_PASS)
        print(f"✅ Connesso! UID: {odoo.env.uid}")
    except Exception as e:
        print(f"❌ Errore connessione: {e}")
        return 1

    # ========================================================================
    # STEP 1: ANALISI KONTO 1099
    # ========================================================================

    print_step(1, "Analisi Konto 1099 Transferkonto")

    Account = odoo.env['account.account']
    MoveLine = odoo.env['account.move.line']

    # Cerca conto 1099
    account_ids = Account.search([('code', '=', '1099')])

    if not account_ids:
        print("❌ Conto 1099 non trovato!")
        return 1

    konto1099 = Account.browse(account_ids[0])

    print(f"\n✅ Conto trovato:")
    print(f"   ID: {konto1099.id}")
    print(f"   Codice: {konto1099.code}")
    print(f"   Nome: {konto1099.name}")
    print(f"   Tipo: {konto1099.account_type}")

    # Cerca movimenti
    line_ids = MoveLine.search([('account_id', '=', konto1099.id)])
    all_lines = MoveLine.browse(line_ids)

    print(f"\n📋 Movimenti totali: {len(all_lines)}")

    # Filtra quelli del 31.01.2024
    lines_jan = [line for line in all_lines if str(line.date) == '2024-01-31']
    print(f"   di cui del 31.01.2024: {len(lines_jan)}")
    print('-' * 60)

    total_debit = 0
    total_credit = 0

    for idx, line in enumerate(lines_jan, 1):
        print(f"\n{idx}. Move Line ID: {line.id}")
        print(f"   Data: {line.date}")
        print(f"   Descrizione: {line.name or 'N/A'}")
        print(f"   Dare: CHF {line.debit:.2f}")
        print(f"   Avere: CHF {line.credit:.2f}")
        print(f"   Saldo: CHF {line.balance:.2f}")

        total_debit += line.debit
        total_credit += line.credit

    net_balance = total_debit - total_credit
    current_balance = konto1099.current_balance

    print(f"\n{'=' * 60}")
    print(f"📊 RIEPILOGO (31.01.2024):")
    print(f"   Totale Dare: CHF {total_debit:.2f}")
    print(f"   Totale Avere: CHF {total_credit:.2f}")
    print(f"   Saldo Netto: CHF {net_balance:.2f}")
    print(f"\n💡 Saldo attuale conto: CHF {current_balance:.2f}")
    print('=' * 60)

    # ========================================================================
    # STEP 2: TROVA CONTO PATRIMONIO NETTO
    # ========================================================================

    print_step(2, "Identifica Conto Patrimonio Netto")

    # Cerca conti equity
    equity_ids = Account.search([('account_type', 'in', ['equity', 'equity_unaffected'])])
    equity_accounts = Account.browse(equity_ids)

    print(f"\n📋 Conti Equity disponibili: {len(equity_accounts)}")

    if not equity_accounts:
        print("❌ Nessun conto Equity trovato!")
        return 1

    # Mostra i primi 10
    for idx, acc in enumerate(equity_accounts[:10], 1):
        print(f"   {idx}. [{acc.code}] {acc.name}")

    # Cerca specificamente conti di apertura/differenze
    target_account = None

    for acc in equity_accounts:
        if acc.code in ['2979', '2980']:
            target_account = acc
            break

    if not target_account:
        for acc in equity_accounts:
            name_lower = acc.name.lower()
            if any(keyword in name_lower for keyword in ['eröffnung', 'differenz', 'apertura', 'opening']):
                target_account = acc
                break

    if not target_account:
        for acc in equity_accounts:
            if acc.account_type == 'equity_unaffected':
                target_account = acc
                break

    if not target_account:
        target_account = equity_accounts[0]

    print(f"\n✅ Conto selezionato:")
    print(f"   ID: {target_account.id}")
    print(f"   Codice: {target_account.code}")
    print(f"   Nome: {target_account.name}")
    print(f"   Tipo: {target_account.account_type}")

    # ========================================================================
    # STEP 3: CREA REGISTRAZIONE
    # ========================================================================

    print_step(3, "Creazione Registrazione di Chiusura")

    Journal = odoo.env['account.journal']

    # Cerca journal generale
    journal_ids = Journal.search([('type', '=', 'general')], limit=1)

    if not journal_ids:
        print("❌ Nessun journal generale trovato!")
        return 1

    journal = Journal.browse(journal_ids[0])
    print(f"\n📘 Journal: {journal.code} - {journal.name}")

    importo = abs(current_balance)

    print(f"\n💡 Saldo da chiudere: CHF {current_balance:.2f}")
    print(f"   ({'Credito' if current_balance < 0 else 'Debito'})")

    # Prepara righe
    if current_balance < 0:
        # Saldo credito → Dare 1099, Avere Equity
        line1099 = {
            'account_id': konto1099.id,
            'name': 'Chiusura Transferkonto su Patrimonio Netto',
            'debit': importo,
            'credit': 0
        }
        line_equity = {
            'account_id': target_account.id,
            'name': 'Chiusura Transferkonto da conto 1099',
            'debit': 0,
            'credit': importo
        }
    else:
        # Saldo debito → Avere 1099, Dare Equity
        line1099 = {
            'account_id': konto1099.id,
            'name': 'Chiusura Transferkonto su Patrimonio Netto',
            'debit': 0,
            'credit': importo
        }
        line_equity = {
            'account_id': target_account.id,
            'name': 'Chiusura Transferkonto da conto 1099',
            'debit': importo,
            'credit': 0
        }

    print(f"\n📋 Registrazione da creare:")
    print(f"   Data: {date.today()}")
    print(f"   Importo: CHF {importo:.2f}")
    print(f"\n   Riga 1: {konto1099.code} - {konto1099.name}")
    print(f"      D: CHF {line1099['debit']:.2f} | A: CHF {line1099['credit']:.2f}")
    print(f"\n   Riga 2: {target_account.code} - {target_account.name}")
    print(f"      D: CHF {line_equity['debit']:.2f} | A: CHF {line_equity['credit']:.2f}")

    print("\n⏳ Creazione registrazione in Odoo...")

    Move = odoo.env['account.move']

    move_data = {
        'journal_id': journal.id,
        'date': str(date.today()),
        'ref': 'Chiusura Konto 1099 Transferkonto - Correzioni post-migrazione 2023',
        'line_ids': [
            (0, 0, line1099),
            (0, 0, line_equity)
        ]
    }

    try:
        move_id = Move.create(move_data)
        print(f"✅ Registrazione creata: ID {move_id}")

        move = Move.browse(move_id)

        print(f"\n📄 Dettagli:")
        print(f"   Numero: {move.name}")
        print(f"   Stato: {move.state}")
        print(f"   Data: {move.date}")
        print(f"   Riferimento: {move.ref}")

    except Exception as e:
        print(f"\n❌ Errore nella creazione: {e}")
        return 1

    # ========================================================================
    # STEP 4: VERIFICA
    # ========================================================================

    print_step(4, "Verifica Saldo Finale")

    # Ricarica il conto per avere il saldo aggiornato
    konto1099 = Account.browse(konto1099.id)
    saldo_finale = konto1099.current_balance

    print(f"\n📊 Conto: {konto1099.code} - {konto1099.name}")
    print(f"   Saldo Finale: CHF {saldo_finale:.2f}")

    if abs(saldo_finale) < 0.01:
        print("\n🎉 SUCCESSO! Saldo = 0.00")
        verifica_ok = True
    else:
        print("\n⚠️  Saldo diverso da 0.00")
        print("   Potrebbe essere necessario validare la registrazione.")
        verifica_ok = False

    # ========================================================================
    # RIEPILOGO
    # ========================================================================

    print(f"\n{'=' * 60}")
    print("  RIEPILOGO OPERAZIONE")
    print('=' * 60)
    print(f"\n✅ Conto chiuso: {konto1099.code} - {konto1099.name}")
    print(f"✅ Importo: CHF {importo:.2f}")
    print(f"✅ Su conto: {target_account.code} - {target_account.name}")
    print(f"✅ Registrazione: {move.name} ({move.state})")
    print(f"{'✅' if verifica_ok else '⚠️ '} Saldo finale: {'CHF 0.00' if verifica_ok else 'Da verificare'}")

    if move.state == 'draft':
        print(f"\n⚠️  IMPORTANTE: La registrazione è in stato DRAFT")
        print(f"   Vai su Odoo e valida la registrazione {move.name}")

    print(f"\n{'=' * 60}")
    print("  ✅ AUTOMAZIONE COMPLETATA")
    print('=' * 60)
    print()

    return 0

if __name__ == '__main__':
    try:
        exit(main())
    except Exception as e:
        print(f"\n❌ ERRORE: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
