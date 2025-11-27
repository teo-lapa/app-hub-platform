import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import * as XLSX from 'xlsx';
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
 * POST /api/inventario-vocale/export/excel
 *
 * Export inventory to Excel
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

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // === Sheet 1: Products ===
    const productsData = products.map((p, index) => ({
      '#': index + 1,
      'Prodotto': p.name,
      'Quantità': p.quantity,
      'Unità': p.unit,
      'Categoria': p.category === 'food' ? 'Food' : 'Non-Food',
      'Confidenza': p.confidence === 'high' ? 'Alta' : p.confidence === 'medium' ? 'Media' : 'Bassa',
      'Note': p.notes || ''
    }));

    const productsSheet = XLSX.utils.json_to_sheet(productsData);

    // Set column widths
    productsSheet['!cols'] = [
      { wch: 5 },   // #
      { wch: 40 },  // Prodotto
      { wch: 12 },  // Quantità
      { wch: 10 },  // Unità
      { wch: 12 },  // Categoria
      { wch: 12 },  // Confidenza
      { wch: 30 }   // Note
    ];

    XLSX.utils.book_append_sheet(workbook, productsSheet, 'Prodotti');

    // === Sheet 2: Summary ===
    const foodProducts = products.filter(p => p.category === 'food');
    const nonFoodProducts = products.filter(p => p.category === 'non_food');

    const summaryData = [
      { 'Campo': 'Data', 'Valore': createdAt.toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })},
      { 'Campo': 'Azienda', 'Valore': companyName || '-' },
      { 'Campo': 'Operatore', 'Valore': userName || '-' },
      { 'Campo': 'Zona', 'Valore': location || '-' },
      { 'Campo': '', 'Valore': '' },
      { 'Campo': 'Totale Prodotti', 'Valore': products.length },
      { 'Campo': 'Prodotti Food', 'Valore': foodProducts.length },
      { 'Campo': 'Prodotti Non-Food', 'Valore': nonFoodProducts.length },
      { 'Campo': '', 'Valore': '' },
      { 'Campo': 'Trascrizione', 'Valore': transcription || '-' }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [
      { wch: 20 },
      { wch: 80 }
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo');

    // === Sheet 3: By Category ===
    // Food products
    const foodData = foodProducts.map((p, index) => ({
      '#': index + 1,
      'Prodotto': p.name,
      'Quantità': p.quantity,
      'Unità': p.unit,
      'Note': p.notes || ''
    }));

    if (foodData.length > 0) {
      const foodSheet = XLSX.utils.json_to_sheet(foodData);
      foodSheet['!cols'] = [
        { wch: 5 },
        { wch: 40 },
        { wch: 12 },
        { wch: 10 },
        { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(workbook, foodSheet, 'Food');
    }

    // Non-food products
    const nonFoodData = nonFoodProducts.map((p, index) => ({
      '#': index + 1,
      'Prodotto': p.name,
      'Quantità': p.quantity,
      'Unità': p.unit,
      'Note': p.notes || ''
    }));

    if (nonFoodData.length > 0) {
      const nonFoodSheet = XLSX.utils.json_to_sheet(nonFoodData);
      nonFoodSheet['!cols'] = [
        { wch: 5 },
        { wch: 40 },
        { wch: 12 },
        { wch: 10 },
        { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(workbook, nonFoodSheet, 'Non-Food');
    }

    // Write to buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventario_${createdAt.toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('[VOICE-INVENTORY] Excel export error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore durante l\'export Excel';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
