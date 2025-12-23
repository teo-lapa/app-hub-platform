/**
 * Upload TUTTI gli articoli con traduzioni al 91%
 * Usa upload-article-final.ts (versione definitiva)
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
    .sort();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          UPLOAD TUTTI GLI ARTICOLI SU ODOO                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`📄 Trovati ${files.length} articoli da caricare\n`);

  const results: Array<{ file: string; postId?: number; title?: string; error?: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const articlePath = join(articlesDir, file);

    console.log(`\n[${ i + 1}/${files.length}] ${file}`);
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
      const idMatch = output.match(/✅ (\d+)/);
      const postId = idMatch ? parseInt(idMatch[1]) : undefined;

      // Estrai percentuali di traduzione
      const pctMatch = output.match(/(\d+)%\)/);
      const percentage = pctMatch ? pctMatch[1] + '%' : 'N/A';

      results.push({ file, postId, title });

      console.log(`✅ Caricato: ID ${postId} (${percentage} traduzioni)`);

      // Pausa tra articoli
      await new Promise(r => setTimeout(r, 2000));

    } catch (e: any) {
      const errorMsg = e.message.substring(0, 200);
      console.log(`❌ ERRORE: ${errorMsg}`);
      results.push({ file, error: errorMsg });
    }
  }

  // Riepilogo finale
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RIEPILOGO UPLOAD');
  console.log('═'.repeat(60) + '\n');

  const successes = results.filter(r => r.postId);
  const errors = results.filter(r => r.error);

  console.log(`✅ Successi: ${successes.length}/${files.length}`);
  console.log(`❌ Errori: ${errors.length}/${files.length}\n`);

  if (successes.length > 0) {
    console.log('✅ ARTICOLI CARICATI:\n');
    for (const r of successes) {
      console.log(`  • ID ${r.postId}: "${r.title?.substring(0, 50)}..."`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORI:\n');
    for (const r of errors) {
      console.log(`  • ${r.file}: ${r.error?.substring(0, 80)}`);
    }
  }

  console.log('\n🎉 Upload completato!');
  console.log('\n⚠️  IMPORTANTE: Gli articoli sono in BOZZA.');
  console.log('   Revisiona e pubblica manualmente da Odoo.\n');
}

main().catch(console.error);
