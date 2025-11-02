import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

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
    const { menu, style = 'classico', logo = null } = await request.json();

    if (!menu || !menu.categories) {
      return NextResponse.json(
        { error: 'Menu data is required' },
        { status: 400 }
      );
    }

    console.log('📄 [MENU-PDF] Generating PDF for:', menu.restaurantName);
    console.log('📄 [MENU-PDF] Logo ricevuto:', logo ? `Sì (${logo.substring(0, 50)}...)` : 'No');

    // Crea un nuovo documento PDF con jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Applica lo stile
    const colors = getStyleColors(style);
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const marginLeft = 15;
    const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;

    // Helper per aggiungere nuova pagina se necessario
    const checkAndAddPage = (neededSpace: number) => {
      if (yPosition + neededSpace > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
        return true;
      }
      return false;
    };

    // Se c'è un logo, aggiungilo in alto
    if (logo) {
      try {
        console.log('📷 [MENU-PDF] Aggiunta logo al PDF');

        // Determina il formato dell'immagine dal data URL
        let imageFormat = 'PNG';
        if (logo.includes('data:image/jpeg') || logo.includes('data:image/jpg')) {
          imageFormat = 'JPEG';
        } else if (logo.includes('data:image/png')) {
          imageFormat = 'PNG';
        }

        const logoSize = 30; // Dimensione del logo in mm (aumentata per visibilità)
        const logoX = (pageWidth - logoSize) / 2; // Centra il logo

        doc.addImage(logo, imageFormat, logoX, yPosition, logoSize, logoSize);
        yPosition += logoSize + 8; // Spazio dopo il logo

        console.log('✅ [MENU-PDF] Logo aggiunto con successo');
      } catch (logoError: any) {
        console.error('❌ [MENU-PDF] Errore aggiunta logo:', logoError.message);
        // Continua senza logo se c'è un errore
      }
    } else {
      console.log('ℹ️ [MENU-PDF] Nessun logo fornito');
    }

    // Header - Nome Ristorante
    doc.setFontSize(28);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.setFont('helvetica', 'bold');
    doc.text(menu.restaurantName, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Linea decorativa
    doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.setLineWidth(0.5);
    doc.line(60, yPosition, pageWidth - 60, yPosition);
    yPosition += 15;

    // Itera sulle categorie
    menu.categories.forEach((category: MenuCategory, categoryIndex: number) => {
      checkAndAddPage(20);

      // Nome categoria
      doc.setFontSize(16);
      doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
      doc.setFont('helvetica', 'bold');
      doc.text(category.name.toUpperCase(), marginLeft, yPosition);
      yPosition += 7;

      // Linea sotto la categoria
      doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
      yPosition += 8;

      // Itera sui piatti
      category.items.forEach((item: MenuItem, itemIndex: number) => {
        checkAndAddPage(30);

        // Nome piatto
        doc.setFontSize(12);
        doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
        doc.setFont('helvetica', 'bold');

        // Nome a sinistra
        const nameMaxWidth = contentWidth - 30;
        doc.text(item.name, marginLeft, yPosition, { maxWidth: nameMaxWidth });

        // Prezzo a destra
        if (item.price) {
          doc.setTextColor(colors.price.r, colors.price.g, colors.price.b);
          doc.text(`CHF ${item.price}`, pageWidth - marginRight, yPosition, { align: 'right' });
        }

        yPosition += 6;

        // Descrizione
        if (item.description) {
          doc.setFontSize(9);
          doc.setTextColor(colors.description.r, colors.description.g, colors.description.b);
          doc.setFont('helvetica', 'normal');
          const descLines = doc.splitTextToSize(item.description, contentWidth);
          doc.text(descLines, marginLeft, yPosition);
          yPosition += descLines.length * 4;
        }

        // Allergeni
        if (item.allergens && item.allergens.length > 0) {
          doc.setFontSize(8);
          doc.setTextColor(colors.allergens.r, colors.allergens.g, colors.allergens.b);
          doc.setFont('helvetica', 'italic');
          doc.text(`Allergeni: ${item.allergens.join(', ')}`, marginLeft, yPosition);
          yPosition += 4;
        }

        yPosition += 6;
      });

      yPosition += 5;
    });

    // Footer su ogni pagina
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(colors.footer.r, colors.footer.g, colors.footer.b);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${menu.restaurantName} - Pagina ${i} di ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    console.log('✅ [MENU-PDF] PDF generated successfully');

    // Genera il PDF come ArrayBuffer
    const pdfArrayBuffer = doc.output('arraybuffer');

    // Restituisci il PDF come response
    return new NextResponse(pdfArrayBuffer, {
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
 * Ritorna i colori RGB per ogni stile
 */
function getStyleColors(style: string) {
  const styles: Record<string, any> = {
    classico: {
      primary: { r: 139, g: 69, b: 19 }, // Marrone
      secondary: { r: 101, g: 67, b: 33 },
      accent: { r: 210, g: 105, b: 30 },
      text: { r: 51, g: 51, b: 51 },
      description: { r: 102, g: 102, b: 102 },
      price: { r: 139, g: 69, b: 19 },
      allergens: { r: 153, g: 153, b: 153 },
      footer: { r: 153, g: 153, b: 153 }
    },
    moderno: {
      primary: { r: 44, g: 62, b: 80 }, // Blu scuro
      secondary: { r: 52, g: 73, b: 94 },
      accent: { r: 52, g: 152, b: 219 },
      text: { r: 44, g: 62, b: 80 },
      description: { r: 127, g: 140, b: 141 },
      price: { r: 231, g: 76, b: 60 },
      allergens: { r: 149, g: 165, b: 166 },
      footer: { r: 189, g: 195, b: 199 }
    },
    elegante: {
      primary: { r: 28, g: 28, b: 28 }, // Nero elegante
      secondary: { r: 51, g: 51, b: 51 },
      accent: { r: 218, g: 165, b: 32 }, // Oro
      text: { r: 28, g: 28, b: 28 },
      description: { r: 102, g: 102, b: 102 },
      price: { r: 218, g: 165, b: 32 },
      allergens: { r: 153, g: 153, b: 153 },
      footer: { r: 204, g: 204, b: 204 }
    }
  };

  return styles[style] || styles.classico;
}
