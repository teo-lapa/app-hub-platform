/**
 * RIGENERAZIONE ARTICOLI INCOMPLETI
 * Rigenera i 18 articoli con traduzioni incomplete usando Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// I 18 articoli da rigenerare (tutti tranne burrata)
const ARTICLES_TO_REGENERATE = [
  'article-03-fior-latte-gerola.json',
  'article-04-guanciale-amatriciano-igp.json',
  'article-05-parmigiano-reggiano-36-mesi.json',
  'article-06-prosciutto-parma-24-mesi.json',
  'article-07-pecorino-romano-dop.json',
  'article-08-gorgonzola-dolce-dop.json',
  'article-09-mozzarella-bufala-campana-dop.json',
  'article-10-mortadella-bologna-igp.json',
  'article-11-carbonara-perfetta-ricetta.json',
  'article-12-amatriciana-perfetta-ricetta.json',
  'article-13-cacio-e-pepe-perfetta-ricetta.json',
  'article-14-pizza-napoletana-stg-ricetta.json',
  'article-15-risotto-parmigiano-ricetta.json',
  'article-16-caprese-gourmet-burrata-ricetta.json',
  'article-17-pasta-gricia-ricetta.json',
  'article-18-formaggi-italiani-dop-guida-ristoratori.json',
  'article-19-salumi-italiani-igp-guida-acquisto-ristoranti.json',
  'article-20-forniture-horeca-svizzera-scegliere-fornitore-italiano.json'
];

const TRANSLATION_PROMPT = (italianContent: any, targetLang: string) => `
Sei un traduttore professionista specializzato in contenuti SEO food & beverage.

Traduci COMPLETAMENTE questo articolo in ${targetLang === 'de_CH' ? 'TEDESCO SVIZZERO' : targetLang === 'fr_CH' ? 'FRANCESE SVIZZERO' : 'INGLESE'}.

ARTICOLO ITALIANO:
${JSON.stringify(italianContent, null, 2)}

REQUISITI TRADUZIONE:
1. Traduci TUTTO il contenuto HTML completo
2. Mantieni TUTTA la struttura HTML (section, h1, h2, h3, p, ul, li, table, etc.)
3. Traduci tutti i paragrafi, liste, tabelle, FAQ
4. Adatta keywords e meta tags per SEO locale
5. Usa terminologia culinaria corretta per ${targetLang}
6. Mantieni brand "LAPA" e "DOP/IGP/STG"

OUTPUT: Restituisci JSON con questa struttura:
{
  "name": "Titolo tradotto",
  "subtitle": "Sottotitolo tradotto",
  "meta": {
    "title": "Meta title SEO tradotto (max 60 char)",
    "description": "Meta description tradotta (120-160 char)",
    "keywords": "keywords tradotte"
  },
  "content_html": "<section>...TUTTO IL CONTENUTO HTML TRADOTTO...</section>"
}

IMPORTANTE:
- Traduci OGNI sezione, non lasciare nulla
- content_html deve avere la STESSA lunghezza dell'italiano (±10%)
- Non usare placeholder, tutto deve essere tradotto
- HTML deve essere valido e completo
`;

async function translateArticle(italianContent: any, targetLang: string): Promise<any> {
  console.log(`   Traduco in ${targetLang}...`);

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: TRANSLATION_PROMPT(italianContent, targetLang)
    }]
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error(`Risposta non valida per ${targetLang}`);
  }

  return JSON.parse(jsonMatch[0]);
}

async function regenerateArticle(filename: string) {
  const filepath = join('data/new-articles', filename);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📝 ${filename}`);
  console.log('─'.repeat(70));

  try {
    // Leggi articolo esistente per mantenere l'italiano
    const existing = JSON.parse(readFileSync(filepath, 'utf-8'));
    const italianContent = existing.translations.it_IT;

    console.log(`   ✅ Italiano esistente: ${italianContent.content_html.length} caratteri`);

    // Rigenera traduzioni COMPLETE
    const translations: any = {
      it_IT: italianContent // Mantieni italiano
    };

    for (const lang of ['de_DE', 'fr_FR', 'en_US']) {
      const odooLang = lang === 'de_DE' ? 'de_CH' : lang === 'fr_FR' ? 'fr_CH' : 'en_US';

      try {
        const translated = await translateArticle(italianContent, odooLang);
        translations[lang] = translated;

        const percent = Math.round((translated.content_html.length / italianContent.content_html.length) * 100);
        console.log(`   ✅ ${lang}: ${translated.content_html.length} caratteri (${percent}%)`);

        // Pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e: any) {
        console.log(`   ❌ Errore ${lang}: ${e.message}`);
        throw e;
      }
    }

    // Salva articolo completo
    const newArticle = {
      ...existing,
      translations
    };

    writeFileSync(filepath, JSON.stringify(newArticle, null, 2));
    console.log(`   💾 Salvato!`);

    return { success: true, filename };
  } catch (e: any) {
    console.log(`   ❌ ERRORE: ${e.message}`);
    return { success: false, filename, error: e.message };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      RIGENERAZIONE 18 ARTICOLI CON TRADUZIONI COMPLETE    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`📄 Articoli da rigenerare: ${ARTICLES_TO_REGENERATE.length}\n`);

  const results = [];

  for (let i = 0; i < ARTICLES_TO_REGENERATE.length; i++) {
    const filename = ARTICLES_TO_REGENERATE[i];
    console.log(`[${i+1}/${ARTICLES_TO_REGENERATE.length}]`);

    const result = await regenerateArticle(filename);
    results.push(result);

    // Pausa tra articoli
    if (i < ARTICLES_TO_REGENERATE.length - 1) {
      console.log('\n⏳ Pausa 3 secondi...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Riepilogo
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RIEPILOGO RIGENERAZIONE');
  console.log('═'.repeat(70) + '\n');

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  console.log(`✅ Successi: ${successes.length}/${ARTICLES_TO_REGENERATE.length}`);
  console.log(`❌ Errori: ${failures.length}/${ARTICLES_TO_REGENERATE.length}\n`);

  if (failures.length > 0) {
    console.log('❌ ERRORI:\n');
    failures.forEach(f => {
      console.log(`  • ${f.filename}: ${f.error}`);
    });
  }

  console.log('\n🎉 Rigenerazione completata!');
  console.log('📋 Prossimi passi:');
  console.log('   1. Verifica che tutti gli articoli abbiano traduzioni al 90-100%');
  console.log('   2. Elimina articoli 211-228 da Odoo (tengo solo 210-Burrata)');
  console.log('   3. Ricarica con: npx tsx scripts/upload-all-articles-final.ts\n');
}

main().catch(console.error);
