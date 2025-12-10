const ODOO_CONFIG = {
  url: "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com",
  db: "lapadevadmin-lapa-v2-main-7268478",
  username: "paul@lapa.ch",
  password: "lapa201180",
};

let sessionId: string = "";

async function authenticate(): Promise<string> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password,
      },
      id: Date.now(),
    }),
  });

  const setCookie = response.headers.get("set-cookie");
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
  if (!sessionMatch) throw new Error("Could not extract session_id");
  return sessionMatch[1];
}

async function readWithLang(model: string, ids: number[], fields: string[], lang: string): Promise<any[]> {
  const response = await fetch(
    `${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/read`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: model,
          method: "read",
          args: [ids],
          kwargs: {
            fields: fields,
            context: { lang: lang },
          },
        },
        id: Date.now(),
      }),
    }
  );

  const data: any = await response.json();
  if (data.error) throw new Error(`Odoo error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function main() {
  console.log("Verifica traduzioni...\n");

  sessionId = await authenticate();
  console.log("✓ Autenticato\n");

  // Prima controlliamo quali campi esistono per blog.post
  const testId = 75;

  // Leggi tutti i campi per capire la struttura
  const [fullRecord] = await readWithLang("blog.post", [testId], [], "it_IT");
  console.log("Campi disponibili per blog.post:");
  console.log(Object.keys(fullRecord).join(", "));

  // Cerca il campo del contenuto
  const contentFields = Object.keys(fullRecord).filter(k =>
    k.includes('content') || k.includes('body') || k.includes('text')
  );
  console.log("\nCampi relativi al contenuto:", contentFields);

  // Verifica articolo 75 in tutte le lingue
  console.log('\n--- Articolo ID 75 - TUTTE LE LINGUE ---');

  const langs = [
    { code: 'it_IT', name: 'IT' },
    { code: 'de_CH', name: 'DE' },
    { code: 'fr_CH', name: 'FR' },
    { code: 'en_US', name: 'EN' }
  ];

  for (const lang of langs) {
    const [version] = await readWithLang("blog.post", [75], ["name", "content"], lang.code);
    const contentPreview = (version.content || '').replace(/<[^>]*>/g, '').substring(0, 60);
    console.log(`\n[${lang.name}] ${version.name}`);
    console.log(`    Contenuto: ${contentPreview}...`);
  }

  console.log('\n========================================');
  console.log('VERIFICA COMPLETATA');
  console.log('========================================');
}

main();
