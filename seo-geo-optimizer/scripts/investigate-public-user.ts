/**
 * Investigazione Public User
 * Controlla chi è il "Public user" e come riesce a fare ordini
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

class OdooInvestigator {
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
          kwargs: { domain, fields, limit: options.limit || 100, order: options.order, context: options.context }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${model}: ${data.error.message}`);
    return data.result || [];
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 INVESTIGAZIONE "PUBLIC USER"');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooInvestigator();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // 1. Cerca l'utente "Public user"
    console.log('👤 RICERCA UTENTE "PUBLIC USER"');
    console.log('─'.repeat(60));

    const publicUsers = await odoo.searchRead<any>(
      'res.partner',
      [['name', 'ilike', 'public']],
      ['id', 'name', 'email', 'phone', 'street', 'city', 'country_id', 'create_date', 'user_id', 'company_id', 'is_company', 'parent_id'],
      { limit: 20 }
    );

    console.log(`\nTrovati ${publicUsers.length} partner con "public" nel nome:\n`);
    for (const user of publicUsers) {
      console.log(`   ID: ${user.id}`);
      console.log(`   Nome: ${user.name}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Telefono: ${user.phone || 'N/A'}`);
      console.log(`   Indirizzo: ${user.street || 'N/A'}, ${user.city || 'N/A'}`);
      console.log(`   Paese: ${user.country_id ? user.country_id[1] : 'N/A'}`);
      console.log(`   Creato: ${user.create_date}`);
      console.log(`   User ID (login): ${user.user_id ? user.user_id[1] : 'Nessun login associato'}`);
      console.log(`   Azienda: ${user.company_id ? user.company_id[1] : 'N/A'}`);
      console.log(`   È azienda: ${user.is_company ? 'Sì' : 'No'}`);
      console.log(`   Parent: ${user.parent_id ? user.parent_id[1] : 'N/A'}`);
      console.log('');
    }

    // 2. Cerca ordini da Public user
    console.log('\n📦 ORDINI DA "PUBLIC USER"');
    console.log('─'.repeat(60));

    const publicOrders = await odoo.searchRead<any>(
      'sale.order',
      [['partner_id.name', 'ilike', 'public']],
      ['id', 'name', 'partner_id', 'date_order', 'state', 'amount_total', 'create_uid', 'website_id', 'access_token', 'origin'],
      { limit: 20, order: 'create_date desc' }
    );

    console.log(`\nTrovati ${publicOrders.length} ordini da utenti "public":\n`);
    for (const order of publicOrders) {
      console.log(`   Ordine: ${order.name}`);
      console.log(`   Cliente: ${order.partner_id ? order.partner_id[1] : 'N/A'}`);
      console.log(`   Data: ${order.date_order}`);
      console.log(`   Stato: ${order.state}`);
      console.log(`   Totale: CHF ${order.amount_total}`);
      console.log(`   Creato da: ${order.create_uid ? order.create_uid[1] : 'N/A'}`);
      console.log(`   Website: ${order.website_id ? order.website_id[1] : 'N/A'}`);
      console.log(`   Origine: ${order.origin || 'N/A'}`);
      console.log(`   Access Token: ${order.access_token ? 'Sì (carrello web)' : 'No'}`);
      console.log('');
    }

    // 3. Controlla l'ordine specifico S36167
    console.log('\n🎯 DETTAGLIO ORDINE S36167');
    console.log('─'.repeat(60));

    const specificOrder = await odoo.searchRead<any>(
      'sale.order',
      [['name', '=', 'S36167']],
      ['id', 'name', 'partner_id', 'partner_invoice_id', 'partner_shipping_id',
       'date_order', 'create_date', 'state', 'amount_total', 'create_uid',
       'website_id', 'access_token', 'origin', 'note', 'client_order_ref',
       'campaign_id', 'source_id', 'medium_id', 'team_id'],
      { limit: 1 }
    );

    if (specificOrder.length > 0) {
      const order = specificOrder[0];
      console.log(`\n   Ordine: ${order.name}`);
      console.log(`   ID Ordine: ${order.id}`);
      console.log(`   Cliente (partner_id): ${order.partner_id ? `${order.partner_id[1]} (ID: ${order.partner_id[0]})` : 'N/A'}`);
      console.log(`   Indirizzo Fattura: ${order.partner_invoice_id ? order.partner_invoice_id[1] : 'N/A'}`);
      console.log(`   Indirizzo Consegna: ${order.partner_shipping_id ? order.partner_shipping_id[1] : 'N/A'}`);
      console.log(`   Data Ordine: ${order.date_order}`);
      console.log(`   Data Creazione: ${order.create_date}`);
      console.log(`   Stato: ${order.state}`);
      console.log(`   Totale: CHF ${order.amount_total}`);
      console.log(`   Creato da Utente: ${order.create_uid ? `${order.create_uid[1]} (ID: ${order.create_uid[0]})` : 'N/A'}`);
      console.log(`   Website: ${order.website_id ? order.website_id[1] : 'Nessuno (creato manualmente?)'}`);
      console.log(`   Origine: ${order.origin || 'N/A'}`);
      console.log(`   Note: ${order.note || 'N/A'}`);
      console.log(`   Rif. Cliente: ${order.client_order_ref || 'N/A'}`);
      console.log(`   Access Token: ${order.access_token ? 'Presente (carrello web attivo)' : 'Assente'}`);
      console.log(`   Campagna: ${order.campaign_id ? order.campaign_id[1] : 'N/A'}`);
      console.log(`   Sorgente: ${order.source_id ? order.source_id[1] : 'N/A'}`);
      console.log(`   Team Vendite: ${order.team_id ? order.team_id[1] : 'N/A'}`);

      // Cerca chi è il create_uid
      if (order.create_uid) {
        console.log('\n   📌 CREATORE ORDINE:');
        const creator = await odoo.searchRead<any>(
          'res.users',
          [['id', '=', order.create_uid[0]]],
          ['id', 'name', 'login', 'partner_id', 'groups_id'],
          { limit: 1 }
        );
        if (creator.length > 0) {
          console.log(`      Nome: ${creator[0].name}`);
          console.log(`      Login: ${creator[0].login}`);
          console.log(`      Partner: ${creator[0].partner_id ? creator[0].partner_id[1] : 'N/A'}`);
        }
      }
    }

    // 4. Verifica carrelli attivi (draft orders) da public user
    console.log('\n\n🛒 CARRELLI ATTIVI (DRAFT) DA PUBLIC USER');
    console.log('─'.repeat(60));

    const draftOrders = await odoo.searchRead<any>(
      'sale.order',
      [['state', '=', 'draft'], ['partner_id.name', 'ilike', 'public']],
      ['id', 'name', 'partner_id', 'create_date', 'amount_total', 'website_id', 'access_token'],
      { limit: 20, order: 'create_date desc' }
    );

    console.log(`\nCarrelli attivi: ${draftOrders.length}`);
    for (const cart of draftOrders) {
      console.log(`   ${cart.name} - CHF ${cart.amount_total} - Creato: ${cart.create_date}`);
    }

    // 5. Controlla configurazione website ecommerce
    console.log('\n\n⚙️ CONFIGURAZIONE WEBSITE E-COMMERCE');
    console.log('─'.repeat(60));

    const websites = await odoo.searchRead<any>(
      'website',
      [],
      ['id', 'name', 'domain', 'user_id', 'partner_id', 'auth_signup_uninvited'],
      { limit: 5 }
    );

    for (const site of websites) {
      console.log(`\n   Website: ${site.name}`);
      console.log(`   Dominio: ${site.domain || 'N/A'}`);
      console.log(`   Utente pubblico: ${site.user_id ? site.user_id[1] : 'N/A'}`);
      console.log(`   Partner pubblico: ${site.partner_id ? site.partner_id[1] : 'N/A'}`);
      console.log(`   Registrazione aperta: ${site.auth_signup_uninvited || 'N/A'}`);
    }

    console.log('\n\n' + '═'.repeat(80));
    console.log('📋 CONCLUSIONE');
    console.log('═'.repeat(80));
    console.log(`
"Public user" è l'utente ANONIMO predefinito di Odoo Website.
Quando qualcuno visita il sito senza fare login e aggiunge prodotti
al carrello, l'ordine viene associato a questo utente generico.

POSSIBILI CAUSE:
1. Qualcuno ha iniziato un ordine sul sito senza registrarsi
2. Un bot/crawler ha interagito con il carrello
3. Test interni fatti senza login
4. Configurazione B2B che permette ordini anonimi

RACCOMANDAZIONI:
- Se non vuoi ordini anonimi, vai in Website > Configurazione > eCommerce
  e disabilita "Checkout come ospite" o richiedi login obbligatorio
- Controlla i log di accesso al sito per vedere IP e user-agent
`);

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
  }
}

main();
