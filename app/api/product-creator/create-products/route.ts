import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Jimp } from 'jimp';
import { readFileSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Add LAPA logo watermark to image using Jimp (pure JS, no native deps)
async function addLogoWatermark(imageBase64: string): Promise<string> {
  try {
    // Load the logo
    const logoPath = path.join(process.cwd(), 'public', 'logo-lapa.png');
    let logoBuffer: Buffer;

    try {
      logoBuffer = readFileSync(logoPath);
    } catch {
      console.log('⚠️ Logo file not found, skipping watermark');
      return imageBase64;
    }

    // Decode base64 image
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Load both images with Jimp v1
    const [image, logo] = await Promise.all([
      Jimp.read(imageBuffer),
      Jimp.read(logoBuffer)
    ]);

    const imageWidth = image.width;
    const imageHeight = image.height;

    // Resize logo to be small (about 12% of image width)
    const logoWidth = Math.round(imageWidth * 0.12);
    const logoRatio = logo.width / logo.height;
    const logoHeight = Math.round(logoWidth / logoRatio);
    logo.resize({ w: logoWidth, h: logoHeight });

    // Position: bottom right corner with padding
    const padding = 15;
    const x = imageWidth - logoWidth - padding;
    const y = imageHeight - logoHeight - padding;

    // Composite the logo onto the image
    image.composite(logo, Math.max(0, x), Math.max(0, y));

    // Export as JPEG base64
    const outputBuffer = await image.getBuffer('image/jpeg', { quality: 90 });
    return outputBuffer.toString('base64');
  } catch (error) {
    console.log('⚠️ Error adding watermark:', error);
    return imageBase64; // Return original if watermarking fails
  }
}

// Search for real product images online
async function searchRealProductImage(productName: string, brand?: string): Promise<string | null> {
  if (!process.env.BRAVE_SEARCH_API_KEY) return null;

  try {
    // Clean product name for image search
    const cleanName = productName
      .replace(/\d+\s*(kg|g|ml|l|cl|pz|conf|x\d+)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const searchQuery = `${cleanName} ${brand || ''} prodotto immagine`.trim();

    // Use Brave Image Search
    const searchUrl = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(searchQuery)}&count=5&safesearch=strict`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
      }
    });

    if (!response.ok) {
      console.log('⚠️ Image search API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Filter for high quality images from reliable sources
      const goodSources = ['coop.ch', 'migros.ch', 'amazon', 'galbani', 'barilla', 'mutti',
                          'wikipedia', '.it/', '.com/', 'produttore', 'ufficiale'];

      for (const result of data.results) {
        const imageUrl = result.thumbnail?.src || result.properties?.url;
        if (!imageUrl) continue;

        // Prefer images from known good sources
        const isGoodSource = goodSources.some(s =>
          (result.url || '').toLowerCase().includes(s) ||
          (imageUrl || '').toLowerCase().includes(s)
        );

        // Check image dimensions if available (prefer larger images)
        const width = result.properties?.width || result.width || 0;
        const height = result.properties?.height || result.height || 0;

        if ((isGoodSource || (width >= 200 && height >= 200)) && imageUrl) {
          console.log(`✅ Found real product image from: ${result.url?.substring(0, 50)}...`);

          // Download and convert to base64
          try {
            const imageResponse = await fetch(imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              const base64 = Buffer.from(imageBuffer).toString('base64');

              // Validate it's a proper image (at least 5KB)
              if (base64.length > 6000) {
                console.log(`✅ Downloaded image: ${Math.round(base64.length * 0.75 / 1024)}KB`);
                return base64;
              }
            }
          } catch (downloadError) {
            console.log('⚠️ Could not download image:', downloadError);
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.log('⚠️ Image search failed:', error);
    return null;
  }
}

// Search for related products in Odoo (for upselling/cross-selling)
// NOTE: accessory_product_ids uses product.product IDs (variants)
// alternative_product_ids and optional_product_ids use product.template IDs
async function findRelatedProducts(
  sessionId: string,
  odooUrl: string,
  productName: string,
  categoryId?: number,
  excludeProductId?: number
): Promise<{
  accessory: number[];      // product.product IDs (for accessory_product_ids)
  alternative: number[];    // product.template IDs (for alternative_product_ids)
  optional: number[];       // product.template IDs (for optional_product_ids)
}> {
  const result = { accessory: [] as number[], alternative: [] as number[], optional: [] as number[] };

  try {
    // Extract keywords from product name
    const keywords = productName
      .toLowerCase()
      .replace(/\d+\s*(kg|g|ml|l|cl|pz|conf|x\d+)/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['della', 'dello', 'delle', 'degli', 'con', 'per', 'alla', 'alle'].includes(w));

    if (keywords.length === 0) return result;

    // Search for products with similar name (potential alternatives)
    const searchKeyword = keywords[0]; // Use first keyword

    // Search product.template for alternatives and optional (these fields use template IDs)
    const templateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.template',
          method: 'search_read',
          args: [
            [['name', 'ilike', searchKeyword], ['sale_ok', '=', true]],
            ['id', 'name', 'categ_id']
          ],
          kwargs: { limit: 10 }
        },
        id: Math.floor(Math.random() * 1000000000)
      })
    });

    const templateData = await templateResponse.json();

    if (templateData.result && templateData.result.length > 0) {
      for (const p of templateData.result) {
        if (excludeProductId && p.id === excludeProductId) continue;

        const pCategId = p.categ_id?.[0];

        if (pCategId === categoryId) {
          // Same category = alternative product (template ID)
          if (result.alternative.length < 4) {
            result.alternative.push(p.id);
          }
        }
      }
    }

    // Search product.product for accessories (this field uses variant IDs)
    const variantResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_read',
          args: [
            [['name', 'ilike', searchKeyword], ['sale_ok', '=', true]],
            ['id', 'name', 'categ_id']
          ],
          kwargs: { limit: 10 }
        },
        id: Math.floor(Math.random() * 1000000000)
      })
    });

    const variantData = await variantResponse.json();

    if (variantData.result && variantData.result.length > 0) {
      for (const p of variantData.result) {
        const pCategId = p.categ_id?.[0];

        // Different category = accessory product (variant ID)
        if (pCategId !== categoryId) {
          if (result.accessory.length < 4) {
            result.accessory.push(p.id);
          }
        }
      }
    }

    // Search for complementary products based on food pairings
    const complementaryKeywords = getComplementaryKeywords(productName);
    if (complementaryKeywords.length > 0) {
      for (const keyword of complementaryKeywords.slice(0, 2)) {
        const complementaryResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'product.template',
              method: 'search_read',
              args: [
                [['name', 'ilike', keyword], ['sale_ok', '=', true]],
                ['id', 'name']
              ],
              kwargs: { limit: 3 }
            },
            id: Math.floor(Math.random() * 1000000000)
          })
        });

        const complementaryData = await complementaryResponse.json();
        if (complementaryData.result) {
          for (const p of complementaryData.result) {
            if (excludeProductId && p.id === excludeProductId) continue;
            if (!result.optional.includes(p.id) && result.optional.length < 4) {
              result.optional.push(p.id);
            }
          }
        }
      }
    }

  } catch (error) {
    console.log('⚠️ Error finding related products:', error);
  }

  return result;
}

// Get complementary product keywords based on food type
function getComplementaryKeywords(productName: string): string[] {
  const nameLower = productName.toLowerCase();

  // Food pairing rules
  if (nameLower.includes('mozzarella') || nameLower.includes('formaggio')) {
    return ['pomodoro', 'basilico', 'prosciutto', 'pasta'];
  }
  if (nameLower.includes('pasta') || nameLower.includes('spaghetti')) {
    return ['pomodoro', 'olio', 'parmigiano', 'basilico'];
  }
  if (nameLower.includes('pomodoro') || nameLower.includes('pelati')) {
    return ['pasta', 'basilico', 'olio', 'mozzarella'];
  }
  if (nameLower.includes('prosciutto') || nameLower.includes('salame')) {
    return ['formaggio', 'pane', 'melone', 'grissini'];
  }
  if (nameLower.includes('caffè') || nameLower.includes('coffee')) {
    return ['zucchero', 'latte', 'biscotti'];
  }
  if (nameLower.includes('olio')) {
    return ['aceto', 'sale', 'pepe', 'pane'];
  }
  if (nameLower.includes('farina') || nameLower.includes('flour')) {
    return ['lievito', 'zucchero', 'uova', 'burro'];
  }

  return [];
}

// Generate usage image prompts based on product type - with LAPA logo instruction
function getUsageImagePrompts(productName: string, category?: string): string[] {
  const nameLower = productName.toLowerCase();

  // Determine product type and generate appropriate usage scenarios
  const prompts: string[] = [];

  // Note: LAPA logo watermark will be added programmatically after image generation
  const suffix = ', professional food photography, high quality, vibrant colors';

  // CHEESE - Different scenarios based on cheese type
  if (nameLower.includes('mozzarella') || nameLower.includes('fior di latte') || nameLower.includes('burrata')) {
    // Mozzarella type - perfect for pizza
    prompts.push(`Delicious pizza margherita fresh from the oven with melted mozzarella, stretchy cheese pull, appetizing, restaurant quality${suffix}`);
    prompts.push(`Fresh caprese salad with sliced mozzarella, ripe tomatoes and fresh basil, drizzled with olive oil, elegant plating${suffix}`);
  }
  else if (nameLower.includes('bel paese') || nameLower.includes('belpaese') || nameLower.includes('taleggio') || nameLower.includes('fontina') || nameLower.includes('asiago')) {
    // Semi-soft cheeses - best on cheese board/tagliere
    prompts.push(`Elegant Italian cheese board with ${productName} as centerpiece, accompanied by grapes, walnuts, honey and crackers, rustic wooden cutting board${suffix}`);
    prompts.push(`Gourmet cheese platter featuring ${productName} sliced beautifully, with figs, prosciutto and artisan bread, wine pairing setting${suffix}`);
  }
  else if (nameLower.includes('parmigiano') || nameLower.includes('grana') || nameLower.includes('pecorino')) {
    // Hard aged cheeses - grating or chunks
    prompts.push(`Fresh pasta being topped with freshly grated ${productName}, cheese shavings falling, steam rising, restaurant kitchen setting${suffix}`);
    prompts.push(`Chunks of aged ${productName} on rustic wooden board with honey dripper and balsamic vinegar, antipasto style${suffix}`);
  }
  else if (nameLower.includes('gorgonzola') || nameLower.includes('roquefort')) {
    // Blue cheeses
    prompts.push(`Creamy risotto with melted ${productName} and toasted walnuts, elegant restaurant presentation${suffix}`);
    prompts.push(`${productName} served with fresh pears and honey on elegant slate board, gourmet pairing${suffix}`);
  }
  else if (nameLower.includes('formaggio') || nameLower.includes('cheese')) {
    // Generic cheese - cheese board
    prompts.push(`Beautiful Italian cheese board with ${productName}, assorted crackers, grapes and dried fruits, rustic presentation${suffix}`);
    prompts.push(`Professional chef preparing a dish with ${productName}, kitchen setting, culinary scene${suffix}`);
  }
  // PASTA products
  else if (nameLower.includes('pasta') || nameLower.includes('spaghetti') || nameLower.includes('penne') || nameLower.includes('fusilli') || nameLower.includes('rigatoni')) {
    prompts.push(`Beautiful plate of ${productName} with rich tomato sauce and fresh basil, parmesan shavings, restaurant presentation${suffix}`);
    prompts.push(`${productName} being tossed by chef in pan with olive oil and garlic, action shot, professional kitchen${suffix}`);
  }
  // TOMATO products
  else if (nameLower.includes('pomodor') || nameLower.includes('tomato') || nameLower.includes('pelati') || nameLower.includes('passata')) {
    prompts.push(`Fresh Italian pasta with rich tomato sauce, steam rising, garnished with fresh basil${suffix}`);
    prompts.push(`Bruschetta with fresh tomatoes on crusty bread, olive oil drizzle, appetizer presentation${suffix}`);
  }
  // OIL products
  else if (nameLower.includes('olio') || nameLower.includes('oil')) {
    prompts.push(`Fresh Mediterranean salad being drizzled with premium olive oil, healthy presentation${suffix}`);
    prompts.push(`Bruschetta with tomatoes and olive oil drizzle, Italian appetizer, elegant styling${suffix}`);
  }
  // MEAT/SALUMI products
  else if (nameLower.includes('prosciutto')) {
    prompts.push(`Elegant antipasto platter with thin slices of ${productName}, melon, and grissini, Italian appetizer${suffix}`);
    prompts.push(`${productName} draped over fresh cantaloupe melon, classic Italian pairing, summer appetizer${suffix}`);
  }
  else if (nameLower.includes('salame') || nameLower.includes('salami')) {
    prompts.push(`Italian charcuterie board with sliced ${productName}, olives, pickles and crusty bread${suffix}`);
    prompts.push(`Gourmet pizza with ${productName} slices, fresh from wood-fired oven${suffix}`);
  }
  else if (nameLower.includes('mortadella')) {
    prompts.push(`Classic Italian sandwich with thick slices of ${productName}, pistachio visible, on fresh focaccia${suffix}`);
    prompts.push(`Aperitivo platter featuring cubed ${productName} with cocktail picks, olives and cheese${suffix}`);
  }
  else if (nameLower.includes('speck') || nameLower.includes('bresaola')) {
    prompts.push(`Elegant carpaccio style presentation of ${productName} with arugula, parmesan shavings and lemon${suffix}`);
    prompts.push(`${productName} wrapped around grissini breadsticks, aperitivo presentation${suffix}`);
  }
  // COFFEE products
  else if (nameLower.includes('caffè') || nameLower.includes('coffee') || nameLower.includes('espresso')) {
    prompts.push(`Perfect espresso shot with golden crema, professional barista style, Italian coffee bar atmosphere${suffix}`);
    prompts.push(`Cappuccino with beautiful latte art being served, warm morning ambiance${suffix}`);
  }
  // FLOUR products
  else if (nameLower.includes('farina') || nameLower.includes('flour')) {
    prompts.push(`Fresh homemade bread loaves just baked, golden crust, artisan bakery style, rustic presentation${suffix}`);
    prompts.push(`Pizza dough being stretched by professional pizzaiolo, flour dusted hands, authentic Italian${suffix}`);
  }
  // Default food product
  else if (category?.toLowerCase().includes('frigo') || category?.toLowerCase().includes('secco')) {
    prompts.push(`Professional chef cooking with ${productName} in restaurant kitchen, action shot${suffix}`);
    prompts.push(`Delicious dish prepared with ${productName}, elegant plating${suffix}`);
  }

  return prompts;
}

// Extract brand from product name
function extractBrandFromName(productName: string): string | undefined {
  if (!productName) return undefined;

  const nameLower = productName.toLowerCase();

  const knownBrands = [
    'galbani', 'barilla', 'mutti', 'de cecco', 'garofalo', 'divella', 'colavita',
    'cirio', 'star', 'knorr', 'findus', 'orogel', 'ferrero', 'lavazza', 'illy',
    'segafredo', 'granarolo', 'parmalat', 'vallelata', 'beretta', 'rovagnati',
    'fiorucci', 'negroni', 'parmacotto', 'citterio', 'ferrarini', 'coca cola',
    'pepsi', 'nestle', 'kraft', 'heinz', 'bonduelle', 'rio mare', 'simmenthal',
    'montana', 'santal', 'yoga', 'develey', 'calvé', 'hellmann', 'nutella',
    'mulino bianco', 'pan di stelle', 'plasmon', 'mellin', 'santa lucia',
    'nonno nanni', 'certosa', 'bel paese', 'belpaese', 'philadelphia'
  ];

  for (const brand of knownBrands) {
    if (nameLower.includes(brand)) {
      return brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return undefined;
}

interface ProductData {
  nome?: string;
  nome_completo: string;
  nome_fornitore?: string;
  descrizione_breve?: string;
  descrizione_dettagliata?: string;
  categoria?: string;
  categoria_odoo_id?: number;
  categoria_nome?: string;
  sottocategoria?: string;
  marca?: string;
  codice_ean?: string;
  codice_sa?: string;
  prezzo_acquisto?: number;
  prezzo_vendita_suggerito?: number;
  unita_misura?: string;
  uom_odoo_id?: number;
  uom_nome?: string;
  peso?: number;
  dimensioni?: string;
  caratteristiche?: string[];
  tags?: string[];
  fornitore_odoo_id?: number | null;
  immagine_search_query?: string;
  shelf_life_days?: number | null;
  expiry_warning_days?: number | null;
  removal_days?: number | null;
  // SEO fields
  seo_name?: string;
  website_meta_title?: string;
  website_meta_description?: string;
  // Multilingual descriptions
  descrizioni_multilingua?: {
    it_IT?: string;
    de_CH?: string;
    fr_CH?: string;
    en_US?: string;
    ro_RO?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { products } = await request.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessun prodotto fornito' },
        { status: 400 }
      );
    }

    // Ottieni session_id utente
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    console.log(`📦 Creating ${products.length} products in Odoo...`);

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

    // STEP 2: Create products one by one
    const results = [];
    const errors = [];

    for (const product of products as ProductData[]) {
      try {
        console.log(`📝 Creating product: ${product.nome_completo}`);

        // Prepare product data for Odoo
        const odooProduct: any = {
          name: product.nome_completo || product.nome || 'Prodotto senza nome',
          type: 'product', // Prodotto immagazzinabile
          categ_id: product.categoria_odoo_id || 1, // Use AI-selected category or default (1 = "All")
          sale_ok: true,
          purchase_ok: true,
          // Tag "Prodotto inserito da IA" (ID 306)
          product_tag_ids: [[6, 0, [306]]],
          // Pubblica automaticamente sul sito web
          is_published: true,
        };

        // Add optional fields only if they exist and are valid
        if (product.descrizione_dettagliata) {
          odooProduct.description = product.descrizione_dettagliata;
        }

        if (product.descrizione_breve) {
          odooProduct.description_sale = product.descrizione_breve;
        }

        if (product.codice_ean) {
          odooProduct.barcode = product.codice_ean;
          odooProduct.default_code = product.codice_ean; // Internal reference
        }

        // Use AI-selected unit of measure (default to ID 1 if not provided)
        if (product.uom_odoo_id && product.uom_odoo_id > 0) {
          odooProduct.uom_id = product.uom_odoo_id; // Unit of measure for sales
          odooProduct.uom_po_id = product.uom_odoo_id; // Unit of measure for purchase
        }

        if (product.prezzo_vendita_suggerito && product.prezzo_vendita_suggerito > 0) {
          odooProduct.list_price = product.prezzo_vendita_suggerito; // Sales price
        }

        if (product.prezzo_acquisto && product.prezzo_acquisto > 0) {
          odooProduct.standard_price = product.prezzo_acquisto; // Cost price
        }

        if (product.peso && product.peso > 0) {
          odooProduct.weight = product.peso;
        }

        // Add SA fiscal code
        if (product.codice_sa) {
          odooProduct.hs_code = product.codice_sa; // Harmonized System Code
        }

        // SEO fields
        if (product.seo_name) {
          odooProduct.seo_name = product.seo_name;
        }
        if (product.website_meta_title) {
          odooProduct.website_meta_title = product.website_meta_title;
        }
        if (product.website_meta_description) {
          odooProduct.website_meta_description = product.website_meta_description;
        }

        // TRACCIABILITÀ: Attiva sempre con data scadenza se shelf_life_days è specificato
        if (product.shelf_life_days && product.shelf_life_days > 0) {
          odooProduct.tracking = 'lot'; // Tracciabilità per lotti
          odooProduct.use_expiration_date = true; // Data scadenza

          // Imposta i giorni di shelf life
          odooProduct.expiration_time = product.shelf_life_days;

          // Giorni di avviso prima della scadenza (default: 5)
          if (product.expiry_warning_days && product.expiry_warning_days > 0) {
            odooProduct.alert_time = product.expiry_warning_days;
          }

          // Giorni prima della scadenza per rimozione (default: 1)
          if (product.removal_days && product.removal_days > 0) {
            odooProduct.removal_time = product.removal_days;
          }

          console.log(`   📅 Tracciabilità attivata - Shelf life: ${product.shelf_life_days} giorni, Avviso: ${product.expiry_warning_days || 5} giorni, Rimozione: ${product.removal_days || 1} giorni`);
        }

        // IVA: Get tax IDs for customer and supplier
        try {
          // IVA Cliente: 8.1% per food, 22% per non-food
          const isNonFood = product.categoria_nome?.toLowerCase().includes('non-food') ||
                           product.categoria_nome?.toLowerCase().includes('pulizia') ||
                           product.categoria_nome?.toLowerCase().includes('carta');

          const taxRate = isNonFood ? 22 : 8.1;

          const taxSaleResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `session_id=${sessionId}`
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'account.tax',
                method: 'search_read',
                args: [[['amount', '=', taxRate], ['type_tax_use', '=', 'sale']], ['id']],
                kwargs: { limit: 1 }
              },
              id: Math.floor(Math.random() * 1000000000)
            })
          });
          const taxSaleData = await taxSaleResponse.json();

          if (taxSaleData.result && taxSaleData.result.length > 0) {
            odooProduct.taxes_id = [[6, 0, [taxSaleData.result[0].id]]];
            console.log(`   💰 IVA Cliente ${taxRate}% impostata`);
          }

          // IVA Fornitore: 0% import (per fornitori esteri) o 8.1% (per fornitori italiani)
          // Default: 0% import per sicurezza
          const taxPurchaseResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `session_id=${sessionId}`
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'account.tax',
                method: 'search_read',
                args: [[['amount', '=', 0], ['type_tax_use', '=', 'purchase']], ['id']],
                kwargs: { limit: 1 }
              },
              id: Math.floor(Math.random() * 1000000000)
            })
          });
          const taxPurchaseData = await taxPurchaseResponse.json();

          if (taxPurchaseData.result && taxPurchaseData.result.length > 0) {
            odooProduct.supplier_taxes_id = [[6, 0, [taxPurchaseData.result[0].id]]];
            console.log(`   💰 IVA Fornitore 0% import impostata`);
          }
        } catch (taxError) {
          console.warn('⚠️  Errore impostazione IVA:', taxError);
        }

        // Add caratteristiche to description (HTML format)
        if (product.caratteristiche && product.caratteristiche.length > 0) {
          const caratteristicheHtml = `<h3>Caratteristiche</h3><ul>${product.caratteristiche.map(c => `<li>${c}</li>`).join('')}</ul>`;
          // Append to existing description or create new
          if (odooProduct.description) {
            odooProduct.description += '\n' + caratteristicheHtml;
          } else {
            odooProduct.description = caratteristicheHtml;
          }
        }

        // Add dimensions to description_purchase (notes for purchasing)
        let purchaseNotes = [];
        if (product.dimensioni) {
          purchaseNotes.push(`Dimensioni: ${product.dimensioni}`);
        }
        if (purchaseNotes.length > 0) {
          odooProduct.description_purchase = purchaseNotes.join('\n');
        }

        // Add description for picking (ordine fai da te / documento di consegna)
        // This shows on delivery orders and customer-facing documents
        if (product.descrizione_breve || product.nome_completo) {
          odooProduct.description_pickingout = product.descrizione_breve || `Prodotto: ${product.nome_completo}`;
          odooProduct.description_pickingin = product.descrizione_breve || `Prodotto: ${product.nome_completo}`;
        }

        // Create product in Odoo
        const createResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'product.product',
              method: 'create',
              args: [odooProduct],
              kwargs: {},
              context: {}
            },
            id: Math.floor(Math.random() * 1000000000)
          })
        });

        const createData = await createResponse.json();

        if (createData.error) {
          console.error('❌ Error creating product:', product.nome_completo);
          console.error('Full Odoo error:', JSON.stringify(createData.error, null, 2));

          // Extract detailed error message
          const errorMsg = createData.error.data?.message ||
                          createData.error.message ||
                          JSON.stringify(createData.error);

          errors.push({
            product: product.nome_completo,
            error: errorMsg
          });
        } else {
          const productId = createData.result;
          console.log('✅ Product created:', product.nome_completo, 'ID:', productId);

          // STEP 2.5: Get product template ID from product variant
          let productTemplateId = null;
          try {
            const templateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': `session_id=${sessionId}`
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: {
                  model: 'product.product',
                  method: 'read',
                  args: [[productId], ['product_tmpl_id']],
                  kwargs: {}
                },
                id: Math.floor(Math.random() * 1000000000)
              })
            });
            const templateData = await templateResponse.json();
            if (templateData.result && templateData.result[0]) {
              productTemplateId = templateData.result[0].product_tmpl_id[0];
              console.log(`   📦 Product Template ID: ${productTemplateId}`);
            }
          } catch (tmplError) {
            console.warn('⚠️  Could not get product template ID:', tmplError);
          }

          // STEP 2.6: Add Brand attribute if marca is specified
          let brandAdded = false;
          if (product.marca && productTemplateId) {
            try {
              console.log(`🏷️ Adding brand: ${product.marca}`);

              // Brand attribute ID is 1 in Odoo
              const BRAND_ATTRIBUTE_ID = 1;

              // Search for existing brand value
              const brandSearchResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    model: 'product.attribute.value',
                    method: 'search_read',
                    args: [[
                      ['attribute_id', '=', BRAND_ATTRIBUTE_ID],
                      ['name', '=ilike', product.marca]
                    ], ['id', 'name']],
                    kwargs: { limit: 1 }
                  },
                  id: Math.floor(Math.random() * 1000000000)
                })
              });
              const brandSearchData = await brandSearchResponse.json();

              let brandValueId = null;

              if (brandSearchData.result && brandSearchData.result.length > 0) {
                // Brand exists
                brandValueId = brandSearchData.result[0].id;
                console.log(`   ✅ Brand found: ${brandSearchData.result[0].name} (ID: ${brandValueId})`);
              } else {
                // Create new brand value
                console.log(`   🆕 Creating new brand: ${product.marca}`);
                const createBrandResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      model: 'product.attribute.value',
                      method: 'create',
                      args: [{
                        attribute_id: BRAND_ATTRIBUTE_ID,
                        name: product.marca
                      }],
                      kwargs: {}
                    },
                    id: Math.floor(Math.random() * 1000000000)
                  })
                });
                const createBrandData = await createBrandResponse.json();

                if (createBrandData.result) {
                  brandValueId = createBrandData.result;
                  console.log(`   ✅ Brand created with ID: ${brandValueId}`);
                } else {
                  console.error('   ❌ Error creating brand:', createBrandData.error);
                }
              }

              // Create attribute line to associate brand with product template
              if (brandValueId) {
                const attrLineResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      model: 'product.template.attribute.line',
                      method: 'create',
                      args: [{
                        product_tmpl_id: productTemplateId,
                        attribute_id: BRAND_ATTRIBUTE_ID,
                        value_ids: [[6, 0, [brandValueId]]] // Many2many set
                      }],
                      kwargs: {}
                    },
                    id: Math.floor(Math.random() * 1000000000)
                  })
                });
                const attrLineData = await attrLineResponse.json();

                if (attrLineData.result) {
                  console.log(`   ✅ Brand attribute line created: ${attrLineData.result}`);
                  brandAdded = true;
                } else {
                  console.error('   ❌ Error creating attribute line:', attrLineData.error);
                }
              }
            } catch (brandError: any) {
              console.error('⚠️  Exception adding brand:', brandError.message || brandError);
            }
          }

          // STEP 3: Create supplier price list if supplier is available
          if (product.fornitore_odoo_id && product.prezzo_acquisto) {
            try {
              console.log(`💰 Creating supplier price for product ${productId} with supplier ${product.fornitore_odoo_id}`);

              // Get EUR currency ID
              const eurResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    model: 'res.currency',
                    method: 'search_read',
                    args: [[['name', '=', 'EUR']], ['id']],
                    kwargs: { limit: 1 }
                  },
                  id: Math.floor(Math.random() * 1000000000)
                })
              });
              const eurData = await eurResponse.json();
              const eurId = eurData.result?.[0]?.id || 3; // Default EUR ID

              const priceListData: any = {
                partner_id: product.fornitore_odoo_id,
                product_id: productId,
                price: product.prezzo_acquisto,
                min_qty: 1,
                currency_id: eurId, // SEMPRE EUR
              };

              // Add supplier product name (PULITO) and code from invoice
              if (product.nome_fornitore || product.nome || product.nome_completo) {
                priceListData.product_name = product.nome_fornitore || product.nome || product.nome_completo;
              }
              if (product.codice_ean) {
                priceListData.product_code = product.codice_ean;
              }

              const priceResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                  'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    model: 'product.supplierinfo',
                    method: 'create',
                    args: [priceListData],
                    kwargs: {},
                  },
                  id: Math.floor(Math.random() * 1000000000)
                })
              });

              const priceData = await priceResponse.json();

              if (priceData.error) {
                console.error('⚠️ Error creating supplier price:', priceData.error);
              } else {
                console.log('✅ Supplier price created with ID:', priceData.result);
              }
            } catch (priceError) {
              console.error('⚠️ Exception creating supplier price:', priceError);
            }
          }

          // STEP 4: Get product image - FIRST try real image from web, THEN fallback to Gemini AI
          let imageGenerated = false;
          let imageSource = '';
          if (product.nome_completo) {
            try {
              let imageBase64: string | null = null;

              // Try to find real product image first
              console.log(`🔍 Searching for real product image online...`);
              const possibleBrand = product.marca || extractBrandFromName(product.nome_completo);

              imageBase64 = await searchRealProductImage(product.nome_completo, possibleBrand);

              if (imageBase64) {
                imageSource = 'web_search';
                console.log(`✅ Found real product image from web`);
              } else {
                // Fallback: Generate with Gemini AI
                console.log(`🎨 No real image found, generating with Gemini AI...`);

                // Initialize Gemini AI
                const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';
                if (!API_KEY) {
                  console.error('❌ GEMINI_API_KEY not configured!');
                  throw new Error('Gemini API key not configured');
                }

                const genAI = new GoogleGenerativeAI(API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

                // Create product photography prompt
                const imagePrompt = `Professional product photography of ${product.nome_completo}. ${product.descrizione_breve || ''}. Clean white background, e-commerce style, well-lit, centered, high quality, studio lighting, detailed, sharp focus, commercial photo.`;

                console.log('📝 Prompt:', imagePrompt.substring(0, 100) + '...');
                console.log('⏳ Generating image (this may take 30-40 seconds)...');

                const startTime = Date.now();
                const result = await model.generateContent(imagePrompt);
                const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

                console.log(`✅ Gemini responded in ${elapsedTime}s`);

                const response = result.response;

                if (!response || !response.candidates || response.candidates.length === 0) {
                  console.error('❌ No image generated by Gemini');
                  throw new Error('No image generated');
                }

                // Extract image data
                const candidate = response.candidates[0];
                const parts = candidate.content?.parts || [];

                for (const part of parts) {
                  if (part.inlineData && part.inlineData.data) {
                    imageBase64 = part.inlineData.data;
                    imageSource = 'gemini_ai';
                    break;
                  }
                }

                if (!imageBase64) {
                  console.error('❌ No image data in Gemini response');
                  throw new Error('No image data found');
                }

                console.log('✅ Image generated:', Math.round(imageBase64.length * 0.75 / 1024), 'KB');
              }

              // Upload image to Odoo product
              if (imageBase64) {
                console.log(`📤 Uploading image to Odoo product ${productId} (source: ${imageSource})`);

                const updateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      model: 'product.product',
                      method: 'write',
                      args: [
                        [productId],
                        { image_1920: imageBase64 }
                      ],
                      kwargs: {},
                    },
                    id: Math.floor(Math.random() * 1000000000)
                  })
                });

                const updateData = await updateResponse.json();

                if (updateData.error) {
                  console.error('⚠️ Error uploading image to Odoo:', updateData.error);
                } else {
                  console.log('✅ Image uploaded to Odoo successfully!');
                  imageGenerated = true;
                }
              }

            } catch (imageError: any) {
              console.error('⚠️ Exception getting/uploading image:', imageError.message || imageError);
            }
          }

          // STEP 5: Add multilingual descriptions (write to each language context)
          let translationsAdded = false;
          if (product.descrizioni_multilingua && productTemplateId) {
            try {
              console.log(`🌐 Adding multilingual descriptions for product template ${productTemplateId}`);

              const languages = [
                { code: 'it_IT', desc: product.descrizioni_multilingua.it_IT },
                { code: 'de_CH', desc: product.descrizioni_multilingua.de_CH },
                { code: 'fr_CH', desc: product.descrizioni_multilingua.fr_CH },
                { code: 'en_US', desc: product.descrizioni_multilingua.en_US },
                { code: 'ro_RO', desc: product.descrizioni_multilingua.ro_RO },
              ];

              for (const lang of languages) {
                if (lang.desc) {
                  try {
                    const transResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `session_id=${sessionId}`
                      },
                      body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: {
                          model: 'product.template',
                          method: 'write',
                          args: [
                            [productTemplateId],
                            { description_sale: lang.desc }
                          ],
                          kwargs: { context: { lang: lang.code } }
                        },
                        id: Math.floor(Math.random() * 1000000000)
                      })
                    });
                    const transData = await transResponse.json();
                    if (transData.error) {
                      console.warn(`   ⚠️ Error setting ${lang.code} description:`, transData.error.message || transData.error);
                    } else {
                      console.log(`   ✅ ${lang.code} description set`);
                      translationsAdded = true;
                    }
                  } catch (langError: any) {
                    console.warn(`   ⚠️ Exception setting ${lang.code}:`, langError.message);
                  }
                }
              }
            } catch (transError: any) {
              console.error('⚠️ Exception adding translations:', transError.message || transError);
            }
          }

          // STEP 6: Find and link related products (upselling/cross-selling/alternatives)
          let relatedProductsAdded = { accessory: 0, alternative: 0, optional: 0 };
          if (product.nome_completo && productTemplateId) {
            try {
              console.log(`🔗 Searching for related products...`);

              const relatedProducts = await findRelatedProducts(
                sessionId,
                odooUrl,
                product.nome_completo,
                product.categoria_odoo_id,
                productTemplateId
              );

              // Link accessory products (cross-selling)
              if (relatedProducts.accessory.length > 0) {
                const accessoryResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      model: 'product.template',
                      method: 'write',
                      args: [
                        [productTemplateId],
                        { accessory_product_ids: [[6, 0, relatedProducts.accessory]] }
                      ],
                      kwargs: {}
                    },
                    id: Math.floor(Math.random() * 1000000000)
                  })
                });
                const accessoryData = await accessoryResponse.json();
                if (accessoryData.result) {
                  relatedProductsAdded.accessory = relatedProducts.accessory.length;
                  console.log(`   ✅ Added ${relatedProducts.accessory.length} accessory products (cross-selling)`);
                }
              }

              // Link alternative products
              if (relatedProducts.alternative.length > 0) {
                const alternativeResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      model: 'product.template',
                      method: 'write',
                      args: [
                        [productTemplateId],
                        { alternative_product_ids: [[6, 0, relatedProducts.alternative]] }
                      ],
                      kwargs: {}
                    },
                    id: Math.floor(Math.random() * 1000000000)
                  })
                });
                const alternativeData = await alternativeResponse.json();
                if (alternativeData.result) {
                  relatedProductsAdded.alternative = relatedProducts.alternative.length;
                  console.log(`   ✅ Added ${relatedProducts.alternative.length} alternative products`);
                }
              }

              // Link optional products (upselling)
              if (relatedProducts.optional.length > 0) {
                const optionalResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      model: 'product.template',
                      method: 'write',
                      args: [
                        [productTemplateId],
                        { optional_product_ids: [[6, 0, relatedProducts.optional]] }
                      ],
                      kwargs: {}
                    },
                    id: Math.floor(Math.random() * 1000000000)
                  })
                });
                const optionalData = await optionalResponse.json();
                if (optionalData.result) {
                  relatedProductsAdded.optional = relatedProducts.optional.length;
                  console.log(`   ✅ Added ${relatedProducts.optional.length} optional products (upselling)`);
                }
              }

            } catch (relatedError: any) {
              console.warn('⚠️ Error linking related products:', relatedError.message || relatedError);
            }
          }

          // STEP 7: Generate extra images showing product in use (e.g., pizza with mozzarella)
          let extraImagesAdded = 0;
          if (product.nome_completo && productTemplateId) {
            try {
              const usagePrompts = getUsageImagePrompts(product.nome_completo, product.categoria_nome);

              if (usagePrompts.length > 0) {
                console.log(`🖼️ Generating ${usagePrompts.length} extra usage images for product...`);

                const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';
                if (API_KEY) {
                  const genAI = new GoogleGenerativeAI(API_KEY);
                  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

                  // Generate up to 2 usage images
                  for (let i = 0; i < Math.min(usagePrompts.length, 2); i++) {
                    try {
                      console.log(`   🎨 Generating usage image ${i + 1}: ${usagePrompts[i].substring(0, 50)}...`);

                      const result = await model.generateContent(usagePrompts[i]);
                      const response = result.response;

                      if (response?.candidates?.[0]?.content?.parts) {
                        for (const part of response.candidates[0].content.parts) {
                          if (part.inlineData?.data) {
                            // Add LAPA logo watermark to the image
                            console.log(`   🏷️ Adding LAPA watermark...`);
                            const watermarkedImage = await addLogoWatermark(part.inlineData.data);

                            // Upload extra image to Odoo product.image model
                            const extraImageResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Cookie': `session_id=${sessionId}`
                              },
                              body: JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'call',
                                params: {
                                  model: 'product.image',
                                  method: 'create',
                                  args: [{
                                    product_tmpl_id: productTemplateId,
                                    name: `${product.nome_completo} - Utilizzo ${i + 1}`,
                                    image_1920: watermarkedImage
                                  }],
                                  kwargs: {}
                                },
                                id: Math.floor(Math.random() * 1000000000)
                              })
                            });

                            const extraImageData = await extraImageResponse.json();
                            if (extraImageData.result) {
                              console.log(`   ✅ Extra image ${i + 1} uploaded with LAPA logo (ID: ${extraImageData.result})`);
                              extraImagesAdded++;
                            } else if (extraImageData.error) {
                              console.warn(`   ⚠️ Error uploading extra image:`, extraImageData.error.message || extraImageData.error);
                            }
                            break;
                          }
                        }
                      }
                    } catch (imgError: any) {
                      console.warn(`   ⚠️ Error generating extra image ${i + 1}:`, imgError.message);
                    }
                  }
                }
              }
            } catch (extraImgError: any) {
              console.error('⚠️ Exception generating extra images:', extraImgError.message || extraImgError);
            }
          }

          results.push({
            product: product.nome_completo,
            odoo_id: productId,
            success: true,
            supplier_price_created: !!product.fornitore_odoo_id,
            brand_added: brandAdded,
            image_generated: imageGenerated,
            image_source: imageSource || null, // 'web_search' or 'gemini_ai'
            extra_images_added: extraImagesAdded,
            translations_added: translationsAdded,
            related_products: {
              accessory: relatedProductsAdded.accessory,
              alternative: relatedProductsAdded.alternative,
              optional: relatedProductsAdded.optional
            }
          });
        }

      } catch (error: any) {
        console.error('❌ Exception creating product:', product.nome_completo, error);
        errors.push({
          product: product.nome_completo,
          error: error.message || 'Errore sconosciuto'
        });
      }
    }

    // Return summary
    console.log(`✅ Created ${results.length}/${products.length} products successfully`);

    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} errors occurred:`, errors);
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: products.length,
        created: results.length,
        failed: errors.length
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ General error creating products:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la creazione dei prodotti'
      },
      { status: 500 }
    );
  }
}
