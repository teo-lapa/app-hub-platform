/**
 * Create Chatbot API Endpoint in Odoo
 * Verifica se esiste già un endpoint chatbot o ne crea uno
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

class OdooAPI {
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
          kwargs: { domain, fields, limit: options.limit || 100 }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${model}: ${data.error.message}`);
    return data.result || [];
  }

  async callMethod(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method, args, kwargs },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${model}.${method}: ${JSON.stringify(data.error)}`);
    return data.result;
  }

  async getParam(key: string): Promise<string | null> {
    const params = await this.searchRead<any>(
      'ir.config_parameter',
      [['key', '=', key]],
      ['value'],
      { limit: 1 }
    );
    return params.length > 0 ? params[0].value : null;
  }
}

// Test chiamata diretta a OpenAI
async function testOpenAI(apiKey: string) {
  console.log('\n🧪 Test chiamata OpenAI...');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Sei un assistente di test. Rispondi brevemente.' },
          { role: 'user', content: 'Ciao, funziona?' }
        ],
        max_tokens: 50
      })
    });

    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ Errore: ${data.error.message}`);
      return false;
    }

    console.log(`   ✅ Funziona! Risposta: "${data.choices[0].message.content}"`);
    console.log(`   Modello usato: ${data.model}`);
    return true;
  } catch (e: any) {
    console.log(`   ❌ Errore connessione: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🤖 LAPA - Setup Chatbot AI Professionale');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // Recupera API key OpenAI
    console.log('🔑 Recupero API Key OpenAI da Odoo...');
    const apiKey = await odoo.getParam('openai_api_key');
    const model = await odoo.getParam('openai_api_engine');
    const maxTokens = await odoo.getParam('openai_api_max_tokens');

    if (!apiKey) {
      throw new Error('API Key OpenAI non trovata in Odoo!');
    }

    console.log(`   ✅ API Key trovata: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 5)}`);
    console.log(`   Modello configurato: ${model || 'default'}`);
    console.log(`   Max tokens: ${maxTokens || 'default'}`);

    // Test API
    const apiWorks = await testOpenAI(apiKey);

    if (apiWorks) {
      console.log('\n' + '═'.repeat(80));
      console.log('✅ API OpenAI FUNZIONANTE!');
      console.log('═'.repeat(80));
      console.log(`
La tua API key OpenAI funziona perfettamente.
Posso usare qualsiasi modello: gpt-4o, gpt-4-turbo, gpt-4o-mini, ecc.

Prossimo step: Creo il widget chatbot per il sito.
`);
    }

    // Salva la API key in un file temporaneo per uso nel chatbot
    // (in produzione questo sarà nel backend)
    console.log('\n📝 Preparazione configurazione chatbot...');

    // Leggi knowledge base
    const fs = await import('fs');
    const knowledgePath = resolve(__dirname, 'chatbot-knowledge.json');
    let knowledge = {};
    if (fs.existsSync(knowledgePath)) {
      knowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf-8'));
      console.log('   ✅ Knowledge base caricata');
    }

    // Crea configurazione
    const chatbotConfig = {
      apiKey: apiKey,
      model: 'gpt-4o', // Usiamo il migliore
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: `Sei LAPA Assistant, l'assistente virtuale di LAPA - il principale distributore di prodotti alimentari italiani autentici in Svizzera.

RUOLO: Assistenza clienti professionale per aiutare i visitatori a:
- Trovare prodotti italiani (pasta, olio, salumi, formaggi, conserve, vini)
- Informazioni su ordini e consegne
- Supporto per clienti B2B (ristoranti, pizzerie, hotel)
- Informazioni generali sull'azienda

STILE:
- Professionale ma cordiale
- Risposte concise e utili
- Proattivo nel suggerire prodotti e soluzioni
- Multilingue (italiano, tedesco, francese, inglese)

INFORMAZIONI CHIAVE:
- Shop online: www.lapa.ch/shop
- Consegna in tutta la Svizzera
- Ordine minimo B2B: CHF 150 per spedizione gratuita
- Contatto: info@lapa.ch
- Orari: Lun-Ven 8:00-17:00

ISTRUZIONI:
1. Saluta sempre cordialmente
2. Identifica rapidamente il bisogno del cliente
3. Fornisci informazioni precise e utili
4. Suggerisci sempre di visitare lo shop per vedere i prodotti
5. Per richieste complesse, invita a contattare info@lapa.ch
6. Rispondi SEMPRE nella lingua usata dal cliente`
    };

    const configPath = resolve(__dirname, 'chatbot-config.json');
    fs.writeFileSync(configPath, JSON.stringify(chatbotConfig, null, 2), 'utf-8');
    console.log(`   ✅ Configurazione salvata in: ${configPath}`);

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
