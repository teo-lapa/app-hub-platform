import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fetch data from Odoo
async function fetchOdooData(invoiceData: any, sessionId: string) {
  const odooUrl = process.env.ODOO_URL;

  // Fetch UoM, Categories, and Suppliers in parallel
  const [uomRes, categoryRes, supplierRes] = await Promise.all([
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
    // Search for supplier by name from invoice
    fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [
            [['is_company', '=', true], ['supplier_rank', '>', 0], ['name', 'ilike', invoiceData.fornitore || '']],
            ['id', 'name']
          ],
          kwargs: { limit: 5 }
        },
        id: 3
      })
    })
  ]);

  const [uomData, categoryData, supplierData] = await Promise.all([
    uomRes.json(),
    categoryRes.json(),
    supplierRes.json()
  ]);

  return {
    uom: uomData.result || [],
    categories: categoryData.result || [],
    suppliers: supplierData.result || []
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

    // Use Claude to enrich product data with Odoo context
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3072,
      messages: [
        {
          role: 'user',
          content: `Sei un esperto di prodotti commerciali e di Odoo ERP. Devi arricchire questo prodotto per crearlo in Odoo.

PRODOTTO DALLA FATTURA:
Nome: ${product.nome}
${product.codice ? `Codice: ${product.codice}` : ''}
${product.prezzo_unitario ? `Prezzo acquisto: €${product.prezzo_unitario}` : ''}
${product.unita_misura ? `Unità dalla fattura: ${product.unita_misura}` : ''}
${product.quantita ? `Quantità: ${product.quantita}` : ''}
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

COMPITO:
Analizza il prodotto e genera i seguenti dati.

**IMPORTANTE**: Tutti i campi sono OPZIONALI. Se non sei sicuro, usa null. Il prodotto deve essere creato comunque!

1. **nome_completo**: Nome completo e professionale
2. **descrizione_breve**: 1-2 frasi per descrizione vendita
3. **descrizione_dettagliata**: Descrizione completa con caratteristiche
4. **categoria_odoo_id**: ID della categoria più appropriata (PRIMA scegli tra FRIGO/SECCO/PINGU/NON-FOOD, poi cerca sottocategoria se disponibile)
5. **categoria_nome**: Nome categoria scelta
6. **marca**: Brand/Marca del prodotto (se identificabile dal nome, altrimenti null)
7. **codice_ean**: Codice EAN/barcode (usa quello dalla fattura)
8. **prezzo_vendita_suggerito**: Prezzo vendita con margine 30-50%
9. **caratteristiche**: Array di caratteristiche chiave (se identificabili)
10. **tags**: Array di tag per ricerca
11. **uom_odoo_id**: ID dell'unità di misura (default: cerca "Unità(i)" o "pz" se non sei sicuro)
12. **uom_nome**: Nome unità scelta
13. **peso**: Peso unitario stimato in KG (per singolo pezzo/unità venduta) - se non sei sicuro metti 0.1
14. **dimensioni**: Dimensioni stimate (solo se chiaramente identificabili, altrimenti null)
15. **immagine_search_query**: Query breve per generare immagine (es: "detergente spray bottiglia")
16. **codice_sa**: Codice SA (Sistema Armonizzato) se lo conosci, altrimenti null
17. **fornitore_odoo_id**: ID fornitore da contesto sopra (o null se non trovato)

LOGICA INTELLIGENTE:
- **Categoria**: SEMPRE scegli tra Frigo/Secco/Pingu/Non-Food come prima scelta
- **UoM**: Se compra a cartone ma vende a pezzo → usa "Unità(i)" o "pz". Default sicuro: ID 1
- **Peso**: Per unità SINGOLA di vendita, non per cartone. Se incerto: 0.1 kg
- **Non bloccare**: Se non trovi un campo, usa null o valori di default

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
  "fornitore_odoo_id": 123 o null
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
      unita_misura_acquisto: product.unita_misura,
      note_acquisto: product.note,
    };

    console.log('✅ Successfully enriched product:', finalProduct.nome_completo);

    return NextResponse.json({
      success: true,
      data: finalProduct,
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
