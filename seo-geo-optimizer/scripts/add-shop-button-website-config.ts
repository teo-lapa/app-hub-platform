/**
 * Add Shop Button via Website Configuration
 * Prova diversi metodi API per aggiungere il pulsante Shop
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

  async searchRead<T>(model: string, domain: any[], fields: string[], options: any = {}): Promise<T[]> {
    return this.callMethod(model, 'search_read', [], { domain, fields, limit: options.limit || 100, order: options.order });
  }

  async read<T>(model: string, ids: number[], fields: string[]): Promise<T[]> {
    return this.callMethod(model, 'read', [ids, fields], {});
  }

  async write(model: string, ids: number[], values: any): Promise<boolean> {
    return this.callMethod(model, 'write', [ids, values], {});
  }

  async create(model: string, values: any): Promise<number> {
    return this.callMethod(model, 'create', [values], {});
  }

  async fieldsGet(model: string): Promise<any> {
    return this.callMethod(model, 'fields_get', [], {});
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🛒 LAPA - Aggiunta Pulsante Shop (Metodi Alternativi)');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // Metodo 1: Cerca campi configurazione website
    console.log('🔍 METODO 1: Configurazione Website');
    console.log('─'.repeat(60));

    const websiteFields = await odoo.fieldsGet('website');
    const relevantFields = Object.entries(websiteFields as Record<string, any>)
      .filter(([key, val]: [string, any]) =>
        key.includes('html') || key.includes('script') || key.includes('custom') ||
        key.includes('head') || key.includes('footer') || key.includes('code')
      );

    console.log('Campi rilevanti trovati:');
    for (const [key, val] of relevantFields) {
      console.log(`   - ${key}: ${(val as any).string} (${(val as any).type})`);
    }

    // Leggi configurazione website attuale
    const websites = await odoo.searchRead<any>(
      'website',
      [['id', '=', 1]],
      ['id', 'name', ...relevantFields.map(([k]) => k)],
      { limit: 1 }
    );

    if (websites.length > 0) {
      console.log('\nValori attuali website LAPA:');
      for (const [key] of relevantFields) {
        if (websites[0][key]) {
          console.log(`   ${key}: ${String(websites[0][key]).substring(0, 100)}...`);
        }
      }
    }

    // Metodo 2: Cerca website.menu per aggiungere voce Shop
    console.log('\n\n🔍 METODO 2: Menu Website');
    console.log('─'.repeat(60));

    const menus = await odoo.searchRead<any>(
      'website.menu',
      [['website_id', '=', 1]],
      ['id', 'name', 'url', 'parent_id', 'sequence'],
      { limit: 50, order: 'sequence' }
    );

    console.log(`Menu trovati: ${menus.length}`);
    for (const menu of menus) {
      const indent = menu.parent_id ? '      ' : '   ';
      console.log(`${indent}- ${menu.name} → ${menu.url} (seq: ${menu.sequence})`);
    }

    // Cerca se esiste già Shop nel menu
    const shopMenu = menus.find((m: any) => m.url === '/shop' || m.name.toLowerCase().includes('shop'));
    if (!shopMenu) {
      console.log('\n📝 Shop non presente nel menu. Posso aggiungerlo...');
    } else {
      console.log(`\n✅ Shop già presente: ${shopMenu.name} → ${shopMenu.url}`);
    }

    // Metodo 3: Cerca ir.attachment per aggiungere CSS/JS custom
    console.log('\n\n🔍 METODO 3: Asset personalizzati (ir.attachment)');
    console.log('─'.repeat(60));

    const attachments = await odoo.searchRead<any>(
      'ir.attachment',
      [['name', 'ilike', 'custom'], ['website_id', '=', 1]],
      ['id', 'name', 'mimetype', 'url'],
      { limit: 20 }
    );

    console.log(`Attachment custom trovati: ${attachments.length}`);
    for (const att of attachments) {
      console.log(`   - ${att.name} (${att.mimetype})`);
    }

    // Metodo 4: Cerca website.page della homepage
    console.log('\n\n🔍 METODO 4: Modifica Homepage (website.page)');
    console.log('─'.repeat(60));

    const homepages = await odoo.searchRead<any>(
      'website.page',
      [['url', '=', '/'], ['website_id', '=', 1]],
      ['id', 'name', 'url', 'view_id', 'is_published', 'arch'],
      { limit: 5 }
    );

    console.log(`Homepage trovate: ${homepages.length}`);
    for (const page of homepages) {
      console.log(`   ID: ${page.id}`);
      console.log(`   Nome: ${page.name}`);
      console.log(`   View: ${page.view_id ? page.view_id[1] : 'N/A'}`);
      console.log(`   Pubblicata: ${page.is_published}`);
      if (page.arch) {
        console.log(`   Arch (primi 200 char): ${page.arch.substring(0, 200)}...`);
      }
    }

    // Metodo 5: Prova a modificare direttamente ir.ui.view esistente
    console.log('\n\n🔍 METODO 5: Vista Layout esistente');
    console.log('─'.repeat(60));

    // Cerca viste ereditate dal layout che possiamo modificare
    const customViews = await odoo.searchRead<any>(
      'ir.ui.view',
      [
        ['website_id', '=', 1],
        ['type', '=', 'qweb'],
        ['inherit_id', '!=', false]
      ],
      ['id', 'name', 'key', 'inherit_id', 'active'],
      { limit: 30 }
    );

    console.log(`Viste custom website 1: ${customViews.length}`);
    for (const view of customViews.slice(0, 15)) {
      console.log(`   - ${view.key || view.name} (ID: ${view.id}, inherit: ${view.inherit_id?.[1]})`);
    }

    // Metodo 6: Usa website.snippet per contenuto custom
    console.log('\n\n🔍 METODO 6: Snippet HTML');
    console.log('─'.repeat(60));

    const snippets = await odoo.searchRead<any>(
      'ir.ui.view',
      [['key', 'ilike', 'snippet'], ['website_id', 'in', [false, 1]]],
      ['id', 'name', 'key'],
      { limit: 20 }
    );

    console.log(`Snippet trovati: ${snippets.length}`);

    // PROVA: Aggiungi voce menu Shop se non esiste
    console.log('\n\n' + '═'.repeat(80));
    console.log('🚀 TENTATIVO: Aggiunta Menu Shop');
    console.log('═'.repeat(80));

    if (!shopMenu) {
      try {
        // Trova il menu root
        const rootMenu = menus.find((m: any) => !m.parent_id);

        const newMenuId = await odoo.create('website.menu', {
          name: '🛒 Shop',
          url: '/shop',
          website_id: 1,
          parent_id: rootMenu?.id || false,
          sequence: 5,  // Prima posizione dopo Home
          new_window: false
        });

        console.log(`✅ Menu Shop creato con ID: ${newMenuId}`);
      } catch (err: any) {
        console.log(`❌ Impossibile creare menu: ${err.message}`);
      }
    }

    // PROVA: Cerca se website ha campo per custom HTML/JS
    console.log('\n\n' + '═'.repeat(80));
    console.log('🚀 TENTATIVO: Inject Custom HTML');
    console.log('═'.repeat(80));

    // Alcuni temi Odoo hanno campi come website.custom_head o website.custom_footer
    try {
      // Prova a leggere tutti i campi della website
      const fullWebsite = await odoo.read<any>('website', [1], []);
      console.log('Campi website disponibili:');
      const htmlFields = Object.keys(fullWebsite[0]).filter(k =>
        k.includes('html') || k.includes('custom') || k.includes('script') || k.includes('inject')
      );
      for (const field of htmlFields) {
        console.log(`   ${field}: ${String(fullWebsite[0][field]).substring(0, 100)}`);
      }
    } catch (err: any) {
      console.log(`Nota: ${err.message}`);
    }

    // PROVA: Cerca modello website.config.settings
    console.log('\n\n🔍 Configurazione eCommerce');
    console.log('─'.repeat(60));

    try {
      const configFields = await odoo.fieldsGet('res.config.settings');
      const websiteConfigFields = Object.entries(configFields as Record<string, any>)
        .filter(([key]: [string, any]) => key.includes('website') || key.includes('ecommerce'));

      console.log('Campi config rilevanti:');
      for (const [key, val] of websiteConfigFields.slice(0, 10)) {
        console.log(`   - ${key}: ${(val as any).string}`);
      }
    } catch (err: any) {
      console.log(`Nota: ${err.message}`);
    }

    console.log('\n\n' + '═'.repeat(80));
    console.log('📋 RIEPILOGO');
    console.log('═'.repeat(80));
    console.log(`
Il sistema Odoo SaaS ha restrizioni sulla creazione diretta di viste.

OPZIONI DISPONIBILI:

1. ✅ MENU SHOP - Posso aggiungere una voce "Shop" al menu principale
   (Già fatto se non esisteva)

2. 📝 HOMEPAGE CONTENT - Posso modificare il contenuto della homepage
   per includere un banner/link allo shop

3. ⚙️ CONFIGURAZIONE - Alcuni parametri di configurazione potrebbero
   permettere l'inserimento di HTML custom

4. 🎨 TEMA - Se il tema supporta custom HTML/CSS, posso usare quei campi

Il pulsante floating richiede accesso al template base, che è protetto.
Tuttavia, posso aggiungere un elemento visibile nel menu o nella homepage.
`);

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
  }
}

main();
