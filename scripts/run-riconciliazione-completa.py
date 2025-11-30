#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ONE-CLICK RICONCILIAZIONE KONTO 1023
=====================================

Esegue l'intero processo di riconciliazione in sequenza:
1. Test connessione
2. Analisi pattern
3. Riconciliazione ADVANCED
4. Verifica finale

Usage:
    python run-riconciliazione-completa.py [--dry-run]
"""

import sys
import io
import subprocess
import os
from datetime import datetime

# Fix encoding per Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def print_header(title):
    """Print header formattato"""
    print(f"\n{'='*70}")
    print(f"{title:^70}")
    print(f"{'='*70}\n")

def run_script(script_name, description):
    """Esegui script Python"""
    print_header(f"STEP: {description}")

    script_path = os.path.join(os.path.dirname(__file__), script_name)

    if not os.path.exists(script_path):
        print(f"ERRORE: Script {script_name} non trovato!")
        return False

    print(f"Esecuzione: {script_name}...")
    print()

    result = subprocess.run(
        [sys.executable, script_path],
        capture_output=False,
        text=True
    )

    if result.returncode != 0:
        print(f"\nERRORE: Script {script_name} fallito!")
        return False

    print(f"\nScript completato con successo.")
    return True

def main():
    """Main execution"""
    dry_run = '--dry-run' in sys.argv

    print("""
    ╔════════════════════════════════════════════════════════════════════╗
    ║                                                                    ║
    ║  RICONCILIAZIONE COMPLETA KONTO 1023                              ║
    ║  One-Click Automated Reconciliation                               ║
    ║                                                                    ║
    ╚════════════════════════════════════════════════════════════════════╝
    """)

    print(f"Inizio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if dry_run:
        print("\nMODALITA DRY-RUN: Nessuna modifica verrà effettuata")

    print("\nQuesto script eseguirà:")
    print("  1. Test connessione Odoo")
    print("  2. Analisi pattern righe non riconciliate")
    print("  3. Riconciliazione ADVANCED (3 strategie)")
    print("  4. Verifica finale e report")

    if not dry_run:
        print("\n⚠ ATTENZIONE: Questo processo modificherà i dati contabili!")
        response = input("\nProcedere? (yes/no): ")

        if response.lower() != 'yes':
            print("\nOperazione annullata.")
            return

    # Step 1: Test connessione
    if not run_script('test-odoo-connection.py', 'Test Connessione Odoo'):
        print("\nERRORE: Impossibile connettersi a Odoo. Abortito.")
        return

    input("\nPremi ENTER per continuare con l'analisi pattern...")

    # Step 2: Analisi pattern
    if not run_script('analizza-pattern-1023.py', 'Analisi Pattern Righe'):
        print("\n⚠ ATTENZIONE: Analisi pattern fallita, ma proseguo...")

    input("\nPremi ENTER per continuare con la riconciliazione...")

    # Step 3: Riconciliazione ADVANCED
    if dry_run:
        print("\n⚠ DRY-RUN: Riconciliazione SKIPPED")
    else:
        if not run_script('riconcilia-konto-1023-advanced.py', 'Riconciliazione ADVANCED'):
            print("\nERRORE: Riconciliazione fallita!")
            print("Verifica gli errori e riprova.")
            return

    input("\nPremi ENTER per continuare con la verifica finale...")

    # Step 4: Verifica finale
    if not run_script('verifica-riconciliazione-1023.py', 'Verifica Finale'):
        print("\n⚠ ATTENZIONE: Verifica finale fallita, ma riconciliazione completata")

    # Summary finale
    print_header("PROCESSO COMPLETATO")

    print(f"Fine: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("Prossimi step:")
    print("  1. Controlla report Excel generati nella root del progetto")
    print("  2. Verifica saldo conto 1023 in Odoo")
    print("  3. Gestisci righe in 'Manual Review' se presenti")
    print("  4. Chiudi periodo contabile se saldo = CHF 0.00")
    print()
    print("Files generati:")
    print("  - analisi_pattern_1023_*.csv")
    print("  - riconciliazione_advanced_*.xlsx")
    print("  - verifica_finale_1023_*.xlsx")
    print()

if __name__ == "__main__":
    main()
