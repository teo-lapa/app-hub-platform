/**
 * Add Shop Button via Website Page
 * Aggiunge il pulsante Shop modificando la homepage
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
const FLOATING_BUTTON_CODE = `<!-- LAPA Shop Button -->
<style>
.lapa-shop-btn{position:fixed;bottom:25px;left:25px;z-index:9999;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);color:#fff!important;padding:14px 24px;border-radius:50px;text-decoration:none!important;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(196,30,58,.4);transition:all .3s ease}
.lapa-shop-btn:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(196,30,58,.5);color:#fff!important}
.lapa-shop-btn svg{width:22px;height:22px;fill:#fff}
@media(max-width:768px){.lapa-shop-btn{bottom:20px;left:20px;padding:16px;border-radius:50%}.lapa-shop-btn span{display:none}}
</style>
<a href="/shop" class="lapa-shop-btn" title="Shop"><svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg><span>Shop</span></a>`;

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
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🛒 LAPA - Aggiunta Pulsante Shop');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // Cerca la homepage
    console.log('🔍 Ricerca homepage...');
    const pages = await odoo.searchRead<any>(
      'website.page',
      [['url', '=', '/']],
      ['id', 'name', 'url', 'view_id', 'website_id'],
      { limit: 5 }
    );

    console.log(`   Trovate ${pages.length} pagine homepage`);
    for (const page of pages) {
      console.log(`   - ${page.name} (ID: ${page.id}, View: ${page.view_id?.[0]}, Website: ${page.website_id?.[1]})`);
    }

    // Trova la homepage del sito LAPA ZERO PENSIERI (website_id = 1)
    const lapaHomepage = pages.find(p => p.website_id?.[0] === 1);

    if (!lapaHomepage) {
      console.log('\n⚠️ Homepage LAPA non trovata tra le pagine');

      // Prova a cercare la vista direttamente
      console.log('\n🔍 Ricerca vista homepage...');
      const homeViews = await odoo.searchRead<any>(
        'ir.ui.view',
        [
          ['key', 'ilike', 'homepage'],
          ['type', '=', 'qweb']
        ],
        ['id', 'name', 'key', 'website_id'],
        { limit: 10 }
      );

      for (const view of homeViews) {
        console.log(`   - ${view.key} (ID: ${view.id})`);
      }
    }

    // Cerca anche il menu del footer per aggiungere lì
    console.log('\n🔍 Ricerca elementi footer...');
    const footerViews = await odoo.searchRead<any>(
      'ir.ui.view',
      [
        ['key', 'ilike', 'footer'],
        ['type', '=', 'qweb'],
        ['website_id', '=', 1]
      ],
      ['id', 'name', 'key'],
      { limit: 10 }
    );

    for (const view of footerViews) {
      console.log(`   - ${view.key} (ID: ${view.id})`);
    }

    // Prova a trovare website.snippets per inserire HTML custom
    console.log('\n🔍 Ricerca snippet HTML personalizzabili...');
    const snippets = await odoo.searchRead<any>(
      'ir.ui.view',
      [
        ['key', 'ilike', 'snippet'],
        ['website_id', '=', 1]
      ],
      ['id', 'name', 'key'],
      { limit: 20 }
    );

    console.log(`   Trovati ${snippets.length} snippet`);

    // Cerca website.page con arch_db accessibile
    console.log('\n🔍 Ricerca struttura pagine website...');
    const websitePages = await odoo.searchRead<any>(
      'website.page',
      [['website_id', '=', 1], ['is_published', '=', true]],
      ['id', 'name', 'url', 'view_id'],
      { limit: 20 }
    );

    console.log(`   Pagine LAPA pubblicate:`);
    for (const p of websitePages.slice(0, 10)) {
      console.log(`   - ${p.url} (${p.name})`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📋 ISTRUZIONI MANUALI');
    console.log('═'.repeat(80));
    console.log(`
L'inserimento automatico via API richiede permessi di admin sul sistema viste.

📌 METODO PIÙ SEMPLICE - Aggiungi blocco HTML nella homepage:

1. Vai su https://www.lapa.ch
2. Clicca su "Modifica" (in alto a destra, devi essere loggato)
3. Scorri fino in fondo alla pagina
4. Clicca "+" per aggiungere un blocco
5. Cerca "HTML" o "Codice" nei blocchi
6. Inserisci questo codice:

${FLOATING_BUTTON_CODE}

7. Clicca "Salva"

✨ Il pulsante apparirà in basso a sinistra!
`);

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
  }
}

main();
