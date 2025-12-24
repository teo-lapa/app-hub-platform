/**
 * Fix All SEO Issues Script
 * Corregge automaticamente i meta tag SEO di tutti gli articoli del blog
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

// Limiti SEO
const SEO_LIMITS = {
  TITLE_MIN: 30,
  TITLE_MAX: 60,
  DESCRIPTION_MIN: 120,
  DESCRIPTION_MAX: 160,
};

interface OdooArticle {
  id: number;
  name: string;
  subtitle?: string;
  content: string;
  website_meta_title?: string;
  website_meta_description?: string;
  website_meta_keywords?: string;
}

class OdooFixer {
  private uid: number | null = null;
  private cookies: string | null = null;

  async authenticate(): Promise<boolean> {
    const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
        id: Date.now()
      })
    });

    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      this.cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
    }

    const data = await response.json();
    if (data.result?.uid) {
      this.uid = data.result.uid;
      if (!this.cookies && data.result.session_id) {
        this.cookies = `session_id=${data.result.session_id}`;
      }
      return true;
    }
    throw new Error('Authentication failed');
  }

  async searchRead<T>(model: string, domain: any[], fields: string[], options: any = {}): Promise<T[]> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model, method: 'search_read', args: [],
          kwargs: { domain, fields, limit: options.limit || 1000, context: options.context }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || [];
  }

  async write(model: string, ids: number[], values: any, context?: any): Promise<boolean> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'write', args: [ids, values], kwargs: { context } },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || false;
  }
}

// Funzioni di ottimizzazione SEO
function cleanTitle(name: string, subtitle?: string): string {
  // Rimuovi frasi problematiche generate
  let title = name
    .replace(/\| Non specificata.*?(?=\||$)/gi, '')
    .replace(/Non specificata.*?(?=\||$)/gi, '')
    .replace(/\s*\|\s*\|\s*/g, ' | ')
    .replace(/\s*\|\s*$/g, '')
    .trim();

  // Se il titolo è troppo lungo, accorcialo
  if (title.length > SEO_LIMITS.TITLE_MAX) {
    // Prova a tagliare al primo | o :
    const sepIndex = Math.min(
      title.indexOf(' | ') > 0 ? title.indexOf(' | ') : Infinity,
      title.indexOf(': ') > 20 ? title.indexOf(': ') : Infinity
    );
    if (sepIndex < SEO_LIMITS.TITLE_MAX && sepIndex !== Infinity) {
      title = title.substring(0, sepIndex);
    } else {
      // Taglia all'ultima parola completa
      title = title.substring(0, SEO_LIMITS.TITLE_MAX - 10).replace(/\s+\S*$/, '') + ' | LAPA';
    }
  }

  // Se il titolo è troppo corto, aggiungi LAPA
  if (title.length < SEO_LIMITS.TITLE_MIN && !title.includes('LAPA')) {
    title = title + ' | LAPA';
  }

  return title.trim();
}

function cleanDescription(description: string, subtitle?: string, name?: string): string {
  if (!description || description.length < 20) {
    // Genera descrizione dal subtitle o name
    description = subtitle || name || '';
    if (description.length > 0) {
      description = description + ' Scopri di più su LAPA, il tuo grossista italiano in Svizzera.';
    }
  }

  // Rimuovi frasi problematiche
  let desc = description
    .replace(/Non specificata.*?(?=\.|$)/gi, '')
    .replace(/\.\.\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Se è troppo lunga, accorcia
  if (desc.length > SEO_LIMITS.DESCRIPTION_MAX) {
    desc = desc.substring(0, SEO_LIMITS.DESCRIPTION_MAX - 3).replace(/\s+\S*$/, '') + '...';
  }

  // Se è troppo corta, espandi
  if (desc.length < SEO_LIMITS.DESCRIPTION_MIN && !desc.includes('LAPA')) {
    const suffix = ' Disponibile da LAPA Svizzera.';
    if (desc.length + suffix.length <= SEO_LIMITS.DESCRIPTION_MAX) {
      desc = desc + suffix;
    }
  }

  return desc.trim();
}

function cleanKeywords(keywords: string, name: string): string {
  if (!keywords || keywords.length < 10) {
    // Genera keywords base
    return `${name}, prodotti italiani, LAPA, grossista Svizzera, gastronomia italiana`.substring(0, 200);
  }

  // Rimuovi frasi lunghe che non sono keywords
  let kw = keywords
    .replace(/Non specificata.*?(?=,|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')
    .trim();

  return kw;
}

function needsFix(article: OdooArticle): { needsTitle: boolean; needsDesc: boolean; needsKw: boolean } {
  const title = article.website_meta_title || '';
  const desc = article.website_meta_description || '';
  const kw = article.website_meta_keywords || '';

  return {
    needsTitle: !title || title.length < SEO_LIMITS.TITLE_MIN || title.length > SEO_LIMITS.TITLE_MAX ||
                title.includes('Non specificata') || title.includes(' | | '),
    needsDesc: !desc || desc.length < SEO_LIMITS.DESCRIPTION_MIN || desc.length > SEO_LIMITS.DESCRIPTION_MAX ||
               desc.includes('Non specificata'),
    needsKw: !kw || kw.length < 10 || kw.includes('Non specificata')
  };
}

async function main() {
  console.log('🔧 SEO Fixer - Correzione automatica meta tag\n');

  const odoo = new OdooFixer();

  try {
    console.log('🔐 Autenticazione Odoo...');
    await odoo.authenticate();
    console.log('✅ Autenticato con successo\n');

    // Carica articoli
    console.log('📚 Caricamento articoli...');
    const articles = await odoo.searchRead<OdooArticle>(
      'blog.post',
      [['website_published', '=', true]],
      ['id', 'name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
      { limit: 500 }
    );
    console.log(`📊 Trovati ${articles.length} articoli pubblicati\n`);

    // Analizza e prepara correzioni
    const fixes: { id: number; name: string; changes: any }[] = [];

    for (const article of articles) {
      const needs = needsFix(article);

      if (needs.needsTitle || needs.needsDesc || needs.needsKw) {
        const changes: any = {};

        if (needs.needsTitle) {
          changes.website_meta_title = cleanTitle(article.name, article.subtitle);
        }
        if (needs.needsDesc) {
          changes.website_meta_description = cleanDescription(
            article.website_meta_description || '',
            article.subtitle,
            article.name
          );
        }
        if (needs.needsKw) {
          changes.website_meta_keywords = cleanKeywords(
            article.website_meta_keywords || '',
            article.name
          );
        }

        fixes.push({ id: article.id, name: article.name, changes });
      }
    }

    console.log(`🔍 Articoli da correggere: ${fixes.length}\n`);

    if (fixes.length === 0) {
      console.log('✅ Nessun articolo richiede correzioni!');
      return;
    }

    // Mostra preview delle prime 5 correzioni
    console.log('📋 Preview correzioni (prime 5):');
    console.log('─'.repeat(80));
    for (const fix of fixes.slice(0, 5)) {
      console.log(`\n📝 ID ${fix.id}: ${fix.name.substring(0, 50)}...`);
      for (const [field, value] of Object.entries(fix.changes)) {
        const displayValue = String(value).substring(0, 70);
        console.log(`   ${field}: ${displayValue}${String(value).length > 70 ? '...' : ''}`);
      }
    }
    console.log('\n' + '─'.repeat(80));

    // Applica correzioni
    console.log('\n🚀 Applicazione correzioni in corso...\n');

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i];
      try {
        await odoo.write('blog.post', [fix.id], fix.changes);
        success++;
        process.stdout.write(`\r✅ Corretti: ${success}/${fixes.length} (Errori: ${failed})`);
      } catch (error) {
        failed++;
        errors.push(`ID ${fix.id}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      }

      // Rate limiting - piccola pausa ogni 10 operazioni
      if (i % 10 === 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 RIEPILOGO CORREZIONI');
    console.log('═'.repeat(80));
    console.log(`✅ Articoli corretti con successo: ${success}`);
    console.log(`❌ Errori: ${failed}`);

    if (errors.length > 0) {
      console.log('\n⚠️ Dettaglio errori:');
      errors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
      if (errors.length > 10) {
        console.log(`   ... e altri ${errors.length - 10} errori`);
      }
    }

    // Salva report
    const report = {
      timestamp: new Date().toISOString(),
      totalArticles: articles.length,
      fixesApplied: success,
      errors: failed,
      fixes: fixes.map(f => ({
        id: f.id,
        name: f.name,
        fieldsUpdated: Object.keys(f.changes)
      }))
    };

    const reportPath = resolve(__dirname, '..', 'data', 'seo-fix-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report salvato: ${reportPath}`);

    console.log('\n✨ Correzioni SEO completate!');

  } catch (error) {
    console.error('❌ Errore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
