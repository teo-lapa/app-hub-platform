/**
 * Check Odoo AI Configuration
 * Verifica le configurazioni AI esistenti in Odoo (OpenAI, Gemini, etc.)
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

  async getModules(): Promise<any[]> {
    return this.searchRead<any>(
      'ir.module.module',
      [['state', '=', 'installed']],
      ['name', 'shortdesc', 'summary'],
      { limit: 500 }
    );
  }

  async getConfigSettings(): Promise<any> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.config.settings',
          method: 'default_get',
          args: [[]],
          kwargs: {}
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    return data.result || {};
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🤖 LAPA - Verifica Configurazione AI in Odoo');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // 1. Cerca moduli AI installati
    console.log('📦 MODULI AI INSTALLATI');
    console.log('─'.repeat(60));

    const modules = await odoo.getModules();
    const aiModules = modules.filter(m =>
      m.name.includes('ai') ||
      m.name.includes('openai') ||
      m.name.includes('gemini') ||
      m.name.includes('chatbot') ||
      m.name.includes('chat') ||
      m.name.includes('bot') ||
      m.name.includes('gpt') ||
      m.name.includes('llm') ||
      m.shortdesc?.toLowerCase().includes('ai') ||
      m.shortdesc?.toLowerCase().includes('artificial') ||
      m.shortdesc?.toLowerCase().includes('chatbot')
    );

    if (aiModules.length > 0) {
      console.log(`Trovati ${aiModules.length} moduli AI:\n`);
      for (const mod of aiModules) {
        console.log(`   📌 ${mod.name}`);
        console.log(`      ${mod.shortdesc}`);
        if (mod.summary) console.log(`      ${mod.summary.substring(0, 100)}...`);
        console.log('');
      }
    } else {
      console.log('   Nessun modulo AI specifico trovato.\n');
    }

    // 2. Cerca moduli livechat/helpdesk
    console.log('\n💬 MODULI CHAT/HELPDESK');
    console.log('─'.repeat(60));

    const chatModules = modules.filter(m =>
      m.name.includes('livechat') ||
      m.name.includes('helpdesk') ||
      m.name.includes('website_livechat') ||
      m.name.includes('im_') ||
      m.name.includes('mail_bot')
    );

    for (const mod of chatModules) {
      console.log(`   📌 ${mod.name}: ${mod.shortdesc}`);
    }

    // 3. Cerca configurazioni API
    console.log('\n\n🔑 CONFIGURAZIONI API');
    console.log('─'.repeat(60));

    // Cerca parametri di sistema con chiavi API
    const params = await odoo.searchRead<any>(
      'ir.config_parameter',
      [['key', 'ilike', 'api']],
      ['key', 'value'],
      { limit: 50 }
    );

    const aiParams = params.filter((p: any) =>
      p.key.includes('openai') ||
      p.key.includes('gemini') ||
      p.key.includes('google') ||
      p.key.includes('ai') ||
      p.key.includes('gpt') ||
      p.key.includes('claude')
    );

    if (aiParams.length > 0) {
      console.log('Parametri AI trovati:\n');
      for (const param of aiParams) {
        const value = param.value?.length > 20
          ? param.value.substring(0, 10) + '...' + param.value.substring(param.value.length - 5)
          : param.value;
        console.log(`   ${param.key}: ${value}`);
      }
    } else {
      console.log('   Nessun parametro API AI trovato.\n');
    }

    // 4. Cerca impostazioni res.config.settings relative ad AI
    console.log('\n\n⚙️ IMPOSTAZIONI AI IN CONFIG');
    console.log('─'.repeat(60));

    const configFields = await odoo.fieldsGet('res.config.settings');
    if (configFields) {
      const aiFields = Object.entries(configFields)
        .filter(([key, val]: [string, any]) =>
          key.includes('ai') ||
          key.includes('openai') ||
          key.includes('gemini') ||
          key.includes('chatbot') ||
          key.includes('google_') ||
          val.string?.toLowerCase().includes('ai') ||
          val.string?.toLowerCase().includes('openai')
        );

      if (aiFields.length > 0) {
        console.log('Campi configurazione AI:\n');
        for (const [key, val] of aiFields) {
          console.log(`   ${key}: ${(val as any).string} (${(val as any).type})`);
        }
      } else {
        console.log('   Nessun campo AI specifico in config.\n');
      }
    }

    // 5. Cerca modello chatbot se esiste
    console.log('\n\n🤖 MODELLO CHATBOT');
    console.log('─'.repeat(60));

    const chatbotModels = [
      'chatbot.script',
      'chatbot.message',
      'im_livechat.channel',
      'mail.channel',
      'discuss.channel'
    ];

    for (const model of chatbotModels) {
      try {
        const fields = await odoo.fieldsGet(model);
        if (fields) {
          console.log(`\n   ✅ Modello ${model} disponibile`);
          const relevantFields = Object.keys(fields).slice(0, 10);
          console.log(`      Campi: ${relevantFields.join(', ')}...`);
        }
      } catch (e) {
        // Model doesn't exist
      }
    }

    // 6. Cerca livechat channels
    console.log('\n\n📡 CANALI LIVECHAT');
    console.log('─'.repeat(60));

    try {
      const channels = await odoo.searchRead<any>(
        'im_livechat.channel',
        [],
        ['id', 'name', 'button_text', 'input_placeholder', 'chatbot_script_id'],
        { limit: 10 }
      );

      if (channels.length > 0) {
        console.log(`Trovati ${channels.length} canali LiveChat:\n`);
        for (const ch of channels) {
          console.log(`   📌 ${ch.name} (ID: ${ch.id})`);
          console.log(`      Testo pulsante: ${ch.button_text || 'default'}`);
          console.log(`      Chatbot: ${ch.chatbot_script_id ? ch.chatbot_script_id[1] : 'Nessuno'}`);
          console.log('');
        }
      } else {
        console.log('   Nessun canale LiveChat configurato.\n');
      }
    } catch (e) {
      console.log('   Modulo LiveChat non installato o non accessibile.\n');
    }

    // 7. Cerca chatbot scripts
    console.log('\n📜 SCRIPT CHATBOT');
    console.log('─'.repeat(60));

    try {
      const scripts = await odoo.searchRead<any>(
        'chatbot.script',
        [],
        ['id', 'name', 'is_published'],
        { limit: 10 }
      );

      if (scripts.length > 0) {
        console.log(`Trovati ${scripts.length} script chatbot:\n`);
        for (const s of scripts) {
          console.log(`   📌 ${s.name} (ID: ${s.id}) - Pubblicato: ${s.is_published ? 'Sì' : 'No'}`);
        }
      } else {
        console.log('   Nessuno script chatbot configurato.\n');
      }
    } catch (e) {
      console.log('   Modello chatbot.script non disponibile.\n');
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📋 RIEPILOGO');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
  }
}

main();
