import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/gemini/generate-menu-pdf
 *
 * Genera un PDF professionale da un menu strutturato
 *
 * Body:
 * - menu: MenuData - Dati del menu strutturati
 * - style: string - Stile del menu (classico, moderno, elegante)
 */

interface MenuItem {
  name: string;
  description?: string;
  price?: string;
  allergens?: string[];
}

interface MenuCategory {
  name: string;
  items: MenuItem[];
}

interface MenuData {
  restaurantName: string;
  categories: MenuCategory[];
}

export async function POST(request: NextRequest) {
  try {
    const { menu, style = 'classico' } = await request.json();

    if (!menu || !menu.categories) {
      return NextResponse.json(
        { error: 'Menu data is required' },
        { status: 400 }
      );
    }

    console.log('📄 [MENU-PDF] Generating PDF for:', menu.restaurantName);

    // Crea un nuovo documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Buffer per raccogliere il PDF
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Promise per aspettare che il PDF sia completo
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
    });

    // Applica lo stile
    const colors = getStyleColors(style);

    // Header - Nome Ristorante
    doc
      .fillColor(colors.primary)
      .fontSize(32)
      .font('Helvetica-Bold')
      .text(menu.restaurantName, {
        align: 'center'
      });

    doc.moveDown(0.5);

    // Linea decorativa
    doc
      .strokeColor(colors.accent)
      .lineWidth(2)
      .moveTo(150, doc.y)
      .lineTo(450, doc.y)
      .stroke();

    doc.moveDown(1.5);

    // Itera sulle categorie
    menu.categories.forEach((category: MenuCategory, categoryIndex: number) => {
      // Controlla se c'è abbastanza spazio per la categoria
      if (doc.y > 650) {
        doc.addPage();
      }

      // Nome categoria
      doc
        .fillColor(colors.secondary)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(category.name.toUpperCase(), {
          align: 'left'
        });

      doc.moveDown(0.3);

      // Linea sotto la categoria
      doc
        .strokeColor(colors.accent)
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(0.8);

      // Itera sui piatti
      category.items.forEach((item: MenuItem, itemIndex: number) => {
        // Controlla se serve una nuova pagina
        if (doc.y > 700) {
          doc.addPage();
        }

        const startY = doc.y;

        // Nome piatto e prezzo sulla stessa riga
        doc
          .fillColor(colors.text)
          .fontSize(14)
          .font('Helvetica-Bold');

        // Nome piatto a sinistra
        const nameWidth = 400;
        doc.text(item.name, 50, startY, {
          width: nameWidth,
          continued: false
        });

        // Prezzo a destra
        if (item.price) {
          doc
            .fillColor(colors.price)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(`€ ${item.price}`, 450, startY, {
              width: 95,
              align: 'right'
            });
        }

        doc.moveDown(0.3);

        // Descrizione
        if (item.description) {
          doc
            .fillColor(colors.description)
            .fontSize(11)
            .font('Helvetica')
            .text(item.description, {
              width: 495,
              align: 'left'
            });

          doc.moveDown(0.2);
        }

        // Allergeni
        if (item.allergens && item.allergens.length > 0) {
          doc
            .fillColor(colors.allergens)
            .fontSize(9)
            .font('Helvetica-Oblique')
            .text(`Allergeni: ${item.allergens.join(', ')}`, {
              width: 495,
              align: 'left'
            });
        }

        doc.moveDown(0.8);
      });

      doc.moveDown(0.5);
    });

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      doc
        .fillColor(colors.footer)
        .fontSize(10)
        .font('Helvetica')
        .text(
          `${menu.restaurantName} - Pagina ${i + 1} di ${pageCount}`,
          50,
          doc.page.height - 50,
          {
            align: 'center'
          }
        );
    }

    // Finalizza il PDF
    doc.end();

    // Aspetta che il PDF sia completo
    const pdfBuffer = await pdfPromise;

    console.log('✅ [MENU-PDF] PDF generated successfully:', pdfBuffer.length, 'bytes');

    // Restituisci il PDF come response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${menu.restaurantName.replace(/[^a-z0-9]/gi, '_')}_menu.pdf"`
      }
    });

  } catch (error: any) {
    console.error('❌ [MENU-PDF] Error:', error);

    return NextResponse.json(
      {
        error: 'Errore durante la generazione del PDF',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Ritorna i colori per ogni stile
 */
function getStyleColors(style: string) {
  const styles: Record<string, any> = {
    classico: {
      primary: '#8B4513', // Marrone
      secondary: '#654321',
      accent: '#D2691E',
      text: '#333333',
      description: '#666666',
      price: '#8B4513',
      allergens: '#999999',
      footer: '#999999'
    },
    moderno: {
      primary: '#2C3E50', // Blu scuro
      secondary: '#34495E',
      accent: '#3498DB',
      text: '#2C3E50',
      description: '#7F8C8D',
      price: '#E74C3C',
      allergens: '#95A5A6',
      footer: '#BDC3C7'
    },
    elegante: {
      primary: '#1C1C1C', // Nero elegante
      secondary: '#333333',
      accent: '#DAA520', // Oro
      text: '#1C1C1C',
      description: '#666666',
      price: '#DAA520',
      allergens: '#999999',
      footer: '#CCCCCC'
    }
  };

  return styles[style] || styles.classico;
}
