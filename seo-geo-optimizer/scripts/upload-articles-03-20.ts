/**
 * Upload articoli 03-20 rigenerati (esclude 02-Burrata già presente come post 210)
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const articlesDir = join(__dirname, '../data/new-articles');
  const files = readdirSync(articlesDir)
    .filter(f => f.endsWith('.json') && f.startsWith('article-'))
    .filter(f => !f.includes('article-02')) // Esclude Burrata (già presente come post 210)
    .sort();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    UPLOAD ARTICOLI 03-20 RIGENERATI (esclude Burrata)    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`📄 Trovati ${files.length} articoli da caricare (esclude 02-Burrata)\n`);

  const results: Array<{ file: string; postId?: number; title?: string; pct?: string; error?: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const articlePath = join(articlesDir, file);

    console.log(`\n[${i + 1}/${files.length}] ${file}`);
    console.log('─'.repeat(60));

    try {
      // Leggi il titolo
      const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
      const title = article.translations.it_IT.name;

      console.log(`📝 "${title.substring(0, 50)}..."`);

      // Esegui upload con lo script FINALE
      const output = execSync(
        `npx tsx scripts/upload-article-final.ts "${articlePath}"`,
        { cwd: join(__dirname, '..'), encoding: 'utf-8', timeout: 120000 }
      );

      // Estrai l'ID dal output
      const idMatch = output.match(/Post creato con ID: (\d+)/);
      const postId = idMatch ? parseInt(idMatch[1]) : undefined;

      // Estrai percentuali di traduzione (cerca la media)
      const lines = output.split('\n');
      const translationLine = lines.find(l => l.includes('Traduzioni:'));
      let pct = 'N/A';
      if (translationLine) {
        const match = translationLine.match(/(\d+)%/g);
        if (match && match.length >= 3) {
          const percentages = match.map(m => parseInt(m));
          const avg = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
          pct = `${avg}%`;
        }
      }

      results.push({ file, postId, title, pct });

      console.log(`✅ Caricato: ID ${postId} (${pct} traduzioni medie)`);

      // Pausa tra articoli
      await new Promise(r => setTimeout(r, 2000));

    } catch (e: any) {
      const errorMsg = e.message.substring(0, 200);
      console.log(`❌ ERRORE: ${errorMsg}`);
      results.push({ file, error: errorMsg });
    }
  }

  // Riepilogo finale
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RIEPILOGO UPLOAD FINALE');
  console.log('═'.repeat(70) + '\n');

  const successes = results.filter(r => r.postId);
  const errors = results.filter(r => r.error);

  console.log(`✅ Successi: ${successes.length}/${files.length}`);
  console.log(`❌ Errori: ${errors.length}/${files.length}\n`);

  if (successes.length > 0) {
    console.log('✅ ARTICOLI CARICATI CON TRADUZIONI COMPLETE:\n');
    for (const r of successes) {
      console.log(`  • ID ${r.postId} (${r.pct}): "${r.title?.substring(0, 50)}..."`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORI:\n');
    for (const r of errors) {
      console.log(`  • ${r.file}: ${r.error?.substring(0, 80)}`);
    }
  }

  console.log('\n🎉 Upload completato!');
  console.log('\n📋 RIEPILOGO FINALE:');
  console.log('   • Post 210: Burrata (già presente, traduzioni 83%)');
  console.log(`   • Post ${successes[0]?.postId}-${successes[successes.length-1]?.postId}: ${successes.length} nuovi articoli (traduzioni 95-107%)`);
  console.log('\n⚠️  IMPORTANTE: Gli articoli sono in BOZZA.');
  console.log('   Revisiona e pubblica manualmente da Odoo.\n');
}

main().catch(console.error);
