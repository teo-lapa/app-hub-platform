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

async function searchReadWithLang(
  model: string,
  domain: any[],
  fields: string[],
  lang: string
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
  console.log("========================================");
  console.log("VERIFICA TRADUZIONI CON SEARCH_READ");
  console.log("========================================\n");

  sessionId = await authenticate();

  // Leggi tutti gli articoli in italiano
  console.log("Lettura articoli in ITALIANO...\n");
  const itArticles = await searchReadWithLang(
    "blog.post",
    [["id", ">=", 75], ["id", "<=", 89]],
    ["id", "name", "content"],
    "it_IT"
  );

  // Leggi tutti gli articoli in inglese
  console.log("Lettura articoli in INGLESE...\n");
  const enArticles = await searchReadWithLang(
    "blog.post",
    [["id", ">=", 75], ["id", "<=", 89]],
    ["id", "name", "content"],
    "en_US"
  );

  // Ordina per ID
  itArticles.sort((a, b) => a.id - b.id);
  enArticles.sort((a, b) => a.id - b.id);

  console.log("Confronto traduzioni:\n");

  let successCount = 0;
  let sameCount = 0;
  let emptyCount = 0;

  for (let i = 0; i < itArticles.length; i++) {
    const itArticle = itArticles[i];
    const enArticle = enArticles[i];

    const itContent = itArticle.content || "";
    const enContent = enArticle.content || "";

    let status = "";
    if (itContent.length <= 10 || enContent.length <= 10) {
      status = "✗ VUOTO";
      emptyCount++;
    } else if (itContent === enContent) {
      status = "⚠ UGUALI";
      sameCount++;
    } else {
      status = "✓ TRADOTTI";
      successCount++;
    }

    console.log(`ID ${itArticle.id}: ${status}`);
    console.log(`  IT: ${itContent.length} caratteri - ${itContent.substring(0, 80).replace(/\n/g, " ")}...`);
    console.log(`  EN: ${enContent.length} caratteri - ${enContent.substring(0, 80).replace(/\n/g, " ")}...`);
    console.log();
  }

  console.log("========================================");
  console.log("RIEPILOGO:");
  console.log(`✓ Articoli tradotti correttamente: ${successCount}`);
  console.log(`⚠ Articoli con contenuto uguale: ${sameCount}`);
  console.log(`✗ Articoli vuoti: ${emptyCount}`);
  console.log(`📊 Totale: ${itArticles.length}`);
  console.log("========================================");
}

main();
