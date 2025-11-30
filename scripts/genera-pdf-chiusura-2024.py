#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera PDF Report Chiusura 2024
Per Commercialista Patrick Angstmann
"""

import sys
import io
import json
from datetime import datetime

# Fix encoding su Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False
    print("⚠️  reportlab non installato. Installa con: pip install reportlab")

class PDFReportGenerator:
    def __init__(self, json_file):
        with open(json_file, 'r', encoding='utf-8') as f:
            self.data = json.load(f)

        self.styles = getSampleStyleSheet()

        # Stili personalizzati
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1f4788'),
            spaceAfter=30,
            alignment=TA_CENTER
        )

        self.heading_style = ParagraphStyle(
            'CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#2e5c8a'),
            spaceAfter=12,
            spaceBefore=12
        )

        self.normal_style = ParagraphStyle(
            'CustomNormal',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6
        )

    def format_currency(self, amount):
        """Formatta importo in CHF"""
        return f"CHF {amount:,.2f}".replace(',', "'")

    def create_cover_page(self):
        """Pagina di copertina"""
        story = []

        # Titolo
        story.append(Spacer(1, 3*cm))
        story.append(Paragraph("REPORT CHIUSURA BILANCIO 2024", self.title_style))
        story.append(Spacer(1, 1*cm))

        # Sottotitolo
        subtitle = ParagraphStyle(
            'Subtitle',
            parent=self.styles['Normal'],
            fontSize=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#555555')
        )
        story.append(Paragraph("Lapa Delikatessen", subtitle))
        story.append(Spacer(1, 2*cm))

        # Info box
        info_data = [
            ['Periodo:', '01.01.2024 - 31.12.2024'],
            ['Data chiusura:', '31 Dicembre 2024'],
            ['Generato il:', datetime.now().strftime('%d.%m.%Y alle %H:%M')],
            ['Commercialista:', 'Patrick Angstmann'],
            ['Società fiduciaria:', 'PAGG Treuhand AG'],
            ['Email:', 'p.angstmann@pagg.ch'],
        ]

        info_table = Table(info_data, colWidths=[5*cm, 10*cm])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e7e7e7')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        story.append(info_table)
        story.append(Spacer(1, 2*cm))

        # Warning box se ci sono errori
        errors_count = sum(1 for v in self.data['checklist_validation'].values() if '✗' in v['status'])
        if errors_count > 0:
            warning_style = ParagraphStyle(
                'Warning',
                parent=self.styles['Normal'],
                fontSize=14,
                textColor=colors.red,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            story.append(Paragraph(f"⚠️ ATTENZIONE: {errors_count} ERRORI CRITICI RILEVATI ⚠️", warning_style))

        story.append(PageBreak())
        return story

    def create_executive_summary(self):
        """Executive Summary"""
        story = []

        story.append(Paragraph("EXECUTIVE SUMMARY", self.heading_style))
        story.append(Spacer(1, 0.5*cm))

        # Balance Sheet Summary
        bs = self.data['balance_sheet']['totals']
        bs_data = [
            ['BALANCE SHEET al 31.12.2024', ''],
            ['Assets (Attivi)', self.format_currency(bs['assets'])],
            ['Liabilities (Passivi)', self.format_currency(bs['liabilities'])],
            ['Equity (Patrimonio Netto)', self.format_currency(bs['equity'])],
            ['Balance Check', self.format_currency(bs['balance_check'])],
        ]

        bs_table = Table(bs_data, colWidths=[12*cm, 5*cm])
        bs_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        # Evidenzia se balance check != 0
        if abs(bs['balance_check']) > 0.01:
            bs_table.setStyle(TableStyle([
                ('BACKGROUND', (1, 4), (1, 4), colors.red),
                ('TEXTCOLOR', (1, 4), (1, 4), colors.whitesmoke),
            ]))

        story.append(bs_table)
        story.append(Spacer(1, 0.7*cm))

        # P&L Summary
        pl = self.data['profit_loss']['totals']
        pl_data = [
            ['PROFIT & LOSS 2024', ''],
            ['Income (Ricavi)', self.format_currency(pl['income'])],
            ['Expenses (Costi)', self.format_currency(pl['expenses'])],
            ['Net Profit (Utile Netto)', self.format_currency(pl['net_profit'])],
        ]

        pl_table = Table(pl_data, colWidths=[12*cm, 5*cm])
        pl_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        story.append(pl_table)
        story.append(Spacer(1, 1*cm))

        # Key metrics
        story.append(Paragraph("INDICATORI CHIAVE", self.heading_style))

        metrics_data = [
            ['Totale conti attivi', str(len(self.data['accounts']))],
            ['Conti bancari', str(len(self.data['bank_reconciliations']))],
            ['Movimenti non riconciliati', f"{sum(b['unreconciled_count'] for b in self.data['bank_reconciliations']):,}"],
            ['Errori critici rilevati', str(sum(1 for v in self.data['checklist_validation'].values() if '✗' in v['status']))],
        ]

        metrics_table = Table(metrics_data, colWidths=[12*cm, 5*cm])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e7e7e7')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))

        story.append(metrics_table)
        story.append(PageBreak())

        return story

    def create_checklist_page(self):
        """Pagina Checklist Validazione"""
        story = []

        story.append(Paragraph("CHECKLIST VALIDAZIONE CONTI TECNICI", self.heading_style))
        story.append(Spacer(1, 0.5*cm))

        checklist_data = [['Konto', 'Nome', 'Saldo CHF', 'Status']]

        for code, data in sorted(self.data['checklist_validation'].items()):
            checklist_data.append([
                data['code'],
                data['name'][:35],  # Tronca se troppo lungo
                self.format_currency(data.get('balance', 0.0)),
                data['status'].replace('✓', 'OK').replace('✗', 'ERR').replace('⚠️', 'WARN')
            ])

        checklist_table = Table(checklist_data, colWidths=[2.5*cm, 8*cm, 4*cm, 2.5*cm])
        checklist_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        # Colora righe in base allo status
        for i, (code, data) in enumerate(sorted(self.data['checklist_validation'].items()), 1):
            if '✗' in data['status']:
                checklist_table.setStyle(TableStyle([
                    ('BACKGROUND', (3, i), (3, i), colors.red),
                    ('TEXTCOLOR', (3, i), (3, i), colors.whitesmoke),
                ]))
            elif '⚠️' in data['status']:
                checklist_table.setStyle(TableStyle([
                    ('BACKGROUND', (3, i), (3, i), colors.orange),
                ]))
            else:
                checklist_table.setStyle(TableStyle([
                    ('BACKGROUND', (3, i), (3, i), colors.green),
                    ('TEXTCOLOR', (3, i), (3, i), colors.whitesmoke),
                ]))

        story.append(checklist_table)
        story.append(Spacer(1, 1*cm))

        # Note sugli errori
        errors = [v for v in self.data['checklist_validation'].values() if v.get('issues')]
        if errors:
            story.append(Paragraph("NOTE ERRORI CRITICI:", self.heading_style))
            for error in errors:
                for issue in error.get('issues', []):
                    story.append(Paragraph(f"• Konto {error['code']}: {issue}", self.normal_style))

        story.append(PageBreak())
        return story

    def create_bank_reconciliation_page(self):
        """Pagina Riconciliazioni Bancarie"""
        story = []

        story.append(Paragraph("RICONCILIAZIONI BANCARIE", self.heading_style))
        story.append(Spacer(1, 0.5*cm))

        bank_data = [['Konto', 'Nome Conto', 'Saldo CHF', 'Non Riconc.']]

        for bank in self.data['bank_reconciliations']:
            bank_data.append([
                bank['account_code'],
                bank['account_name'][:30],
                self.format_currency(bank['balance']),
                str(bank['unreconciled_count'])
            ])

        bank_table = Table(bank_data, colWidths=[2*cm, 8*cm, 4*cm, 3*cm])
        bank_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (3, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        # Evidenzia se ci sono molti movimenti non riconciliati
        for i, bank in enumerate(self.data['bank_reconciliations'], 1):
            if bank['unreconciled_count'] > 100:
                bank_table.setStyle(TableStyle([
                    ('BACKGROUND', (3, i), (3, i), colors.red),
                    ('TEXTCOLOR', (3, i), (3, i), colors.whitesmoke),
                ]))
            elif bank['unreconciled_count'] > 0:
                bank_table.setStyle(TableStyle([
                    ('BACKGROUND', (3, i), (3, i), colors.orange),
                ]))

        story.append(bank_table)
        story.append(PageBreak())
        return story

    def create_vat_page(self):
        """Pagina IVA"""
        story = []

        story.append(Paragraph("RIEPILOGO IVA 2024", self.heading_style))
        story.append(Spacer(1, 0.5*cm))

        vat_data = [['Konto', 'Descrizione', 'Saldo CHF']]

        for code, vat in self.data['vat_accounts'].items():
            vat_data.append([
                vat['code'],
                vat['description'],
                self.format_currency(vat['balance'])
            ])

        vat_table = Table(vat_data, colWidths=[2.5*cm, 10*cm, 4.5*cm])
        vat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        story.append(vat_table)
        story.append(Spacer(1, 1*cm))

        story.append(Paragraph("NOTE:", self.heading_style))
        story.append(Paragraph("• Konto 1170 (Vorsteuer MWST): IVA versata su acquisti - credito verso Fisco", self.normal_style))
        story.append(Paragraph("• Konto 2016 (Kreditor MWST): IVA incassata su vendite - debito verso Fisco", self.normal_style))
        story.append(Paragraph("• Verificare che i saldi corrispondano alle dichiarazioni IVA 2024", self.normal_style))

        story.append(PageBreak())
        return story

    def generate(self, output_file):
        """Genera PDF completo"""
        print("Generazione PDF Report Chiusura 2024...")

        doc = SimpleDocTemplate(
            output_file,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )

        story = []

        # Cover page
        story.extend(self.create_cover_page())
        print("  ✓ Cover page")

        # Executive summary
        story.extend(self.create_executive_summary())
        print("  ✓ Executive Summary")

        # Checklist
        story.extend(self.create_checklist_page())
        print("  ✓ Checklist Validazione")

        # Bank reconciliations
        story.extend(self.create_bank_reconciliation_page())
        print("  ✓ Riconciliazioni Bancarie")

        # VAT
        story.extend(self.create_vat_page())
        print("  ✓ Riepilogo IVA")

        # Build PDF
        doc.build(story)
        print(f"\n✓ PDF salvato: {output_file}")

def main():
    if not HAS_REPORTLAB:
        print("\n❌ Impossibile generare PDF senza reportlab")
        print("   Installa con: pip install reportlab")
        return 1

    try:
        json_file = "report-chiusura-2024.json"
        output_file = "REPORT-CHIUSURA-2024.pdf"

        generator = PDFReportGenerator(json_file)
        generator.generate(output_file)

        print("\n✓ Report PDF completato con successo!")
        return 0

    except Exception as e:
        print(f"\n✗ ERRORE: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
