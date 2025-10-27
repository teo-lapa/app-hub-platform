/**
 * TEST MANUALE DEGLI AGENTI DI PARSING INVOICE
 *
 * Questo script testa tutti e 4 gli agenti con un PDF reale
 * per verificare che funzionino PRIMA di far testare all'utente!
 */

import Anthropic from '@anthropic-ai/sdk';
import { loadSkill } from './lib/ai/skills-loader';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY non trovata in .env.local');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testAgents() {
  console.log('🧪 TEST AGENTI DI PARSING INVOICE\n');

  // Carica il PDF di test
  const pdfPath = 'C:\\Users\\lapa\\Downloads\\stroppa2695lapa.pdf';
  console.log(`📄 Caricando PDF: ${pdfPath}`);

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF non trovato: ${pdfPath}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64 = pdfBuffer.toString('base64');
  const mediaType = 'application/pdf';

  console.log(`✅ PDF caricato: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

  // Crea content block per Anthropic
  const contentBlock = {
    type: 'document' as const,
    source: {
      type: 'base64' as const,
      media_type: mediaType,
      data: base64,
    },
  };

  // Helper per chiamare un agente
  async function callAgent(skillPath: string, agentName: string, additionalContext?: string) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 ${agentName}`);
    console.log(`${'='.repeat(80)}`);

    const skill = loadSkill(skillPath, { skipCache: true });

    const promptText = additionalContext
      ? `${skill.content}\n\n---\n\n${additionalContext}`
      : skill.content;

    console.log(`📝 Prompt length: ${promptText.length} chars`);
    if (additionalContext) {
      console.log(`📝 Additional context: ${additionalContext.substring(0, 200)}...`);
    }

    const message = await anthropic.messages.create({
      model: skill.metadata.model || 'claude-3-5-sonnet-20241022',
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
        console.error(`❌ ${agentName}: Nessun JSON valido nella risposta`);
        console.error('Risposta:', responseText);
        throw new Error(`${agentName}: Nessun JSON valido nella risposta`);
      }
    }

    console.log(`✅ ${agentName}: completato`);
    console.log(`📊 Risposta JSON:`, JSON.stringify(json, null, 2));

    return json;
  }

  try {
    // 🤖 AGENT 0: Identify Documents
    const docInfo = await callAgent('document-processing/identify-documents', 'AGENT 0 - Identificazione Documenti');
    console.log('\n📄 Documento principale identificato:', docInfo.primary_document?.type, '- Pagine:', docInfo.primary_document?.pages);

    // 🤖 AGENT 1: Extract Products
    const pagesContext = `IMPORTANTE: Estrai prodotti SOLO dalle pagine ${docInfo.primary_document.pages.join(', ')} che contengono il documento "${docInfo.primary_document.type}". IGNORA tutte le altre pagine!`;
    const productsData = await callAgent('document-processing/extract-products', 'AGENT 1 - Estrazione Prodotti', pagesContext);
    console.log('\n🛒 Prodotti estratti:', productsData.products?.length || 0);

    // 🤖 AGENT 2: Extract Lots + VALIDATE
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
    const lotsData = await callAgent('document-processing/extract-lots', 'AGENT 2 - Validazione + Estrazione Lotti', productsListContext);

    // Check formato risposta
    console.log('\n🔍 Controllo formato risposta Agent 2:');
    if (lotsData.validated_products) {
      console.log(`✅ Formato NUOVO: validated_products (${lotsData.validated_products.length} prodotti)`);
      console.log(`✅ Prodotti validati:`, lotsData.validated_products.map((p: any) => p.article_code).join(', '));
      if (lotsData.rejected_products && lotsData.rejected_products.length > 0) {
        console.log(`🗑️  Prodotti scartati (${lotsData.rejected_products.length}):`);
        lotsData.rejected_products.forEach((p: any) => {
          console.log(`   - "${p.description}" (${p.reason})`);
        });
      }
    } else if (lotsData.lots) {
      console.log(`⚠️  Formato VECCHIO: lots (${lotsData.lots.length} lotti)`);
      console.log(`⚠️  Agent 2 NON ha usato il nuovo formato validated_products!`);
    } else {
      console.log(`❌ Formato SCONOSCIUTO!`);
    }

    // 🤖 AGENT 3: Extract Supplier
    const supplierData = await callAgent('document-processing/extract-supplier', 'AGENT 3 - Estrazione Fornitore');
    console.log('\n🏭 Fornitore:', supplierData.supplier_name);

    // MERGE e verifica finale
    console.log('\n' + '='.repeat(80));
    console.log('📊 RISULTATO FINALE');
    console.log('='.repeat(80));

    const validatedProducts = lotsData.validated_products || [];
    const rejectedProducts = lotsData.rejected_products || [];

    console.log(`\n✅ Prodotti VALIDI: ${validatedProducts.length}`);
    console.log(`❌ Prodotti SCARTATI: ${rejectedProducts.length}`);
    console.log(`📦 Totale estratti da Agent 1: ${productsData.products?.length || 0}`);

    if (validatedProducts.length === 0 && productsData.products && productsData.products.length > 0) {
      console.error('\n❌ ERRORE: Agent 2 NON ha validato NESSUN prodotto!');
      console.error('❌ Questo significa che la validazione NON funziona!');
    }

    if (rejectedProducts.length === 0 && productsData.products && productsData.products.length > 15) {
      console.error('\n⚠️  WARNING: Agent 2 NON ha scartato NESSUN prodotto!');
      console.error('⚠️  Con 15+ prodotti estratti, dovrebbe scartare almeno i duplicati!');
    }

    console.log('\n✅ TEST COMPLETATO!');

  } catch (error: any) {
    console.error('\n❌ ERRORE DURANTE IL TEST:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testAgents();
