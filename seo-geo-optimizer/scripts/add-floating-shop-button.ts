/**
 * Add Floating Shop Button
 * Aggiunge un pulsante "Shop" fisso in basso a sinistra sul sito LAPA
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

// Codice HTML/CSS per il pulsante floating
const FLOATING_BUTTON_CODE = `
<!-- Floating Shop Button LAPA - Added by SEO Optimizer -->
<style>
.lapa-floating-shop {
    position: fixed;
    bottom: 25px;
    left: 25px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%);
    color: white !important;
    padding: 14px 24px;
    border-radius: 50px;
    text-decoration: none !important;
    font-weight: 600;
    font-size: 16px;
    box-shadow: 0 4px 15px rgba(196, 30, 58, 0.4);
    transition: all 0.3s ease;
    font-family: inherit;
}
.lapa-floating-shop:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(196, 30, 58, 0.5);
    color: white !important;
    text-decoration: none !important;
}
.lapa-floating-shop svg {
    width: 22px;
    height: 22px;
    fill: white;
}
@media (max-width: 768px) {
    .lapa-floating-shop {
        bottom: 20px;
        left: 20px;
        padding: 12px 20px;
        font-size: 14px;
    }
    .lapa-floating-shop span {
        display: none;
    }
    .lapa-floating-shop {
        border-radius: 50%;
        padding: 16px;
    }
}
</style>

<a href="/shop" class="lapa-floating-shop" title="Vai allo Shop LAPA">
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
    <span>Shop</span>
</a>
<!-- End Floating Shop Button -->
`;

class OdooWebsite {
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

  async write(model: string, ids: number[], values: any): Promise<boolean> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'write', args: [ids, values], kwargs: {} },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || false;
  }

  async create(model: string, values: any): Promise<number> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'create', args: [values], kwargs: {} },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }

  async getFieldsInfo(model: string): Promise<any> {
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
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🛒 LAPA - Aggiunta Pulsante Shop Floating');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooWebsite();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // Metodo 1: Cercare la vista del footer o layout
    console.log('🔍 Ricerca view website per inserire il codice...');

    // Cerca le viste del website
    const views = await odoo.searchRead<any>(
      'ir.ui.view',
      [
        ['type', '=', 'qweb'],
        ['key', 'ilike', 'website.layout']
      ],
      ['id', 'name', 'key', 'arch_db', 'active'],
      { limit: 10 }
    );

    console.log(`   Trovate ${views.length} viste layout\n`);

    for (const view of views) {
      console.log(`   - ${view.key} (ID: ${view.id})`);
    }

    // Metodo 2: Prova con website.snippets o website.assets
    console.log('\n🔍 Ricerca assets/snippets...');
    const assets = await odoo.searchRead<any>(
      'ir.ui.view',
      [
        ['key', 'ilike', 'website.assets']
      ],
      ['id', 'name', 'key'],
      { limit: 10 }
    );

    for (const asset of assets) {
      console.log(`   - ${asset.key} (ID: ${asset.id})`);
    }

    // Metodo 3: Cerca se esiste già un posto per custom HTML
    console.log('\n🔍 Ricerca configurazione website...');
    const websites = await odoo.searchRead<any>(
      'website',
      [],
      ['id', 'name', 'domain'],
      { limit: 5 }
    );

    console.log(`   Websites trovati: ${websites.length}`);
    for (const site of websites) {
      console.log(`   - ${site.name} (ID: ${site.id}) - ${site.domain || 'no domain'}`);
    }

    // Metodo 4: Creare una vista inherit per aggiungere il pulsante
    console.log('\n📝 Creazione vista personalizzata per il pulsante...');

    // Cerca se esiste già la nostra vista
    const existingView = await odoo.searchRead<any>(
      'ir.ui.view',
      [['key', '=', 'website.lapa_floating_shop_button']],
      ['id', 'name', 'key', 'arch_db'],
      { limit: 1 }
    );

    const viewArch = `<?xml version="1.0"?>
<t t-name="website.lapa_floating_shop_button" t-inherit="website.layout" t-inherit-mode="extension">
    <xpath expr="//footer" position="after">
        ${FLOATING_BUTTON_CODE}
    </xpath>
</t>`;

    if (existingView.length > 0) {
      console.log(`   Vista esistente trovata (ID: ${existingView[0].id}), aggiornamento...`);
      await odoo.write('ir.ui.view', [existingView[0].id], {
        arch_db: viewArch,
        active: true
      });
      console.log('   ✅ Vista aggiornata!');
    } else {
      console.log('   Creazione nuova vista...');

      // Trova l'ID della vista website.layout da ereditare
      const layoutView = await odoo.searchRead<any>(
        'ir.ui.view',
        [['key', '=', 'website.layout']],
        ['id'],
        { limit: 1 }
      );

      if (layoutView.length === 0) {
        throw new Error('Vista website.layout non trovata');
      }

      const newViewId = await odoo.create('ir.ui.view', {
        name: 'LAPA Floating Shop Button',
        type: 'qweb',
        key: 'website.lapa_floating_shop_button',
        inherit_id: layoutView[0].id,
        arch_db: viewArch,
        active: true,
        priority: 100
      });

      console.log(`   ✅ Vista creata con ID: ${newViewId}`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✨ COMPLETATO!');
    console.log('═'.repeat(80));
    console.log(`
Il pulsante "Shop" è stato aggiunto!

🔴 Apparirà in basso a sinistra su tutte le pagine del sito
🛒 Cliccando porta direttamente a /shop
📱 Su mobile diventa un'icona compatta

Vai su https://www.lapa.ch per verificare!
`);

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);

    console.log('\n💡 ALTERNATIVA MANUALE:');
    console.log('─'.repeat(60));
    console.log('Se l\'aggiunta automatica non funziona, puoi farlo manualmente:');
    console.log('');
    console.log('1. Vai in Odoo → Website → Configurazione → Personalizza');
    console.log('2. Cerca "HTML/CSS personalizzato" o "Custom Code"');
    console.log('3. Incolla questo codice:\n');
    console.log(FLOATING_BUTTON_CODE);

    process.exit(1);
  }
}

main();
