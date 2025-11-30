#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUSINESS ANALYST - BANK RECONCILIATION VALIDATOR
================================================
Valida allineamento saldi bancari Odoo vs Estratti Conto al centesimo.

Author: Business Analyst Agent
Date: 2025-11-15
"""

import xmlrpc.client
import json
import sys
from datetime import datetime
from typing import Dict, List, Tuple
import pandas as pd
from decimal import Decimal

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# ODOO CONNECTION
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# SALDI ODOO (dal report fornito)
ODOO_BALANCES = {
    "1021": -154149.93,
    "1024": 121554.65,
    "1025": 108267.67,
    "1026": 371453.70,
    "1027": 13032.22,
    "1028": -1340.43,
    "1029": -997.28,
    "1034": 94.26
}

# SALDI REALI 31.12.2024 (da estratti conto)
BANK_STATEMENTS = {
    "UBS CHF Unternehmen": {"amount": 182613.26, "currency": "CHF"},
    "UBS Privatkonto": {"amount": 23783.88, "currency": "CHF"},
    "UBS COVID": {"amount": -116500.00, "currency": "CHF"},
    "UBS EUR": {"amount": 128860.70, "currency": "EUR"},
    "UBS USD": {"amount": 92.63, "currency": "USD"},
    "CS Hauptkonto": {"amount": 11120.67, "currency": "CHF"},
    "CS Zweitkonto": {"amount": 13777.05, "currency": "CHF"}
}


class OdooConnector:
    """Connettore Odoo per analisi bancaria"""

    def __init__(self, url: str, db: str, username: str, password: str):
        self.url = url
        self.db = db
        self.username = username
        self.password = password
        self.uid = None
        self.models = None

    def connect(self) -> bool:
        """Autentica su Odoo"""
        try:
            common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
            self.uid = common.authenticate(self.db, self.username, self.password, {})

            if self.uid:
                self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
                print(f"✅ Connesso a Odoo come UID: {self.uid}")
                return True
            else:
                print("❌ Autenticazione fallita")
                return False

        except Exception as e:
            print(f"❌ Errore connessione: {e}")
            return False

    def get_bank_accounts(self) -> List[Dict]:
        """Recupera tutti i conti bancari"""
        try:
            # Cerca account.account con codice 102x (conti bancari)
            accounts = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.account', 'search_read',
                [[['code', 'like', '102']]],
                {'fields': ['code', 'name', 'currency_id', 'account_type']}
            )

            print(f"\n📊 Trovati {len(accounts)} conti bancari in Odoo:")
            for acc in accounts:
                print(f"  - {acc['code']}: {acc['name']}")

            return accounts

        except Exception as e:
            print(f"❌ Errore recupero conti: {e}")
            return []

    def get_account_balance(self, account_code: str, date: str = "2024-12-31") -> Decimal:
        """Calcola saldo conto alla data specifica"""
        try:
            # Cerca l'account
            accounts = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.account', 'search_read',
                [[['code', '=', account_code]]],
                {'fields': ['id', 'code', 'name'], 'limit': 1}
            )

            if not accounts:
                print(f"⚠️  Account {account_code} non trovato")
                return Decimal('0')

            account_id = accounts[0]['id']

            # Recupera movimenti fino alla data
            moves = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.move.line', 'search_read',
                [[['account_id', '=', account_id], ['date', '<=', date]]],
                {'fields': ['debit', 'credit', 'balance', 'date']}
            )

            # Calcola saldo (debit - credit)
            balance = sum(Decimal(str(m['debit'])) - Decimal(str(m['credit'])) for m in moves)

            print(f"  {account_code}: {balance:.2f} CHF ({len(moves)} movimenti)")
            return balance

        except Exception as e:
            print(f"❌ Errore calcolo saldo {account_code}: {e}")
            return Decimal('0')

    def get_bank_journals(self) -> List[Dict]:
        """Recupera journal bancari con dettagli account"""
        try:
            journals = self.models.execute_kw(
                self.db, self.uid, self.password,
                'account.journal', 'search_read',
                [[['type', '=', 'bank']]],
                {'fields': ['name', 'code', 'bank_account_id', 'default_account_id', 'currency_id']}
            )

            print(f"\n🏦 Trovati {len(journals)} journal bancari:")
            for j in journals:
                print(f"  - {j.get('code', 'N/A')}: {j['name']}")
                if j.get('bank_account_id'):
                    print(f"    Bank Account ID: {j['bank_account_id']}")

            return journals

        except Exception as e:
            print(f"❌ Errore recupero journals: {e}")
            return []


class BankReconciliationAnalyzer:
    """Analizza e valida riconciliazione bancaria"""

    def __init__(self, odoo: OdooConnector):
        self.odoo = odoo
        self.mapping = {}
        self.discrepancies = []

    def create_mapping(self) -> Dict[str, str]:
        """
        Crea mapping conti Odoo → Banche reali
        Basato su naming patterns e best guess
        """
        # Recupera conti da Odoo per analisi
        accounts = self.odoo.get_bank_accounts()
        journals = self.odoo.get_bank_journals()

        # MAPPING MANUALE (da verificare con utente)
        # Basato su codici conti e nomi comuni
        mapping = {
            "1021": "UBS COVID",           # Probabile conto COVID (saldo negativo)
            "1024": "UBS Privatkonto",     # Probabile privatkonto
            "1025": "CS Hauptkonto",       # Credit Suisse principale
            "1026": "UBS CHF Unternehmen", # Conto aziendale principale (saldo alto)
            "1027": "CS Zweitkonto",       # Credit Suisse secondario
            "1028": "UBS EUR",             # Probabile EUR (verificare conversione)
            "1029": "UBS USD",             # Probabile USD (verificare conversione)
            "1034": "UNKNOWN"              # Da identificare
        }

        self.mapping = mapping

        print("\n🗺️  MAPPING CONTI ODOO → BANCA:")
        print("=" * 60)
        for odoo_code, bank_name in mapping.items():
            odoo_balance = ODOO_BALANCES.get(odoo_code, 0)
            print(f"{odoo_code} ({odoo_balance:>12,.2f} CHF) → {bank_name}")
        print("=" * 60)

        return mapping

    def validate_balances(self) -> pd.DataFrame:
        """
        Confronta saldi Odoo vs Banca
        Identifica discrepanze al centesimo
        """
        results = []

        print("\n💰 VALIDAZIONE SALDI (al 31.12.2024):")
        print("=" * 80)

        for odoo_code, bank_name in self.mapping.items():
            odoo_balance = Decimal(str(ODOO_BALANCES.get(odoo_code, 0)))

            # Recupera saldo reale
            bank_data = BANK_STATEMENTS.get(bank_name, {})
            bank_balance = Decimal(str(bank_data.get('amount', 0)))
            currency = bank_data.get('currency', 'CHF')

            # Calcola delta
            delta = odoo_balance - bank_balance

            # Status
            if abs(delta) < Decimal('0.01'):
                status = "✅ OK"
                variance_pct = 0
            elif abs(delta) < Decimal('1.00'):
                status = "⚠️  MINOR"
                variance_pct = float(abs(delta) / bank_balance * 100) if bank_balance != 0 else 0
            else:
                status = "❌ DISCREPANCY"
                variance_pct = float(abs(delta) / bank_balance * 100) if bank_balance != 0 else 0

            result = {
                'Odoo_Code': odoo_code,
                'Bank_Name': bank_name,
                'Odoo_Balance': float(odoo_balance),
                'Bank_Balance': float(bank_balance),
                'Currency': currency,
                'Delta': float(delta),
                'Variance_%': variance_pct,
                'Status': status
            }

            results.append(result)

            # Print
            print(f"{odoo_code} → {bank_name:25} | "
                  f"Odoo: {odoo_balance:>12,.2f} | "
                  f"Bank: {bank_balance:>12,.2f} {currency} | "
                  f"Δ: {delta:>10,.2f} | {status}")

            # Track discrepancies
            if abs(delta) >= Decimal('0.01'):
                self.discrepancies.append(result)

        print("=" * 80)

        df = pd.DataFrame(results)
        return df

    def calculate_totals(self, df: pd.DataFrame) -> Dict:
        """Calcola totali e metriche aggregate"""

        # Solo CHF per somme (ignora EUR/USD non convertiti)
        chf_rows = df[df['Currency'] == 'CHF']

        totals = {
            'total_odoo_chf': chf_rows['Odoo_Balance'].sum(),
            'total_bank_chf': chf_rows['Bank_Balance'].sum(),
            'total_delta_chf': chf_rows['Delta'].sum(),
            'num_accounts': len(df),
            'num_discrepancies': len(self.discrepancies),
            'max_delta': df['Delta'].abs().max(),
            'total_variance_pct': (chf_rows['Delta'].sum() / chf_rows['Bank_Balance'].sum() * 100)
                                   if chf_rows['Bank_Balance'].sum() != 0 else 0
        }

        return totals

    def generate_action_plan(self) -> List[Dict]:
        """Genera action plan per correzioni"""

        actions = []

        print("\n📋 ACTION PLAN:")
        print("=" * 80)

        for i, disc in enumerate(self.discrepancies, 1):
            odoo_code = disc['Odoo_Code']
            bank_name = disc['Bank_Name']
            delta = disc['Delta']

            # Determina azione
            if bank_name == "UNKNOWN":
                action_type = "INVESTIGATE"
                description = f"Identificare conto bancario reale per Odoo {odoo_code}"
                priority = "HIGH"
            elif disc['Currency'] in ['EUR', 'USD']:
                action_type = "VERIFY_FX"
                description = f"Verificare tasso cambio {disc['Currency']}/CHF al 31.12.2024"
                priority = "HIGH"
            elif abs(delta) > 1000:
                action_type = "RECONCILE"
                description = f"Riconciliare conto {odoo_code} ({bank_name}) - Delta: {delta:,.2f} CHF"
                priority = "HIGH"
            else:
                action_type = "ADJUST"
                description = f"Adjustment minore per {odoo_code} - Delta: {delta:,.2f} CHF"
                priority = "MEDIUM"

            action = {
                'ID': f"ACT-{i:03d}",
                'Odoo_Code': odoo_code,
                'Bank_Name': bank_name,
                'Delta': delta,
                'Action_Type': action_type,
                'Description': description,
                'Priority': priority,
                'Status': 'PENDING'
            }

            actions.append(action)

            print(f"{action['ID']} [{priority:6}] {action_type:12} | {description}")

        print("=" * 80)

        return actions


def main():
    """Main execution"""

    print("=" * 80)
    print("📊 BUSINESS ANALYST - BANK RECONCILIATION VALIDATOR")
    print("=" * 80)
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Reference Date: 31.12.2024")
    print("=" * 80)

    # Connect to Odoo
    odoo = OdooConnector(ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD)

    if not odoo.connect():
        print("❌ Impossibile connettersi a Odoo. Uscita.")
        return

    # Analizza conti
    analyzer = BankReconciliationAnalyzer(odoo)

    # Step 1: Mapping
    print("\n📌 STEP 1: MAPPING CONTI")
    mapping = analyzer.create_mapping()

    # Step 2: Validation
    print("\n📌 STEP 2: VALIDAZIONE SALDI")
    df_validation = analyzer.validate_balances()

    # Step 3: Totals
    print("\n📌 STEP 3: TOTALI E METRICHE")
    totals = analyzer.calculate_totals(df_validation)

    print(f"\n💰 TOTALI (solo CHF):")
    print(f"  Odoo Total:  {totals['total_odoo_chf']:>15,.2f} CHF")
    print(f"  Bank Total:  {totals['total_bank_chf']:>15,.2f} CHF")
    print(f"  Delta Total: {totals['total_delta_chf']:>15,.2f} CHF ({totals['total_variance_pct']:.2f}%)")
    print(f"\n📊 STATISTICHE:")
    print(f"  Accounts:       {totals['num_accounts']}")
    print(f"  Discrepancies:  {totals['num_discrepancies']}")
    print(f"  Max Delta:      {totals['max_delta']:,.2f} CHF")

    # Step 4: Action Plan
    print("\n📌 STEP 4: ACTION PLAN")
    actions = analyzer.generate_action_plan()

    # Export to Excel
    print("\n📌 STEP 5: EXPORT DASHBOARD")

    output_file = "c:/Users/lapa/Desktop/Claude Code/app-hub-platform/bank-reconciliation-dashboard.xlsx"

    try:
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            # Sheet 1: Validation
            df_validation.to_excel(writer, sheet_name='Validation', index=False)

            # Sheet 2: Mapping
            df_mapping = pd.DataFrame([
                {'Odoo_Code': k, 'Bank_Name': v}
                for k, v in mapping.items()
            ])
            df_mapping.to_excel(writer, sheet_name='Mapping', index=False)

            # Sheet 3: Action Plan
            df_actions = pd.DataFrame(actions)
            df_actions.to_excel(writer, sheet_name='Action_Plan', index=False)

            # Sheet 4: Summary
            df_summary = pd.DataFrame([totals])
            df_summary.to_excel(writer, sheet_name='Summary', index=False)

        print(f"✅ Dashboard esportato: {output_file}")

    except Exception as e:
        print(f"❌ Errore export Excel: {e}")

    # Export JSON
    json_file = "c:/Users/lapa/Desktop/Claude Code/app-hub-platform/bank-reconciliation-report.json"

    report = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'reference_date': '2024-12-31',
            'analyst': 'Business Analyst Agent'
        },
        'mapping': mapping,
        'validation': df_validation.to_dict('records'),
        'totals': totals,
        'actions': actions,
        'discrepancies': analyzer.discrepancies
    }

    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"✅ Report JSON esportato: {json_file}")

    print("\n" + "=" * 80)
    print("✅ ANALISI COMPLETATA")
    print("=" * 80)


if __name__ == "__main__":
    main()
