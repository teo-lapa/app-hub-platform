import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadSkill, logSkillInfo } from '@/lib/ai/skills-loader';
import { PDFDocument } from 'pdf-lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large PDFs

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper function to extract specific pages from PDF
async function extractPDFPages(buffer: Buffer, pages: number[]): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    const newPdf = await PDFDocument.create();

    // Pages in pdf-lib are 0-indexed, but we receive 1-indexed pages
    for (const pageNum of pages) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error extracting PDF pages:', error);
    // If extraction fails, return original buffer
    return buffer;
  }
}

// Helper function to compress large PDFs
async function compressPDF(buffer: Buffer): Promise<Buffer> {
  // For now, we'll just return the original buffer
  // In production, you could use pdf-lib or similar to actually compress
  return buffer;
}

// Helper function to validate file size
function validateFileSize(size: number): { valid: boolean; message?: string } {
  const maxSize = 10 * 1024 * 1024; // 10 MB
  const warningSize = 5 * 1024 * 1024; // 5 MB

  if (size > maxSize) {
    return {
      valid: false,
      message: `File troppo grande (${(size / 1024 / 1024).toFixed(2)} MB). Dimensione massima: 10 MB. Prova a ridurre la qualità del PDF o dividerlo in più parti.`
    };
  }

  if (size > warningSize) {
    console.warn(`⚠️ File grande (${(size / 1024 / 1024).toFixed(2)} MB) - il parsing potrebbe richiedere più tempo`);
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    }

    console.log('📄 File ricevuto:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file size
    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      return NextResponse.json({ error: sizeValidation.message }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // Compress if needed (for future implementation)
    if (file.size > 5 * 1024 * 1024) {
      console.log('🗜️ File grande, preparazione per processing...');
      buffer = await compressPDF(buffer);
    }

    const base64 = buffer.toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';

    if (file.type === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      mediaType = 'image/jpeg';
    } else if (file.type === 'image/png') {
      mediaType = 'image/png';
    } else if (file.type === 'image/gif') {
      mediaType = 'image/gif';
    } else if (file.type === 'image/webp') {
      mediaType = 'image/webp';
    } else {
      return NextResponse.json({
        error: 'Formato file non supportato. Usa PDF o immagini (JPG, PNG, GIF, WEBP)'
      }, { status: 400 });
    }

    console.log('🤖 Sistema 4-Agenti UNIVERSALE attivato...');

    // Determine content type based on file format (PDF uses 'document', images use 'image')
    const isPDF = mediaType === 'application/pdf';
    const contentBlock: any = isPDF ? {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    } : {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    };

    // Helper function to call Claude and parse JSON
    const callAgent = async (skillPath: string, agentName: string, additionalContext?: string) => {
      console.log(`🤖 ${agentName}...`);
      // ⚠️ IMPORTANTE: skipCache: true per forzare reload degli skills modificati!
      // In produzione la cache è ottimale, ma durante sviluppo vogliamo le modifiche immediate
      const skill = loadSkill(skillPath, { skipCache: true });

      const promptText = additionalContext
        ? `${skill.content}\n\n---\n\n${additionalContext}`
        : skill.content;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              { type: 'text', text: promptText },
            ],
          },
        ],
      });

      const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

      // Parse JSON
      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          json = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`${agentName}: Nessun JSON valido nella risposta`);
        }
      }

      console.log(`✅ ${agentName}: completato`);
      return json;
    };

    // Helper function to call Gemini for product extraction
    const callGeminiAgent = async (pdfBase64: string, agentName: string) => {
      console.log(`🤖 ${agentName} (Gemini 2.5 Flash)...`);

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      });

      const prompt = `Estrai i dati dalla fattura.

IMPORTANTE: Se il PDF contiene più documenti (fattura, packing list, DDT, ecc.), leggi SOLO la FATTURA. Ignora completamente gli altri documenti.

La tabella prodotti della FATTURA ha queste colonne IN ORDINE (da sinistra a destra):
ARTICOLO | LOTTO | DESCRIZIONE | UM | QUANTITA' | QTA' x CARTONE | PREZZO UNITARIO | % SCONTI | IMPORTO | DT. SCAD. | IVA

ATTENZIONE COLONNA QUANTITA':
- Colonna QUANTITA': contiene SOLO NUMERI (es: 18, 54, 8, 5, 1, 2)
- Colonna QTA' x CARTONE: contiene TESTO (es: KG 5, PZ 50, CT 30)
- USA la colonna QUANTITA' (solo numeri)!

Esempio riga:
A0334SG | 25233 | ARAN DI RISO SUGO 25 g | CT | 18 | KG 5 | 29,51 | 25,0 10,0 | 358,55 | 12/02/27 | 69
→ quantita = 18 (NON 5!)

Output JSON:
{
  "fornitore": "nome fornitore",
  "numero_fattura": "numero",
  "data_fattura": "YYYY-MM-DD",
  "products": [
    {
      "article_code": "A0334SG",
      "description": "ARAN DI RISO SUGO 25 g",
      "quantity": 18,
      "unit": "CT",
      "lot_number": "25233",
      "expiry_date": "2027-02-12"
    }
  ]
}`;

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64
          }
        },
        prompt
      ]);

      const text = result.response.text();
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const json = JSON.parse(cleaned);

      console.log(`✅ ${agentName}: completato - ${json.products?.length || 0} prodotti estratti`);
      return json;
    };

    // 🤖 AGENT 0: Identify Documents (usa PDF completo)
    const docInfo = await callAgent('document-processing/identify-documents', 'AGENT 0 - Identificazione Documenti');
    console.log('📄 Documento principale identificato:', docInfo.primary_document.type, '- Pagine:', docInfo.primary_document.pages);

    // 📄 ESTRAI SOLO LE PAGINE DEL DOCUMENTO PRINCIPALE
    console.log(`✂️  Estrazione pagine ${docInfo.primary_document.pages.join(', ')} dal PDF...`);
    const filteredPdfBuffer = await extractPDFPages(buffer, docInfo.primary_document.pages);
    const filteredBase64 = filteredPdfBuffer.toString('base64');

    // Crea nuovo content block con SOLO le pagine filtrate
    const filteredContentBlock = {
      type: 'document' as const,
      source: {
        type: 'base64' as const,
        media_type: mediaType,
        data: filteredBase64,
      },
    };

    console.log(`✅ PDF filtrato creato: ${(filteredPdfBuffer.length / 1024).toFixed(2)} KB (originale: ${(buffer.length / 1024).toFixed(2)} KB)`);

    // 🤖 AGENT 1: Extract Products (con PDF FILTRATO - solo pagine giuste!)
    // Ora Agent 1 riceve SOLO le pagine 1-2, è FISICAMENTE IMPOSSIBILE che legga pagina 3!
    const pagesContext = `Stai ricevendo un PDF che contiene SOLO il documento "${docInfo.primary_document.type}". Estrai TUTTI i prodotti che trovi.`;

    // Modifica callAgent per accettare contentBlock custom
    const callAgentWithPDF = async (skillPath: string, agentName: string, pdfContentBlock: any, additionalContext?: string) => {
      console.log(`🤖 ${agentName}...`);
      const skill = loadSkill(skillPath, { skipCache: true });

      const promptText = additionalContext
        ? `${skill.content}\n\n---\n\n${additionalContext}`
        : skill.content;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              pdfContentBlock,
              { type: 'text', text: promptText },
            ],
          },
        ],
      });

      const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          json = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`${agentName}: Nessun JSON valido nella risposta`);
        }
      }

      console.log(`✅ ${agentName}: completato`);
      return json;
    };

    // 🤖 AGENT 1: Extract Products con GEMINI 2.5 Flash (invece di Claude)
    // IMPORTANTE: Gemini usa il PDF ORIGINALE (non filtrato) per leggere meglio le tabelle!
    const productsData = await callGeminiAgent(base64, 'AGENT 1 - Estrazione Prodotti (PDF ORIGINALE)');

    // 🤖 AGENT 2: Extract Lots and Expiry Dates + VALIDATE PRODUCTS (usa PDF filtrato)
    const productsListContext = `
${pagesContext}

---

**PRODOTTI ESTRATTI DA AGENT 1** (potrebbero contenere errori - TU DEVI VALIDARLI!):

\`\`\`json
${JSON.stringify(productsData, null, 2)}
\`\`\`

**TUO COMPITO**:
1. Guarda ogni prodotto in questa lista
2. Verifica se è un VERO prodotto alimentare (usa la CHECKLIST)
3. SCARTA quelli che sono indirizzi, dichiarazioni, nomi azienda, note legali
4. Estrai lotti SOLO per i prodotti VALIDI
5. Ritorna lotti SOLO per i prodotti che hai validato come VERI
`;
    const lotsData = await callAgentWithPDF('document-processing/extract-lots', 'AGENT 2 - Validazione + Estrazione Lotti (PDF filtrato)', filteredContentBlock, productsListContext);

    // 🤖 AGENT 3: Extract Supplier Info
    const supplierData = await callAgent('document-processing/extract-supplier', 'AGENT 3 - Estrazione Fornitore');

    // 🔗 MERGE: Use ONLY validated products from Agent 2
    // ⚠️ Agent 2 ha fatto il lavoro di validazione - usiamo SOLO i prodotti che ha approvato!
    console.log('🔗 Usando solo prodotti validati da Agent 2...');
    console.log('DEBUG - lotsData format:', JSON.stringify(lotsData, null, 2));

    // Check se Agent 2 ha usato il nuovo formato (validated_products) o il vecchio formato (lots)
    const validatedProducts = lotsData.validated_products || [];
    const rejectedProducts = lotsData.rejected_products || [];

    if (validatedProducts.length === 0 && lotsData.lots && lotsData.lots.length > 0) {
      // FALLBACK: Agent 2 ha usato il vecchio formato!
      console.error('⚠️ WARNING: Agent 2 ha usato il vecchio formato "lots" invece di "validated_products"!');
      console.error('⚠️ Questo significa che la skill NON è stata aggiornata correttamente o c\'è una cache!');
      console.error('⚠️ FALLBACK: Uso tutti i prodotti da Agent 1 senza validazione (comportamento vecchio)');

      // Usa il vecchio comportamento per non rompere il sistema
      const lotsMap = new Map();
      for (const lot of (lotsData.lots || [])) {
        lotsMap.set(lot.article_code, {
          lot_number: lot.lot_number,
          expiry_date: lot.expiry_date,
        });
      }

      const products = (productsData.products || []).map((product: any) => {
        const lotInfo = lotsMap.get(product.article_code) || {};
        return {
          article_code: product.article_code,
          description: product.description,
          quantity: product.quantity,
          unit: product.unit,
          lot_number: lotInfo.lot_number || undefined,
          expiry_date: lotInfo.expiry_date || undefined,
        };
      });

      const parsedData = {
        supplier_name: supplierData.supplier_name,
        supplier_vat: supplierData.supplier_vat || '',
        document_number: supplierData.document_number,
        document_date: supplierData.document_date,
        products,
      };

      return NextResponse.json(parsedData);
    }

    console.log(`✅ Prodotti validati: ${validatedProducts.length}`);
    console.log(`❌ Prodotti scartati: ${rejectedProducts.length}`);
    if (rejectedProducts.length > 0) {
      console.log('🗑️ Scartati:', rejectedProducts.map((p: any) => `"${p.description}" (${p.reason})`).join(', '));
    }

    // Combina i dati: usa validated_products da Agent 2 con quantità/descrizioni da Agent 1
    const productsMap = new Map();
    for (const product of (productsData.products || [])) {
      productsMap.set(product.article_code, {
        description: product.description,
        quantity: product.quantity,
        unit: product.unit,
      });
    }

    const products = validatedProducts.map((validatedProduct: any) => {
      const productInfo = productsMap.get(validatedProduct.article_code) || {};
      return {
        article_code: validatedProduct.article_code,
        description: productInfo.description || 'N/A',
        quantity: productInfo.quantity || 0,
        unit: productInfo.unit || 'NR',
        lot_number: validatedProduct.lot_number || undefined,
        expiry_date: validatedProduct.expiry_date || undefined,
      };
    });

    const parsedData = {
      supplier_name: supplierData.supplier_name,
      supplier_vat: supplierData.supplier_vat || '',
      document_number: supplierData.document_number,
      document_date: supplierData.document_date,
      products: products,
    };

    console.log('✅ Sistema 4-Agenti completato:', {
      documento_usato: docInfo.primary_document.type,
      pagine: docInfo.primary_document.pages,
      supplier: parsedData.supplier_name,
      products: parsedData.products?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: parsedData,
      tokens_used: undefined
    });

  } catch (error: any) {
    console.error('❌ Errore parse-invoice:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing della fattura',
      details: error.toString()
    }, { status: 500 });
  }
}
