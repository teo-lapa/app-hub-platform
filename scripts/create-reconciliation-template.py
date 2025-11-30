#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create Excel reconciliation template for line-by-line account matching
"""

import pandas as pd
from datetime import datetime
import sys

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def create_reconciliation_template():
    """Create comprehensive Excel template for bank reconciliation"""

    output_file = "c:/Users/lapa/Desktop/Claude Code/app-hub-platform/BANK-RECONCILIATION-WORKBOOK.xlsx"

    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:

        # SHEET 1: INSTRUCTIONS
        instructions = pd.DataFrame({
            'Step': [
                '1. MAPPING VERIFICATION',
                '2. DATA EXTRACTION',
                '3. LINE-BY-LINE MATCHING',
                '4. IDENTIFY GAPS',
                '5. CREATE ADJUSTMENTS',
                '6. VALIDATE',
                '7. CFO APPROVAL'
            ],
            'Description': [
                'Go to "IBAN Mapping" sheet and verify all Odoo accounts have correct IBAN',
                'Extract Odoo movements (SQL) and download bank statements (PDF/CSV)',
                'Use account-specific sheets (1026-UBS, 1024-Priv, etc.) to match line-by-line',
                'Identify movements in Odoo but not Bank (to reverse) and Bank but not Odoo (to register)',
                'Document all adjustments in "Adjustments" sheet with journal entry details',
                'Re-run validation script to confirm Delta < CHF 1.00 for all accounts',
                'Present final workbook to CFO for sign-off'
            ],
            'Owner': [
                'IT/Odoo Admin',
                'Accountant',
                'Accountant',
                'Accountant',
                'Accountant',
                'Business Analyst',
                'CFO'
            ],
            'Duration': [
                '30 min',
                '2 hours',
                '16 hours',
                '4 hours',
                '4 hours',
                '1 hour',
                '30 min'
            ],
            'Status': [
                'PENDING',
                'PENDING',
                'PENDING',
                'PENDING',
                'PENDING',
                'PENDING',
                'PENDING'
            ]
        })
        instructions.to_excel(writer, sheet_name='0-INSTRUCTIONS', index=False)

        # SHEET 2: IBAN MAPPING
        mapping_template = pd.DataFrame({
            'Odoo_Code': ['1021', '1024', '1025', '1026', '1027', '1028', '1029', '1034'],
            'Odoo_Name': [
                'Bank Suspense Account (COVID)',
                'UBS-CHF, 278-122087.01J',
                'EUR-UBS, 278-122087.60A',
                'CHF-CRS PRINCIPALE, 3977497-51',
                'CH3504835397749751001',
                'CRT. CS CHF AUTISTI 8596',
                'CRT. CS CHF AUTISTI 5820',
                'UNKNOWN'
            ],
            'Odoo_IBAN': [
                '(Extract from Odoo)',
                '(Extract from Odoo)',
                '(Extract from Odoo)',
                '(Extract from Odoo)',
                '(Extract from Odoo)',
                '(Extract from Odoo)',
                '(Extract from Odoo)',
                '(Extract from Odoo)'
            ],
            'Bank_Name': [
                'UBS COVID',
                'UBS Privatkonto',
                'CS Hauptkonto',
                'UBS CHF Unternehmen',
                'CS Zweitkonto',
                'UBS EUR',
                'UBS USD',
                'UNKNOWN'
            ],
            'Bank_IBAN': [
                '(From statement)',
                '(From statement)',
                '(From statement)',
                '(From statement)',
                '(From statement)',
                '(From statement)',
                '(From statement)',
                '(From statement)'
            ],
            'Match': [
                'TODO',
                'TODO',
                'TODO',
                'TODO',
                'TODO',
                'TODO',
                'TODO',
                'TODO'
            ],
            'Notes': [''] * 8
        })
        mapping_template.to_excel(writer, sheet_name='1-IBAN-Mapping', index=False)

        # SHEET 3: FX CONVERSION
        fx_template = pd.DataFrame({
            'Account': ['1028', '1029'],
            'Currency': ['EUR', 'USD'],
            'Bank_Balance_Foreign': [128860.70, 92.63],
            'SNB_Rate_31_12_2024': [
                '(https://www.snb.ch - EUR/CHF)',
                '(https://www.snb.ch - USD/CHF)'
            ],
            'Bank_Balance_CHF': ['=C2*D2', '=C3*D3'],
            'Odoo_Balance_CHF': [-1340.43, -997.28],
            'Delta_CHF': ['=E2-F2', '=E3-F3'],
            'Notes': ['', '']
        })
        fx_template.to_excel(writer, sheet_name='2-FX-Conversion', index=False)

        # SHEET 4-10: Account-specific reconciliation templates
        accounts_to_reconcile = [
            ('1026', 'UBS CHF Unternehmen'),
            ('1024', 'UBS Privatkonto'),
            ('1025', 'CS Hauptkonto'),
            ('1021', 'UBS COVID'),
            ('1027', 'CS Zweitkonto'),
            ('1028', 'UBS EUR (converted)'),
            ('1029', 'UBS USD (converted)')
        ]

        for idx, (code, name) in enumerate(accounts_to_reconcile, start=3):
            recon_template = pd.DataFrame({
                'Odoo_Date': ['2024-12-01', '2024-12-02', '...'],
                'Odoo_Description': ['Example: Invoice payment', 'Example: Salary', '...'],
                'Odoo_Debit': [1000.00, 0, '...'],
                'Odoo_Credit': [0, 5000.00, '...'],
                'Odoo_Balance': [1000.00, -4000.00, '...'],
                'Bank_Date': ['2024-12-01', '', '...'],
                'Bank_Description': ['Invoice XYZ', '', '...'],
                'Bank_Amount': [1000.00, '', '...'],
                'Match': ['YES', 'MISSING IN BANK', '...'],
                'Action': ['', 'Investigate', '...'],
                'Notes': ['', 'Check if pending', '...']
            })
            sheet_name = f"{idx}-{code}-{name[:10]}"
            recon_template.to_excel(writer, sheet_name=sheet_name, index=False)

        # SHEET 11: ADJUSTMENTS
        adjustments_template = pd.DataFrame({
            'ID': ['ADJ-001', 'ADJ-002', 'ADJ-003'],
            'Date': ['2025-11-15', '2025-11-15', '2025-11-15'],
            'Account_Code': ['1026', '1024', '1025'],
            'Description': [
                'Reverse duplicate entry - Invoice 12345',
                'Register missing bank fee CHF 50',
                'Correct intercompany transfer'
            ],
            'Debit': [0, 50, 1000],
            'Credit': [5000, 0, 0],
            'Odoo_Journal_Entry': [
                'JE/2025/001',
                'JE/2025/002',
                'JE/2025/003'
            ],
            'Status': ['PENDING', 'PENDING', 'PENDING'],
            'Approved_By': ['', '', '']
        })
        adjustments_template.to_excel(writer, sheet_name='11-Adjustments', index=False)

        # SHEET 12: VALIDATION SUMMARY
        validation_template = pd.DataFrame({
            'Account': ['1021', '1024', '1025', '1026', '1027', '1028', '1029', '1034'],
            'Before_Delta': [-37649.93, 97770.77, 97147.00, 188840.44, -744.83, 'FX', 'FX', 94.26],
            'Adjustments': [0, 0, 0, 0, 0, 0, 0, 0],
            'After_Delta': ['=B2+C2'] * 8,
            'Target': ['< CHF 1.00'] * 8,
            'Status': ['PENDING'] * 8,
            'CFO_Approval': [''] * 8
        })
        validation_template.to_excel(writer, sheet_name='12-Validation', index=False)

        # SHEET 13: SQL QUERIES
        sql_queries = pd.DataFrame({
            'Query_Name': [
                'Extract IBAN Mapping',
                'Account Balance at Date',
                'Movements December 2024',
                'Unreconciled Entries'
            ],
            'SQL': [
                """SELECT aa.code, aa.name, aj.name AS journal, rpb.acc_number AS iban
FROM account_account aa
LEFT JOIN account_journal aj ON aa.id = aj.default_account_id
LEFT JOIN res_partner_bank rpb ON aj.bank_account_id = rpb.id
WHERE aa.code LIKE '102%'
ORDER BY aa.code;""",

                """SELECT aa.code, aa.name, SUM(aml.debit - aml.credit) AS balance
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code IN ('1021', '1024', '1025', '1026', '1027', '1028', '1029', '1034')
  AND aml.date <= '2024-12-31'
GROUP BY aa.code, aa.name;""",

                """SELECT aml.date, aml.name, aml.ref, aml.debit, aml.credit, aml.balance
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code = '1026'
  AND aml.date BETWEEN '2024-12-01' AND '2024-12-31'
ORDER BY aml.date;""",

                """SELECT aa.code, COUNT(*) AS unreconciled_count
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code LIKE '102%'
  AND aml.reconciled = FALSE
GROUP BY aa.code;"""
            ],
            'Description': [
                'Get IBAN for all bank accounts',
                'Get balance at 31.12.2024',
                'Get all movements for specific account in Dec 2024',
                'Count unreconciled entries per account'
            ]
        })
        sql_queries.to_excel(writer, sheet_name='13-SQL-Queries', index=False)

    print(f"✓ Reconciliation workbook created: {output_file}")
    print("\nSheets included:")
    print("  0. Instructions (7-step process)")
    print("  1. IBAN Mapping (verification)")
    print("  2. FX Conversion (EUR/USD)")
    print("  3-9. Account reconciliation (line-by-line)")
    print("  11. Adjustments (journal entries)")
    print("  12. Validation (final summary)")
    print("  13. SQL Queries (Odoo extraction)")


if __name__ == "__main__":
    create_reconciliation_template()
