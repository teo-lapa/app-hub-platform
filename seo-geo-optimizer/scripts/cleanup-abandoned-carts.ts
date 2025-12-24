/**
 * Cleanup Abandoned Carts Script
 * Elimina i carrelli abbandonati dei "Public user" (utenti anonimi)
 *
 * Uso: npx tsx scripts/cleanup-abandoned-carts.ts [--dry-run] [--days=7]
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

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DAYS_ARG = args.find(a => a.startsWith('--days='));
const DAYS_OLD = DAYS_ARG ? parseInt(DAYS_ARG.split('=')[1]) : 7;

class OdooCleaner {
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
          kwargs: { domain, fields, limit: options.limit || 1000, order: options.order }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${model}: ${data.error.message}`);
    return data.result || [];
  }

  async unlink(model: string, ids: number[]): Promise<boolean> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'unlink', args: [ids], kwargs: {} },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || false;
  }

  async cancelOrder(ids: number[]): Promise<boolean> {
    if (!this.uid) await this.authenticate();

    // First cancel the order, then delete
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model: 'sale.order', method: 'action_cancel', args: [ids], kwargs: {} },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) {
      // If cancel fails, try to delete directly (for draft orders)
      return this.unlink('sale.order', ids);
    }
    return true;
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🧹 LAPA - Pulizia Carrelli Abbandonati');
  console.log('═'.repeat(80));
  console.log('');

  if (DRY_RUN) {
    console.log('⚠️  MODALITÀ DRY-RUN: Nessuna modifica verrà effettuata\n');
  }

  console.log(`📅 Cercando carrelli più vecchi di ${DAYS_OLD} giorni...\n`);

  const odoo = new OdooCleaner();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // Calculate date threshold
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_OLD);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Find Public user partner ID
    console.log('👤 Ricerca utenti "Public user"...');
    const publicPartners = await odoo.searchRead<any>(
      'res.partner',
      [['name', 'ilike', 'public user']],
      ['id', 'name'],
      { limit: 10 }
    );

    if (publicPartners.length === 0) {
      console.log('   Nessun "Public user" trovato.\n');
    } else {
      console.log(`   Trovati ${publicPartners.length} partner "Public user"\n`);
    }

    const publicPartnerIds = publicPartners.map(p => p.id);

    // Find abandoned carts (draft orders from public users)
    console.log('🛒 Ricerca carrelli abbandonati...');

    const domain: any[] = [
      ['state', '=', 'draft'],  // Only draft orders (carts)
    ];

    // Add partner filter if we found public users
    if (publicPartnerIds.length > 0) {
      domain.push(['partner_id', 'in', publicPartnerIds]);
    } else {
      // Fallback: search by partner name
      domain.push(['partner_id.name', 'ilike', 'public']);
    }

    // Add date filter
    domain.push(['create_date', '<', cutoffDateStr]);

    const abandonedCarts = await odoo.searchRead<any>(
      'sale.order',
      domain,
      ['id', 'name', 'partner_id', 'create_date', 'amount_total', 'website_id'],
      { limit: 500, order: 'create_date asc' }
    );

    console.log(`\n📊 Risultati:`);
    console.log(`   Carrelli abbandonati trovati: ${abandonedCarts.length}`);

    if (abandonedCarts.length === 0) {
      console.log('\n✅ Nessun carrello da eliminare!');

      // Show recent carts for info
      console.log('\n📋 Carrelli recenti (ultimi 7 giorni) da Public user:');
      const recentCarts = await odoo.searchRead<any>(
        'sale.order',
        [
          ['state', '=', 'draft'],
          ['partner_id.name', 'ilike', 'public']
        ],
        ['id', 'name', 'partner_id', 'create_date', 'amount_total'],
        { limit: 20, order: 'create_date desc' }
      );

      if (recentCarts.length > 0) {
        for (const cart of recentCarts) {
          const date = new Date(cart.create_date).toLocaleDateString('it-CH');
          console.log(`   ${cart.name} | ${date} | CHF ${cart.amount_total.toFixed(2)} | ${cart.partner_id[1]}`);
        }
        console.log(`\n💡 Questi carrelli sono recenti. Usa --days=1 per eliminarli.`);
      } else {
        console.log('   Nessun carrello recente trovato.');
      }

      return;
    }

    // Show carts to be deleted
    console.log('\n📋 Carrelli da eliminare:');
    console.log('─'.repeat(80));

    let totalAmount = 0;
    for (const cart of abandonedCarts.slice(0, 20)) {
      const date = new Date(cart.create_date).toLocaleDateString('it-CH');
      const time = new Date(cart.create_date).toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' });
      console.log(`   ${cart.name} | ${date} ${time} | CHF ${cart.amount_total.toFixed(2)} | ${cart.partner_id[1]}`);
      totalAmount += cart.amount_total;
    }

    if (abandonedCarts.length > 20) {
      console.log(`   ... e altri ${abandonedCarts.length - 20} carrelli`);
    }

    console.log('─'.repeat(80));
    console.log(`   Totale valore carrelli: CHF ${totalAmount.toFixed(2)}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY-RUN: Nessun carrello eliminato.');
      console.log('   Rimuovi --dry-run per eliminare effettivamente i carrelli.');
      return;
    }

    // Delete carts
    console.log('\n🗑️  Eliminazione carrelli in corso...');

    const cartIds = abandonedCarts.map(c => c.id);
    let deleted = 0;
    let errors = 0;

    // Delete in batches of 50
    const batchSize = 50;
    for (let i = 0; i < cartIds.length; i += batchSize) {
      const batch = cartIds.slice(i, i + batchSize);
      try {
        await odoo.unlink('sale.order', batch);
        deleted += batch.length;
        process.stdout.write(`\r   Eliminati: ${deleted}/${cartIds.length}`);
      } catch (err) {
        // Try one by one if batch fails
        for (const id of batch) {
          try {
            await odoo.unlink('sale.order', [id]);
            deleted++;
          } catch {
            errors++;
          }
        }
      }
    }

    console.log('\n');
    console.log('═'.repeat(80));
    console.log('📊 RIEPILOGO');
    console.log('═'.repeat(80));
    console.log(`   ✅ Carrelli eliminati: ${deleted}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log(`   💰 Valore liberato: CHF ${totalAmount.toFixed(2)}`);

    console.log('\n✨ Pulizia completata!');

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
