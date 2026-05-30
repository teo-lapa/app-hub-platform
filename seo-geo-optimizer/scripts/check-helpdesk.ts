/**
 * Check Helpdesk Module in Odoo
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || (process.env.ODOO_PASSWORD || '');

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
}

async function main() {
  console.log('â•'.repeat(60));
  console.log('ðŸŽ« Verifica Modulo Helpdesk');
  console.log('â•'.repeat(60));

  const odoo = new OdooAPI();

  try {
    await odoo.authenticate();
    console.log('âœ… Connesso\n');

    // Check helpdesk.ticket model
    console.log('ðŸ“‹ Verifica modello helpdesk.ticket...');
    const fields = await odoo.fieldsGet('helpdesk.ticket');

    if (fields) {
      console.log('âœ… Helpdesk ATTIVO!\n');
      console.log('Campi principali:');
      const mainFields = ['name', 'description', 'partner_id', 'partner_email', 'partner_name', 'team_id', 'stage_id', 'user_id', 'priority'];
      for (const f of mainFields) {
        if (fields[f]) {
          console.log(`   - ${f}: ${fields[f].string} (${fields[f].type})`);
        }
      }

      // Cerca team helpdesk
      console.log('\nðŸ“‚ Team Helpdesk disponibili:');
      const teams = await odoo.searchRead<any>(
        'helpdesk.team',
        [],
        ['id', 'name', 'use_website_helpdesk_form'],
        { limit: 10 }
      );

      for (const team of teams) {
        console.log(`   - ${team.name} (ID: ${team.id}) - Form web: ${team.use_website_helpdesk_form ? 'SÃ¬' : 'No'}`);
      }

      // Cerca stage
      console.log('\nðŸ“Š Stage ticket:');
      const stages = await odoo.searchRead<any>(
        'helpdesk.stage',
        [],
        ['id', 'name', 'sequence'],
        { limit: 10, order: 'sequence' }
      );

      for (const stage of stages) {
        console.log(`   - ${stage.name} (ID: ${stage.id})`);
      }

    } else {
      console.log('âŒ Helpdesk NON disponibile');
    }

  } catch (error) {
    console.error('âŒ Errore:', error instanceof Error ? error.message : error);
  }
}

main();
