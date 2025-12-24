/**
 * Find Custom AI Module in Odoo
 * Cerca moduli custom con integrazione AI (OpenAI, Gemini, etc.)
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
          kwargs: { domain, fields, limit: options.limit || 500, order: options.order }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${model}: ${data.error.message}`);
    return data.result || [];
  }

  async fieldsGet(model: string): Promise<any> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'fields_get', args: [], kwargs: {} },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) return null;
    return data.result;
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 LAPA - Ricerca Moduli Custom AI');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // 1. Tutti i moduli installati (cerca custom)
    console.log('📦 TUTTI I MODULI INSTALLATI');
    console.log('─'.repeat(60));

    const allModules = await odoo.searchRead<any>(
      'ir.module.module',
      [['state', '=', 'installed']],
      ['name', 'shortdesc', 'author', 'category_id'],
      { limit: 500, order: 'name' }
    );

    // Filtra moduli custom (non Odoo SA)
    const customModules = allModules.filter((m: any) =>
      !m.author?.includes('Odoo S.A.') &&
      !m.author?.includes('Odoo SA') &&
      m.author !== 'Odoo' &&
      m.author
    );

    console.log(`\nModuli CUSTOM (non Odoo SA): ${customModules.length}\n`);
    for (const mod of customModules) {
      console.log(`   📌 ${mod.name}`);
      console.log(`      ${mod.shortdesc}`);
      console.log(`      Autore: ${mod.author}`);
      console.log('');
    }

    // 2. Cerca moduli con "lapa" nel nome
    console.log('\n📦 MODULI LAPA');
    console.log('─'.repeat(60));

    const lapaModules = allModules.filter((m: any) =>
      m.name.toLowerCase().includes('lapa') ||
      m.shortdesc?.toLowerCase().includes('lapa')
    );

    for (const mod of lapaModules) {
      console.log(`   📌 ${mod.name}: ${mod.shortdesc}`);
    }

    // 3. Cerca parametri di sistema con API keys
    console.log('\n\n🔑 PARAMETRI API (tutti)');
    console.log('─'.repeat(60));

    const allParams = await odoo.searchRead<any>(
      'ir.config_parameter',
      [],
      ['key', 'value'],
      { limit: 200 }
    );

    // Filtra parametri interessanti
    const interestingParams = allParams.filter((p: any) =>
      p.key.includes('api') ||
      p.key.includes('key') ||
      p.key.includes('token') ||
      p.key.includes('openai') ||
      p.key.includes('gemini') ||
      p.key.includes('google') ||
      p.key.includes('ai_') ||
      p.key.includes('gpt') ||
      p.key.includes('llm') ||
      p.key.includes('chat')
    );

    console.log(`\nParametri interessanti trovati: ${interestingParams.length}\n`);
    for (const param of interestingParams) {
      const value = param.value?.length > 30
        ? param.value.substring(0, 15) + '...' + param.value.substring(param.value.length - 8)
        : param.value;
      console.log(`   ${param.key}`);
      console.log(`      = ${value}`);
      console.log('');
    }

    // 4. Cerca modelli custom
    console.log('\n🗃️ MODELLI CUSTOM (cerca AI/chat/bot)');
    console.log('─'.repeat(60));

    const irModels = await odoo.searchRead<any>(
      'ir.model',
      [],
      ['model', 'name'],
      { limit: 500 }
    );

    const aiModels = irModels.filter((m: any) =>
      m.model.includes('ai') ||
      m.model.includes('chat') ||
      m.model.includes('bot') ||
      m.model.includes('gpt') ||
      m.model.includes('llm') ||
      m.model.includes('openai') ||
      m.model.includes('gemini') ||
      m.model.includes('assistant') ||
      m.name?.toLowerCase().includes('ai') ||
      m.name?.toLowerCase().includes('chat')
    );

    console.log(`\nModelli AI/Chat trovati: ${aiModels.length}\n`);
    for (const model of aiModels) {
      console.log(`   📌 ${model.model}`);
      console.log(`      ${model.name}`);

      // Prova a leggere i campi
      try {
        const fields = await odoo.fieldsGet(model.model);
        if (fields) {
          const fieldNames = Object.keys(fields).slice(0, 8);
          console.log(`      Campi: ${fieldNames.join(', ')}...`);
        }
      } catch (e) {}
      console.log('');
    }

    // 5. Cerca nella tabella mail.channel per bot
    console.log('\n💬 CANALI/BOT CONFIGURATI');
    console.log('─'.repeat(60));

    try {
      const channels = await odoo.searchRead<any>(
        'discuss.channel',
        [],
        ['id', 'name', 'channel_type', 'description'],
        { limit: 20 }
      );

      console.log(`\nCanali discuss: ${channels.length}\n`);
      for (const ch of channels) {
        console.log(`   ${ch.name} (${ch.channel_type})`);
      }
    } catch (e) {}

    // 6. Cerca livechat
    console.log('\n\n🎧 LIVECHAT');
    console.log('─'.repeat(60));

    try {
      const livechats = await odoo.searchRead<any>(
        'im_livechat.channel',
        [],
        ['id', 'name', 'button_text', 'default_message', 'chatbot_script_id', 'are_you_inside', 'web_page'],
        { limit: 10 }
      );

      if (livechats.length > 0) {
        console.log(`\nCanali LiveChat: ${livechats.length}\n`);
        for (const lc of livechats) {
          console.log(`   📌 ${lc.name} (ID: ${lc.id})`);
          console.log(`      Pulsante: "${lc.button_text}"`);
          console.log(`      Messaggio default: "${lc.default_message || 'N/A'}"`);
          console.log(`      Chatbot: ${lc.chatbot_script_id ? lc.chatbot_script_id[1] : 'Nessuno'}`);
          console.log(`      Web page: ${lc.web_page || 'Tutte'}`);
          console.log('');
        }
      }
    } catch (e) {
      console.log('   LiveChat non disponibile');
    }

    // 7. Cerca chatbot scripts
    console.log('\n📜 CHATBOT SCRIPTS');
    console.log('─'.repeat(60));

    try {
      const scripts = await odoo.searchRead<any>(
        'chatbot.script',
        [],
        ['id', 'name', 'title', 'is_published', 'source_id'],
        { limit: 20 }
      );

      if (scripts.length > 0) {
        console.log(`\nScript chatbot: ${scripts.length}\n`);
        for (const s of scripts) {
          console.log(`   📌 ${s.name} (ID: ${s.id})`);
          console.log(`      Titolo: ${s.title}`);
          console.log(`      Pubblicato: ${s.is_published ? 'Sì' : 'No'}`);
          console.log('');

          // Cerca i messaggi/step dello script
          const steps = await odoo.searchRead<any>(
            'chatbot.script.step',
            [['chatbot_script_id', '=', s.id]],
            ['id', 'message', 'step_type', 'sequence'],
            { limit: 20, order: 'sequence' }
          );

          if (steps.length > 0) {
            console.log(`      Steps (${steps.length}):`);
            for (const step of steps.slice(0, 5)) {
              console.log(`         ${step.sequence}. [${step.step_type}] ${step.message?.substring(0, 50)}...`);
            }
          }
        }
      }
    } catch (e) {
      console.log('   chatbot.script non disponibile');
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
  }
}

main();
