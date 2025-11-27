import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'lapa-hub-secret-key-2024';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface ExtractedProduct {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'food' | 'non_food';
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * POST /api/inventario-vocale/export/pdf
 *
 * Export inventory to PDF
 *
 * Request: JSON
 * {
 *   session_id?: string,  // If provided, export from database
 *   products?: ExtractedProduct[],  // If provided, export directly
 *   location?: string,
 *   transcription?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, products: directProducts, location: directLocation, transcription: directTranscription } = body;

    let products: ExtractedProduct[] = [];
    let location: string = '';
    let transcription: string = '';
    let createdAt: Date = new Date();
    let userName: string = '';
    let companyName: string = '';

    // Get user info from token
    const token = request.cookies.get('token')?.value;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userName = decoded.name || '';
        companyName = decoded.azienda || '';
      } catch (e) {
        console.warn('[VOICE-INVENTORY] Invalid token');
      }
    }

    if (session_id) {
      // Load from database
      const result = await sql`
        SELECT products, location, transcription, created_at, user_name, company_name
        FROM voice_inventory_sessions
        WHERE id = ${session_id}
      `;

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Sessione non trovata'
        }, { status: 404 });
      }

      const row = result.rows[0];
      products = row.products || [];
      location = row.location || '';
      transcription = row.transcription || '';
      createdAt = new Date(row.created_at);
      userName = row.user_name || userName;
      companyName = row.company_name || companyName;
    } else if (directProducts) {
      // Use direct data
      products = directProducts;
      location = directLocation || '';
      transcription = directTranscription || '';
    } else {
      return NextResponse.json({
        success: false,
        error: 'Nessun dato da esportare'
      }, { status: 400 });
    }

    // Create PDF
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Inventario Vocale', 105, 20, { align: 'center' });

    // Company name
    if (companyName) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(companyName, 105, 30, { align: 'center' });
    }

    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let yPos = 45;

    doc.text(`Data: ${createdAt.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 14, yPos);
    yPos += 6;

    if (location) {
      doc.text(`Zona: ${location}`, 14, yPos);
      yPos += 6;
    }

    if (userName) {
      doc.text(`Operatore: ${userName}`, 14, yPos);
      yPos += 6;
    }

    doc.text(`Totale prodotti: ${products.length}`, 14, yPos);
    yPos += 10;

    // Summary by category
    const foodProducts = products.filter(p => p.category === 'food');
    const nonFoodProducts = products.filter(p => p.category === 'non_food');

    doc.setFont('helvetica', 'bold');
    doc.text('Riepilogo:', 14, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`- Prodotti Food: ${foodProducts.length}`, 20, yPos);
    yPos += 5;
    doc.text(`- Prodotti Non-Food: ${nonFoodProducts.length}`, 20, yPos);
    yPos += 10;

    // Products table
    const tableData = products.map(p => [
      p.name,
      `${p.quantity} ${p.unit}`,
      p.category === 'food' ? 'Food' : 'Non-Food',
      p.confidence === 'high' ? 'Alta' : p.confidence === 'medium' ? 'Media' : 'Bassa',
      p.notes || '-'
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['Prodotto', 'Quantità', 'Categoria', 'Confidenza', 'Note']],
      body: tableData,
      headStyles: {
        fillColor: [147, 51, 234], // Purple
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 40 }
      }
    });

    // Transcription (if not too long)
    if (transcription && transcription.length < 500) {
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Trascrizione originale:', 14, finalY);
      doc.setFont('helvetica', 'italic');
      const splitText = doc.splitTextToSize(`"${transcription}"`, 180);
      doc.text(splitText, 14, finalY + 6);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generato da LAPA - Inventario Vocale | Pagina ${i} di ${pageCount}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    // Output PDF
    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="inventario_${createdAt.toISOString().split('T')[0]}.pdf"`
      }
    });

  } catch (error) {
    console.error('[VOICE-INVENTORY] PDF export error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore durante l\'export PDF';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
