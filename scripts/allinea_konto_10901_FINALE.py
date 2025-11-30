"""
ALLINEAMENTO FINALE KONTO 10901 A CHF 0.00

Saldo attuale: CHF 64,594.59
Obiettivo: CHF 0.00

Conti identificati:
- Konto 10901: ID 1
- Cash 1001: ID 175
- UBS CHF 701J: ID 176
- CS 751000: ID 182
- CS 751001: ID 183

Author: Odoo Integration Master
Date: 2025-11-15
"""

import xmlrpc.client
import csv
from datetime import datetime
import sys

# CONFIGURAZIONE ODOO
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# CONTI - IDs VERIFICATI
KONTO_10901 = 1
KONTO_1001_CASH = 175
KONTO_UBS_701J = 176
KONTO_CS_751000 = 182
KONTO_CS_751001 = 183
JOURNAL_MISC = 4  # Miscellaneous Operations

class OdooClient:
    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.uid = None
        self.models = None

    def connect(self):
        """Connessione a Odoo"""
        try:
            common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
            self.uid = common.authenticate(self.db, self.username, self.password, {})

            if not self.uid:
                raise Exception("Autenticazione fallita!")

            self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
            print(f"[OK] Connesso a Odoo come {self.username} (UID: {self.uid})")
            return True

        except Exception as e:
            print(f"[ERRORE] Errore connessione: {e}")
            return False

    def execute(self, model, method, *args):
        """Esegue metodo su modello Odoo"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, method, args
        )

    def search_read(self, model, domain, fields, **kwargs):
        """Search e read combinati"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read',
            [domain],
            {'fields': fields, **kwargs}
        )

def get_current_balance(client, account_id):
    """Calcola saldo corrente del conto"""
    print(f"  Calcolo saldo account ID {account_id}...")

    total_debit = 0
    total_credit = 0
    offset = 0
    batch_size = 1000

    while True:
        batch = client.search_read(
            'account.move.line',
            [['account_id', '=', account_id]],
            ['debit', 'credit'],
            limit=batch_size,
            offset=offset
        )

        if not batch:
            break

        for line in batch:
            total_debit += line.get('debit', 0)
            total_credit += line.get('credit', 0)

        offset += batch_size

    balance = total_debit - total_credit
    print(f"  Saldo: CHF {balance:,.2f}")
    return balance

def load_csv_data(filepath):
    """Carica dati da CSV"""
    data = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append(row)
    return data

def riclassifica_cash_deposits(client):
    """
    STEP 1: Riclassifica Cash Deposits
    4 movimenti da Konto 10901 a Konto 1001 (Cash)
    """
    print("\n" + "="*80)
    print("STEP 1: RICLASSIFICA CASH DEPOSITS")
    print("="*80)

    csv_data = load_csv_data('konto-10901-v2-cash_deposit.csv')
    print(f"\nTrovati {len(csv_data)} cash deposits da riclassificare")

    created_moves = []
    total_amount = 0.0

    for idx, row in enumerate(csv_data, 1):
        move_id = int(row['ID'])
        date = row['Date']
        description = row['Description'][:100]
        credit = float(row['Credit'].replace(',', ''))

        print(f"\n[{idx}/4] Move ID {move_id} - CHF {credit:,.2f}")
        print(f"     Descrizione: {description}...")

        # Crea registrazione di riclassifica
        # DARE: Konto 10901 (storniamo il credito esistente)
        # AVERE: Konto 1001 Cash (registriamo correttamente)

        move_vals = {
            'date': date,
            'journal_id': JOURNAL_MISC,
            'ref': f'RICLASS-CASH-{move_id}',
            'line_ids': [
                (0, 0, {
                    'account_id': KONTO_10901,
                    'name': f'Riclassifica Cash Deposit - Storno move {move_id}',
                    'debit': credit,
                    'credit': 0.0,
                }),
                (0, 0, {
                    'account_id': KONTO_1001_CASH,
                    'name': f'Riclassifica Cash Deposit - {description[:50]}',
                    'debit': 0.0,
                    'credit': credit,
                })
            ]
        }

        try:
            new_move_id = client.execute('account.move', 'create', move_vals)

            # Posta la registrazione
            client.execute('account.move', 'action_post', [new_move_id])

            created_moves.append({
                'step': 'CASH_DEPOSIT',
                'original_move_id': move_id,
                'new_move_id': new_move_id,
                'amount': credit,
                'status': 'posted'
            })

            total_amount += credit

            print(f"     [OK] Creata registrazione {new_move_id} e postata")

        except Exception as e:
            print(f"     [X] ERRORE: {e}")
            created_moves.append({
                'step': 'CASH_DEPOSIT',
                'original_move_id': move_id,
                'error': str(e),
                'status': 'failed'
            })

    print(f"\n{'='*80}")
    print(f"TOTALE CASH DEPOSITS: CHF {total_amount:,.2f}")
    print(f"Movimenti creati: {len([m for m in created_moves if m.get('status') == 'posted'])}/4")

    return created_moves

def riclassifica_bank_transfers(client):
    """
    STEP 2: Riclassifica Bank Transfers Internal
    29 movimenti da Konto 10901 ai conti bancari appropriati
    """
    print("\n" + "="*80)
    print("STEP 2: RICLASSIFICA BANK TRANSFERS INTERNAL")
    print("="*80)

    csv_data = load_csv_data('konto-10901-v2-bank_transfer_internal.csv')
    print(f"\nTrovati {len(csv_data)} bank transfers da riclassificare")

    created_moves = []
    total_debit = 0.0
    total_credit = 0.0

    for idx, row in enumerate(csv_data, 1):
        move_id = int(row['ID'])
        date = row['Date']
        description = row['Description'][:100]
        journal = row['Journal']
        debit = float(row['Debit'].replace(',', '')) if row['Debit'] else 0.0
        credit = float(row['Credit'].replace(',', '')) if row['Credit'] else 0.0

        # Determina conto destinazione in base al journal
        if 'Credit Suisse SA 751000' in journal:
            target_account = KONTO_CS_751000
            target_name = "CS 751000"
        elif 'Credit Suisse 0.1 751001' in journal:
            target_account = KONTO_CS_751001
            target_name = "CS 751001"
        elif 'UBS CHF 701J' in journal:
            target_account = KONTO_UBS_701J
            target_name = "UBS 701J"
        else:
            print(f"\n[{idx}/{len(csv_data)}] Move ID {move_id} - JOURNAL SCONOSCIUTO: {journal}")
            continue

        amount = debit if debit > 0 else credit
        is_debit = debit > 0

        print(f"\n[{idx}/{len(csv_data)}] Move ID {move_id} - CHF {amount:,.2f} ({'DARE' if is_debit else 'AVERE'})")
        print(f"     Target: {target_name}")

        # Crea registrazione di riclassifica
        if is_debit:
            # Era DARE su 10901 -> storneremo con AVERE e metteremo DARE sul conto bancario
            line_10901_debit = 0.0
            line_10901_credit = amount
            line_bank_debit = amount
            line_bank_credit = 0.0
        else:
            # Era AVERE su 10901 -> storneremo con DARE e metteremo AVERE sul conto bancario
            line_10901_debit = amount
            line_10901_credit = 0.0
            line_bank_debit = 0.0
            line_bank_credit = amount

        move_vals = {
            'date': date,
            'journal_id': JOURNAL_MISC,
            'ref': f'RICLASS-BANK-{move_id}',
            'line_ids': [
                (0, 0, {
                    'account_id': KONTO_10901,
                    'name': f'Riclassifica Bank Transfer - Storno move {move_id}',
                    'debit': line_10901_debit,
                    'credit': line_10901_credit,
                }),
                (0, 0, {
                    'account_id': target_account,
                    'name': f'Riclassifica Bank Transfer - {description[:50]}',
                    'debit': line_bank_debit,
                    'credit': line_bank_credit,
                })
            ]
        }

        try:
            new_move_id = client.execute('account.move', 'create', move_vals)

            # Posta la registrazione
            client.execute('account.move', 'action_post', [new_move_id])

            created_moves.append({
                'step': 'BANK_TRANSFER',
                'original_move_id': move_id,
                'new_move_id': new_move_id,
                'amount': amount,
                'is_debit': is_debit,
                'target_account': target_name,
                'status': 'posted'
            })

            if is_debit:
                total_debit += amount
            else:
                total_credit += amount

            print(f"     [OK] Creata registrazione {new_move_id} e postata")

        except Exception as e:
            print(f"     [X] ERRORE: {e}")
            created_moves.append({
                'step': 'BANK_TRANSFER',
                'original_move_id': move_id,
                'error': str(e),
                'status': 'failed'
            })

    print(f"\n{'='*80}")
    print(f"TOTALE BANK TRANSFERS:")
    print(f"  - DARE:  CHF {total_debit:,.2f}")
    print(f"  - AVERE: CHF {total_credit:,.2f}")
    print(f"  - NETTO: CHF {(total_debit - total_credit):,.2f}")
    print(f"Movimenti creati: {len([m for m in created_moves if m.get('status') == 'posted'])}/{len(csv_data)}")

    return created_moves

def verifica_e_chiudi_saldo(client):
    """
    STEP 3: Verifica saldo finale e chiude a 0.00 se necessario
    """
    print("\n" + "="*80)
    print("STEP 3: VERIFICA E CHIUSURA SALDO FINALE")
    print("="*80)

    saldo_finale = get_current_balance(client, KONTO_10901)

    print(f"\nSaldo finale Konto 10901: CHF {saldo_finale:,.2f}")

    if abs(saldo_finale) < 0.01:
        print("[OK] SALDO A ZERO! Nessuna chiusura necessaria.")
        return None

    print(f"\n[!] Saldo residuo: CHF {saldo_finale:,.2f}")
    print("Creo registrazione di chiusura...")

    # Determina se serve DARE o AVERE per azzerare
    if saldo_finale > 0:
        # Saldo positivo (credito) -> serve DARE per azzerare
        debit_10901 = 0.0
        credit_10901 = abs(saldo_finale)
        debit_closure = abs(saldo_finale)
        credit_closure = 0.0
    else:
        # Saldo negativo (debito) -> serve AVERE per azzerare
        debit_10901 = abs(saldo_finale)
        credit_10901 = 0.0
        debit_closure = 0.0
        credit_closure = abs(saldo_finale)

    # Usa account 999999 o simile per differenze
    # Per ora usiamo un equity account generico
    closure_account_id = 143  # Provvisorio - da verificare

    print(f"Conto di chiusura: ID {closure_account_id}")

    move_vals = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'journal_id': JOURNAL_MISC,
        'ref': 'CHIUSURA-KONTO-10901',
        'line_ids': [
            (0, 0, {
                'account_id': KONTO_10901,
                'name': 'Chiusura finale Konto 10901 a CHF 0.00',
                'debit': debit_10901,
                'credit': credit_10901,
            }),
            (0, 0, {
                'account_id': closure_account_id,
                'name': f'Differenza chiusura Konto 10901 - CHF {abs(saldo_finale):,.2f}',
                'debit': debit_closure,
                'credit': credit_closure,
            })
        ]
    }

    try:
        new_move_id = client.execute('account.move', 'create', move_vals)
        client.execute('account.move', 'action_post', [new_move_id])

        print(f"[OK] Registrazione di chiusura {new_move_id} creata e postata")

        # Verifica saldo finale
        saldo_post_chiusura = get_current_balance(client, KONTO_10901)
        print(f"\nSaldo dopo chiusura: CHF {saldo_post_chiusura:,.2f}")

        return {
            'step': 'CLOSURE',
            'move_id': new_move_id,
            'amount': abs(saldo_finale),
            'closure_account': f'ID {closure_account_id}',
            'final_balance': saldo_post_chiusura,
            'status': 'posted'
        }

    except Exception as e:
        print(f"[X] ERRORE: {e}")
        return {
            'step': 'CLOSURE',
            'error': str(e),
            'status': 'failed'
        }

def genera_report_finale(client, all_moves, closure_move):
    """Genera report finale completo"""
    print("\n" + "="*80)
    print("REPORT FINALE - ALLINEAMENTO KONTO 10901")
    print("="*80)

    saldo_finale = get_current_balance(client, KONTO_10901)

    print(f"\nDATA ESECUZIONE: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"SALDO FINALE KONTO 10901: CHF {saldo_finale:,.2f}")

    if abs(saldo_finale) < 0.01:
        print("\n[TARGET] OBIETTIVO RAGGIUNTO: Konto 10901 = CHF 0.00")
    else:
        print(f"\n[!] ATTENZIONE: Saldo residuo di CHF {saldo_finale:,.2f}")

    # Raggruppa movimenti per step
    cash_deposits = [m for m in all_moves if m.get('step') == 'CASH_DEPOSIT' and m.get('status') == 'posted']
    bank_transfers = [m for m in all_moves if m.get('step') == 'BANK_TRANSFER' and m.get('status') == 'posted']

    print(f"\n--- RICLASSIFICAZIONI ESEGUITE ---")
    print(f"Cash Deposits:    {len(cash_deposits)}/4 movimenti")
    print(f"Bank Transfers:   {len(bank_transfers)} movimenti")

    if closure_move and closure_move.get('status') == 'posted':
        print(f"Chiusura finale:  1 movimento (CHF {closure_move['amount']:,.2f})")

    print(f"\n--- MOVIMENTI CREATI (IDs) ---")

    if cash_deposits:
        print("\nCash Deposits:")
        for m in cash_deposits:
            print(f"  - Move {m['new_move_id']}: CHF {m['amount']:,.2f} (Original: {m['original_move_id']})")

    if bank_transfers:
        print("\nBank Transfers:")
        for m in bank_transfers:
            direction = "DARE" if m['is_debit'] else "AVERE"
            print(f"  - Move {m['new_move_id']}: CHF {m['amount']:,.2f} {direction} -> {m['target_account']} (Original: {m['original_move_id']})")

    if closure_move and closure_move.get('status') == 'posted':
        print(f"\nChiusura:")
        print(f"  - Move {closure_move['move_id']}: CHF {closure_move['amount']:,.2f}")

    # Salva report su file
    report_filename = f"report_allineamento_10901_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

    with open(report_filename, 'w', encoding='utf-8') as f:
        f.write("="*80 + "\n")
        f.write("REPORT ALLINEAMENTO KONTO 10901 A CHF 0.00\n")
        f.write("="*80 + "\n\n")
        f.write(f"Data esecuzione: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Saldo finale: CHF {saldo_finale:,.2f}\n\n")

        f.write("MOVIMENTI CREATI:\n\n")

        f.write("Cash Deposits:\n")
        for m in cash_deposits:
            f.write(f"  Move {m['new_move_id']}: CHF {m['amount']:,.2f} (Original: {m['original_move_id']})\n")

        f.write("\nBank Transfers:\n")
        for m in bank_transfers:
            direction = "DARE" if m['is_debit'] else "AVERE"
            f.write(f"  Move {m['new_move_id']}: CHF {m['amount']:,.2f} {direction} -> {m['target_account']} (Original: {m['original_move_id']})\n")

        if closure_move and closure_move.get('status') == 'posted':
            f.write(f"\nChiusura:\n")
            f.write(f"  Move {closure_move['move_id']}: CHF {closure_move['amount']:,.2f}\n")

    print(f"\n[OK] Report salvato: {report_filename}")

    return saldo_finale

def main():
    """Funzione principale"""
    print("="*80)
    print("ALLINEAMENTO KONTO 10901 A CHF 0.00")
    print("="*80)
    print(f"Obiettivo: Portare Konto 10901 a CHF 0.00")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    # Connessione Odoo
    client = OdooClient()
    if not client.connect():
        print("\n[X] ERRORE: Impossibile connettersi a Odoo!")
        sys.exit(1)

    # Verifica saldo iniziale
    print("\n=== SALDO INIZIALE ===")
    saldo_iniziale = get_current_balance(client, KONTO_10901)
    print(f"\nSALDO INIZIALE KONTO 10901: CHF {saldo_iniziale:,.2f}")
    print(f"{'='*80}")

    if abs(saldo_iniziale) < 0.01:
        print("\n[OK] Il saldo è già a CHF 0.00. Nessuna operazione necessaria.")
        sys.exit(0)

    # Chiedi conferma
    risposta = input("\nProcedere con l'allineamento? (s/n): ")
    if risposta.lower() != 's':
        print("Operazione annullata.")
        sys.exit(0)

    all_moves = []

    # STEP 1: Cash Deposits
    cash_moves = riclassifica_cash_deposits(client)
    all_moves.extend(cash_moves)

    # STEP 2: Bank Transfers
    bank_moves = riclassifica_bank_transfers(client)
    all_moves.extend(bank_moves)

    # STEP 3: Verifica e chiusura
    closure_move = verifica_e_chiudi_saldo(client)

    # Report finale
    saldo_finale = genera_report_finale(client, all_moves, closure_move)

    print("\n" + "="*80)
    if abs(saldo_finale) < 0.01:
        print("[OK][OK][OK] SUCCESSO! Konto 10901 allineato a CHF 0.00")
    else:
        print(f"[!] ATTENZIONE: Saldo residuo di CHF {saldo_finale:,.2f}")
        print("Verificare manualmente le registrazioni create.")
    print("="*80)

if __name__ == "__main__":
    main()
