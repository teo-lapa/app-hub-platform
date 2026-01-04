/**
 * LAPA AI - Analyze Chatter Communication Styles
 *
 * Analizza i messaggi nel chatter degli ordini Odoo per estrarre
 * lo stile comunicativo di ogni contatto.
 *
 * Questo script:
 * 1. Recupera gli ordini degli ultimi 6 mesi
 * 2. Per ogni ordine, recupera i messaggi del chatter
 * 3. Analizza i messaggi con Claude per determinare lo stile
 * 4. Salva i risultati in un file JSON per review
 *
 * Usage: npx tsx scripts/analyze-chatter-styles.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getOdooClient } from "../lib/odoo-client";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

// Config
const EXCLUDE_COMPANY_IDS = [1, 6301, 1208]; // LAPA, ItaEmpire, USO INTERNO
const MAX_MESSAGES_PER_PARTNER = 20;  // Limit messages to analyze per partner
const SAMPLE_SIZE = 10;  // Start with a sample for testing

interface ChatterMessage {
  id: number;
  date: string;
  body: string;
  author_id: [number, string] | false;
  message_type: string;
  subtype_id: [number, string] | false;
}

interface PartnerChatter {
  partner_id: number;
  partner_name: string;
  company_id?: number;
  company_name?: string;
  messages: ChatterMessage[];
  total_orders: number;
  total_revenue: number;
}

interface StyleAnalysis {
  partner_id: number;
  partner_name: string;
  communication_style: 'diretto' | 'analitico' | 'relazionale' | 'pratico';
  personality_category: 'dominante' | 'gregario';
  preferred_tone: 'formale' | 'informale' | 'amichevole';
  uses_emoji: boolean;
  message_length: 'corto' | 'medio' | 'dettagliato';
  confidence: number;
  reasoning: string;
  sample_messages: string[];
}

async function analyzeStyleWithClaude(
  anthropic: Anthropic,
  partnerName: string,
  messages: string[]
): Promise<StyleAnalysis | null> {
  if (messages.length === 0) return null;

  const prompt = `Analizza questi messaggi di ${partnerName} (cliente di un distributore alimentare) e determina il suo stile comunicativo.

MESSAGGI:
${messages.slice(0, 10).map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Basandoti sui messaggi, classifica la persona in UNO dei 4 stili:

1. DIRETTO (Dominante): Va al punto, messaggi brevi, efficiente, non fa chiacchiere
2. ANALITICO (Dominante): Chiede dettagli, confronta prezzi, vuole dati precisi
3. RELAZIONALE (Gregario): Saluta, chiede come stai, fa conversazione, usa emoji
4. PRATICO (Gregario): Vuole semplicità, ordina sempre le stesse cose, messaggi standard

Rispondi SOLO con un JSON valido (senza markdown):
{
  "communication_style": "diretto|analitico|relazionale|pratico",
  "personality_category": "dominante|gregario",
  "preferred_tone": "formale|informale|amichevole",
  "uses_emoji": true|false,
  "message_length": "corto|medio|dettagliato",
  "confidence": 0.0-1.0,
  "reasoning": "breve spiegazione in italiano"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`❌ No JSON found in response for ${partnerName}`);
      return null;
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return {
      partner_id: 0, // Will be set by caller
      partner_name: partnerName,
      ...analysis,
      sample_messages: messages.slice(0, 3)
    };

  } catch (error) {
    console.error(`❌ Error analyzing ${partnerName}:`, error);
    return null;
  }
}

function stripHtml(html: string): string {
  if (!html) return '';
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

async function main() {
  console.log("🔍 LAPA AI - Analisi Stile Comunicativo dal Chatter Odoo\n");

  // Check for API key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error("❌ ANTHROPIC_API_KEY non trovata!");
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  const odoo = await getOdooClient();
  console.log("✅ Connesso a Odoo\n");

  // Date filter: last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];

  console.log(`📅 Periodo: dal ${sixMonthsAgoStr}\n`);

  // Step 1: Get recent sales orders
  console.log("📦 Recupero ordini di vendita recenti...");
  const orders = await odoo.searchRead("sale.order",
    [
      ["date_order", ">=", sixMonthsAgoStr],
      ["state", "in", ["sale", "done"]]
    ],
    ["id", "name", "partner_id", "date_order", "amount_total"],
    5000
  );
  console.log(`   Trovati ${orders.length} ordini\n`);

  // Step 2: Group orders by partner
  const partnerOrders = new Map<number, {
    partner_id: number;
    partner_name: string;
    order_ids: number[];
    total_revenue: number;
  }>();

  orders.forEach(order => {
    const partnerId = order.partner_id[0];
    const partnerName = order.partner_id[1];

    if (EXCLUDE_COMPANY_IDS.includes(partnerId)) return;

    if (!partnerOrders.has(partnerId)) {
      partnerOrders.set(partnerId, {
        partner_id: partnerId,
        partner_name: partnerName,
        order_ids: [],
        total_revenue: 0
      });
    }

    const data = partnerOrders.get(partnerId)!;
    data.order_ids.push(order.id);
    data.total_revenue += order.amount_total;
  });

  console.log(`👥 Partner unici: ${partnerOrders.size}\n`);

  // Step 3: Sort by revenue and take sample
  const sortedPartners = [...partnerOrders.values()]
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, SAMPLE_SIZE);

  console.log(`📊 Analizzo top ${SAMPLE_SIZE} partner per fatturato:\n`);

  const results: StyleAnalysis[] = [];

  for (const partner of sortedPartners) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📧 ${partner.partner_name} (ID: ${partner.partner_id})`);
    console.log(`   Ordini: ${partner.order_ids.length} | Fatturato: CHF ${partner.total_revenue.toFixed(0)}`);

    // Get chatter messages for this partner's orders
    // mail.message model stores chatter messages
    const messages = await odoo.searchRead("mail.message",
      [
        ["res_id", "in", partner.order_ids],
        ["model", "=", "sale.order"],
        ["message_type", "in", ["comment", "email"]],
        ["body", "!=", false],
        ["body", "!=", ""]
      ],
      ["id", "date", "body", "author_id", "message_type", "subtype_id"],
      MAX_MESSAGES_PER_PARTNER
    ) as ChatterMessage[];

    // Filter to only messages from external partners (not internal users)
    // Internal users typically have author_id that matches company users
    const externalMessages = messages.filter(m => {
      const body = stripHtml(m.body);
      // Skip very short or empty messages
      if (body.length < 10) return false;
      // Skip system messages
      if (body.includes("Ordine confermato") ||
          body.includes("Quotation →") ||
          body.includes("has been created")) return false;
      return true;
    });

    console.log(`   Messaggi nel chatter: ${messages.length} (filtrati: ${externalMessages.length})`);

    if (externalMessages.length < 2) {
      console.log(`   ⚠️ Troppo pochi messaggi per analizzare`);
      continue;
    }

    // Extract message bodies
    const messageBodies = externalMessages
      .map(m => stripHtml(m.body))
      .filter(b => b.length > 5);

    // Show sample messages
    console.log(`\n   📝 Esempi messaggi:`);
    messageBodies.slice(0, 3).forEach((m, i) => {
      const short = m.substring(0, 100) + (m.length > 100 ? '...' : '');
      console.log(`      ${i + 1}. "${short}"`);
    });

    // Analyze with Claude
    console.log(`\n   🤖 Analisi con Claude...`);
    const analysis = await analyzeStyleWithClaude(anthropic, partner.partner_name, messageBodies);

    if (analysis) {
      analysis.partner_id = partner.partner_id;
      results.push(analysis);

      console.log(`   ✅ Stile: ${analysis.communication_style.toUpperCase()} (${analysis.personality_category})`);
      console.log(`   📊 Tono: ${analysis.preferred_tone} | Emoji: ${analysis.uses_emoji ? 'sì' : 'no'} | Lunghezza: ${analysis.message_length}`);
      console.log(`   💡 ${analysis.reasoning}`);
      console.log(`   🎯 Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Save results
  const outputFile = `/home/paul/chatter-style-analysis.json`;
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n\n✅ Risultati salvati in: ${outputFile}`);

  // Summary
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`RIEPILOGO ANALISI`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Partner analizzati: ${results.length}`);

  const styleCounts = results.reduce((acc, r) => {
    acc[r.communication_style] = (acc[r.communication_style] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\nDistribuzione stili:`);
  Object.entries(styleCounts).forEach(([style, count]) => {
    console.log(`  ${style}: ${count} (${((count / results.length) * 100).toFixed(0)}%)`);
  });
}

main().catch(console.error);
