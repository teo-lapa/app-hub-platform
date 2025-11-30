#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyze Reconciliation Report
"""

import pandas as pd
import sys
import io

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Read the Excel file
filename = r"C:\Users\lapa\Desktop\Claude Code\app-hub-platform\reconciliation-report-20251115-193023.xlsx"

print("="*80)
print("RECONCILIATION REPORT ANALYSIS")
print("="*80)

# Read all sheets
xl_file = pd.ExcelFile(filename)
print(f"\n📊 Available sheets: {xl_file.sheet_names}\n")

# Summary Sheet
if 'Summary' in xl_file.sheet_names:
    df_summary = pd.read_excel(filename, sheet_name='Summary')
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(df_summary.to_string(index=False))

# Reconciled Sheet
if 'Reconciled' in xl_file.sheet_names:
    df_reconciled = pd.read_excel(filename, sheet_name='Reconciled')
    print(f"\n✅ RECONCILED TRANSACTIONS: {len(df_reconciled)}")
    if len(df_reconciled) > 0:
        print(df_reconciled.to_string(index=False))

# Failed Sheet
if 'Failed' in xl_file.sheet_names:
    df_failed = pd.read_excel(filename, sheet_name='Failed')
    print(f"\n❌ FAILED RECONCILIATIONS: {len(df_failed)}")
    if len(df_failed) > 0:
        # Group by error type
        error_summary = df_failed.groupby('error').size().reset_index(name='count')
        print("\nError Summary:")
        print(error_summary.to_string(index=False))

        # Show first 20 failed entries
        print("\nFirst 20 Failed Entries:")
        print(df_failed.head(20).to_string(index=False))

# Manual Review Sheet
if 'Manual Review' in xl_file.sheet_names:
    df_manual = pd.read_excel(filename, sheet_name='Manual Review')
    print(f"\n⚠️  NEEDS MANUAL REVIEW: {len(df_manual)}")
    if len(df_manual) > 0:
        print(df_manual.head(20).to_string(index=False))
