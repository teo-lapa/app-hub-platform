import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// RAG: Search web for product information
async function searchProductInfo(productName: string, brand?: string): Promise<string> {
  try {
    // Clean product name for better search
    const cleanName = productName
      .replace(/\d+\s*(kg|g|ml|l|cl|pz|conf|x\d+)/gi, '') // Remove quantities
      .replace(/\s+/g, ' ')
      .trim();

    // Build search queries
    const queries = [
      `${cleanName} ${brand || ''} scheda tecnica ingredienti`.trim(),
      `${cleanName} ${brand || ''} prodotto alimentare caratteristiche`.trim(),
    ];

    let allResults: string[] = [];

    for (const query of queries) {
      try {
        // Use Brave Search API if available
        if (process.env.BRAVE_SEARCH_API_KEY) {
          const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'Accept': 'application/json',
              'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
            }
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.web?.results) {
              for (const result of searchData.web.results.slice(0, 3)) {
                allResults.push(`📄 ${result.title}\n${result.description}\nURL: ${result.url}`);
              }
            }
          }
        }

        // Fallback: Use Google Custom Search if available
        if (allResults.length === 0 && process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
          const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}&num=3`;
          const googleResponse = await fetch(googleUrl);

          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            if (googleData.items) {
              for (const item of googleData.items.slice(0, 3)) {
                allResults.push(`📄 ${item.title}\n${item.snippet}\nURL: ${item.link}`);
              }
            }
          }
        }

        // If we have enough results, stop searching
        if (allResults.length >= 5) break;

      } catch (searchError) {
        console.log(`⚠️ Search error for query "${query}":`, searchError);
      }
    }

    if (allResults.length === 0) {
      return ''; // No external info found
    }

    return `\n\n📚 INFORMAZIONI TROVATE SUL WEB (usa queste per arricchire la descrizione):\n${allResults.join('\n\n')}`;

  } catch (error) {
    console.log('⚠️ RAG search failed:', error);
    return '';
  }
}

// Search Swiss market prices for reference
async function searchSwissPrices(productName: string, brand?: string): Promise<{ retail?: number; wholesale?: number; sources: string[] }> {
  const result: { retail?: number; wholesale?: number; sources: string[] } = { sources: [] };

  if (!process.env.BRAVE_SEARCH_API_KEY) return result;

  try {
    // Clean product name
    const cleanName = productName
      .replace(/\d+\s*(kg|g|ml|l|cl|pz|conf|x\d+)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Swiss retail sites: Coop, Migros, etc.
    const retailQuery = `"${cleanName}" ${brand || ''} prezzo CHF site:coop.ch OR site:migros.ch OR site:aldi.ch OR site:lidl.ch`.trim();

    const retailSearch = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(retailQuery)}&count=5`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
        }
      }
    );

    if (retailSearch.ok) {
      const retailData = await retailSearch.json();
      if (retailData.web?.results) {
        for (const r of retailData.web.results) {
          // Extract prices from snippets (CHF patterns)
          const priceMatch = r.description?.match(/CHF\s*([\d.,']+)|(\d+[.,]\d{2})\s*CHF/i);
          if (priceMatch) {
            const priceStr = (priceMatch[1] || priceMatch[2]).replace(/[',]/g, '.');
            const price = parseFloat(priceStr);
            if (price > 0 && price < 500) { // Sanity check
              if (!result.retail || price < result.retail) {
                result.retail = price;
                result.sources.push(`${r.title}: CHF ${price.toFixed(2)}`);
              }
            }
          }
        }
      }
    }

    // Swiss wholesale/gastro sites: Aligro, Prodega, etc.
    const wholesaleQuery = `"${cleanName}" ${brand || ''} prezzo grossista Svizzera site:aligro.ch OR site:prodega.ch`.trim();

    const wholesaleSearch = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(wholesaleQuery)}&count=3`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
        }
      }
    );

    if (wholesaleSearch.ok) {
      const wholesaleData = await wholesaleSearch.json();
      if (wholesaleData.web?.results) {
        for (const r of wholesaleData.web.results) {
          const priceMatch = r.description?.match(/CHF\s*([\d.,']+)|(\d+[.,]\d{2})\s*CHF/i);
          if (priceMatch) {
            const priceStr = (priceMatch[1] || priceMatch[2]).replace(/[',]/g, '.');
            const price = parseFloat(priceStr);
            if (price > 0 && price < 500) {
              if (!result.wholesale || price < result.wholesale) {
                result.wholesale = price;
                result.sources.push(`[Grossista] ${r.title}: CHF ${price.toFixed(2)}`);
              }
            }
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.log('⚠️ Swiss price search failed:', error);
    return result;
  }
}

// Search for product on manufacturer website
async function searchManufacturerInfo(productName: string, brand?: string): Promise<string> {
  if (!brand) return '';

  try {
    // Common manufacturer websites for food products
    const brandDomains: Record<string, string> = {
      'galbani': 'galbani.it',
      'barilla': 'barilla.com',
      'mutti': 'mutti-parma.com',
      'de cecco': 'dececco.com',
      'garofalo': 'pasta-garofalo.com',
      'divella': 'divella.com',
      'colavita': 'colavita.it',
      'cirio': 'cirio.it',
      'star': 'star.it',
      'knorr': 'knorr.com',
      'findus': 'findus.it',
      'orogel': 'orogel.it',
      'ferrero': 'ferrero.com',
      'lavazza': 'lavazza.it',
      'illy': 'illy.com',
      'segafredo': 'segafredo.it',
      'granarolo': 'granarolo.it',
      'parmalat': 'parmalat.it',
      'vallelata': 'vallelata.it',
      'beretta': 'berettafood.com',
      'rovagnati': 'rovagnati.it',
      'fiorucci': 'fiorucci.it',
      'negroni': 'negroni.com',
      'parmacotto': 'parmacotto.com',
      'san daniele': 'prosciuttosandaniele.it',
      'citterio': 'citterio.com',
      'ferrarini': 'ferrarini.com',
    };

    const brandLower = brand.toLowerCase();
    let domain = '';

    for (const [key, value] of Object.entries(brandDomains)) {
      if (brandLower.includes(key)) {
        domain = value;
        break;
      }
    }

    if (!domain) return '';

    // Search specifically on manufacturer site
    if (process.env.BRAVE_SEARCH_API_KEY) {
      const query = `site:${domain} ${productName}`;
      const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=2`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
        }
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.web?.results && searchData.web.results.length > 0) {
          const results = searchData.web.results.slice(0, 2).map((r: any) =>
            `📄 [${brand.toUpperCase()}] ${r.title}\n${r.description}\nURL: ${r.url}`
          );
          return `\n\n🏭 INFORMAZIONI DAL PRODUTTORE (${domain}):\n${results.join('\n\n')}`;
        }
      }
    }

    return '';
  } catch (error) {
    console.log('⚠️ Manufacturer search failed:', error);
    return '';
  }
}

// Extract brand from product name
function extractBrandFromName(productName: string): string | undefined {
  if (!productName) return undefined;

  const nameLower = productName.toLowerCase();

  // Common brand patterns to look for
  const knownBrands = [
    'galbani', 'barilla', 'mutti', 'de cecco', 'garofalo', 'divella', 'colavita',
    'cirio', 'star', 'knorr', 'findus', 'orogel', 'ferrero', 'lavazza', 'illy',
    'segafredo', 'granarolo', 'parmalat', 'vallelata', 'beretta', 'rovagnati',
    'fiorucci', 'negroni', 'parmacotto', 'citterio', 'ferrarini', 'coca cola',
    'pepsi', 'nestle', 'kraft', 'heinz', 'bonduelle', 'rio mare', 'simmenthal',
    'montana', 'santal', 'yoga', 'develey', 'calvé', 'hellmann', 'nutella',
    'mulino bianco', 'pan di stelle', 'plasmon', 'mellin', 'santa lucia',
    'nonno nanni', 'certosa', 'bel paese', 'belpaese', 'philadelphia',
    'sottilette', 'leerdammer', 'president', 'elle & vire', 'lurpak',
    'parmigiano reggiano', 'grana padano', 'pecorino romano', 'taleggio',
    'gorgonzola', 'fontina', 'asiago', 'provolone', 'mozzarella di bufala',
    'prosciutto di parma', 'prosciutto san daniele', 'mortadella bologna',
    'bresaola valtellina', 'speck alto adige', 'nduja', 'salsiccia',
    'oro saiwa', 'ritz', 'tuc', 'pavesi', 'voiello', 'rummo', 'cocco',
    'agnesi', 'buitoni', 'rana', 'giovanni rana', 'santa lucia', 'auricchio',
    'lactalis', 'crai', 'conad', 'esselunga', 'coop', 'selex', 'despar',
    'eurospin', 'lidl', 'aldi', 'penny', 'md', 'todis'
  ];

  for (const brand of knownBrands) {
    if (nameLower.includes(brand)) {
      return brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  // Try to extract first word if it looks like a brand (capitalized)
  const words = productName.split(/\s+/);
  if (words.length > 1 && words[0].length > 2) {
    const firstWord = words[0];
    // Check if it's all caps or first letter cap (likely a brand)
    if (firstWord === firstWord.toUpperCase() || /^[A-Z][a-z]/.test(firstWord)) {
      // Make sure it's not a common product type word
      const nonBrandWords = ['pasta', 'riso', 'olio', 'aceto', 'sale', 'zucchero', 'farina',
        'latte', 'burro', 'formaggio', 'prosciutto', 'salame', 'mortadella', 'pollo',
        'manzo', 'maiale', 'pesce', 'tonno', 'salmone', 'verdura', 'frutta'];
      if (!nonBrandWords.includes(firstWord.toLowerCase())) {
        return firstWord;
      }
    }
  }

  return undefined;
}

// Clean supplier name for better matching
function cleanSupplierName(name: string): string[] {
  if (!name) return [];

  // Remove common suffixes and clean up
  const suffixes = [
    /\s*s\.?r\.?l\.?\s*$/i,
    /\s*s\.?p\.?a\.?\s*$/i,
    /\s*s\.?n\.?c\.?\s*$/i,
    /\s*s\.?a\.?s\.?\s*$/i,
    /\s*ltd\.?\s*$/i,
    /\s*gmbh\s*$/i,
    /\s*inc\.?\s*$/i,
    /\s*\(.*\)\s*$/i,  // Remove anything in parentheses
  ];

  let cleaned = name.trim();
  for (const suffix of suffixes) {
    cleaned = cleaned.replace(suffix, '').trim();
  }

  // Return multiple search variants
  const variants = [
    name.trim(),           // Original name
    cleaned,               // Without suffix
    cleaned.split(' ')[0], // First word only (e.g., "PASTIFICIO")
  ];

  // Add first two words if available
  const words = cleaned.split(' ');
  if (words.length >= 2) {
    variants.push(words.slice(0, 2).join(' ')); // First two words
  }

  // Remove duplicates and empty strings
  return [...new Set(variants.filter(v => v && v.length > 2))];
}

// Fetch data from Odoo
async function fetchOdooData(invoiceData: any, sessionId: string) {
  const odooUrl = process.env.ODOO_URL;

  // Get search variants for supplier name
  const supplierSearchVariants = cleanSupplierName(invoiceData.fornitore || '');
  console.log(`🔍 Supplier search variants:`, supplierSearchVariants);

  // Fetch UoM and Categories in parallel first
  const [uomRes, categoryRes] = await Promise.all([
    // Get UoM
    fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'uom.uom',
          method: 'search_read',
          args: [[], ['id', 'name', 'category_id']],
          kwargs: { limit: 200 }
        },
        id: 1
      })
    }),
    // Get Categories
    fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.category',
          method: 'search_read',
          args: [[], ['id', 'name', 'complete_name']],
          kwargs: { limit: 200, order: 'complete_name ASC' }
        },
        id: 2
      })
    }),
  ]);

  const [uomData, categoryData] = await Promise.all([
    uomRes.json(),
    categoryRes.json(),
  ]);

  // Try to find supplier with multiple search strategies
  let suppliers: any[] = [];

  for (const searchTerm of supplierSearchVariants) {
    if (suppliers.length > 0) break; // Stop if we found a match

    console.log(`🔍 Trying supplier search: "${searchTerm}"`);

    const supplierRes = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [
            [['is_company', '=', true], ['supplier_rank', '>', 0], ['name', 'ilike', searchTerm]],
            ['id', 'name']
          ],
          kwargs: { limit: 10 }
        },
        id: 3
      })
    });

    const supplierData = await supplierRes.json();
    if (supplierData.result && supplierData.result.length > 0) {
      suppliers = supplierData.result;
      console.log(`✅ Found ${suppliers.length} suppliers with search term: "${searchTerm}"`);
    }
  }

  // If still no match, get all suppliers for manual selection
  let allSuppliers: any[] = [];
  if (suppliers.length === 0) {
    console.log(`⚠️ No supplier found, fetching all suppliers for manual selection`);
    const allSuppliersRes = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [
            [['is_company', '=', true], ['supplier_rank', '>', 0]],
            ['id', 'name']
          ],
          kwargs: { limit: 200, order: 'name ASC' }
        },
        id: 4
      })
    });
    const allSuppliersData = await allSuppliersRes.json();
    allSuppliers = allSuppliersData.result || [];
  }

  return {
    uom: uomData.result || [],
    categories: categoryData.result || [],
    suppliers: suppliers,
    allSuppliers: allSuppliers, // For manual selection if auto-match fails
    supplierSearchFailed: suppliers.length === 0
  };
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { product, invoiceData } = body;

    if (!product || !product.nome) {
      return NextResponse.json(
        { success: false, error: 'Dati prodotto mancanti' },
        { status: 400 }
      );
    }

    console.log('🔍 Enriching product:', product.nome);

    // Fetch Odoo data
    const odooData = await fetchOdooData(invoiceData || {}, sessionId);

    console.log(`📊 Odoo data fetched - UoM: ${odooData.uom.length}, Categories: ${odooData.categories.length}, Suppliers: ${odooData.suppliers.length}`);

    // Filter main categories (parent categories only) - Frigo, Secco, Pingu, Non-Food
    const mainCategories = odooData.categories.filter((c: any) => {
      const name = c.complete_name.toLowerCase();
      return name.includes('frigo') ||
             name.includes('secco') ||
             name.includes('pingu') ||
             name.includes('congelat') ||
             name.includes('non') && name.includes('food') ||
             name.includes('non-food') ||
             !name.includes('/'); // Root categories
    });

    console.log(`🏷️ Main categories found: ${mainCategories.length}`);
    mainCategories.forEach((c: any) => console.log(`   - ${c.complete_name} (ID: ${c.id})`));

    // Prepare context for Claude
    const uomList = odooData.uom.map((u: any) => `${u.name} (ID: ${u.id})`).join(', ');

    // Use main categories for initial selection
    const mainCategoryList = mainCategories.map((c: any) => `${c.complete_name} (ID: ${c.id})`).join(', ');

    // Also prepare all categories for secondary search
    const allCategoryList = odooData.categories.map((c: any) => `${c.complete_name} (ID: ${c.id})`).slice(0, 100).join(', ');

    const supplierInfo = odooData.suppliers.length > 0
      ? `Fornitore trovato: ${odooData.suppliers[0].name} (ID: ${odooData.suppliers[0].id})`
      : `Fornitore: ${invoiceData?.fornitore || 'Non specificato'}`;

    console.log(`📦 UoM disponibili: ${uomList.substring(0, 200)}...`);
    console.log(`🏭 ${supplierInfo}`);

    // RAG: Search for additional product information from the web
    console.log('🔍 RAG: Searching web for product information...');

    // Try to extract brand from product name for better search
    const possibleBrand = extractBrandFromName(product.nome);
    console.log(`🏷️ Possible brand detected: ${possibleBrand || 'none'}`);

    // Search in parallel for web info, manufacturer info, and Swiss prices
    const [webInfo, manufacturerInfo, swissPrices] = await Promise.all([
      searchProductInfo(product.nome, possibleBrand),
      searchManufacturerInfo(product.nome, possibleBrand),
      searchSwissPrices(product.nome, possibleBrand)
    ]);

    const ragContext = webInfo + manufacturerInfo;
    if (ragContext) {
      console.log(`✅ RAG: Found additional information (${ragContext.length} chars)`);
    } else {
      console.log('⚠️ RAG: No additional information found');
    }

    // Log Swiss prices if found
    if (swissPrices.retail || swissPrices.wholesale) {
      console.log(`💰 Swiss prices found - Retail: ${swissPrices.retail ? `CHF ${swissPrices.retail}` : 'N/A'}, Wholesale: ${swissPrices.wholesale ? `CHF ${swissPrices.wholesale}` : 'N/A'}`);
    }

    // Build Swiss price context for Claude
    let swissPriceContext = '';
    if (swissPrices.retail || swissPrices.wholesale) {
      swissPriceContext = `\n\n💰 PREZZI DI RIFERIMENTO MERCATO SVIZZERO (per aiutarti a capire il posizionamento):`;
      if (swissPrices.retail) {
        swissPriceContext += `\n- Prezzo dettaglio (Coop/Migros): CHF ${swissPrices.retail.toFixed(2)}`;
      }
      if (swissPrices.wholesale) {
        swissPriceContext += `\n- Prezzo grossista (Aligro/Prodega): CHF ${swissPrices.wholesale.toFixed(2)}`;
      }
      swissPriceContext += `\nFonti: ${swissPrices.sources.slice(0, 3).join(', ')}`;
    }

    // Use Claude to enrich product data with Odoo context + RAG
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Sei un esperto di prodotti commerciali e di Odoo ERP. Devi arricchire questo prodotto per crearlo in Odoo.

PRODOTTO DALLA FATTURA:
Nome: ${product.nome}
${product.codice ? `Codice: ${product.codice}` : ''}
${product.prezzo_unitario ? `Prezzo acquisto: €${product.prezzo_unitario}` : ''}
${product.unita_misura ? `Unità di Misura dalla fattura: ${product.unita_misura}` : ''}
${product.quantita ? `Quantità ordinata: ${product.quantita}` : ''}
${product.prezzo_totale ? `Prezzo totale riga: €${product.prezzo_totale}` : ''}
${product.note ? `Note: ${product.note}` : ''}

CONTESTO ODOO:
${supplierInfo}

UNITÀ DI MISURA DISPONIBILI IN ODOO:
${uomList}

CATEGORIE PRINCIPALI DISPONIBILI (scegli una di queste):
${mainCategoryList}

IMPORTANTE CATEGORIE:
- **FRIGO**: Prodotti refrigerati (salumi, latticini, freschi)
- **SECCO**: Prodotti a temperatura ambiente (pasta, scatole, bottiglie)
- **PINGU/CONGELATO**: Prodotti surgelati/congelati
- **NON-FOOD**: Prodotti non alimentari (pulizia, carta, plastica)

CATEGORIE DETTAGLIATE (opzionali, se trovi match più preciso):
${allCategoryList.substring(0, 500)}...
${ragContext ? `
${ragContext}
` : ''}${swissPriceContext}

COMPITO:
Analizza il prodotto e genera i seguenti dati.${ragContext ? ' USA LE INFORMAZIONI DAL WEB per arricchire la descrizione con dettagli reali (ingredienti, metodo di produzione, certificazioni, ecc.).' : ''}

**IMPORTANTE**: Tutti i campi sono OPZIONALI. Se non sei sicuro, usa null. Il prodotto deve essere creato comunque!

1. **nome_completo**: Nome completo e professionale
2. **descrizione_breve**: 1-2 frasi per descrizione vendita
3. **descrizione_dettagliata**: Descrizione completa con caratteristiche
4. **categoria_odoo_id**: ID della categoria più appropriata (PRIMA scegli tra FRIGO/SECCO/PINGU/NON-FOOD, poi cerca sottocategoria se disponibile)
5. **categoria_nome**: Nome categoria scelta
6. **marca**: Brand/Marca del prodotto (se identificabile dal nome, altrimenti null)
7. **codice_ean**: Codice EAN/barcode (usa quello dalla fattura)
8. **prezzo_vendita_suggerito**: Prezzo vendita = prezzo_acquisto × 1.30 (130% del costo, cioè +30% margine)
9. **caratteristiche**: Array di caratteristiche chiave (se identificabili)
10. **tags**: Array di tag per ricerca
11. **uom_odoo_id**: ID dell'unità di misura (default: cerca "Unità(i)" o "pz" se non sei sicuro)
12. **uom_nome**: Nome unità scelta
13. **peso**: Peso unitario in KG (per singolo pezzo/unità venduta). IMPORTANTE: estrai dal nome il peso REALE (es: "2.5 KG" → 2.5, "500g" → 0.5). Se non trovi peso esplicito, stima in base al prodotto.
14. **dimensioni**: Dimensioni stimate (solo se chiaramente identificabili, altrimenti null)
15. **immagine_search_query**: Query breve per generare immagine (es: "detergente spray bottiglia")
16. **codice_sa**: Codice SA (Sistema Armonizzato) se lo conosci, altrimenti null
17. **fornitore_odoo_id**: ID fornitore da contesto sopra (o null se non trovato)
18. **nome_fornitore**: Nome PULITO del prodotto per fornitore (SENZA lotto, scadenza, pallet, codici - solo nome prodotto base)
19. **shelf_life_days**: Giorni di shelf life totale dalla produzione (es: 365 per prodotti lunghi, 30 per freschi, 730 per surgelati). null se non applicabile.
20. **expiry_warning_days**: Giorni prima della scadenza per avviso (suggerito: 5-7 giorni). null se non applicabile.
21. **removal_days**: Giorni prima della scadenza per rimozione (suggerito: 1 giorno). null se non applicabile.
22. **seo_name**: Nome SEO-friendly per URL (es: "formaggio-belpaese-2-5kg-galbani")
23. **website_meta_title**: Meta title per SEO (es: "Formaggio Belpaese 2.5kg Galbani | LAPA Grossista") - max 60 caratteri
24. **website_meta_description**: Meta description per SEO - descrizione accattivante per i motori di ricerca, max 160 caratteri

**DESCRIZIONI MULTILINGUA PER E-COMMERCE - ORIENTATE ALLA VENDITA** (NON tradurre, SCRIVI come un copywriter madrelingua!):
25. **descrizioni_multilingua**: Descrizioni di VENDITA aggressive e persuasive per e-commerce B2B (ristoranti, hotel, grossisti).

    OBIETTIVO: Far comprare il prodotto! Ogni parola deve spingere all'acquisto.

    STRUTTURA OBBLIGATORIA (100-150 parole, 5-7 frasi POTENTI):
    1. HOOK IRRESISTIBILE: Inizia con una frase che cattura ("Il segreto dei migliori chef...", "Finalmente disponibile...", "La scelta dei professionisti...")
    2. PROMESSA DI VALORE: Cosa otterrà il cliente (clienti soddisfatti, piatti eccezionali, margini migliori)
    3. PROVA DI QUALITÀ: Metodo produzione, ingredienti premium, certificazioni, tradizione
    4. DIFFERENZIAZIONE: Perché questo e non un altro (unicità, esclusività, risultati garantiti)
    5. USO PRATICO: Applicazioni concrete, abbinamenti vincenti, versatilità in cucina
    6. CALL TO ACTION IMPLICITA: Crea urgenza ("I migliori ristoranti lo sanno...", "Non restare indietro...")

    TONO: VENDITA DIRETTA - Entusiasta, convincente, professionale ma pushy. Usa parole potenti: eccellenza, premium, autentico, irresistibile, garantito, esclusivo.

    Lingue richieste:
    - **it_IT**: Italiano - passionale e persuasivo, "questo prodotto farà la differenza nel tuo locale"
    - **de_CH**: Tedesco - qualità svizzera, affidabilità, "Qualität die überzeugt"
    - **fr_CH**: Francese - eleganza gastronomica, "l'excellence à votre portée"
    - **en_US**: Inglese - premium positioning, "elevate your menu"
    - **ro_RO**: Rumeno - pratico e convincente, "calitate la preț avantajos"

LOGICA INTELLIGENTE:
- **Categoria**: SEMPRE scegli tra Frigo/Secco/Pingu/Non-Food come prima scelta
- **UoM**: Se compra a cartone ma vende a pezzo → usa "Unità(i)" o "pz". Default sicuro: ID 1
- **Peso**: Per unità SINGOLA di vendita, non per cartone. Se incerto: 0.1 kg
- **Non bloccare**: Se non trovi un campo, usa null o valori di default

CONFIGURAZIONE PRODOTTI (IMPORTANTE):
1. **Unità di Misura**:
   - Se la fattura dice "PZ" ma indica quantità come cartoni (es: "X6", "X12", "CONF"), il prodotto si vende a PEZZI
   - UoM vendita = sempre "Unità(i)" o "pz" per i pezzi singoli
   - UoM acquisto = potrebbe essere diversa (cartone, confezione, ecc) ma per semplicità usa la stessa dell'UoM vendita

2. **Prezzo di Acquisto**:
   - Il prezzo dalla fattura è il prezzo a cui compriamo (per cartone/conf se indicato)
   - Questo va nel campo "prezzo_acquisto" e "standard_price"

3. **IVA/Tasse** (NON gestire qui, solo informazione):
   - Prodotti Food italiani: IVA 8.1% vendita
   - Prodotti Non-Food: IVA 22% vendita
   - Fornitori esteri: IVA 0% import acquisto
   - (Questa configurazione verrà fatta dopo la creazione)

4. **Fornitore**:
   - Usa sempre il fornitore_odoo_id dal contesto se disponibile
   - Il prezzo fornitore sarà quello della fattura

Rispondi SOLO con JSON valido:
{
  "nome_completo": "...",
  "descrizione_breve": "...",
  "descrizione_dettagliata": "...",
  "categoria_odoo_id": 123,
  "categoria_nome": "...",
  "marca": "..." o null,
  "codice_ean": "...",
  "prezzo_vendita_suggerito": 0.00,
  "caratteristiche": ["...", "..."],
  "tags": ["...", "..."],
  "uom_odoo_id": 1,
  "uom_nome": "...",
  "peso": 0.0,
  "dimensioni": "...",
  "immagine_search_query": "...",
  "codice_sa": "...",
  "fornitore_odoo_id": 123 o null,
  "nome_fornitore": "...",
  "shelf_life_days": 365 o null,
  "expiry_warning_days": 5 o null,
  "removal_days": 1 o null,
  "seo_name": "nome-seo-friendly",
  "website_meta_title": "Titolo SEO | LAPA Grossista",
  "website_meta_description": "Meta description SEO...",
  "descrizioni_multilingua": {
    "it_IT": "Pasta artigianale all'uovo di prima qualità, trafilata al bronzo per una texture perfetta che trattiene ogni condimento. Realizzata con uova fresche italiane e semola di grano duro selezionato. Ideale per sughi corposi, ragù della tradizione e condimenti ricchi. Un prodotto che porta in tavola l'autentico sapore della pasta fatta in casa.",
    "de_CH": "Hochwertige handwerkliche Eiernudeln, bronzegezogen für eine perfekte Textur, die jede Sauce optimal aufnimmt. Hergestellt mit frischen italienischen Eiern und ausgewähltem Hartweizengrieß. Ideal für kräftige Saucen, traditionelle Ragùs und reichhaltige Beilagen. Ein Produkt, das den authentischen Geschmack hausgemachter Pasta auf den Tisch bringt.",
    "fr_CH": "Pâtes artisanales aux œufs de première qualité, tréfilées au bronze pour une texture parfaite qui retient chaque sauce. Élaborées avec des œufs frais italiens et de la semoule de blé dur sélectionnée. Idéales pour les sauces corsées, les ragùs traditionnels et les accompagnements riches. Un produit qui apporte à table l'authentique saveur des pâtes faites maison.",
    "en_US": "Premium artisan egg pasta, bronze-drawn for a perfect texture that holds every sauce. Made with fresh Italian eggs and selected durum wheat semolina. Ideal for hearty sauces, traditional ragùs, and rich condiments. A product that brings the authentic taste of homemade pasta to your table.",
    "ro_RO": "Paste artizanale cu ou de cea mai bună calitate, trase prin bronz pentru o textură perfectă care reține fiecare sos. Realizate cu ouă proaspete italienești și griș de grâu dur selecționat. Ideale pentru sosuri consistente, ragù tradiționale și condimente bogate. Un produs care aduce la masă gustul autentic al pastelor făcute în casă."
  }
}`,
        },
      ],
    });

    // Extract JSON
    const firstContent = message.content[0];
    const responseText = firstContent && firstContent.type === 'text' ? firstContent.text : '';
    console.log('📝 Claude full response:\n', responseText);

    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      jsonMatch = responseText.match(/```\n([\s\S]*?)\n```/);
    }

    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
    const enrichedData = JSON.parse(jsonStr.trim());

    console.log('🔍 Parsed enrichment data:', JSON.stringify(enrichedData, null, 2));

    // Merge with original
    const finalProduct = {
      ...product,
      ...enrichedData,
      codice_ean: product.codice || enrichedData.codice_ean,
      prezzo_acquisto: product.prezzo_unitario,
      quantita_acquisto: product.quantita,
      unita_misura_fattura: product.unita_misura, // UoM dalla fattura
      unita_misura_acquisto: product.unita_misura,
      note_acquisto: product.note,
    };

    console.log('✅ Successfully enriched product:', finalProduct.nome_completo);

    return NextResponse.json({
      success: true,
      data: finalProduct,
      comparison: {
        uom_fattura: product.unita_misura,
        uom_odoo: enrichedData.uom_nome,
        uom_odoo_id: enrichedData.uom_odoo_id,
        prezzo_fattura: product.prezzo_unitario,
        quantita_fattura: product.quantita
      },
      supplierInfo: {
        autoMatched: !odooData.supplierSearchFailed,
        matchedSupplier: odooData.suppliers.length > 0 ? odooData.suppliers[0] : null,
        allSuppliers: odooData.allSuppliers, // For manual selection if needed
      },
      swissPrices: {
        retail: swissPrices.retail || null,
        wholesale: swissPrices.wholesale || null,
        sources: swissPrices.sources,
      }
    });

  } catch (error: any) {
    console.error('❌ Error enriching product:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'arricchimento del prodotto'
      },
      { status: 500 }
    );
  }
}
