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

// Traduzioni tedesche per tutti i 15 articoli
const translations = [
  {
    id: 75,
    name: "So wählen Sie den richtigen Lieferanten für Ihre Pizzeria in der Schweiz",
    subtitle: "Vollständiger Leitfaden zur Auswahl des idealen Grosshändlers für italienische Qualitätszutaten"
  },
  {
    id: 76,
    name: "Vollständiger Leitfaden: Ein italienisches Restaurant in der Schweiz eröffnen",
    subtitle: "Alles, was Sie wissen müssen, um Ihr italienisches Gastronomieunternehmen zu starten"
  },
  {
    id: 77,
    name: "Büffelmozzarella vs. Fior di Latte: Die Unterschiede",
    subtitle: "Vollständiger Leitfaden zur Auswahl des richtigen Mozzarellas für jedes Gericht"
  },
  {
    id: 78,
    name: "Die 10 unverzichtbaren Produkte für Pizzerien",
    subtitle: "Die vollständige Liste der Zutaten, die jede Pizzeria haben muss"
  },
  {
    id: 79,
    name: "So wählen Sie einen Grosshändler für italienische Produkte",
    subtitle: "Die grundlegenden Kriterien für die Auswahl des idealen Lieferanten für Ihr Restaurant"
  },
  {
    id: 80,
    name: "Guanciale vs. Pancetta: Was ist der Unterschied",
    subtitle: "Vollständiger Leitfaden, um zu verstehen, wann Sie Guanciale oder Pancetta in Ihren Gerichten verwenden"
  },
  {
    id: 81,
    name: "So lagern Sie italienische Frischprodukte richtig",
    subtitle: "Praktischer Leitfaden zur Erhaltung der Qualität von Mozzarella, Wurstwaren und anderen Frischprodukten"
  },
  {
    id: 82,
    name: "Natives Olivenöl Extra: Auswahlhilfe für Restaurants",
    subtitle: "So wählen Sie das richtige Öl für jedes Gericht auf Ihrer Speisekarte"
  },
  {
    id: 83,
    name: "Frische Pasta vs. Trockene Pasta: Leitfaden für Gastronomen",
    subtitle: "Wann Sie frische Pasta und wann trockene Pasta in Ihrem Restaurant verwenden sollten"
  },
  {
    id: 84,
    name: "Die italienischen DOP-Käse, die jedes Restaurant haben muss",
    subtitle: "Der ultimative Leitfaden zu zertifizierten italienischen Käsesorten für die Gastronomie"
  },
  {
    id: 85,
    name: "Tomaten für Pizza: San Marzano und Qualitätsalternativen",
    subtitle: "So wählen Sie die richtigen Tomaten für Ihre neapolitanische Pizza"
  },
  {
    id: 86,
    name: "Unverzichtbare Ausstattung für eine Pizzeria: Die vollständige Liste",
    subtitle: "Alles, was Sie brauchen, um eine erfolgreiche Pizzeria zu starten und zu führen"
  },
  {
    id: 87,
    name: "Italienische Wurstwaren für Restaurants: Vollständiger Leitfaden",
    subtitle: "Von der Auswahl bis zur Lagerung: Alles über italienische Wurstwaren für die Gastronomie"
  },
  {
    id: 88,
    name: "So erstellen Sie eine authentische italienische Speisekarte für Ihr Restaurant",
    subtitle: "Praktische Tipps zum Aufbau einer Speisekarte, die die echte italienische Küche repräsentiert"
  },
  {
    id: 89,
    name: "Lieferung von Frischprodukten: Worauf Sie bei einem Lieferanten achten sollten",
    subtitle: "Die grundlegenden Kriterien zur Sicherung der Qualität von Frischprodukten in Ihrem Restaurant"
  }
];

async function main() {
  await auth();

  console.log('\n=== TRADUZIONI TEDESCHE (de_CH) ===\n');

  for (const t of translations) {
    console.log(`Articolo ${t.id}...`);
    const result = await writeWithLang(t.id, { name: t.name, subtitle: t.subtitle }, 'de_CH');
    if (result.result === true) {
      console.log(`  OK: ${t.name.substring(0, 50)}...`);
    } else {
      console.log(`  ERRORE:`, result.error);
    }
  }

  console.log('\n=== TRADUZIONI TEDESCHE COMPLETATE ===');
}

main();
