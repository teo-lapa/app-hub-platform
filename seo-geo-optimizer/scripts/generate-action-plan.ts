/**
 * Analisi report SEO/GEO e generazione piano d'azione prioritizzato
 * Identifica articoli problematici e suggerisce azioni concrete
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ArticleAnalysis {
  id: number;
  name: string;
  isPublished: boolean;
  translations: {
    [lang: string]: {
      name: string;
      subtitle: string;
      metaTitle: string;
      metaDescription: string;
      metaKeywords: string;
      contentPreview: string;
      contentWordCount: number;
      hasContent: boolean;
    }
  };
  seoIssues: string[];
  geoScore: number;
  translationStatus: {
    [lang: string]: 'complete' | 'partial' | 'missing';
  };
  structure: {
    wordCount: number;
    h1: number;
    h2: number;
    h3: number;
    lists: number;
    images: number;
    links: number;
  };
}

interface Report {
  generatedAt: string;
  summary: any;
  commonIssues: Record<string, number>;
  articles: ArticleAnalysis[];
}

interface ActionItem {
  articleId: number;
  articleName: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  isPublished: boolean;
  seoIssueCount: number;
  geoScore: number;
  issues: string[];
  actions: string[];
  translationIssues: string[];
  estimatedEffort: 'Quick' | 'Medium' | 'Long';
}

function calculatePriority(article: ArticleAnalysis): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const { isPublished, seoIssues, geoScore, translationStatus } = article;

  if (!isPublished) return 'LOW'; // Articoli non pubblicati hanno bassa priorità

  const issueCount = seoIssues.length;
  const hasCriticalIssues = seoIssues.some(issue =>
    issue.includes('H1') ||
    issue.includes('Meta title mancante') ||
    issue.includes('Meta description mancante')
  );

  const hasMissingTranslations = Object.values(translationStatus).some(s => s === 'missing');

  // CRITICAL: pubblicato con problemi gravi
  if (issueCount >= 6 || (hasCriticalIssues && issueCount >= 4) || geoScore < 20) {
    return 'CRITICAL';
  }

  // HIGH: pubblicato con problemi significativi
  if (issueCount >= 4 || hasCriticalIssues || geoScore < 40 || hasMissingTranslations) {
    return 'HIGH';
  }

  // MEDIUM: pubblicato con alcuni problemi
  if (issueCount >= 2 || geoScore < 60) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function estimateEffort(article: ArticleAnalysis): 'Quick' | 'Medium' | 'Long' {
  const issueCount = article.seoIssues.length;
  const hasMajorContentWork = article.seoIssues.some(issue =>
    issue.includes('Contenuto troppo corto') ||
    issue.includes('Manca H1') ||
    issue.includes('Mancano H2')
  );

  const translationWork = Object.values(article.translationStatus).filter(s => s !== 'complete').length;

  if (hasMajorContentWork || translationWork >= 2) {
    return 'Long';
  }

  if (issueCount >= 4 || translationWork >= 1) {
    return 'Medium';
  }

  return 'Quick';
}

function generateActions(article: ArticleAnalysis): string[] {
  const actions: string[] = [];
  const { seoIssues, structure, geoScore } = article;

  // Azioni SEO
  if (seoIssues.includes('Nessuna immagine')) {
    actions.push('➕ Aggiungere almeno 1-2 immagini rilevanti al contenuto');
  }

  if (seoIssues.includes('Manca H1')) {
    actions.push('📝 Aggiungere un H1 chiaro e descrittivo all\'inizio dell\'articolo');
  }

  if (seoIssues.some(i => i.includes('Troppi H1'))) {
    actions.push('🔧 Convertire gli H1 extra in H2 o H3 (dovrebbe esserci solo 1 H1)');
  }

  if (seoIssues.includes('Mancano H2 (sottotitoli)')) {
    actions.push('📋 Strutturare il contenuto con sottotitoli H2 per migliorare leggibilità');
  }

  if (seoIssues.some(i => i.includes('Meta title'))) {
    if (seoIssues.includes('Meta title mancante')) {
      actions.push('🏷️ Creare meta title ottimizzato (30-60 caratteri, con keyword principale)');
    } else if (seoIssues.some(i => i.includes('troppo corto'))) {
      actions.push('🏷️ Allungare meta title (almeno 30 caratteri)');
    } else if (seoIssues.some(i => i.includes('troppo lungo'))) {
      actions.push('🏷️ Accorciare meta title (massimo 60 caratteri)');
    }
  }

  if (seoIssues.some(i => i.includes('Meta description'))) {
    if (seoIssues.includes('Meta description mancante')) {
      actions.push('📄 Creare meta description (120-160 caratteri, con CTA)');
    } else if (seoIssues.some(i => i.includes('troppo corta'))) {
      actions.push('📄 Espandere meta description (almeno 120 caratteri)');
    } else if (seoIssues.some(i => i.includes('troppo lunga'))) {
      actions.push('📄 Ridurre meta description (massimo 160 caratteri)');
    }
  }

  if (seoIssues.includes('Meta keywords mancanti')) {
    actions.push('🔑 Aggiungere 3-5 keywords rilevanti');
  }

  if (seoIssues.some(i => i.includes('Contenuto troppo corto'))) {
    actions.push('📝 Espandere contenuto (almeno 300 parole) con informazioni utili e dettagliate');
  }

  if (seoIssues.includes('Nessuna lista (UL/OL)')) {
    actions.push('📋 Aggiungere liste puntate o numerate per migliorare scansionabilità');
  }

  if (seoIssues.includes('Nessun link')) {
    actions.push('🔗 Aggiungere link interni ad altri articoli o prodotti correlati');
  }

  // Azioni GEO
  if (geoScore < 30) {
    actions.push('🌍 CRITICO GEO: Aggiungere riferimenti geografici (Svizzera, cantoni, città)');
    actions.push('🌍 Includere termini locali e brand LAPA per migliorare targeting geografico');
  } else if (geoScore < 50) {
    actions.push('🌍 Migliorare GEO score con più menzioni geografiche svizzere');
  }

  return actions;
}

function generateTranslationIssues(article: ArticleAnalysis): string[] {
  const issues: string[] = [];
  const { translationStatus } = article;

  const langs = {
    'de_CH': 'Tedesco',
    'fr_CH': 'Francese',
    'en_US': 'Inglese'
  };

  for (const [lang, name] of Object.entries(langs)) {
    const status = translationStatus[lang];
    if (status === 'missing') {
      issues.push(`❌ ${name}: Traduzione completamente mancante`);
    } else if (status === 'partial') {
      issues.push(`⚠️ ${name}: Traduzione parziale (completare contenuto e meta)`);
    }
  }

  return issues;
}

function main() {
  console.log('\n🎯 GENERAZIONE PIANO D\'AZIONE SEO/GEO\n');
  console.log('='.repeat(70));

  // Carica report
  const reportPath = join(__dirname, '..', 'data', 'seo-geo-report.json');
  const report: Report = JSON.parse(readFileSync(reportPath, 'utf-8'));

  console.log(`\n📊 Report caricato: ${report.articles.length} articoli analizzati`);
  console.log(`   Generato: ${new Date(report.generatedAt).toLocaleString('it-IT')}\n`);

  // Genera action items
  const actionItems: ActionItem[] = report.articles.map(article => ({
    articleId: article.id,
    articleName: article.name,
    priority: calculatePriority(article),
    isPublished: article.isPublished,
    seoIssueCount: article.seoIssues.length,
    geoScore: article.geoScore,
    issues: article.seoIssues,
    actions: generateActions(article),
    translationIssues: generateTranslationIssues(article),
    estimatedEffort: estimateEffort(article)
  }));

  // Ordina per priorità
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  actionItems.sort((a, b) => {
    if (a.priority !== b.priority) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.seoIssueCount - a.seoIssueCount;
  });

  // Statistiche
  const stats = {
    total: actionItems.length,
    published: actionItems.filter(a => a.isPublished).length,
    byPriority: {
      CRITICAL: actionItems.filter(a => a.priority === 'CRITICAL').length,
      HIGH: actionItems.filter(a => a.priority === 'HIGH').length,
      MEDIUM: actionItems.filter(a => a.priority === 'MEDIUM').length,
      LOW: actionItems.filter(a => a.priority === 'LOW').length,
    },
    byEffort: {
      Quick: actionItems.filter(a => a.estimatedEffort === 'Quick' && a.isPublished).length,
      Medium: actionItems.filter(a => a.estimatedEffort === 'Medium' && a.isPublished).length,
      Long: actionItems.filter(a => a.estimatedEffort === 'Long' && a.isPublished).length,
    }
  };

  console.log('📈 STATISTICHE AZIONI RICHIESTE\n');
  console.log(`   Articoli totali: ${stats.total}`);
  console.log(`   Articoli pubblicati: ${stats.published}\n`);

  console.log('   Per priorità:');
  console.log(`      🔴 CRITICAL: ${stats.byPriority.CRITICAL} articoli`);
  console.log(`      🟠 HIGH:     ${stats.byPriority.HIGH} articoli`);
  console.log(`      🟡 MEDIUM:   ${stats.byPriority.MEDIUM} articoli`);
  console.log(`      🟢 LOW:      ${stats.byPriority.LOW} articoli\n`);

  console.log('   Per sforzo richiesto (solo pubblicati):');
  console.log(`      ⚡ Quick:  ${stats.byEffort.Quick} articoli (< 30 min)`);
  console.log(`      ⏱️  Medium: ${stats.byEffort.Medium} articoli (30-60 min)`);
  console.log(`      ⏳ Long:   ${stats.byEffort.Long} articoli (> 60 min)\n`);

  // Report articoli critici
  const critical = actionItems.filter(a => a.priority === 'CRITICAL' && a.isPublished).slice(0, 10);
  if (critical.length > 0) {
    console.log('='.repeat(70));
    console.log('🚨 TOP 10 ARTICOLI CRITICI (azione immediata richiesta)\n');

    critical.forEach((item, index) => {
      console.log(`${index + 1}. [ID:${item.articleId}] ${item.articleName.substring(0, 50)}...`);
      console.log(`   📊 Problemi: ${item.seoIssueCount} | GEO: ${item.geoScore}/100 | Sforzo: ${item.estimatedEffort}`);

      if (item.actions.length > 0) {
        console.log(`   ✅ Azioni da fare:`);
        item.actions.forEach(action => console.log(`      ${action}`));
      }

      if (item.translationIssues.length > 0) {
        console.log(`   🌍 Traduzioni:`);
        item.translationIssues.forEach(issue => console.log(`      ${issue}`));
      }
      console.log();
    });
  }

  // Quick wins
  const quickWins = actionItems.filter(a =>
    a.isPublished &&
    a.estimatedEffort === 'Quick' &&
    (a.priority === 'HIGH' || a.priority === 'CRITICAL')
  ).slice(0, 15);

  if (quickWins.length > 0) {
    console.log('='.repeat(70));
    console.log('⚡ QUICK WINS - Massimo impatto, minimo sforzo (< 30 min ciascuno)\n');

    quickWins.forEach((item, index) => {
      console.log(`${index + 1}. [ID:${item.articleId}] ${item.articleName.substring(0, 50)}...`);
      console.log(`   ${item.actions.join(' | ')}\n`);
    });
  }

  // Articoli con problemi di traduzione
  const translationProblems = actionItems.filter(a =>
    a.isPublished && a.translationIssues.length > 0
  );

  if (translationProblems.length > 0) {
    console.log('='.repeat(70));
    console.log(`🌍 ARTICOLI CON PROBLEMI DI TRADUZIONE (${translationProblems.length} totali)\n`);

    const byLang = {
      de_CH: translationProblems.filter(a =>
        a.translationIssues.some(i => i.includes('Tedesco'))
      ).length,
      fr_CH: translationProblems.filter(a =>
        a.translationIssues.some(i => i.includes('Francese'))
      ).length,
      en_US: translationProblems.filter(a =>
        a.translationIssues.some(i => i.includes('Inglese'))
      ).length,
    };

    console.log(`   Tedesco (DE):  ${byLang.de_CH} articoli`);
    console.log(`   Francese (FR): ${byLang.fr_CH} articoli`);
    console.log(`   Inglese (EN):  ${byLang.en_US} articoli\n`);
  }

  // Salva piano completo
  const actionPlan = {
    generatedAt: new Date().toISOString(),
    sourceReport: report.generatedAt,
    statistics: stats,
    actionItems: actionItems,
    recommendations: {
      immediate: critical.map(a => ({
        id: a.articleId,
        name: a.articleName,
        actions: a.actions,
        translationIssues: a.translationIssues
      })),
      quickWins: quickWins.map(a => ({
        id: a.articleId,
        name: a.articleName,
        actions: a.actions
      })),
      translationWork: translationProblems.slice(0, 20).map(a => ({
        id: a.articleId,
        name: a.articleName,
        issues: a.translationIssues
      }))
    }
  };

  const outputPath = join(__dirname, '..', 'output', 'action-plan.json');
  writeFileSync(outputPath, JSON.stringify(actionPlan, null, 2));
  console.log('='.repeat(70));
  console.log(`\n💾 Piano d'azione completo salvato in: ${outputPath}`);

  // Genera anche un markdown leggibile
  const mdPath = join(__dirname, '..', 'output', 'action-plan.md');
  let markdown = `# Piano d'Azione SEO/GEO - Blog LAPA\n\n`;
  markdown += `**Generato:** ${new Date().toLocaleString('it-IT')}\n\n`;
  markdown += `---\n\n`;

  markdown += `## 📊 Statistiche Generali\n\n`;
  markdown += `- **Articoli totali:** ${stats.total}\n`;
  markdown += `- **Articoli pubblicati:** ${stats.published}\n\n`;
  markdown += `### Per Priorità\n\n`;
  markdown += `- 🔴 **CRITICAL:** ${stats.byPriority.CRITICAL} articoli\n`;
  markdown += `- 🟠 **HIGH:** ${stats.byPriority.HIGH} articoli\n`;
  markdown += `- 🟡 **MEDIUM:** ${stats.byPriority.MEDIUM} articoli\n`;
  markdown += `- 🟢 **LOW:** ${stats.byPriority.LOW} articoli\n\n`;
  markdown += `### Per Sforzo (pubblicati)\n\n`;
  markdown += `- ⚡ **Quick:** ${stats.byEffort.Quick} articoli (< 30 min)\n`;
  markdown += `- ⏱️ **Medium:** ${stats.byEffort.Medium} articoli (30-60 min)\n`;
  markdown += `- ⏳ **Long:** ${stats.byEffort.Long} articoli (> 60 min)\n\n`;

  if (critical.length > 0) {
    markdown += `---\n\n## 🚨 Articoli Critici (Azione Immediata)\n\n`;
    critical.forEach((item, index) => {
      markdown += `### ${index + 1}. [ID:${item.articleId}] ${item.articleName}\n\n`;
      markdown += `**Problemi:** ${item.seoIssueCount} | **GEO Score:** ${item.geoScore}/100 | **Sforzo:** ${item.estimatedEffort}\n\n`;
      if (item.actions.length > 0) {
        markdown += `**Azioni da fare:**\n\n`;
        item.actions.forEach(action => markdown += `- ${action}\n`);
        markdown += `\n`;
      }
      if (item.translationIssues.length > 0) {
        markdown += `**Traduzioni:**\n\n`;
        item.translationIssues.forEach(issue => markdown += `- ${issue}\n`);
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (quickWins.length > 0) {
    markdown += `## ⚡ Quick Wins - Massimo Impatto, Minimo Sforzo\n\n`;
    quickWins.forEach((item, index) => {
      markdown += `### ${index + 1}. [ID:${item.articleId}] ${item.articleName}\n\n`;
      item.actions.forEach(action => markdown += `- ${action}\n`);
      markdown += `\n`;
    });
    markdown += `---\n\n`;
  }

  writeFileSync(mdPath, markdown);
  console.log(`📄 Report markdown salvato in: ${mdPath}\n`);

  console.log('✅ Piano d\'azione generato con successo!\n');
}

main().catch(console.error);
