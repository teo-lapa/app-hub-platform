import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to search product info (simplified version without cheerio)
async function searchProductInfo(productName: string, ean?: string) {
  try {
    // Build search query
    const searchQuery = ean
      ? `${productName} EAN ${ean}`
      : productName;

    console.log('🔍 Searching for:', searchQuery);

    // Use Wikipedia API for basic product info (free and reliable)
    const wikiUrl = `https://it.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(productName)}&limit=3&format=json`;

    const response = await fetch(wikiUrl);
    const data = await response.json();

    // Extract descriptions
    const descriptions = data[2] || [];
    return descriptions.join('\n');
  } catch (error) {
    console.error('❌ Error searching product info:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product, additionalInfo } = body;

    if (!product || !product.nome) {
      return NextResponse.json(
        { success: false, error: 'Dati prodotto mancanti' },
        { status: 400 }
      );
    }

    console.log('🔍 Enriching product:', product.nome);

    // Search for product information online
    const webInfo = await searchProductInfo(product.nome, product.codice);

    // Use Claude to enrich product data
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Sei un esperto di prodotti commerciali. Devi arricchire le informazioni di questo prodotto per creare una scheda completa nel sistema.

PRODOTTO DALLA FATTURA:
Nome: ${product.nome}
${product.codice ? `Codice/EAN: ${product.codice}` : ''}
${product.prezzo_unitario ? `Prezzo acquisto: €${product.prezzo_unitario}` : ''}
${product.unita_misura ? `Unità: ${product.unita_misura}` : ''}
${product.note ? `Note: ${product.note}` : ''}

${webInfo ? `INFORMAZIONI TROVATE ONLINE:\n${webInfo}\n` : ''}

${additionalInfo ? `INFORMAZIONI AGGIUNTIVE FORNITE:\n${additionalInfo}\n` : ''}

COMPITO:
Genera una scheda prodotto completa con i seguenti campi:

1. **nome_completo**: Nome completo e chiaro del prodotto
2. **descrizione_breve**: Descrizione breve (1-2 frasi) per listing prodotto
3. **descrizione_dettagliata**: Descrizione dettagliata con caratteristiche principali
4. **categoria**: Categoria merceologica (es: "Alimentari > Bevande > Vino", "Elettronica > Computer > Accessori")
5. **sottocategoria**: Sottocategoria specifica
6. **marca**: Brand/Marca del prodotto (se identificabile)
7. **codice_ean**: Codice EAN/barcode se presente
8. **prezzo_vendita_suggerito**: Prezzo di vendita consigliato (se hai il prezzo acquisto, suggerisci con margine 30-50%)
9. **caratteristiche**: Array di caratteristiche tecniche chiave
10. **tags**: Array di tag per ricerca (es: ["biologico", "italiano", "premium"])
11. **unita_misura**: Unità di misura standard (PZ, KG, LT, etc)
12. **peso**: Peso stimato in KG (se applicabile)
13. **dimensioni**: Dimensioni stimate in cm (se applicabile)
14. **immagine_url_search**: Query di ricerca ottimizzata per trovare immagini del prodotto

IMPORTANTE:
- Se non hai certezza su un campo, usa il tuo miglior giudizio basato sul nome
- Per il prezzo vendita, considera un margine commerciale standard
- Sii specifico nelle descrizioni ma realistico
- Rispondi SOLO con un JSON valido, senza commenti o testo aggiuntivo

Formato JSON richiesto:
{
  "nome_completo": "...",
  "descrizione_breve": "...",
  "descrizione_dettagliata": "...",
  "categoria": "...",
  "sottocategoria": "...",
  "marca": "...",
  "codice_ean": "...",
  "prezzo_vendita_suggerito": 0,
  "caratteristiche": ["...", "..."],
  "tags": ["...", "..."],
  "unita_misura": "...",
  "peso": 0,
  "dimensioni": "...",
  "immagine_url_search": "..."
}`,
        },
      ],
    });

    // Extract JSON from response
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    console.log('📝 Claude enrichment response:', responseText.substring(0, 200) + '...');

    // Parse JSON from response (handle markdown code blocks)
    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      jsonMatch = responseText.match(/```\n([\s\S]*?)\n```/);
    }

    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
    const enrichedData = JSON.parse(jsonStr.trim());

    // Merge with original product data
    const finalProduct = {
      ...product,
      ...enrichedData,
      // Keep original values if present
      codice_ean: product.codice || enrichedData.codice_ean,
      prezzo_acquisto: product.prezzo_unitario,
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
