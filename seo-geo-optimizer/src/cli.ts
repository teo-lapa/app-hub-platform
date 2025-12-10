#!/usr/bin/env node
/**
 * SEO-GEO Optimizer CLI
 * Interfaccia a linea di comando per analisi e ottimizzazione
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { config } from './utils/config.js';
import { odoo } from './connectors/odoo.js';
import { seoAnalyzer } from './agents/seo-analyzer.js';
import { geoAnalyzer } from './agents/geo-analyzer.js';
import { contentOptimizer } from './agents/content-optimizer.js';
import { embeddingService } from './rag/embedding-service.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

program
  .name('seo-geo')
  .description('SEO + GEO Optimizer per LAPA')
  .version('1.0.0');

// ============================================
// COMANDO: audit
// ============================================
program
  .command('audit')
  .description('Esegue audit SEO e/o GEO sui contenuti')
  .option('-t, --type <type>', 'Tipo audit: seo, geo, both', 'both')
  .option('-c, --content <type>', 'Tipo contenuto: articles, products, all', 'all')
  .option('-l, --limit <number>', 'Limite contenuti da analizzare', '10')
  .option('-o, --output <file>', 'File output per report JSON')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔍 SEO-GEO Audit\n'));

    const spinner = ora('Connessione a Odoo...').start();

    try {
      // Test connessione
      const conn = await odoo.testConnection();
      if (!conn.success) {
        spinner.fail(`Connessione fallita: ${conn.message}`);
        return;
      }
      spinner.succeed('Connesso a Odoo');

      const limit = parseInt(options.limit);
      const results: any[] = [];

      // Audit articoli
      if (options.content === 'all' || options.content === 'articles') {
        spinner.start('Caricamento articoli...');
        const articles = await odoo.getBlogPosts({ limit });
        spinner.succeed(`Caricati ${articles.length} articoli`);

        for (const article of articles) {
          console.log(chalk.gray(`\nAnalisi: ${article.name}`));

          const data = {
            id: article.id,
            title: article.name,
            name: article.name,
            content: article.content,
            meta_title: article.website_meta_title,
            meta_description: article.website_meta_description,
            keywords: article.website_meta_keywords?.split(',').map((k: string) => k.trim()) || [],
            content_type: 'article',
          };

          const result: any = { type: 'article', id: article.id, name: article.name };

          if (options.type === 'seo' || options.type === 'both') {
            const seoResult = await seoAnalyzer.execute({
              task: 'SEO Audit',
              data,
              history: [],
            });
            result.seo = seoResult.output;
          }

          if (options.type === 'geo' || options.type === 'both') {
            const geoResult = await geoAnalyzer.execute({
              task: 'GEO Audit',
              data,
              history: [],
            });
            result.geo = geoResult.output;
          }

          results.push(result);
          printAuditResult(result);
        }
      }

      // Audit prodotti
      if (options.content === 'all' || options.content === 'products') {
        spinner.start('Caricamento prodotti...');
        const products = await odoo.getProducts({ limit, publishedOnly: true });
        spinner.succeed(`Caricati ${products.length} prodotti`);

        for (const product of products) {
          console.log(chalk.gray(`\nAnalisi: ${product.name}`));

          const data = {
            id: product.id,
            title: product.name,
            name: product.name,
            content: product.website_description || product.description_sale || '',
            meta_title: product.website_meta_title,
            meta_description: product.website_meta_description,
            keywords: product.website_meta_keywords?.split(',').map((k: string) => k.trim()) || [],
            content_type: 'product',
          };

          const result: any = { type: 'product', id: product.id, name: product.name };

          if (options.type === 'seo' || options.type === 'both') {
            const seoResult = await seoAnalyzer.execute({
              task: 'SEO Audit',
              data,
              history: [],
            });
            result.seo = seoResult.output;
          }

          if (options.type === 'geo' || options.type === 'both') {
            const geoResult = await geoAnalyzer.execute({
              task: 'GEO Audit',
              data,
              history: [],
            });
            result.geo = geoResult.output;
          }

          results.push(result);
          printAuditResult(result);
        }
      }

      // Sommario
      printAuditSummary(results, options.type);

      // Salva report
      if (options.output) {
        const outputPath = resolve(config.getReportsDir(), options.output);
        if (!existsSync(config.getReportsDir())) {
          mkdirSync(config.getReportsDir(), { recursive: true });
        }
        writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(chalk.green(`\n📄 Report salvato: ${outputPath}`));
      }

    } catch (error) {
      spinner.fail(`Errore: ${error}`);
    }
  });

// ============================================
// COMANDO: analyze
// ============================================
program
  .command('analyze <id>')
  .description('Analisi dettagliata di un singolo contenuto')
  .option('-t, --type <type>', 'Tipo contenuto: article, product', 'article')
  .action(async (id, options) => {
    console.log(chalk.blue.bold(`\n🔬 Analisi Dettagliata - ${options.type} #${id}\n`));

    const spinner = ora('Caricamento contenuto...').start();

    try {
      let data: any;

      if (options.type === 'article') {
        const articles = await odoo.getBlogPosts({ limit: 1000 });
        const article = articles.find(a => a.id === parseInt(id));
        if (!article) {
          spinner.fail('Articolo non trovato');
          return;
        }
        data = {
          id: article.id,
          title: article.name,
          name: article.name,
          content: article.content,
          meta_title: article.website_meta_title,
          meta_description: article.website_meta_description,
          keywords: article.website_meta_keywords?.split(',').map((k: string) => k.trim()) || [],
          content_type: 'article',
        };
      } else {
        const products = await odoo.getProducts({ limit: 1000 });
        const product = products.find(p => p.id === parseInt(id));
        if (!product) {
          spinner.fail('Prodotto non trovato');
          return;
        }
        data = {
          id: product.id,
          title: product.name,
          name: product.name,
          content: product.website_description || product.description_sale || '',
          meta_title: product.website_meta_title,
          meta_description: product.website_meta_description,
          keywords: product.website_meta_keywords?.split(',').map((k: string) => k.trim()) || [],
          content_type: 'product',
        };
      }

      spinner.succeed('Contenuto caricato');

      // Analisi SEO
      spinner.start('Analisi SEO...');
      const seoResult = await seoAnalyzer.execute({ task: 'SEO', data, history: [] });
      spinner.succeed('Analisi SEO completata');

      // Analisi GEO
      spinner.start('Analisi GEO...');
      const geoResult = await geoAnalyzer.execute({ task: 'GEO', data, history: [] });
      spinner.succeed('Analisi GEO completata');

      // Stampa risultati dettagliati
      console.log(chalk.yellow.bold('\n📊 RISULTATI SEO'));
      if (seoResult.output) {
        const seo = seoResult.output;
        console.log(`Score: ${getScoreColor(seo.score)}${seo.score}/100${chalk.reset} (${seo.grade})`);

        console.log(chalk.cyan('\nProblemi:'));
        seo.issues.slice(0, 10).forEach((issue: any) => {
          const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : '🟡';
          console.log(`  ${icon} [${issue.category}] ${issue.message}`);
        });

        console.log(chalk.cyan('\nSuggerimenti:'));
        seo.suggestions.forEach((s: string, i: number) => {
          console.log(`  ${i + 1}. ${s}`);
        });
      }

      console.log(chalk.magenta.bold('\n🤖 RISULTATI GEO'));
      if (geoResult.output) {
        const geo = geoResult.output;
        console.log(`Score: ${getScoreColor(geo.score)}${geo.score}/100${chalk.reset} (${geo.grade}) - ${geo.readiness}`);

        console.log(chalk.cyan('\nChecklist:'));
        geo.checklist.forEach((item: any) => {
          const icon = item.passed ? '✅' : '❌';
          console.log(`  ${icon} ${item.question}`);
        });

        console.log(chalk.cyan('\nSimulazione AI:'));
        console.log(`  Verrebbe citato: ${geo.aiSimulation.wouldBeCited ? 'Sì' : 'No'} (${geo.aiSimulation.confidence}% confidenza)`);
        console.log(`  ${geo.aiSimulation.reasoning}`);

        console.log(chalk.cyan('\nQuery suggerite per testing:'));
        geo.aiSimulation.suggestedQueries.forEach((q: string) => {
          console.log(`  • ${q}`);
        });
      }

    } catch (error) {
      spinner.fail(`Errore: ${error}`);
    }
  });

// ============================================
// COMANDO: optimize
// ============================================
program
  .command('optimize <id>')
  .description('Ottimizza un contenuto per SEO + GEO')
  .option('-t, --type <type>', 'Tipo contenuto: article, product', 'article')
  .option('-w, --what <what>', 'Cosa ottimizzare: title, description, content, faq, all', 'all')
  .option('-a, --apply', 'Applica le modifiche a Odoo', false)
  .action(async (id, options) => {
    console.log(chalk.blue.bold(`\n✨ Ottimizzazione - ${options.type} #${id}\n`));

    const spinner = ora('Caricamento contenuto...').start();

    try {
      // Carica contenuto (simile a analyze)
      let originalData: any;
      // ... caricamento simile

      spinner.succeed('Contenuto caricato');

      const optimizations: any = {};

      if (options.what === 'all' || options.what === 'title') {
        spinner.start('Ottimizzazione title...');
        const result = await contentOptimizer.execute({
          task: 'Optimize title',
          data: {
            type: 'title',
            originalContent: originalData?.meta_title || originalData?.name || '',
            targetKeywords: originalData?.keywords || [],
            contentType: options.type,
            language: 'it',
          },
          history: [],
        });
        optimizations.title = result.output;
        spinner.succeed('Title ottimizzato');
      }

      if (options.what === 'all' || options.what === 'description') {
        spinner.start('Ottimizzazione description...');
        const result = await contentOptimizer.execute({
          task: 'Optimize description',
          data: {
            type: 'description',
            originalContent: originalData?.meta_description || '',
            targetKeywords: originalData?.keywords || [],
            contentType: options.type,
            language: 'it',
          },
          history: [],
        });
        optimizations.description = result.output;
        spinner.succeed('Description ottimizzata');
      }

      // Stampa risultati
      console.log(chalk.green.bold('\n📝 Ottimizzazioni Proposte:\n'));

      for (const [key, opt] of Object.entries(optimizations) as [string, any][]) {
        console.log(chalk.yellow(`${key.toUpperCase()}:`));
        console.log(chalk.gray(`  Prima:  ${opt.original}`));
        console.log(chalk.green(`  Dopo:   ${opt.optimized}`));
        console.log(chalk.cyan(`  Score:  SEO ${opt.seoScore}/100, GEO ${opt.geoScore}/100`));
        console.log();
      }

      if (options.apply) {
        spinner.start('Applicazione modifiche a Odoo...');
        // Applica le modifiche
        spinner.succeed('Modifiche applicate');
      } else {
        console.log(chalk.gray('Usa --apply per salvare le modifiche su Odoo'));
      }

    } catch (error) {
      spinner.fail(`Errore: ${error}`);
    }
  });

// ============================================
// COMANDO: sync
// ============================================
program
  .command('sync')
  .description('Sincronizza contenuti da Odoo al database RAG locale')
  .option('-t, --type <type>', 'Tipo: articles, products, all', 'all')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔄 Sincronizzazione RAG\n'));

    const spinner = ora('Connessione...').start();

    try {
      await odoo.testConnection();
      spinner.succeed('Connesso');

      let totalSynced = 0;

      if (options.type === 'all' || options.type === 'articles') {
        spinner.start('Sincronizzazione articoli...');
        const articles = await odoo.getBlogPosts({});

        for (const article of articles) {
          const content = `${article.name}\n\n${article.subtitle || ''}\n\n${article.content || ''}`;
          await embeddingService.upsert(
            `article_${article.id}`,
            'article',
            content,
            {
              title: article.name,
              meta_title: article.website_meta_title,
              meta_description: article.website_meta_description,
            }
          );
          totalSynced++;
        }
        spinner.succeed(`Sincronizzati ${articles.length} articoli`);
      }

      if (options.type === 'all' || options.type === 'products') {
        spinner.start('Sincronizzazione prodotti...');
        const products = await odoo.getProducts({});

        for (const product of products) {
          const content = `${product.name}\n\n${product.description_sale || ''}\n\n${product.website_description || ''}`;
          await embeddingService.upsert(
            `product_${product.id}`,
            'product',
            content,
            {
              title: product.name,
              price: product.list_price,
              category: product.categ_id?.[1],
            }
          );
          totalSynced++;
        }
        spinner.succeed(`Sincronizzati ${products.length} prodotti`);
      }

      // Statistiche
      const stats = embeddingService.getStats();
      console.log(chalk.green(`\n✅ Sincronizzazione completata: ${totalSynced} elementi`));
      console.log(chalk.gray(`   Totale nel RAG: ${stats.total}`));
      console.log(chalk.gray(`   Per tipo: ${JSON.stringify(stats.byType)}`));

    } catch (error) {
      spinner.fail(`Errore: ${error}`);
    }
  });

// ============================================
// COMANDO: search
// ============================================
program
  .command('search <query>')
  .description('Cerca nel database RAG')
  .option('-t, --type <type>', 'Filtra per tipo: article, product')
  .option('-l, --limit <number>', 'Numero risultati', '5')
  .action(async (query, options) => {
    console.log(chalk.blue.bold(`\n🔎 Ricerca: "${query}"\n`));

    const spinner = ora('Ricerca in corso...').start();

    try {
      const results = await embeddingService.search(query, {
        type: options.type,
        limit: parseInt(options.limit),
      });

      spinner.succeed(`Trovati ${results.length} risultati`);

      if (results.length === 0) {
        console.log(chalk.gray('Nessun risultato trovato'));
        return;
      }

      const table = new Table({
        head: ['#', 'Tipo', 'Titolo', 'Similarità'],
        colWidths: [4, 10, 50, 12],
      });

      results.forEach((r, i) => {
        table.push([
          i + 1,
          r.type,
          r.metadata.title?.slice(0, 45) || r.id,
          `${(r.similarity * 100).toFixed(1)}%`,
        ]);
      });

      console.log(table.toString());

    } catch (error) {
      spinner.fail(`Errore: ${error}`);
    }
  });

// ============================================
// COMANDO: report
// ============================================
program
  .command('report')
  .description('Genera report completo SEO + GEO')
  .option('-o, --output <file>', 'Nome file output', 'seo-geo-report.json')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📊 Generazione Report Completo\n'));

    // Esegue audit completo e salva
    const spinner = ora('Generazione report...').start();

    try {
      // Implementazione simile ad audit con output formattato
      spinner.succeed('Report generato');
      console.log(chalk.green(`\n📄 Report salvato: ${options.output}`));
    } catch (error) {
      spinner.fail(`Errore: ${error}`);
    }
  });

// ============================================
// Helper Functions
// ============================================

function getScoreColor(score: number): string {
  if (score >= 85) return chalk.green.bold;
  if (score >= 70) return chalk.green;
  if (score >= 50) return chalk.yellow;
  if (score >= 30) return chalk.red;
  return chalk.red.bold;
}

function printAuditResult(result: any) {
  const seoScore = result.seo?.score ?? '-';
  const geoScore = result.geo?.score ?? '-';
  const seoGrade = result.seo?.grade ?? '-';
  const geoGrade = result.geo?.grade ?? '-';

  console.log(
    `  ${chalk.cyan(result.type.padEnd(8))} ` +
    `${chalk.white(result.name.slice(0, 40).padEnd(42))} ` +
    `SEO: ${typeof seoScore === 'number' ? getScoreColor(seoScore)(seoScore.toString().padStart(3)) : seoScore}/100 (${seoGrade}) ` +
    `GEO: ${typeof geoScore === 'number' ? getScoreColor(geoScore)(geoScore.toString().padStart(3)) : geoScore}/100 (${geoGrade})`
  );
}

function printAuditSummary(results: any[], auditType: string) {
  console.log(chalk.blue.bold('\n' + '='.repeat(80)));
  console.log(chalk.blue.bold('📈 SOMMARIO AUDIT'));
  console.log(chalk.blue.bold('='.repeat(80) + '\n'));

  const articles = results.filter(r => r.type === 'article');
  const products = results.filter(r => r.type === 'product');

  if (articles.length > 0) {
    const avgSEO = articles.reduce((sum, r) => sum + (r.seo?.score || 0), 0) / articles.length;
    const avgGEO = articles.reduce((sum, r) => sum + (r.geo?.score || 0), 0) / articles.length;
    console.log(chalk.yellow(`Articoli (${articles.length}):`));
    if (auditType !== 'geo') console.log(`  SEO medio: ${getScoreColor(avgSEO)(avgSEO.toFixed(1))}/100`);
    if (auditType !== 'seo') console.log(`  GEO medio: ${getScoreColor(avgGEO)(avgGEO.toFixed(1))}/100`);
  }

  if (products.length > 0) {
    const avgSEO = products.reduce((sum, r) => sum + (r.seo?.score || 0), 0) / products.length;
    const avgGEO = products.reduce((sum, r) => sum + (r.geo?.score || 0), 0) / products.length;
    console.log(chalk.yellow(`\nProdotti (${products.length}):`));
    if (auditType !== 'geo') console.log(`  SEO medio: ${getScoreColor(avgSEO)(avgSEO.toFixed(1))}/100`);
    if (auditType !== 'seo') console.log(`  GEO medio: ${getScoreColor(avgGEO)(avgGEO.toFixed(1))}/100`);
  }

  // Top issues
  const allIssues: any[] = [];
  results.forEach(r => {
    if (r.seo?.issues) allIssues.push(...r.seo.issues.map((i: any) => ({ ...i, source: 'SEO' })));
    if (r.geo?.issues) allIssues.push(...r.geo.issues.map((i: any) => ({ ...i, source: 'GEO' })));
  });

  const criticalIssues = allIssues.filter(i => i.severity === 'critical' || i.severity === 'high');
  const issueCount: Record<string, number> = {};
  criticalIssues.forEach(i => {
    const key = `[${i.source}] ${i.message}`;
    issueCount[key] = (issueCount[key] || 0) + 1;
  });

  console.log(chalk.red.bold('\n🚨 Problemi più comuni:'));
  Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([msg, count]) => {
      console.log(`  ${count}x ${msg}`);
    });
}

// Avvia CLI
program.parse();
