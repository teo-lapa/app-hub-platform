#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SCRIPT CORREZIONE CREDIT SUISSE - KONTO 1026

ATTENZIONE: Questo script MODIFICA i dati in Odoo!
Eseguire SOLO dopo:
1. Backup database
2. Verifica su staging
3. Approvazione finale

AZIONI:
1. Elimina movimento "azzeramento 2023" (ID 266506) - CHF 132,834.54
2. Elimina 7 movimenti duplicati - CHF 10,780.50
3. Verifica saldo finale

IMPATTO ATTESO:
- Saldo prima: CHF 360,549.83
- Correzioni: -CHF 143,615.04
- Saldo dopo: CHF 216,934.79
- Saldo target: CHF 24,897.72
- Residuo da investigare: CHF 192,037.07
"""

import sys
import io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import xmlrpc.client
import json
from datetime import datetime

ODOO_URL = "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-main-7268478"
ODOO_USERNAME = "apphubplatform@lapa.ch"
ODOO_PASSWORD = "apphubplatform2025"

# CRITICAL MOVEMENT - Azzeramento 2023
CRITICAL_MOVE_LINE_ID = 266506
CRITICAL_MOVE_ID = 58103
CRITICAL_AMOUNT = 132834.54

# DUPLICATE MOVE LINE IDs (solo secondi elementi delle coppie)
DUPLICATE_LINE_IDS = [
    328697,  # Carburante CHF 5,000.00
    277635,  # Coop CHF 133.48
    264598,  # BP CHF 117.79
    264764,  # CHF 50.03
    264736,  # CHF 41.00
    278248,  # CHF 40.00
    249916   # CHF 7.95
]

EXPECTED_DUPLICATE_AMOUNT = 10780.50

# Modalità di esecuzione
DRY_RUN = True  # Cambiare a False per esecuzione reale
REQUIRE_CONFIRMATION = True  # Richiede conferma prima di ogni operazione

class CreditSuisseFixer:
    def __init__(self, dry_run=True):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_PASSWORD
        self.dry_run = dry_run
        self.uid = None
        self.models = None
        self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')

        self.corrections_log = []

    def authenticate(self):
        self.uid = self.common.authenticate(self.db, self.username, self.password, {})
        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
        return self.uid is not None

    def log_action(self, action_type, description, data):
        """Log ogni azione per audit trail"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action_type,
            'description': description,
            'data': data,
            'dry_run': self.dry_run
        }
        self.corrections_log.append(log_entry)
        print(f"[LOG] {action_type}: {description}")

    def get_current_balance(self):
        """Calcola saldo attuale del konto 1026"""
        lines = self.models.execute_kw(
            self.db, self.uid, self.password,
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', 182],
                ['date', '>=', '2024-01-01'],
                ['date', '<=', '2024-12-31'],
                ['parent_state', '=', 'posted']
            ]],
            {'fields': ['debit', 'credit']}
        )

        total_debit = sum(l['debit'] for l in lines)
        total_credit = sum(l['credit'] for l in lines)
        balance = total_debit - total_credit

        return {
            'total_lines': len(lines),
            'total_debit': total_debit,
            'total_credit': total_credit,
            'balance': balance
        }

    def verify_critical_move(self):
        """Verifica che il movimento critico esista e sia come previsto"""
        print(f"\n{'='*80}")
        print("STEP 1: Verifica movimento critico (azzeramento 2023)")
        print(f"{'='*80}\n")

        try:
            line = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move.line', 'read',
                [[CRITICAL_MOVE_LINE_ID]],
                {'fields': ['id', 'move_id', 'name', 'debit', 'credit', 'reconciled']}
            )[0]

            print(f"Movimento trovato:")
            print(f"  ID: {line['id']}")
            print(f"  Move: {line['move_id']}")
            print(f"  Name: {line['name']}")
            print(f"  Debit: CHF {line['debit']:.2f}")
            print(f"  Credit: CHF {line['credit']:.2f}")
            print(f"  Riconciliato: {line['reconciled']}")

            # Verifiche
            if line['debit'] != CRITICAL_AMOUNT:
                raise Exception(f"Importo non corrisponde! Atteso {CRITICAL_AMOUNT}, trovato {line['debit']}")

            if line['reconciled']:
                raise Exception("ATTENZIONE: Movimento è riconciliato! Non può essere eliminato senza unreconcile.")

            if line['name'] != 'azzeramento 2023':
                raise Exception(f"Nome non corrisponde! Atteso 'azzeramento 2023', trovato '{line['name']}'")

            print(f"\n[OK] Verifica superata\n")
            return True

        except Exception as e:
            print(f"\n[ERROR] Verifica fallita: {str(e)}\n")
            return False

    def delete_critical_move(self):
        """Elimina il movimento critico"""
        print(f"\n{'='*80}")
        print("STEP 2: Eliminazione movimento critico")
        print(f"{'='*80}\n")

        if self.dry_run:
            print("[DRY RUN] Simulazione eliminazione...")
            self.log_action('DELETE_CRITICAL_MOVE', 'Movimento azzeramento 2023', {
                'move_id': CRITICAL_MOVE_ID,
                'line_id': CRITICAL_MOVE_LINE_ID,
                'amount': CRITICAL_AMOUNT
            })
            print(f"[DRY RUN] Eliminato move ID {CRITICAL_MOVE_ID}\n")
            return True

        if REQUIRE_CONFIRMATION:
            confirm = input(f"Confermi eliminazione move ID {CRITICAL_MOVE_ID}? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Operazione annullata dall'utente\n")
                return False

        try:
            # Step 1: Metti move in draft
            self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move', 'button_draft',
                [[CRITICAL_MOVE_ID]]
            )
            print(f"[OK] Move {CRITICAL_MOVE_ID} portato in draft")

            # Step 2: Elimina move
            self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move', 'unlink',
                [[CRITICAL_MOVE_ID]]
            )
            print(f"[OK] Move {CRITICAL_MOVE_ID} eliminato")

            self.log_action('DELETE_CRITICAL_MOVE', 'Movimento azzeramento 2023 eliminato', {
                'move_id': CRITICAL_MOVE_ID,
                'line_id': CRITICAL_MOVE_LINE_ID,
                'amount': CRITICAL_AMOUNT
            })

            return True

        except Exception as e:
            print(f"[ERROR] Eliminazione fallita: {str(e)}\n")
            self.log_action('ERROR', f'Eliminazione critical move fallita: {str(e)}', {})
            return False

    def verify_duplicates(self):
        """Verifica che i duplicati esistano e siano come previsti"""
        print(f"\n{'='*80}")
        print("STEP 3: Verifica movimenti duplicati")
        print(f"{'='*80}\n")

        found_duplicates = []
        total_amount = 0

        for line_id in DUPLICATE_LINE_IDS:
            try:
                line = self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'account.move.line', 'read',
                    [[line_id]],
                    {'fields': ['id', 'move_id', 'name', 'debit', 'credit', 'reconciled', 'date']}
                )[0]

                amount = abs(line['debit'] - line['credit'])
                total_amount += amount

                print(f"  ID {line['id']}: {line['date']} - CHF {amount:.2f}")
                print(f"    {line['name'][:60]}")
                print(f"    Riconciliato: {line['reconciled']}")

                if line['reconciled']:
                    print(f"    [WARNING] Movimento riconciliato!")

                found_duplicates.append(line)

            except Exception as e:
                print(f"  [ERROR] Line ID {line_id} non trovata: {str(e)}")

        print(f"\n  Totale duplicati: {len(found_duplicates)}")
        print(f"  Importo totale: CHF {total_amount:.2f}")
        print(f"  Atteso: CHF {EXPECTED_DUPLICATE_AMOUNT:.2f}")

        if abs(total_amount - EXPECTED_DUPLICATE_AMOUNT) > 0.01:
            print(f"\n  [WARNING] Importo non corrisponde!")

        return found_duplicates

    def delete_duplicates(self, duplicates):
        """Elimina i movimenti duplicati"""
        print(f"\n{'='*80}")
        print("STEP 4: Eliminazione duplicati")
        print(f"{'='*80}\n")

        # Get move IDs
        move_ids = list(set([d['move_id'][0] for d in duplicates]))

        print(f"Move da eliminare: {len(move_ids)}")
        for move_id in move_ids:
            print(f"  - Move ID {move_id}")

        if self.dry_run:
            print(f"\n[DRY RUN] Simulazione eliminazione {len(move_ids)} moves...\n")
            self.log_action('DELETE_DUPLICATES', f'Eliminazione {len(move_ids)} moves duplicati', {
                'move_ids': move_ids,
                'line_ids': DUPLICATE_LINE_IDS
            })
            return True

        if REQUIRE_CONFIRMATION:
            confirm = input(f"\nConfermi eliminazione di {len(move_ids)} moves? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Operazione annullata dall'utente\n")
                return False

        deleted_count = 0
        for move_id in move_ids:
            try:
                # Draft
                self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'account.move', 'button_draft',
                    [[move_id]]
                )

                # Delete
                self.models.execute_kw(
                    self.db, self.uid, self.password,
                    'account.move', 'unlink',
                    [[move_id]]
                )

                print(f"  [OK] Move {move_id} eliminato")
                deleted_count += 1

            except Exception as e:
                print(f"  [ERROR] Move {move_id} fallito: {str(e)}")

        print(f"\n[OK] Eliminati {deleted_count}/{len(move_ids)} moves\n")

        self.log_action('DELETE_DUPLICATES', f'Eliminati {deleted_count} duplicati', {
            'move_ids': move_ids,
            'deleted_count': deleted_count
        })

        return deleted_count == len(move_ids)

    def run_corrections(self):
        """Esegue tutte le correzioni"""
        print(f"\n{'#'*80}")
        print(f"# CREDIT SUISSE CORRECTOR - KONTO 1026")
        print(f"#{'#'*80}\n")
        print(f"Modalità: {'DRY RUN (simulazione)' if self.dry_run else 'ESECUZIONE REALE'}")
        print(f"Conferma richiesta: {REQUIRE_CONFIRMATION}\n")

        if not self.authenticate():
            print("[ERROR] Autenticazione fallita")
            return False

        print("[OK] Autenticato\n")

        # Saldo iniziale
        print(f"\n{'='*80}")
        print("SALDO INIZIALE")
        print(f"{'='*80}\n")

        balance_before = self.get_current_balance()
        print(f"Movimenti totali: {balance_before['total_lines']}")
        print(f"Dare: CHF {balance_before['total_debit']:.2f}")
        print(f"Avere: CHF {balance_before['total_credit']:.2f}")
        print(f"Saldo: CHF {balance_before['balance']:.2f}\n")

        # 1. Verifica e elimina movimento critico
        if not self.verify_critical_move():
            print("[ERROR] Verifica movimento critico fallita. Interrompo.\n")
            return False

        if not self.delete_critical_move():
            print("[ERROR] Eliminazione movimento critico fallita. Interrompo.\n")
            return False

        # 2. Verifica e elimina duplicati
        duplicates = self.verify_duplicates()

        if not duplicates:
            print("[ERROR] Nessun duplicato trovato. Interrompo.\n")
            return False

        if not self.delete_duplicates(duplicates):
            print("[WARNING] Eliminazione duplicati parziale o fallita.\n")

        # Saldo finale
        if not self.dry_run:
            print(f"\n{'='*80}")
            print("SALDO FINALE")
            print(f"{'='*80}\n")

            balance_after = self.get_current_balance()
            print(f"Movimenti totali: {balance_after['total_lines']}")
            print(f"Dare: CHF {balance_after['total_debit']:.2f}")
            print(f"Avere: CHF {balance_after['total_credit']:.2f}")
            print(f"Saldo: CHF {balance_after['balance']:.2f}\n")

            # Calcola differenza
            diff = balance_before['balance'] - balance_after['balance']
            expected_diff = CRITICAL_AMOUNT + (EXPECTED_DUPLICATE_AMOUNT / 2)  # Duplicati sono metà perché eliminiamo solo uno

            print(f"CORREZIONE APPLICATA:")
            print(f"  Saldo prima: CHF {balance_before['balance']:.2f}")
            print(f"  Saldo dopo: CHF {balance_after['balance']:.2f}")
            print(f"  Differenza: CHF {diff:.2f}")
            print(f"  Atteso: CHF {expected_diff:.2f}\n")

        # Salva log
        log_filename = f'CORREZIONE-CS-LOG-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json'
        log_path = rf'C:\Users\lapa\Desktop\Claude Code\app-hub-platform\{log_filename}'

        with open(log_path, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'dry_run': self.dry_run,
                'balance_before': balance_before,
                'balance_after': balance_after if not self.dry_run else None,
                'corrections_log': self.corrections_log
            }, f, indent=2, ensure_ascii=False, default=str)

        print(f"Log salvato in: {log_filename}\n")

        return True

def main():
    """Main execution"""

    print("\n" + "="*80)
    print("ATTENZIONE: SCRIPT DI CORREZIONE DATI ODOO")
    print("="*80 + "\n")

    if DRY_RUN:
        print("Esecuzione in modalità DRY RUN (simulazione)")
        print("Nessuna modifica sarà applicata al database\n")
    else:
        print("ATTENZIONE: Esecuzione REALE!")
        print("Le modifiche saranno PERMANENTI!\n")
        confirm = input("Sei SICURO di voler continuare? Digita 'EXECUTE' per confermare: ")
        if confirm != 'EXECUTE':
            print("Operazione annullata.\n")
            return

    fixer = CreditSuisseFixer(dry_run=DRY_RUN)
    success = fixer.run_corrections()

    if success:
        print(f"\n{'='*80}")
        print("CORREZIONE COMPLETATA CON SUCCESSO")
        print(f"{'='*80}\n")
    else:
        print(f"\n{'='*80}")
        print("CORREZIONE FALLITA O PARZIALE")
        print(f"{'='*80}\n")

if __name__ == '__main__':
    main()
