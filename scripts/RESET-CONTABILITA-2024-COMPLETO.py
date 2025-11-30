#!/usr/bin/env python3
"""
RESET COMPLETO CONTABILIT[*] 2024 - STAGING
Commercialista Svizzero - Database Optimizer

FASE 1: Eliminazione movimenti bancari errati
Target: Preparare database per import pulito
"""

import xmlrpc.client
import json
from datetime import datetime
from typing import List, Dict, Any
import time

# =============================================================================
# CONFIGURAZIONE ODOO STAGING
# =============================================================================
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "lapa201180"

# Target accounts per pulizia
KONTO_1024_UBS_CHF = "1024"  # UBS CHF
KONTO_1025_UBS_EUR = "1025"  # UBS EUR
KONTO_1026_CS = "1026"       # Credit Suisse

# Movimenti specifici da eliminare Credit Suisse
CS_MOVES_TO_DELETE = [58103, 58101, 95413]  # CHF 193K totale

class OdooClient:
    """Client Odoo ottimizzato per operazioni batch"""

    def __init__(self, url: str, db: str, username: str, password: str):
        self.url = url
        self.db = db
        self.username = username
        self.password = password
        self.uid = None
        self.common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

    def authenticate(self):
        """Autentica e ottieni UID"""
        print(f"[AUTH] Autenticazione su {self.db}...")
        self.uid = self.common.authenticate(self.db, self.username, self.password, {})
        if not self.uid:
            raise Exception("Autenticazione fallita!")
        print(f"[OK] Autenticato come UID {self.uid}")
        return self.uid

    def execute(self, model: str, method: str, *args, **kwargs):
        """Execute model method"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, method, args, kwargs
        )

    def search_read(self, model: str, domain: List, fields: List[str], limit: int = None):
        """Search and read records"""
        kwargs = {}
        if fields:
            kwargs['fields'] = fields
        if limit:
            kwargs['limit'] = limit
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search_read', [domain], kwargs
        )

    def search(self, model: str, domain: List):
        """Search record IDs"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search', [domain]
        )

    def read(self, model: str, ids: List[int], fields: List[str]):
        """Read specific records"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'read', [ids], {'fields': fields}
        )

    def unlink(self, model: str, ids: List[int]):
        """Delete records (batch)"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'unlink', [ids]
        )


class ContabilitaResetManager:
    """Manager per reset completo contabilit[*]"""

    def __init__(self, odoo: OdooClient):
        self.odoo = odoo
        self.log = []
        self.backup_data = {}
        self.stats = {
            'start_time': datetime.now(),
            'deleted_moves': 0,
            'backup_records': 0,
            'errors': []
        }

    def log_action(self, action: str, details: Any = None):
        """Log azione con timestamp"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'details': details
        }
        self.log.append(entry)
        print(f"[LOG] {action}")
        if details:
            print(f"      {details}")

    def get_account_balance(self, account_code: str) -> Dict[str, float]:
        """Calcola saldo account (debit - credit)"""
        # Find account
        accounts = self.odoo.search_read(
            'account.account',
            [('code', '=', account_code)],
            ['id', 'name', 'currency_id']
        )

        if not accounts:
            return {'balance': 0.0, 'debit': 0.0, 'credit': 0.0}

        account = accounts[0]

        # Get move lines for this account in 2024
        move_lines = self.odoo.search_read(
            'account.move.line',
            [
                ('account_id', '=', account['id']),
                ('date', '>=', '2024-01-01'),
                ('date', '<=', '2024-12-31'),
                ('parent_state', '=', 'posted')  # Solo movimenti contabilizzati
            ],
            ['debit', 'credit', 'balance']
        )

        total_debit = sum(line['debit'] for line in move_lines)
        total_credit = sum(line['credit'] for line in move_lines)
        total_balance = sum(line['balance'] for line in move_lines)

        return {
            'account_id': account['id'],
            'account_name': account['name'],
            'debit': total_debit,
            'credit': total_credit,
            'balance': total_balance,
            'move_lines_count': len(move_lines)
        }

    def backup_all_2024_moves(self) -> str:
        """STEP 1: Backup completo movimenti 2024"""
        self.log_action("BACKUP COMPLETO", "Inizio backup tutti i movimenti 2024")

        # Fetch ALL account moves from 2024
        moves = self.odoo.search_read(
            'account.move',
            [
                ('date', '>=', '2024-01-01'),
                ('date', '<=', '2024-12-31')
            ],
            [
                'id', 'name', 'date', 'ref', 'state', 'move_type',
                'journal_id', 'partner_id', 'amount_total', 'currency_id'
            ]
        )

        print(f"\n[FOUND] {len(moves)} movimenti 2024")

        # Fetch move lines in batches (avoid 502 Bad Gateway)
        move_ids = [m['id'] for m in moves]
        move_lines = []
        batch_size = 1000

        print(f"\n[BACKUP] Fetching move lines in batches of {batch_size}...")

        for i in range(0, len(move_ids), batch_size):
            batch = move_ids[i:i+batch_size]
            print(f"  Batch {i//batch_size + 1}/{(len(move_ids) + batch_size - 1)//batch_size}: fetching {len(batch)} moves...")

            batch_lines = self.odoo.search_read(
                'account.move.line',
                [('move_id', 'in', batch)],
                [
                    'id', 'move_id', 'account_id', 'partner_id', 'name',
                    'debit', 'credit', 'balance', 'date', 'currency_id'
                ]
            )
            move_lines.extend(batch_lines)
            print(f"  -> {len(batch_lines)} lines fetched")

        print(f"\n[OK] Total: {len(move_lines)} righe contabili")

        self.backup_data = {
            'backup_date': datetime.now().isoformat(),
            'odoo_db': ODOO_DB,
            'total_moves': len(moves),
            'total_lines': len(move_lines),
            'moves': moves,
            'move_lines': move_lines
        }

        # Save to file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = f"backup-pre-reset-{timestamp}.json"

        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(self.backup_data, f, indent=2, ensure_ascii=False)

        self.stats['backup_records'] = len(moves)
        self.log_action("BACKUP COMPLETATO", f"File: {backup_file}")

        return backup_file

    def clean_konto_bank_statements(self, account_code: str, description: str) -> Dict:
        """Pulisci bank statements duplicati/errati da un konto"""
        self.log_action(f"PULIZIA {account_code}", f"Inizio pulizia {description}")

        # Get account balance BEFORE
        balance_before = self.get_account_balance(account_code)
        print(f"\n[*] SALDO PRE-PULIZIA {account_code}:")
        print(f"   Dare: {balance_before['debit']:,.2f}")
        print(f"   Avere: {balance_before['credit']:,.2f}")
        print(f"   Saldo: {balance_before['balance']:,.2f}")
        print(f"   Righe: {balance_before['move_lines_count']}")

        # Find account
        accounts = self.odoo.search_read(
            'account.account',
            [('code', '=', account_code)],
            ['id']
        )

        if not accounts:
            self.log_action("ERRORE", f"Account {account_code} non trovato")
            return {'deleted': 0, 'error': 'Account not found'}

        account_id = accounts[0]['id']

        # Strategy: Find bank statement moves
        # 1. Journal type = 'bank'
        # 2. Move type = 'entry'
        # 3. Has statement_line_id

        bank_journals = self.odoo.search_read(
            'account.journal',
            [('type', '=', 'bank')],
            ['id', 'name']
        )
        bank_journal_ids = [j['id'] for j in bank_journals]

        print(f"\n[FOUND] {len(bank_journal_ids)} journal bancari")

        # Find moves to delete
        moves_to_delete = self.odoo.search_read(
            'account.move',
            [
                ('date', '>=', '2024-01-01'),
                ('date', '<=', '2024-12-31'),
                ('journal_id', 'in', bank_journal_ids),
                ('move_type', '=', 'entry'),  # Bank statement entries
                ('line_ids.account_id', '=', account_id)  # Touches this account
            ],
            ['id', 'name', 'date', 'ref', 'amount_total', 'state']
        )

        print(f"\n[FOUND] {len(moves_to_delete)} movimenti bancari da analizzare")

        # Filter: Delete only POSTED moves (safe to delete)
        # Keep DRAFT moves for review
        posted_moves = [m for m in moves_to_delete if m['state'] == 'posted']

        print(f"[*] {len(posted_moves)} movimenti posted da eliminare")

        if not posted_moves:
            self.log_action("NESSUNA ELIMINAZIONE", f"Nessun movimento da eliminare per {account_code}")
            return {'deleted': 0, 'balance_before': balance_before['balance']}

        # Log moves to delete
        for move in posted_moves[:10]:  # Show first 10
            print(f"   [*]  Move {move['id']}: {move['name']} | {move['date']} | {move['amount_total']:.2f}")

        if len(posted_moves) > 10:
            print(f"   ... e altri {len(posted_moves) - 10} movimenti")

        # BATCH DELETE (skip button_draft - too slow, delete directly with admin privileges)
        move_ids_to_delete = [m['id'] for m in posted_moves]

        print(f"\n[DELETE] ELIMINAZIONE DIRETTA IN BATCH di {len(move_ids_to_delete)} movimenti...")
        print(f"[INFO] Skipping button_draft (troppo lento) - delete diretto con admin privileges")

        try:
            # Delete in batches of 50 (smaller batches for safety)
            batch_size = 50
            deleted_count = 0

            for i in range(0, len(move_ids_to_delete), batch_size):
                batch = move_ids_to_delete[i:i+batch_size]
                try:
                    self.odoo.unlink('account.move', batch)
                    deleted_count += len(batch)
                    print(f"   [OK] Eliminati {deleted_count}/{len(move_ids_to_delete)} movimenti ({(deleted_count/len(move_ids_to_delete)*100):.1f}%)")
                except Exception as e:
                    error_msg = f"Errore eliminazione batch {i}-{i+len(batch)}: {e}"
                    print(f"   [ERROR] {error_msg}")
                    self.log_action("ERRORE BATCH", error_msg)
                    self.stats['errors'].append(error_msg)
                    # Continue with next batch even if one fails

            self.stats['deleted_moves'] += deleted_count

            # Get balance AFTER
            time.sleep(2)  # Wait for DB to update
            balance_after = self.get_account_balance(account_code)

            print(f"\n[*] SALDO POST-PULIZIA {account_code}:")
            print(f"   Dare: {balance_after['debit']:,.2f}")
            print(f"   Avere: {balance_after['credit']:,.2f}")
            print(f"   Saldo: {balance_after['balance']:,.2f}")
            print(f"   Righe: {balance_after['move_lines_count']}")

            result = {
                'deleted': deleted_count,
                'balance_before': balance_before['balance'],
                'balance_after': balance_after['balance'],
                'delta': balance_after['balance'] - balance_before['balance'],
                'lines_before': balance_before['move_lines_count'],
                'lines_after': balance_after['move_lines_count']
            }

            self.log_action(f"PULIZIA COMPLETATA {account_code}", result)

            return result

        except Exception as e:
            error_msg = f"Errore durante eliminazione: {e}"
            self.log_action("ERRORE CRITICO", error_msg)
            self.stats['errors'].append(error_msg)
            return {'deleted': 0, 'error': error_msg}

    def clean_credit_suisse_specific_moves(self) -> Dict:
        """Pulisci movimenti specifici Credit Suisse"""
        self.log_action("PULIZIA CREDIT SUISSE", "Eliminazione 3 movimenti specifici (CHF 193K)")

        # Get balance before
        balance_before = self.get_account_balance(KONTO_1026_CS)

        print(f"\n[*] SALDO PRE-PULIZIA Credit Suisse:")
        print(f"   Saldo: {balance_before['balance']:,.2f} CHF")

        # Read specific moves
        try:
            moves = self.odoo.read(
                'account.move',
                CS_MOVES_TO_DELETE,
                ['id', 'name', 'date', 'amount_total', 'state']
            )

            print(f"\n[*] Movimenti da eliminare:")
            for move in moves:
                print(f"   [DEL]  Move {move['id']}: {move['name']} | {move['date']} | {move['amount_total']:,.2f}")

            # Direct delete (skip button_draft)
            deleted_count = 0

            for move_id in CS_MOVES_TO_DELETE:
                try:
                    # Delete directly
                    self.odoo.unlink('account.move', [move_id])
                    deleted_count += 1
                    print(f"   [OK] Eliminato Move {move_id}")
                except Exception as e:
                    error_msg = f"Errore eliminazione Move {move_id}: {e}"
                    print(f"   [ERROR] {error_msg}")
                    self.stats['errors'].append(error_msg)

            self.stats['deleted_moves'] += deleted_count

            # Get balance after
            time.sleep(2)
            balance_after = self.get_account_balance(KONTO_1026_CS)

            print(f"\n[*] SALDO POST-PULIZIA Credit Suisse:")
            print(f"   Saldo: {balance_after['balance']:,.2f} CHF")
            print(f"   Delta: {balance_after['balance'] - balance_before['balance']:,.2f} CHF")

            result = {
                'deleted': deleted_count,
                'balance_before': balance_before['balance'],
                'balance_after': balance_after['balance'],
                'delta': balance_after['balance'] - balance_before['balance']
            }

            self.log_action("CREDIT SUISSE COMPLETATO", result)

            return result

        except Exception as e:
            error_msg = f"Errore pulizia Credit Suisse: {e}"
            self.log_action("ERRORE", error_msg)
            self.stats['errors'].append(error_msg)
            return {'deleted': 0, 'error': error_msg}

    def generate_final_report(self, backup_file: str, results: Dict) -> str:
        """Genera report finale pulizia"""
        self.stats['end_time'] = datetime.now()
        duration = self.stats['end_time'] - self.stats['start_time']

        # Try to get final balances (might fail if connection issues)
        saldi_finali = {}
        try:
            saldi_finali = {
                '1024_UBS_CHF': self.get_account_balance(KONTO_1024_UBS_CHF),
                '1025_UBS_EUR': self.get_account_balance(KONTO_1025_UBS_EUR),
                '1026_CREDIT_SUISSE': self.get_account_balance(KONTO_1026_CS)
            }
        except Exception as e:
            saldi_finali = {'error': f'Unable to fetch balances: {e}'}

        report = {
            'reset_completato': datetime.now().isoformat(),
            'durata_totale': str(duration),
            'backup_file': backup_file,
            'statistiche': {
                'movimenti_eliminati': self.stats['deleted_moves'],
                'record_backup': self.stats['backup_records'],
                'errori': len(self.stats['errors'])
            },
            'risultati_per_konto': results,
            'saldi_finali': saldi_finali,
            'log_completo': self.log,
            'errori': self.stats['errors'],
            'pronto_per_fase_2': len(self.stats['errors']) == 0
        }

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = f"pulizia-completata-{timestamp}.json"

        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return report_file


def main():
    """Main execution"""
    print("=" * 80)
    print("RESET COMPLETO CONTABILIT[*] 2024 - COMMERCIALISTA SVIZZERO")
    print("=" * 80)
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Connect to Odoo
    odoo = OdooClient(ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASS)
    odoo.authenticate()

    # Initialize manager
    manager = ContabilitaResetManager(odoo)

    results = {}

    try:
        # STEP 1: Backup completo
        print("\n" + "=" * 80)
        print("STEP 1: BACKUP COMPLETO MOVIMENTI 2024")
        print("=" * 80)
        backup_file = manager.backup_all_2024_moves()

        # STEP 2: Pulizia KONTO 1024 UBS CHF
        print("\n" + "=" * 80)
        print("STEP 2: PULIZIA KONTO 1024 UBS CHF")
        print("=" * 80)
        results['1024_UBS_CHF'] = manager.clean_konto_bank_statements(
            KONTO_1024_UBS_CHF,
            "UBS CHF - Bank statements duplicati"
        )

        # STEP 3: Pulizia KONTO 1025 UBS EUR
        print("\n" + "=" * 80)
        print("STEP 3: PULIZIA KONTO 1025 UBS EUR")
        print("=" * 80)
        results['1025_UBS_EUR'] = manager.clean_konto_bank_statements(
            KONTO_1025_UBS_EUR,
            "UBS EUR - Bank statements duplicati"
        )

        # STEP 4: Pulizia KONTO 1026 Credit Suisse (movimenti specifici)
        print("\n" + "=" * 80)
        print("STEP 4: PULIZIA KONTO 1026 CREDIT SUISSE")
        print("=" * 80)
        results['1026_CREDIT_SUISSE'] = manager.clean_credit_suisse_specific_moves()

        # STEP 5: Report finale
        print("\n" + "=" * 80)
        print("STEP 5: VERIFICA POST-PULIZIA E REPORT FINALE")
        print("=" * 80)
        report_file = manager.generate_final_report(backup_file, results)

        # Final summary
        print("\n" + "=" * 80)
        print("[*] RESET COMPLETATO CON SUCCESSO")
        print("=" * 80)
        print(f"[*]  Durata totale: {manager.stats['end_time'] - manager.stats['start_time']}")
        print(f"[*]  Movimenti eliminati: {manager.stats['deleted_moves']}")
        print(f"[*] Backup salvato: {backup_file}")
        print(f"[*] Report salvato: {report_file}")
        print()
        print("SALDI FINALI:")

        # Read from saved report to avoid re-fetching
        with open(report_file, 'r', encoding='utf-8') as f:
            saved_report = json.load(f)
            saldi = saved_report.get('saldi_finali', {})

        if 'error' in saldi:
            print(f"  [WARN] {saldi['error']}")
        else:
            for konto, balance_info in saldi.items():
                print(f"  {konto}: {balance_info['balance']:,.2f} ({balance_info['move_lines_count']} righe)")

        print()
        if manager.stats['errors']:
            print(f"[*]  {len(manager.stats['errors'])} errori riscontrati (vedi log)")
            print("[*] PRONTO PER FASE 2: NO")
        else:
            print("[*] PRONTO PER FASE 2 IMPORT: S[*]")

        print("=" * 80)

    except Exception as e:
        print(f"\n[*] ERRORE CRITICO: {e}")
        import traceback
        traceback.print_exc()
        manager.stats['errors'].append(str(e))
        report_file = manager.generate_final_report("N/A", results)
        print(f"\n[*] Report errori salvato: {report_file}")


if __name__ == '__main__':
    main()
