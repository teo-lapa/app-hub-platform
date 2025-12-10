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

// Traduzioni francesi per tutti i 15 articoli
const translations = [
  {
    id: 75,
    name: "Comment choisir le bon fournisseur pour votre pizzeria en Suisse",
    subtitle: "Guide complet pour choisir le grossiste idéal pour des ingrédients italiens de qualité"
  },
  {
    id: 76,
    name: "Guide complet : Ouvrir un restaurant italien en Suisse",
    subtitle: "Tout ce que vous devez savoir pour lancer votre activité de restauration italienne"
  },
  {
    id: 77,
    name: "Mozzarella di Bufala vs Fior di Latte : Les différences",
    subtitle: "Guide complet pour choisir la bonne mozzarella pour chaque plat"
  },
  {
    id: 78,
    name: "Les 10 produits essentiels pour les pizzerias",
    subtitle: "La liste complète des ingrédients que chaque pizzeria doit avoir"
  },
  {
    id: 79,
    name: "Comment choisir un grossiste de produits italiens",
    subtitle: "Les critères fondamentaux pour sélectionner le fournisseur idéal pour votre restaurant"
  },
  {
    id: 80,
    name: "Guanciale vs Pancetta : Quelle est la différence",
    subtitle: "Guide complet pour comprendre quand utiliser le guanciale ou la pancetta dans vos plats"
  },
  {
    id: 81,
    name: "Comment conserver correctement les produits frais italiens",
    subtitle: "Guide pratique pour maintenir la qualité de la mozzarella, charcuterie et autres produits frais"
  },
  {
    id: 82,
    name: "Huile d'olive extra vierge : Guide de choix pour les restaurants",
    subtitle: "Comment sélectionner la bonne huile pour chaque plat de votre menu"
  },
  {
    id: 83,
    name: "Pâtes fraîches vs Pâtes sèches : Guide pour les restaurateurs",
    subtitle: "Quand utiliser des pâtes fraîches et quand utiliser des pâtes sèches dans votre restaurant"
  },
  {
    id: 84,
    name: "Les fromages DOP italiens que chaque restaurant doit avoir",
    subtitle: "Le guide définitif des fromages italiens certifiés pour la restauration"
  },
  {
    id: 85,
    name: "Tomates pour pizza : San Marzano et alternatives de qualité",
    subtitle: "Comment choisir les bonnes tomates pour votre pizza napolitaine"
  },
  {
    id: 86,
    name: "Équipements essentiels pour une pizzeria : La liste complète",
    subtitle: "Tout ce dont vous avez besoin pour démarrer et gérer une pizzeria à succès"
  },
  {
    id: 87,
    name: "La charcuterie italienne pour restaurants : Guide complet",
    subtitle: "De la sélection à la conservation : tout sur la charcuterie italienne pour la restauration"
  },
  {
    id: 88,
    name: "Comment créer un menu italien authentique pour votre restaurant",
    subtitle: "Conseils pratiques pour construire un menu qui représente la vraie cuisine italienne"
  },
  {
    id: 89,
    name: "Livraison de produits frais : Ce qu'il faut rechercher chez un fournisseur",
    subtitle: "Les critères fondamentaux pour garantir la qualité des produits frais dans votre restaurant"
  }
];

async function main() {
  await auth();

  console.log('\n=== TRADUZIONI FRANCESI (fr_CH) ===\n');

  for (const t of translations) {
    console.log(`Articolo ${t.id}...`);
    const result = await writeWithLang(t.id, { name: t.name, subtitle: t.subtitle }, 'fr_CH');
    if (result.result === true) {
      console.log(`  OK: ${t.name.substring(0, 50)}...`);
    } else {
      console.log(`  ERRORE:`, result.error);
    }
  }

  console.log('\n=== TRADUZIONI FRANCESI COMPLETATE ===');
}

main();
