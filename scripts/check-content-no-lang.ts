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

async function searchRead(
  model: string,
  domain: any[],
  fields: string[]
): Promise<any[]> {
  const response = await fetch(
    `${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`,
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
          method: "search_read",
          args: [],
          kwargs: {
            domain: domain,
            fields: fields,
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
  console.log("Controllo contenuto senza contesto lingua...\n");

  sessionId = await authenticate();

  const articles = await searchRead(
    "blog.post",
    [["id", ">=", 75], ["id", "<=", 89]],
    ["id", "name", "content"]
  );

  articles.sort((a, b) => a.id - b.id);

  console.log(`Trovati ${articles.length} articoli\n`);

  // Mostra i primi 3 in dettaglio
  for (let i = 0; i < Math.min(3, articles.length); i++) {
    const article = articles[i];
    console.log(`\n=== ID ${article.id} ===`);
    console.log(`Titolo: ${article.name}`);
    console.log(`Content length: ${article.content?.length || 0}`);
    console.log(`Content type: ${typeof article.content}`);
    console.log(`Content preview (primi 500 caratteri):`);
    console.log(article.content?.substring(0, 500) || "[VUOTO]");
    console.log("\n" + "-".repeat(80));
  }
}

main();
