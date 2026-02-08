import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for video generation

/**
 * Clean Odoo product names by removing packaging/weight info
 * "ACCIUGHE A FILETTI IN OLIO DI OLIVA DEL MAR CANTABRICO LATTA 700G 6PZ CRT RIS"
 * → "Acciughe a Filetti in Olio di Oliva del Mar Cantabrico"
 */
function cleanProductName(name: string): string {
  if (!name) return name;

  // Remove packaging codes at the end (VASC, BUSTA, LATTA, CRT, etc.)
  let cleaned = name
    .replace(/\s+(VASC|BUSTA|SACCO|CONFEZIONE|CONF|PKG|CRT|PZ|PEZZI|LATTA|BARATT|BRICK|FLAC|BOT|TDT|RIS|GIFF|AL)\s*.*$/i, '')
    .replace(/\s+\d+[\.,]?\d*\s*(KG|GR|G|ML|L|LT|LITRI|GRAMMI|PZ)(\s|$)/gi, ' ')
    .replace(/\s+\d+PZ\s*/gi, ' ')
    .trim();

  // Convert to title case (nicer for social media)
  cleaned = cleaned
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Keep short prepositions/articles lowercase
      if (['di', 'del', 'della', 'delle', 'dei', 'degli', 'da', 'in', 'a', 'e', 'con', 'per', 'su'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  // Capitalize first letter always
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return cleaned;
}

/**
 * Generate a rich product description for the AI based on name and category
 */
function generateProductDescription(name: string, category: string): string {
  const cleanName = cleanProductName(name);
  const lowerName = name.toLowerCase();

  // Detect product type and generate appropriate description
  if (lowerName.includes('mozzarella') || lowerName.includes('fiordilatte') || lowerName.includes('burrata') || lowerName.includes('treccia')) {
    return `${cleanName} - Formaggio fresco italiano artigianale, prodotto con latte di alta qualità. Perfetto per insalate, pizza e antipasti gourmet. Prodotto premium importato dall'Italia da LAPA, il tuo fornitore di eccellenza in Svizzera.`;
  }
  if (lowerName.includes('aceto balsamico')) {
    return `${cleanName} - Aceto balsamico tradizionale italiano, invecchiato e dal sapore intenso. Un condimento di lusso per piatti raffinati. Importato direttamente dall'Italia da LAPA per i migliori ristoranti svizzeri.`;
  }
  if (lowerName.includes('acciugh') || lowerName.includes('tonno') || lowerName.includes('pesce')) {
    return `${cleanName} - Conserve di pesce di altissima qualità dal Mediterraneo. Selezionate a mano per garantire gusto e freschezza premium. Da LAPA, eccellenza italiana in Svizzera.`;
  }
  if (lowerName.includes('aceto') && lowerName.includes('lamponi')) {
    return `${cleanName} - Aceto gourmet aromatizzato ai frutti di bosco, perfetto per insalate creative e piatti innovativi. Un tocco di originalità dalla tradizione italiana. Disponibile da LAPA.`;
  }
  if (lowerName.includes('tartufo') || lowerName.includes('affetta')) {
    return `${cleanName} - Strumento professionale per il tartufo, indispensabile in ogni cucina gourmet. Acciaio inox di alta qualità per affettature perfette. Da LAPA, attrezzature per chef professionisti.`;
  }
  if (lowerName.includes('pasta') || lowerName.includes('spaghett') || lowerName.includes('penne') || lowerName.includes('fusilli')) {
    return `${cleanName} - Pasta artigianale italiana di prima qualità, trafilata al bronzo per una consistenza perfetta. Da LAPA, il gusto autentico dell'Italia in Svizzera.`;
  }
  if (lowerName.includes('olio')) {
    return `${cleanName} - Olio extra vergine d'oliva italiano di prima spremitura a freddo. Aroma intenso e gusto autentico del Mediterraneo. Importato da LAPA per la Svizzera.`;
  }
  if (lowerName.includes('salame') || lowerName.includes('prosciutto') || lowerName.includes('bresaola') || lowerName.includes('speck')) {
    return `${cleanName} - Salume italiano DOP/IGP stagionato secondo tradizione. Gusto intenso e qualità certificata per i veri intenditori. Da LAPA, eccellenza italiana in Svizzera.`;
  }

  // Default description
  return `${cleanName} - Prodotto alimentare italiano premium selezionato da LAPA, il fornitore di eccellenza per ristoranti e gastronomie in Svizzera. Qualità artigianale e gusto autentico dall'Italia.`;
}

/**
 * POST /api/social-ai/autopilot/generate-post
 *
 * Takes a single autopilot post plan and executes full generation.
 * Reuses the existing generate-marketing endpoint internally.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post } = body;

    if (!post || !post.product) {
      return NextResponse.json({ error: 'Post data richiesto' }, { status: 400 });
    }

    if (!post.product.image) {
      return NextResponse.json({ error: 'Immagine prodotto richiesta' }, { status: 400 });
    }

    // Clean product name and generate rich description
    const cleanName = cleanProductName(post.product.name);
    const richDescription = generateProductDescription(post.product.name, post.product.category);

    console.log(`[AutopilotGenerate] "${post.product.name}" → "${cleanName}"`);

    // Call the existing generate-marketing endpoint
    const generateResponse = await fetch(
      `${request.nextUrl.origin}/api/social-ai/generate-marketing`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          productImage: post.product.image,
          productName: cleanName,
          productDescription: richDescription,
          socialPlatform: post.platform,
          contentType: post.contentType,
          tone: post.tone,
          targetAudience: post.platform === 'linkedin'
            ? 'Chef professionisti, ristoratori e buyer della gastronomia in Svizzera'
            : post.platform === 'tiktok'
            ? 'Giovani foodies e appassionati di cucina italiana in Svizzera'
            : 'Amanti del cibo italiano, foodies e gastronomi in Svizzera',
          videoStyle: post.videoStyle || 'cinematic',
          videoDuration: post.videoDuration || 6,
          includeLogo: true,
          companyMotto: 'Zero Pensieri',
          productCategory: post.product.category || 'Food',
          targetCanton: 'Zürich',
        }),
      }
    );

    const generateData = await generateResponse.json();

    if (!generateResponse.ok) {
      return NextResponse.json(
        { error: generateData.error || 'Errore durante generazione contenuto' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        postId: post.id,
        result: generateData.data,
      }
    });

  } catch (error: any) {
    console.error('[AutopilotGenerate] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante generazione post autopilot' },
      { status: 500 }
    );
  }
}
