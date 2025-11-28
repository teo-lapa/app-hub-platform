import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { jsPDF } from 'jspdf';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'lapa-hub-secret-key-2024';

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
        const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
        userName = String(decoded.name || '');
        companyName = String(decoded.azienda || '');
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
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFillColor(147, 51, 234); // Purple
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('INVENTARIO VOCALE', pageWidth / 2, 18, { align: 'center' });

    if (companyName) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(companyName, pageWidth / 2, 28, { align: 'center' });
    }

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Metadata section
    let yPos = 50;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const dateStr = createdAt.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    doc.text(`Data: ${dateStr}`, 14, yPos);
    yPos += 6;

    if (location) {
      doc.text(`Zona: ${location}`, 14, yPos);
      yPos += 6;
    }

    if (userName) {
      doc.text(`Operatore: ${userName}`, 14, yPos);
      yPos += 6;
    }

    // Summary
    const foodProducts = products.filter(p => p.category === 'food');
    const nonFoodProducts = products.filter(p => p.category === 'non_food');

    yPos += 5;
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos - 4, pageWidth - 28, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text('RIEPILOGO', 20, yPos + 2);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`Totale prodotti: ${products.length}`, 20, yPos);
    doc.text(`Food: ${foodProducts.length}`, 80, yPos);
    doc.text(`Non-Food: ${nonFoodProducts.length}`, 120, yPos);
    yPos += 15;

    // Products header
    doc.setFillColor(147, 51, 234);
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PRODOTTO', 16, yPos + 5.5);
    doc.text('QTA', 100, yPos + 5.5);
    doc.text('CATEGORIA', 130, yPos + 5.5);
    doc.text('CONF.', 165, yPos + 5.5);
    yPos += 10;

    // Products list
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    products.forEach((product, index) => {
      // Check if need new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
      }

      // Truncate long names
      const name = product.name.length > 40 ? product.name.substring(0, 37) + '...' : product.name;

      doc.text(name, 16, yPos);
      doc.text(`${product.quantity} ${product.unit}`, 100, yPos);
      doc.text(product.category === 'food' ? 'Food' : 'Non-Food', 130, yPos);

      // Confidence with color
      const confText = product.confidence === 'high' ? 'Alta' : product.confidence === 'medium' ? 'Media' : 'Bassa';
      if (product.confidence === 'high') {
        doc.setTextColor(34, 197, 94); // Green
      } else if (product.confidence === 'medium') {
        doc.setTextColor(234, 179, 8); // Yellow
      } else {
        doc.setTextColor(239, 68, 68); // Red
      }
      doc.text(confText, 165, yPos);
      doc.setTextColor(0, 0, 0);

      yPos += 8;
    });

    // Transcription
    if (transcription && transcription.length < 500) {
      yPos += 10;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(240, 240, 240);
      doc.rect(14, yPos - 4, pageWidth - 28, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TRASCRIZIONE ORIGINALE', 16, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      const splitText = doc.splitTextToSize(`"${transcription}"`, pageWidth - 32);
      doc.text(splitText, 16, yPos);
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generato da LAPA - Inventario Vocale | Pagina ${i} di ${pageCount}`,
        pageWidth / 2,
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
