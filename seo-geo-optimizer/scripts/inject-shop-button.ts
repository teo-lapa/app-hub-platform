/**
 * Inject Shop Button via custom_code_footer
 * Aggiunge il pulsante floating usando il campo custom_code_footer del website
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

// Codice HTML/CSS per il pulsante floating Shop
const SHOP_BUTTON_CODE = `
<!-- LAPA Floating Shop Button - Added by SEO Optimizer -->
<style>
.lapa-shop-float{position:fixed;bottom:25px;left:25px;z-index:9999;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);color:#fff!important;padding:14px 24px;border-radius:50px;text-decoration:none!important;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(196,30,58,.4);transition:all .3s ease;font-family:inherit}
.lapa-shop-float:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(196,30,58,.5);color:#fff!important;text-decoration:none!important}
.lapa-shop-float svg{width:22px;height:22px;fill:#fff}
@media(max-width:768px){.lapa-shop-float{bottom:20px;left:20px;padding:16px;border-radius:50%}.lapa-shop-float span{display:none}}
</style>
<a href="/shop" class="lapa-shop-float" title="Vai allo Shop LAPA">
<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
<span>Shop</span>
</a>
<!-- End LAPA Floating Shop Button -->
`;

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
  console.log('🛒 LAPA - Iniezione Pulsante Shop Floating');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // Leggi il custom_code_footer attuale
    console.log('📖 Lettura codice footer attuale...');
    const websites = await odoo.searchRead<any>(
      'website',
      [['id', '=', 1]],
      ['id', 'name', 'custom_code_footer'],
      { limit: 1 }
    );

    if (websites.length === 0) {
      throw new Error('Website non trovato');
    }

    const website = websites[0];
    const currentFooterCode = website.custom_code_footer || '';

    console.log(`   Website: ${website.name} (ID: ${website.id})`);
    console.log(`   Lunghezza codice attuale: ${currentFooterCode.length} caratteri`);

    // Verifica se il pulsante è già presente
    if (currentFooterCode.includes('lapa-shop-float') || currentFooterCode.includes('LAPA Floating Shop Button')) {
      console.log('\n⚠️  Il pulsante Shop floating è già presente nel footer!');
      console.log('    Nessuna modifica necessaria.');
      return;
    }

    // Aggiungi il codice del pulsante
    console.log('\n📝 Aggiunta pulsante Shop...');
    const newFooterCode = currentFooterCode + SHOP_BUTTON_CODE;

    const success = await odoo.write('website', [1], {
      custom_code_footer: newFooterCode
    });

    if (success) {
      console.log('✅ Pulsante Shop aggiunto con successo!');
      console.log('\n' + '═'.repeat(80));
      console.log('✨ COMPLETATO!');
      console.log('═'.repeat(80));
      console.log(`
🛒 Il pulsante "Shop" floating è stato aggiunto!

CARATTERISTICHE:
   🔴 Posizione: In basso a sinistra (fixed)
   🎨 Stile: Rosso LAPA con gradiente
   📱 Responsive: Su mobile diventa solo icona
   ✨ Effetto hover: Leggero sollevamento

👉 Vai su https://www.lapa.ch per verificare!

NOTA: Potrebbe essere necessario svuotare la cache del browser
o attendere qualche minuto per vedere le modifiche.
`);
    } else {
      throw new Error('Write ha restituito false');
    }

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
