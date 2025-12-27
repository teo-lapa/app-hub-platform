/**
 * Collect Knowledge Base for LAPA Chatbot
 * Raccoglie informazioni su prodotti, categorie, FAQ e servizi per il chatbot AI
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

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
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🧠 LAPA - Raccolta Knowledge Base per Chatbot AI');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();
  const knowledge: any = {
    azienda: {},
    categorie: [],
    prodotti: [],
    servizi: [],
    faq: [],
    contatti: {}
  };

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // 1. Info azienda
    console.log('🏢 Raccolta info azienda...');
    knowledge.azienda = {
      nome: "LAPA",
      slogan: "Zero Pensieri - Specialisti in prodotti italiani in Svizzera",
      descrizione: "LAPA è il principale distributore di prodotti alimentari italiani autentici in Svizzera. Serviamo ristoranti, pizzerie, hotel e privati con ingredienti di alta qualità direttamente dall'Italia.",
      puntiForza: [
        "Prodotti 100% italiani autentici",
        "Consegna rapida in tutta la Svizzera",
        "Servizio B2B per ristoratori",
        "Catalogo con oltre 1000 prodotti",
        "Assistenza clienti dedicata",
        "Shop online 24/7"
      ],
      zona: "Svizzera (Zurigo, Berna, Basilea, Ginevra, Lugano e tutto il territorio)",
      lingue: ["Italiano", "Tedesco", "Francese"]
    };

    // 2. Categorie prodotti
    console.log('📦 Raccolta categorie prodotti...');
    try {
      const categories = await odoo.searchRead<any>(
        'product.public.category',
        [],
        ['id', 'name', 'display_name', 'parent_id'],
        { limit: 100 }
      );

      knowledge.categorie = categories.map(c => ({
        nome: c.display_name || c.name,
        parent: c.parent_id ? c.parent_id[1] : null
      }));
      console.log(`   Trovate ${categories.length} categorie`);
    } catch (e) {
      console.log('   Usando categorie predefinite...');
      knowledge.categorie = [
        { nome: "Pasta e Riso", parent: null },
        { nome: "Salumi e Formaggi", parent: null },
        { nome: "Olio e Condimenti", parent: null },
        { nome: "Conserve e Sughi", parent: null },
        { nome: "Dolci e Caffè", parent: null },
        { nome: "Vini e Bevande", parent: null },
        { nome: "Prodotti Freschi", parent: null }
      ];
    }

    // 3. Prodotti principali (top sellers e in evidenza)
    console.log('🍕 Raccolta prodotti...');
    try {
      const products = await odoo.searchRead<any>(
        'product.template',
        [['sale_ok', '=', true]],
        ['id', 'name', 'list_price', 'description_sale', 'default_code'],
        { limit: 200 }
      );

      knowledge.prodotti = products.map(p => ({
        nome: p.name,
        codice: p.default_code || '',
        prezzo: `CHF ${(p.list_price || 0).toFixed(2)}`,
        descrizione: stripHtml(p.description_sale || '').substring(0, 200)
      }));
      console.log(`   Trovati ${products.length} prodotti`);
    } catch (e) {
      console.log('   Usando prodotti di esempio...');
      knowledge.prodotti = [
        { nome: "Pasta Barilla", prezzo: "CHF 3.50", codice: "", descrizione: "Pasta italiana di qualità" },
        { nome: "Olio Extra Vergine", prezzo: "CHF 15.00", codice: "", descrizione: "Olio d'oliva italiano" },
        { nome: "Pomodori San Marzano", prezzo: "CHF 4.50", codice: "", descrizione: "Pomodori DOP" }
      ];
    }

    // 4. Servizi
    console.log('🛎️ Raccolta servizi...');
    knowledge.servizi = [
      {
        nome: "Consegna a domicilio",
        descrizione: "Consegniamo in tutta la Svizzera. Ordini effettuati entro le 12:00 vengono consegnati il giorno successivo nelle zone principali."
      },
      {
        nome: "Servizio B2B per ristoratori",
        descrizione: "Condizioni speciali per ristoranti, pizzerie, hotel e catering. Listino prezzi dedicato e account manager personale."
      },
      {
        nome: "Shop online",
        descrizione: "Acquista 24/7 sul nostro shop online. Pagamento sicuro con carta o fattura per clienti business."
      },
      {
        nome: "Consulenza prodotti",
        descrizione: "Il nostro team ti aiuta a scegliere i prodotti giusti per il tuo ristorante o per casa."
      },
      {
        nome: "Catalogo e campioni",
        descrizione: "Richiedi il nostro catalogo completo o campioni di prodotti per provare la qualità."
      }
    ];

    // 5. FAQ comuni
    console.log('❓ Creazione FAQ...');
    knowledge.faq = [
      {
        domanda: "Come posso ordinare?",
        risposta: "Puoi ordinare direttamente sul nostro shop online www.lapa.ch/shop, oppure contattarci telefonicamente o via email. Per i clienti business offriamo anche ordini via WhatsApp."
      },
      {
        domanda: "Quali sono i tempi di consegna?",
        risposta: "Ordini effettuati entro le 12:00 vengono generalmente consegnati il giorno lavorativo successivo nelle zone principali della Svizzera. Per zone più remote potrebbero essere necessari 2-3 giorni."
      },
      {
        domanda: "Qual è l'ordine minimo?",
        risposta: "Per i privati non c'è un ordine minimo. Per i clienti business (B2B) l'ordine minimo è di CHF 150 per la consegna gratuita."
      },
      {
        domanda: "Consegnate in tutta la Svizzera?",
        risposta: "Sì, consegniamo in tutta la Svizzera: Zurigo, Berna, Basilea, Ginevra, Lugano, Lucerna e tutte le altre città e comuni."
      },
      {
        domanda: "Come posso diventare cliente business/B2B?",
        risposta: "Contattaci via email o telefono con i dati della tua attività (nome, indirizzo, partita IVA). Ti creeremo un account business con listino prezzi dedicato e condizioni speciali."
      },
      {
        domanda: "Quali metodi di pagamento accettate?",
        risposta: "Accettiamo carte di credito (Visa, Mastercard), PostFinance, TWINT, e fattura per clienti business registrati."
      },
      {
        domanda: "I prodotti sono veramente italiani?",
        risposta: "Assolutamente sì! Tutti i nostri prodotti sono importati direttamente dall'Italia da produttori selezionati. Garantiamo autenticità e qualità 100% italiana."
      },
      {
        domanda: "Posso visitare il vostro magazzino?",
        risposta: "Sì, su appuntamento puoi visitare il nostro magazzino e vedere i prodotti. Contattaci per fissare una visita."
      },
      {
        domanda: "Fate consegne per eventi e catering?",
        risposta: "Certamente! Gestiamo ordini speciali per eventi, matrimoni, feste aziendali e catering. Contattaci con anticipo per organizzare la consegna."
      },
      {
        domanda: "Come posso contattarvi?",
        risposta: "Puoi contattarci via: Email (info@lapa.ch), Telefono, WhatsApp, o tramite il modulo di contatto sul sito. Rispondiamo entro 24 ore lavorative."
      }
    ];

    // 6. Contatti
    console.log('📞 Raccolta contatti...');
    knowledge.contatti = {
      email: "info@lapa.ch",
      sito: "www.lapa.ch",
      shop: "www.lapa.ch/shop",
      orari: "Lunedì-Venerdì 8:00-17:00",
      social: {
        linkedin: "LAPA",
        instagram: "@lapa_ch"
      }
    };

    // Salva knowledge base
    const outputPath = resolve(__dirname, 'chatbot-knowledge.json');
    writeFileSync(outputPath, JSON.stringify(knowledge, null, 2), 'utf-8');
    console.log(`\n✅ Knowledge base salvata in: ${outputPath}`);

    // Crea il system prompt per OpenAI
    const systemPrompt = `Sei l'assistente virtuale di LAPA, il principale distributore di prodotti alimentari italiani autentici in Svizzera.

INFORMAZIONI AZIENDA:
${JSON.stringify(knowledge.azienda, null, 2)}

CATEGORIE PRODOTTI DISPONIBILI:
${knowledge.categorie.map((c: any) => `- ${c.nome}`).join('\n')}

ALCUNI PRODOTTI POPOLARI:
${knowledge.prodotti.slice(0, 30).map((p: any) => `- ${p.nome} (${p.prezzo})`).join('\n')}

SERVIZI:
${knowledge.servizi.map((s: any) => `- ${s.nome}: ${s.descrizione}`).join('\n')}

FAQ FREQUENTI:
${knowledge.faq.map((f: any) => `D: ${f.domanda}\nR: ${f.risposta}`).join('\n\n')}

CONTATTI:
${JSON.stringify(knowledge.contatti, null, 2)}

ISTRUZIONI:
1. Rispondi sempre in modo cordiale e professionale
2. Se qualcuno chiede di prodotti specifici, indirizzalo allo shop: www.lapa.ch/shop
3. Per ordini B2B o richieste speciali, invita a contattare info@lapa.ch
4. Rispondi nella lingua in cui ti scrive l'utente (italiano, tedesco, francese o inglese)
5. Non inventare informazioni sui prezzi se non le conosci, rimanda allo shop
6. Sii conciso ma utile nelle risposte
7. Promuovi sempre la qualità italiana dei prodotti`;

    const promptPath = resolve(__dirname, 'chatbot-system-prompt.txt');
    writeFileSync(promptPath, systemPrompt, 'utf-8');
    console.log(`✅ System prompt salvato in: ${promptPath}`);

    console.log('\n' + '═'.repeat(80));
    console.log('📊 RIEPILOGO KNOWLEDGE BASE');
    console.log('═'.repeat(80));
    console.log(`
   🏢 Azienda: LAPA - Zero Pensieri
   📦 Categorie: ${knowledge.categorie.length}
   🍕 Prodotti: ${knowledge.prodotti.length}
   🛎️ Servizi: ${knowledge.servizi.length}
   ❓ FAQ: ${knowledge.faq.length}

   File generati:
   - chatbot-knowledge.json (dati strutturati)
   - chatbot-system-prompt.txt (prompt per OpenAI)
`);

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
