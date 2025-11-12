"""
Importatore CSV movimenti bancari UBS in Odoo
"""

import csv
import os
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import chardet
import config
from odoo_connector import (
    OdooConnector,
    BankStatementManager,
    format_date_odoo,
    format_amount_odoo
)


class UBSCSVParser:
    """Parser per file CSV esportati da UBS e-banking"""

    def __init__(self, file_path: str):
        """
        Inizializza parser

        Args:
            file_path: Percorso file CSV UBS
        """
        self.file_path = file_path
        self.encoding = self._detect_encoding()
        self.header_info = {}
        self.transactions = []

    def _detect_encoding(self) -> str:
        """
        Rileva encoding del file

        Returns:
            Nome encoding (es. 'utf-8', 'windows-1252')
        """
        with open(self.file_path, 'rb') as f:
            result = chardet.detect(f.read())
            return result['encoding'] or 'utf-8'

    def parse(self) -> Tuple[Dict, List[Dict]]:
        """
        Parsa il file CSV UBS

        Returns:
            Tuple (header_info, transactions)
            - header_info: Info account (IBAN, valuta, ecc.)
            - transactions: Lista movimenti

        Raises:
            ValueError: Se file non valido
        """
        with open(self.file_path, 'r', encoding=self.encoding) as f:
            # Leggi tutte le righe
            lines = f.readlines()

            if len(lines) < 3:
                raise ValueError("File CSV troppo corto, non sembra un export UBS valido")

            # Parsea header account (prima riga dati)
            self._parse_header(lines)

            # Parsea transazioni
            self._parse_transactions(lines)

        return self.header_info, self.transactions

    def _parse_header(self, lines: List[str]) -> None:
        """
        Parsea le righe di header con info account

        Args:
            lines: Tutte le righe del file
        """
        # Prima riga: nomi colonne header
        # Seconda riga: valori header
        reader = csv.reader(lines[:2], delimiter=';')
        rows = list(reader)

        if len(rows) >= 2:
            header_keys = rows[0]
            header_values = rows[1]

            # Crea dizionario header
            for i, key in enumerate(header_keys):
                if i < len(header_values):
                    self.header_info[key.strip()] = header_values[i].strip()

    def _parse_transactions(self, lines: List[str]) -> None:
        """
        Parsea le righe con le transazioni

        Args:
            lines: Tutte le righe del file
        """
        # Trova riga header transazioni (di solito riga 3)
        transaction_header_index = None
        for i, line in enumerate(lines):
            if 'Buchungsdatum' in line or 'Valuta' in line or 'Belastung' in line:
                transaction_header_index = i
                break

        if transaction_header_index is None:
            raise ValueError("Header transazioni non trovato nel CSV")

        # Parsea transazioni
        reader = csv.DictReader(
            lines[transaction_header_index:],
            delimiter=';'
        )

        for row in reader:
            # Salta righe vuote
            if not any(row.values()):
                continue

            # Estrai dati transazione
            transaction = self._parse_transaction_row(row)
            if transaction:
                self.transactions.append(transaction)

    def _parse_transaction_row(self, row: Dict[str, str]) -> Optional[Dict]:
        """
        Parsea una singola riga transazione

        Args:
            row: Riga CSV come dizionario

        Returns:
            Dizionario transazione o None se riga non valida
        """
        try:
            # Campi comuni UBS (possono variare)
            buchungsdatum = row.get('Buchungsdatum', '').strip()
            valuta = row.get('Valuta', '').strip()
            beschreibung1 = row.get('Beschreibung 1', '').strip()
            beschreibung2 = row.get('Beschreibung 2', '').strip()
            beschreibung3 = row.get('Beschreibung 3', '').strip()
            transaktions_nr = row.get('Transaktions-Nr.', '').strip()
            einzelbetrag = row.get('Einzelbetrag', '').strip()
            belastung = row.get('Belastung', '').strip()
            gutschrift = row.get('Gutschrift', '').strip()
            saldo = row.get('Saldo', '').strip()

            # Data obbligatoria
            if not (buchungsdatum or valuta):
                return None

            # Usa data valuta se disponibile, altrimenti data registrazione
            date_str = valuta if valuta else buchungsdatum
            if not date_str:
                return None

            # Calcola importo (positivo=entrata, negativo=uscita)
            amount = 0.0
            if gutschrift:  # Accredito (entrata)
                amount = format_amount_odoo(gutschrift)
            elif belastung:  # Addebito (uscita)
                amount = -format_amount_odoo(belastung)
            elif einzelbetrag:  # Importo singolo (potrebbe avere segno)
                amount = format_amount_odoo(einzelbetrag)

            # Se importo zero, salta
            if amount == 0.0:
                return None

            # Combina descrizioni
            description_parts = [p for p in [beschreibung1, beschreibung2, beschreibung3] if p]
            payment_ref = '; '.join(description_parts) if description_parts else 'Movimento bancario'

            # Partner name (di solito in Beschreibung 2)
            partner_name = beschreibung2 if beschreibung2 else None

            return {
                'date': format_date_odoo(date_str),
                'payment_ref': payment_ref,
                'amount': amount,
                'partner_name': partner_name,
                'ref': transaktions_nr if transaktions_nr else None,
                'balance': format_amount_odoo(saldo) if saldo else None,
                'raw_data': dict(row)  # Conserva dati originali per debug
            }

        except Exception as e:
            print(f"⚠️  Errore parsing riga: {e}")
            print(f"   Riga: {row}")
            return None


class UBSImporter:
    """Importa movimenti CSV UBS in Odoo"""

    def __init__(self, odoo_connector: OdooConnector, journal_id: int = None):
        """
        Inizializza importatore

        Args:
            odoo_connector: Connessione Odoo attiva
            journal_id: ID giornale bancario (default da config)
        """
        self.odoo = odoo_connector
        self.manager = BankStatementManager(odoo_connector)
        self.journal_id = journal_id or config.DEFAULT_JOURNAL_ID

        # Verifica giornale
        journal_info = self.manager.get_journal_info(self.journal_id)
        if not journal_info:
            raise ValueError(f"Giornale bancario ID {self.journal_id} non trovato")

        self.journal_info = journal_info
        print(f"📁 Giornale selezionato: {journal_info['name']} ({journal_info['code']})")

    def import_csv(self, csv_file_path: str, dry_run: bool = True) -> Dict:
        """
        Importa movimenti da CSV UBS

        Args:
            csv_file_path: Percorso file CSV
            dry_run: Se True, simula import senza salvare (default True)

        Returns:
            Dizionario con statistiche import
        """
        stats = {
            'file': csv_file_path,
            'total_lines': 0,
            'imported': 0,
            'skipped': 0,
            'errors': 0,
            'dry_run': dry_run,
            'movements': []
        }

        print(f"\n{'🔍 SIMULAZIONE' if dry_run else '💾 IMPORTAZIONE'} MOVIMENTI BANCARI UBS")
        print(f"{'='*70}\n")

        # Parsea CSV
        print(f"📄 Parsing file: {os.path.basename(csv_file_path)}")
        parser = UBSCSVParser(csv_file_path)

        try:
            header_info, transactions = parser.parse()
        except Exception as e:
            print(f"❌ Errore parsing CSV: {e}")
            stats['errors'] += 1
            return stats

        stats['total_lines'] = len(transactions)

        # Mostra info header
        print(f"\n📋 Info Account:")
        if 'IBAN' in header_info:
            print(f"   IBAN: {header_info['IBAN']}")
        if 'Whrg.' in header_info:
            print(f"   Valuta: {header_info['Whrg.']}")

        print(f"\n📊 Trovate {len(transactions)} transazioni")
        print(f"\n{'─'*70}")

        # Importa ogni transazione
        for i, transaction in enumerate(transactions, 1):
            try:
                # Prepara dati per Odoo
                odoo_data = {
                    'journal_id': self.journal_id,
                    'date': transaction['date'],
                    'payment_ref': transaction['payment_ref'],
                    'amount': transaction['amount'],
                }

                # Aggiungi campi opzionali se presenti
                if transaction.get('partner_name'):
                    odoo_data['partner_name'] = transaction['partner_name']

                if transaction.get('ref'):
                    odoo_data['ref'] = transaction['ref']

                # Mostra movimento
                amount_str = f"CHF {transaction['amount']:>10.2f}"
                status = "📗" if transaction['amount'] > 0 else "📕"
                print(f"{status} {transaction['date']} | {amount_str} | {transaction['payment_ref'][:50]}")

                # Importa in Odoo (se non dry_run)
                if not dry_run:
                    line_id = self.manager.create_statement_line(odoo_data)
                    odoo_data['odoo_id'] = line_id
                    print(f"   ✅ Importato con ID {line_id}")

                stats['imported'] += 1
                stats['movements'].append(odoo_data)

            except Exception as e:
                print(f"   ❌ Errore: {e}")
                stats['errors'] += 1

        # Riepilogo
        print(f"\n{'─'*70}")
        print(f"\n📈 RIEPILOGO:")
        print(f"   Totale righe: {stats['total_lines']}")
        print(f"   Importate: {stats['imported']}")
        print(f"   Errori: {stats['errors']}")

        if dry_run:
            print(f"\n⚠️  MODALITÀ SIMULAZIONE - Nessun dato salvato in Odoo")
            print(f"   Esegui con dry_run=False per salvare realmente")

        return stats


def import_ubs_csv(csv_file: str, journal_id: int = None, dry_run: bool = True) -> Dict:
    """
    Funzione helper per importare CSV UBS

    Args:
        csv_file: Percorso file CSV
        journal_id: ID giornale bancario (opzionale)
        dry_run: Se True, simula senza salvare

    Returns:
        Statistiche import
    """
    # Connetti a Odoo
    odoo = OdooConnector()
    if not odoo.connect():
        raise Exception("Impossibile connettersi a Odoo")

    # Importa
    importer = UBSImporter(odoo, journal_id)
    return importer.import_csv(csv_file, dry_run)


if __name__ == "__main__":
    import sys

    print("🏦 IMPORTATORE MOVIMENTI BANCARI UBS → ODOO")
    print("="*70)

    # Se passato file CSV come argomento
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
        dry_run = '--save' not in sys.argv

        if not os.path.exists(csv_file):
            print(f"❌ File non trovato: {csv_file}")
            sys.exit(1)

        # Importa
        stats = import_ubs_csv(csv_file, dry_run=dry_run)

        print(f"\n✅ Completato!")

    else:
        print("\nUSO:")
        print("  python ubs_csv_importer.py <file.csv>              # Simula import")
        print("  python ubs_csv_importer.py <file.csv> --save      # Importa realmente")
        print("\nESEMPIO:")
        print("  python ubs_csv_importer.py movimenti_ubs_2024.csv")
