const ODOO = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  user: 'paul@lapa.ch',
  pass: 'lapa201180'
};

let sid = '';

async function auth() {
  const r = await fetch(ODOO.url + '/web/session/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { db: ODOO.db, login: ODOO.user, password: ODOO.pass }, id: 1 })
  });
  const cookie = r.headers.get('set-cookie');
  if (cookie) {
    const match = cookie.match(/session_id=([^;]+)/);
    if (match) sid = match[1];
  }
  console.log('Auth:', sid ? 'OK' : 'FAILED');
}

async function writeWithLang(id, values, lang) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'write',
        args: [[id], values],
        kwargs: { context: { lang: lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json());
}

// Traduzioni inglesi per tutti i 15 articoli
const translations = [
  {
    id: 75,
    name: "How to Choose the Right Supplier for Your Pizzeria in Switzerland",
    subtitle: "Complete guide to selecting the ideal wholesaler for quality Italian ingredients"
  },
  {
    id: 76,
    name: "Complete Guide: Opening an Italian Restaurant in Switzerland",
    subtitle: "Everything you need to know to start your Italian dining business"
  },
  {
    id: 77,
    name: "Buffalo Mozzarella vs Fior di Latte: The Differences",
    subtitle: "Complete guide to choosing the right mozzarella for every dish"
  },
  {
    id: 78,
    name: "The 10 Essential Products for Pizzerias",
    subtitle: "The complete list of ingredients every pizzeria must have"
  },
  {
    id: 79,
    name: "How to Choose an Italian Products Wholesaler",
    subtitle: "The fundamental criteria for selecting the ideal supplier for your restaurant"
  },
  {
    id: 80,
    name: "Guanciale vs Pancetta: What's the Difference",
    subtitle: "Complete guide to understanding when to use guanciale or pancetta in your dishes"
  },
  {
    id: 81,
    name: "How to Properly Store Fresh Italian Products",
    subtitle: "Practical guide to maintaining the quality of mozzarella, cured meats and other fresh products"
  },
  {
    id: 82,
    name: "Extra Virgin Olive Oil: Selection Guide for Restaurants",
    subtitle: "How to select the right oil for every dish on your menu"
  },
  {
    id: 83,
    name: "Fresh Pasta vs Dry Pasta: Guide for Restaurateurs",
    subtitle: "When to use fresh pasta and when to use dry pasta in your restaurant"
  },
  {
    id: 84,
    name: "Italian DOP Cheeses Every Restaurant Must Have",
    subtitle: "The definitive guide to certified Italian cheeses for the restaurant industry"
  },
  {
    id: 85,
    name: "Tomatoes for Pizza: San Marzano and Quality Alternatives",
    subtitle: "How to choose the right tomatoes for your Neapolitan pizza"
  },
  {
    id: 86,
    name: "Essential Equipment for a Pizzeria: The Complete List",
    subtitle: "Everything you need to start and run a successful pizzeria"
  },
  {
    id: 87,
    name: "Italian Cured Meats for Restaurants: Complete Guide",
    subtitle: "From selection to storage: everything about Italian cured meats for the restaurant industry"
  },
  {
    id: 88,
    name: "How to Create an Authentic Italian Menu for Your Restaurant",
    subtitle: "Practical tips for building a menu that represents true Italian cuisine"
  },
  {
    id: 89,
    name: "Fresh Product Delivery: What to Look for in a Supplier",
    subtitle: "The fundamental criteria to ensure fresh product quality in your restaurant"
  }
];

async function main() {
  await auth();

  console.log('\n=== TRADUZIONI INGLESI (en_US) ===\n');

  for (const t of translations) {
    console.log(`Articolo ${t.id}...`);
    const result = await writeWithLang(t.id, { name: t.name, subtitle: t.subtitle }, 'en_US');
    if (result.result === true) {
      console.log(`  OK: ${t.name.substring(0, 50)}...`);
    } else {
      console.log(`  ERRORE:`, result.error);
    }
  }

  console.log('\n=== TRADUZIONI INGLESI COMPLETATE ===');
}

main();
